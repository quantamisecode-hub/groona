const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const { subDays, isSameDay, format, parseISO } = require('date-fns');

// Load Env
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/groona_dev';

/**
 * Get the last N working days for a user
 */
const getLastWorkingDays = (user, count = 3) => {
    // Fallback if working_days is empty or null
    let workingDays = (user.working_days && user.working_days.length > 0)
        ? user.working_days
        : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Normalize to handle both 'Mon' and 'Monday'
    const normalizedWorkingDays = workingDays.map(d => d.trim().toLowerCase());

    const days = [];
    let checkDate = subDays(new Date(), 1); // Start from yesterday
    let iterations = 0;

    while (days.length < count && iterations < 30) {
        iterations++;
        const fullDayName = format(checkDate, 'EEEE').toLowerCase(); // e.g. 'monday'
        const shortDayName = format(checkDate, 'EEE').toLowerCase();  // e.g. 'mon'

        if (normalizedWorkingDays.includes(fullDayName) || normalizedWorkingDays.includes(shortDayName)) {
            days.push(new Date(checkDate));
        }
        checkDate = subDays(checkDate, 1);
    }

    return days.reverse(); // Standard chronological order
};

const runAlerts = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('MongoDB Connected');

        const { User, User_timesheets, Notification, Tenant } = require('../models/SchemaDefinitions');
        const emailService = require('../services/emailService');

        console.log(`\n=== LOW LOGGED HOURS CHECK (3 Consecutive Days) ===`);

        const users = await User.find({ status: 'active' });
        console.log(`Checking ${users.length} active users...`);

        for (const user of users) {
            const dailyAvailability = user.working_hours_per_day || 8;
            const availabilityInMinutes = dailyAvailability * 60;

            // Get last 3 working days
            const last3WorkingDays = getLastWorkingDays(user, 3);

            if (last3WorkingDays.length < 3) {
                console.log(`   -> Skipping ${user.email}: Not enough working days history found.`);
                continue;
            }

            console.log(`   -> Checking ${user.email}:`);
            let lowHoursDaysCount = 0;
            const dayLogs = [];

            for (const day of last3WorkingDays) {
                const dateString = format(day, 'yyyy-MM-dd');

                // Query User_timesheets for this specific day
                const dailyLog = await User_timesheets.findOne({
                    user_email: user.email,
                    timesheet_date: dateString
                });

                const loggedMinutes = dailyLog ? (dailyLog.total_time_submitted_in_day || 0) : 0;

                if (loggedMinutes < availabilityInMinutes) {
                    lowHoursDaysCount++;
                }

                dayLogs.push(`${dateString}: ${loggedMinutes / 60}h/${dailyAvailability}h`);
            }

            console.log(`      Logs: ${dayLogs.join(' | ')}`);

            if (lowHoursDaysCount === 3) {
                console.log(`      -> [ALERT] Low hours detected for 3 consecutive days!`);

                const alertTitle = `📉 Low Logged Hours Alert`;
                const alertMessage = `Your logged hours are below your declared availability. Please review your workload.`;

                // 1. Create In-App Notification
                // Check if an alert was already sent today to avoid spamming if script runs multiple times
                const todayStart = new Date();
                todayStart.setHours(0, 0, 0, 0);

                const existingNotification = await Notification.findOne({
                    user_id: user._id,
                    type: 'low_logged_hours',
                    created_date: { $gte: todayStart }
                });

                if (!existingNotification) {
                    await Notification.create({
                        tenant_id: user.tenant_id,
                        recipient_email: user.email,
                        user_id: user._id,
                        type: 'low_logged_hours',
                        category: 'alert',
                        title: alertTitle,
                        message: alertMessage,
                        status: 'OPEN',
                        read: false,
                        created_date: new Date()
                    });
                    console.log(`         -> In-app notification created.`);

                    // 2. Send Email
                    try {
                        await emailService.sendEmail({
                            to: user.email,
                            templateType: 'low_logged_hours',
                            data: {
                                userName: user.full_name || user.email,
                                userEmail: user.email,
                                consecutiveDays: 3,
                                loggedHours: 'N/A', // Dynamic calculation could be added
                                availability: dailyAvailability
                            }
                        });
                        console.log(`         -> Email sent.`);
                    } catch (emailErr) {
                        console.error(`         -> Failed to send email:`, emailErr.message);
                    }
                } else {
                    console.log(`         -> Alert already sent today. Skipping.`);
                }
            } else {
                console.log(`      -> No consecutive pattern found.`);
            }
        }

        console.log('\n=== CHECK COMPLETE ===');
        process.exit(0);
    } catch (err) {
        console.error('Error running alerts:', err);
        process.exit(1);
    }
};

runAlerts();
