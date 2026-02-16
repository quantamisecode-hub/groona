const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const debug = async () => {
    try {
        await connectDB();
        const Models = require('./models/SchemaDefinitions');
        const UserLog = Models.UserLog;
        const Notification = Models.Notification;

        const logs = await UserLog.find({
            $or: [
                { logout_time: { $exists: false } },
                { logout_time: null }
            ]
        });

        console.log('--- Active User Logs ---');
        logs.forEach(l => {
            console.log(`Email: ${l.email}, Count: ${l.today_submitted_timesheets_count}, Login: ${l.login_time}`);
        });

        const notifs = await Notification.find({ type: 'timesheet_reminder_alert' }).sort({ created_date: -1 }).limit(5);
        console.log('\n--- Recent Reminder Notifs ---');
        notifs.forEach(n => {
            console.log(`To: ${n.recipient_email}, Title: ${n.title}, Date: ${n.created_date}`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

debug();
