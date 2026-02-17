const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');
const { subDays, format } = require('date-fns');

// Load Env
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/groona_dev';
const CONTEXT_SWITCH_THRESHOLD = 5; // > 5 projects
const REPEAT_THRESHOLD = 2; // >= 2 days in a week

const runContextSwitchingCheck = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('MongoDB Connected');

        const { User, Timesheet, Notification } = require('../models/SchemaDefinitions');

        console.log(`\n=== FREQUENT CONTEXT SWITCHING CHECK ===`);
        console.log(`Threshold: > ${CONTEXT_SWITCH_THRESHOLD} projects/day`);
        console.log(`Repeat Requirement: >= ${REPEAT_THRESHOLD} days in last 7 days`);

        const users = await User.find({ status: 'active' });
        console.log(`Checking ${users.length} active users...`);

        const sevenDaysAgo = subDays(new Date(), 7);
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        for (const user of users) {
            // Fetch all timesheets for this user in the last 7 days
            const timesheets = await Timesheet.find({
                user_email: user.email,
                date: { $gte: format(sevenDaysAgo, 'yyyy-MM-dd') }
            });

            if (timesheets.length === 0) continue;

            // Group by date and count unique projects
            const projectCountsByDate = {};
            timesheets.forEach(ts => {
                const dateKey = ts.date; // already YYYY-MM-DD
                if (!projectCountsByDate[dateKey]) {
                    projectCountsByDate[dateKey] = new Set();
                }
                if (ts.project_id) {
                    projectCountsByDate[dateKey].add(ts.project_id.toString());
                }
            });

            let contextSwitchDays = 0;
            const details = [];

            Object.entries(projectCountsByDate).forEach(([date, projects]) => {
                if (projects.size > CONTEXT_SWITCH_THRESHOLD) {
                    contextSwitchDays++;
                    details.push(`${date}: ${projects.size} projects`);
                }
            });

            if (contextSwitchDays >= REPEAT_THRESHOLD) {
                console.log(`   -> [ALERT] User ${user.email} flagged! (${contextSwitchDays} days with high switching)`);
                console.log(`      Details: ${details.join(' | ')}`);

                const alertTitle = `⚠️ Context Switching Alert`;
                const alertMessage = `Frequent context switching detected. This may reduce productivity.`;

                // Check for existing notification in the last 24 hours to avoid spam
                const existingNotification = await Notification.findOne({
                    user_id: user._id,
                    type: 'context_switching_alert',
                    created_date: { $gte: todayStart }
                });

                if (!existingNotification) {
                    await Notification.create({
                        tenant_id: user.tenant_id,
                        recipient_email: user.email,
                        user_id: user._id,
                        type: 'context_switching_alert',
                        category: 'general',
                        title: alertTitle,
                        message: alertMessage,
                        status: 'OPEN',
                        read: false,
                        created_date: new Date()
                    });
                    console.log(`         -> In-app notification created.`);
                } else {
                    console.log(`         -> Notification already sent today. Skipping.`);
                }
            }
        }

        console.log('\n=== CHECK COMPLETE ===');
        process.exit(0);
    } catch (err) {
        console.error('Error running context switching check:', err);
        process.exit(1);
    }
};

runContextSwitchingCheck();
