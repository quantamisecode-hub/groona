const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { User, Timesheet, User_timesheets } = require('../models/SchemaDefinitions');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/groona_dev';

async function syncAll() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const users = await User.find({ status: 'active' });
        console.log(`Syncing ${users.length} active users...`);

        for (const user of users) {
            console.log(`Processing ${user.email}...`);

            // Get unique dates from Timesheet for this user
            const distinctDates = await Timesheet.distinct('date', { user_email: user.email });
            console.log(`  Found ${distinctDates.length} distinct dates with timesheets.`);

            for (const date of distinctDates) {
                const dateStr = date instanceof Date ? date.toISOString().split('T')[0] : String(date).split('T')[0];
                const startOfDay = new Date(dateStr + 'T00:00:00.000Z');
                const endOfDay = new Date(dateStr + 'T23:59:59.999Z');

                const dayTimesheets = await Timesheet.find({
                    user_email: user.email,
                    date: { $gte: startOfDay, $lte: endOfDay },
                    status: { $ne: 'rejected' }
                });

                if (dayTimesheets.length === 0) continue;

                const totalMinutes = dayTimesheets.reduce((acc, ts) => acc + (ts.total_minutes || 0), 0);
                const reworkMinutes = dayTimesheets.reduce((acc, ts) => {
                    return acc + (ts.work_type === 'rework' ? (ts.total_minutes || 0) : 0);
                }, 0);

                const hasOfficialEntry = dayTimesheets.some(ts => !['draft', 'rejected'].includes(ts.status));
                const dailyStatus = hasOfficialEntry ? 'submitted' : 'draft';

                const latestTs = dayTimesheets.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0];

                const updateData = {
                    tenant_id: user.tenant_id,
                    user_id: user._id,
                    user_email: user.email,
                    timesheet_date: startOfDay,
                    actual_date: new Date(),
                    status: dailyStatus,
                    work_type: latestTs?.work_type || 'other',
                    start_time: latestTs?.start_time || startOfDay,
                    end_time: latestTs?.end_time || endOfDay,
                    location: latestTs?.location || {},
                    total_time_submitted_in_day: totalMinutes,
                    rework_time_in_day: reworkMinutes
                };

                await User_timesheets.findOneAndUpdate(
                    { user_email: user.email, timesheet_date: { $gte: startOfDay, $lte: endOfDay } },
                    { $set: updateData },
                    { upsert: true }
                );
            }
            console.log(`  Done with ${user.email}`);
        }

        console.log('\nAll User_timesheets synchronized successfully!');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

syncAll();
