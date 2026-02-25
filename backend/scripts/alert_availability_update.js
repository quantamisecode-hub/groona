const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const { subDays, format } = require('date-fns');

// Load Env
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/groona_dev';

const runAvailabilityCheck = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('MongoDB Connected');

        // Load models via the central definitions loader
        const SchemaDefinitions = require('../models/SchemaDefinitions');
        const User = mongoose.model('User');
        const User_timesheets = mongoose.model('User_timesheets');
        const Notification = mongoose.model('Notification');

        console.log(`\n=== USER AVAILABILITY & ACTIVITY CHECK (30 Days) ===`);

        const thresholdDate = subDays(new Date(), 30);
        console.log(`Threshold Date: ${format(thresholdDate, 'yyyy-MM-dd')}`);

        // Get all active users (members)
        const users = await User.find({ status: 'active' });
        console.log(`Checking ${users.length} active users...`);

        for (const user of users) {
            console.log(`\n   -> Checking user: ${user.email}`);

            // 1. Check last_login
            const lastLogin = user.last_login ? new Date(user.last_login) : null;
            if (lastLogin && lastLogin > thresholdDate) {
                console.log(`      [PASS] Recent login detected: ${format(lastLogin, 'yyyy-MM-dd')}`);
                continue;
            }

            // 2. Check updated_date (User profile update)
            const lastUpdate = user.updated_date ? new Date(user.updated_date) : null;
            if (lastUpdate && lastUpdate > thresholdDate) {
                console.log(`      [PASS] Recent profile update detected: ${format(lastUpdate, 'yyyy-MM-dd')}`);
                continue;
            }

            // 3. Check for any timesheet submissions in the last 30 days
            const recentTimesheet = await User_timesheets.findOne({
                user_email: user.email,
                timesheet_date: { $gte: format(thresholdDate, 'yyyy-MM-dd') }
            });

            if (recentTimesheet) {
                console.log(`      [PASS] Recent timesheet submission detected for date: ${recentTimesheet.timesheet_date}`);
                continue;
            }

            console.log(`      [ALERT] No activity detected for 30+ days.`);

            // Condition met: No login, no profile update, no timesheet in 30 days.
            // Check if we already sent a notification recently to avoid spamming
            const recentNotification = await Notification.findOne({
                user_id: user._id,
                type: 'user_availability_update',
                created_date: { $gte: subDays(new Date(), 7) } // Don't notify more than once a week
            });

            if (!recentNotification) {
                const alertMessage = "Please update your availability to ensure accurate planning.";

                await Notification.create({
                    tenant_id: user.tenant_id,
                    recipient_email: user.email,
                    user_id: user._id,
                    title: '📅 Availability Update Required',
                    message: alertMessage,
                    type: 'user_availability_update',
                    category: 'general',
                    status: 'OPEN',
                    read: false,
                    created_date: new Date()
                });
                console.log(`      -> In-app notification created.`);
            } else {
                console.log(`      -> Alert already sent recently. Skipping.`);
            }
        }

        console.log('\n=== CHECK COMPLETE ===');
        process.exit(0);
    } catch (err) {
        console.error('Check failed:', err);
        process.exit(1);
    }
};

runAvailabilityCheck();
