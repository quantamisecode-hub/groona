const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('../config/db');
const path = require('path');

// Load Env
dotenv.config({ path: path.join(__dirname, '../.env') });

const runChecks = async () => {
    try {
        await connectDB();
        const Models = require('../models/SchemaDefinitions');
        const Notification = Models.Notification;
        const User = Models.User;
        const UserActivityLog = Models.UserActivityLog;

        console.log('\n=== MISSING TIMESHEET CHECK (24h Rule | Assigned vs Submitted) ===');

        const users = await User.find({
            status: { $ne: 'inactive' },
            $or: [
                { role: 'member', custom_role: 'viewer' },
                { role: 'admin', custom_role: 'project_manager' }
            ]
        });
        console.log(`Checking ${users.length} active users...`);

        const REQUIRED_MINUTES = 480; // 8 Hours

        for (const user of users) {
            const now = new Date();
            const currentHour = now.getHours();
            let checkDate = new Date(now);
            if (currentHour < 18) {
                checkDate.setDate(checkDate.getDate() - 1);
            }
            checkDate.setHours(0, 0, 0, 0);

            const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            firstOfMonth.setHours(0, 0, 0, 0);

            let firstMissingDateStr = null;

            while (checkDate >= firstOfMonth) {
                // Skip Sundays
                if (checkDate.getDay() === 0) {
                    checkDate.setDate(checkDate.getDate() - 1);
                    continue;
                }

                const y = checkDate.getFullYear();
                const m = String(checkDate.getMonth() + 1).padStart(2, '0');
                const d = String(checkDate.getDate()).padStart(2, '0');
                const dateStr = `${y}-${m}-${d}`;

                const startOfTarget = new Date(`${dateStr}T00:00:00.000Z`);
                const endOfTarget = new Date(`${dateStr}T23:59:59.999Z`);

                const UserTimesheets = Models.User_timesheets;
                const dayRecord = await UserTimesheets.findOne({
                    user_email: user.email,
                    timesheet_date: { $gte: startOfTarget, $lte: endOfTarget }
                });

                const totalMinutes = dayRecord ? dayRecord.total_time_submitted_in_day : 0;

                if (totalMinutes < REQUIRED_MINUTES) {
                    firstMissingDateStr = dateStr;
                    break;
                }

                checkDate.setDate(checkDate.getDate() - 1);
            }

            console.log(`[CHECK] ${user.email} - First Missing Day: ${firstMissingDateStr || 'None'}`);

            if (firstMissingDateStr) {
                console.log(`   -> [ALERT] Incomplete for ${firstMissingDateStr}.`);

                const existingAlert = await Notification.findOne({
                    user_id: user._id,
                    type: 'timesheet_missing_alert',
                    status: 'OPEN'
                });

                if (!existingAlert) {
                    await Notification.create({
                        tenant_id: user.tenant_id || 'default',
                        recipient_email: user.email,
                        user_id: user._id,
                        rule_id: 'TIMESHEET_MANDATORY_EIGHT_HOURS',
                        scope: 'user',
                        status: 'OPEN',
                        type: 'timesheet_missing_alert',
                        category: 'alert',
                        title: 'Missing Timesheet Entry Required',
                        message: `Mandatory: 8 hours required for ${firstMissingDateStr}. Please log your pending hours.`,
                        read: false,
                        created_date: new Date()
                    });
                    console.log(`      -> Created Notif`);
                } else {
                    console.log(`      -> Alert already active.`);
                }
            } else {
                console.log(`   -> [OK] All days compliant.`);
                // Auto-resolve any open alerts
                const openAlert = await Notification.findOne({
                    user_id: user._id,
                    type: 'timesheet_missing_alert',
                    status: 'OPEN'
                });
                if (openAlert) {
                    await Notification.updateOne({ _id: openAlert._id }, { status: 'RESOLVED', updated_at: new Date() });
                    console.log(`      -> Resolved Alert`);
                }
            }
        }

        console.log('=== CHECK COMPLETE ===');
        process.exit(0);

    } catch (err) {
        console.error('Check failed:', err);
        process.exit(1);
    }
};

runChecks();
