const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const { subDays, startOfDay } = require('date-fns');

// Load Env
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/groona_dev';

const runAlerts = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('MongoDB Connected');

        const { Timesheet, Notification, User } = require('../models/SchemaDefinitions');

        console.log(`\n=== PENDING TIMESHEET CHECK (> 7 Days) ===`);

        // Calculate threshold (7 days ago from now)
        const thresholdDate = subDays(new Date(), 7);
        const todayStart = startOfDay(new Date());

        console.log(`Checking entries pending since before: ${thresholdDate.toISOString()}`);

        // 1. Find all pending timesheets (pending_pm or pending_admin) created > 7 days ago
        const pendingTimesheets = await Timesheet.find({
            status: { $in: ['pending_pm', 'pending_admin'] },
            created_date: { $lte: thresholdDate }
        });

        if (pendingTimesheets.length === 0) {
            console.log('No pending timesheets older than 7 days found.');
            process.exit(0);
        }

        console.log(`Found ${pendingTimesheets.length} stale pending entries.`);

        // 2. Group by user to avoid multiple notifications per user
        const userGroups = {};
        pendingTimesheets.forEach(ts => {
            if (!userGroups[ts.user_email]) {
                userGroups[ts.user_email] = {
                    count: 0,
                    tenant_id: ts.tenant_id,
                    entries: []
                };
            }
            userGroups[ts.user_email].count++;
            userGroups[ts.user_email].entries.push(ts);
        });

        for (const [email, data] of Object.entries(userGroups)) {
            console.log(`Processing user: ${email} (${data.count} entries)`);

            try {
                // Find user_id
                const user = await User.findOne({ email });
                if (!user) {
                    console.log(`   [SKIP] User not found for email: ${email}`);
                    continue;
                }

                // 3. Check if we already sent a 'pending_timesheet_alert' TODAY
                const existingNotification = await Notification.findOne({
                    recipient_email: email,
                    type: 'pending_timesheet_alert',
                    created_date: { $gte: todayStart }
                });

                if (existingNotification) {
                    console.log(`   [SKIP] Alert already sent to ${email} today.`);
                    continue;
                }

                // 4. Create In-App Notification
                const title = 'Action Required: Stale Pending Timesheet';
                const message = data.count === 1
                    ? `Your timesheet for ${new Date(data.entries[0].date).toLocaleDateString()} has been pending for over 7 days. Please check with your manager.`
                    : `You have ${data.count} timesheets that have been pending for over 7 days. Please check with your manager.`;

                await Notification.create({
                    tenant_id: data.tenant_id,
                    recipient_email: email,
                    user_id: user._id,
                    type: 'pending_timesheet_alert',
                    category: 'alert',
                    title: title,
                    message: message,
                    status: 'OPEN',
                    read: false,
                    sender_name: 'System',
                    created_date: new Date()
                });

                console.log(`   [SUCCESS] Alert sent to ${email}`);

            } catch (err) {
                console.error(`   [ERROR] Failed to process user ${email}:`, err.message);
            }
        }

        console.log('\n=== PM APPROVAL BACKLOG CHECK ===');

        const allPendingPM = await Timesheet.find({ status: 'pending_pm' });
        console.log(`Found ${allPendingPM.length} total entries pending PM approval.`);

        if (allPendingPM.length > 0) {
            const { ProjectUserRole } = require('../models/SchemaDefinitions');

            // 1. Group pending entries by project
            const projectCounts = {};
            allPendingPM.forEach(ts => {
                const pid = String(ts.project_id);
                projectCounts[pid] = (projectCounts[pid] || 0) + 1;
            });

            // 2. Find PMs for these projects
            const pmBacklogs = {}; // { pmEmail: count }
            const projectIds = Object.keys(projectCounts);

            for (const projectId of projectIds) {
                const pmRoles = await ProjectUserRole.find({
                    project_id: projectId,
                    role: 'project_manager'
                });

                pmRoles.forEach(role => {
                    const pmEmail = role.user_email;
                    pmBacklogs[pmEmail] = (pmBacklogs[pmEmail] || 0) + projectCounts[projectId];
                });
            }

            // 3. Notify each PM
            for (const [pmEmail, count] of Object.entries(pmBacklogs)) {
                console.log(`Processing PM: ${pmEmail} (${count} pending approvals)`);

                try {
                    const pmUser = await User.findOne({ email: pmEmail });
                    if (!pmUser) {
                        console.log(`   [SKIP] PM user record not found: ${pmEmail}`);
                        continue;
                    }

                    // Daily guard for PM summary
                    const pmExistingNotif = await Notification.findOne({
                        recipient_email: pmEmail,
                        type: 'pending_pm_summary',
                        created_date: { $gte: todayStart }
                    });

                    if (pmExistingNotif) {
                        console.log(`   [SKIP] PM summary already sent to ${pmEmail} today.`);
                        continue;
                    }

                    await Notification.create({
                        tenant_id: pmUser.tenant_id,
                        recipient_email: pmEmail,
                        user_id: pmUser._id,
                        type: 'pending_pm_summary',
                        category: 'general',
                        title: 'Timesheet Approvals Pending',
                        message: `You have ${count} timesheet entries waiting for your approval. Please review them in your dashboard.`,
                        status: 'OPEN',
                        read: false,
                        sender_name: 'System',
                        created_date: new Date()
                    });

                    console.log(`   [SUCCESS] PM summary sent to ${pmEmail}`);

                } catch (pmErr) {
                    console.error(`   [ERROR] Failed to notify PM ${pmEmail}:`, pmErr.message);
                }
            }
        }

        console.log('\n=== ALL PENDING CHECKS COMPLETE ===');
        process.exit(0);
    } catch (err) {
        console.error('Core script error:', err);
        process.exit(1);
    }
};

runAlerts();
