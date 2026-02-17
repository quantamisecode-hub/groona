const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { User_timesheets, Timesheet } = require('../models/SchemaDefinitions');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/groona_dev';

async function checkData() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const email = 'jxv7815@gmail.com'; // Testing for this user
        console.log(`\n--- Inspecting data for ${email} ---`);

        const userTimesheets = await User_timesheets.find({ user_email: email }).sort({ timesheet_date: -1 }).limit(10);
        console.log(`\n[User_timesheets] Found ${userTimesheets.length} records. Latest 10:`);
        userTimesheets.forEach(ut => {
            console.log(`Date: ${ut.timesheet_date.toISOString().split('T')[0]} | Total: ${ut.total_time_submitted_in_day}m | Rework: ${ut.rework_time_in_day}m`);
        });

        const rawTimesheets = await Timesheet.find({ user_email: email, work_type: 'rework' }).sort({ date: -1 }).limit(10);
        console.log(`\n[Timesheet] Found ${rawTimesheets.length} raw rework entries. Latest 10:`);
        rawTimesheets.forEach(t => {
            console.log(`Date: ${t.date.toISOString().split('T')[0]} | Mins: ${t.total_minutes} | WorkType: ${t.work_type}`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkData();
