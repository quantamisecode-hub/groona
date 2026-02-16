const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/groona_dev';

const resetAlarms = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('MongoDB Connected');

        // Check if model exists, if not define it.
        let Notification;
        if (mongoose.models.Notification) {
            Notification = mongoose.model('Notification');
        } else {
            Notification = mongoose.model('Notification', new mongoose.Schema({
                type: String,
                created_date: Date
            }, { strict: false }));
        }

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        console.log(`Resetting alarms created after: ${todayStart.toISOString()}`);

        const result1 = await Notification.deleteMany({
            type: 'timesheet_lockout_alarm',
            created_date: { $gte: todayStart }
        });
        console.log(`Deleted ${result1.deletedCount} user lockout alarms.`);

        const result2 = await Notification.deleteMany({
            type: 'timesheet_missing_alert',
            created_date: { $gte: todayStart }
        });
        console.log(`Deleted ${result2.deletedCount} manager alerts.`);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

resetAlarms();
