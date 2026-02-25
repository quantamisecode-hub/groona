const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('../config/db');
const path = require('path');
const { sendEmail } = require('../services/emailService');

// Load Env
dotenv.config({ path: path.join(__dirname, '../.env') });

const runReminders = async () => {
    try {
        await connectDB();
        const Models = require('../models/SchemaDefinitions');
        const UserLog = Models.UserLog;
        const Notification = Models.Notification;
        const User = Models.User;

        console.log('\n=== TIMESHEET REMINDER CHECK ===');

        const getISTDate = () => new Date(Date.now() + (330 * 60000));
        const now = getISTDate();
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);

        // Get active logs with no submissions today
        const activeLogs = await UserLog.find({
            today_submitted_timesheets_count: 0,
            $or: [
                { logout_time: { $exists: false } },
                { logout_time: null }
            ]
        });

        console.log(`Checking roles for ${activeLogs.length} users with no logs today...`);

        for (const log of activeLogs) {
            try {
                const user = await User.findOne({ email: log.email });
                if (!user || user.status === 'inactive' || user.role === 'admin' || user.custom_role === 'project_manager' || user.custom_role === 'owner') {
                    console.log(`[SKIP] ${log.email} - User inactive, manager, or admin skip.`);
                    continue;
                }

                const loginTime = new Date(log.login_time);
                // Both 'now' and 'loginTime' are now in IST (if DB stores IST)
                const diffMs = now - loginTime;
                const diffHours = Math.floor(diffMs / (60 * 60 * 1000));

                const title = 'Timesheet Logging Reminder';
                const message = "You haven’t logged your time today. Please update your timesheet before day end.";

                // 1. Create In-App Notification (General Tab)
                await Notification.create({
                    tenant_id: log.tenant_id,
                    recipient_email: log.email,
                    user_id: log.user_id,
                    type: 'timesheet_reminder',
                    category: 'general',
                    title: title,
                    message: message,
                    read: false,
                    created_date: new Date()
                });

                // 2. Send Email Notification
                await sendEmail({
                    to: log.email,
                    templateType: 'timesheet_reminder',
                    data: {
                        userName: user.full_name || log.email,
                        userEmail: log.email,
                        scheduledEnd: log.scheduled_working_end,
                        reminderType: 'systemic'
                    },
                    subject: title
                });

                console.log(`[ALERT] Sent reminder to ${log.email}`);

            } catch (logErr) {
                console.error(`Error processing log for ${log.email}:`, logErr);
            }
        }

        console.log('=== REMINDER CHECK COMPLETE ===');
        process.exit(0);

    } catch (err) {
        console.error('Reminder check failed:', err);
        process.exit(1);
    }
};

runReminders();
