const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const { subDays, format, startOfDay, endOfDay } = require('date-fns');

// Load Env
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/groona_dev';

/**
 * Get the last N working days for a user
 */
const getLastWorkingDays = (user, count = 30) => {
    let workingDays = (user.working_days && user.working_days.length > 0)
        ? user.working_days
        : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const normalizedWorkingDays = workingDays.map(d => d.trim().toLowerCase());
    const days = [];
    let checkDate = subDays(new Date(), 1); // Start from yesterday
    let iterations = 0;

    // We look back up to 60 calendar days to find 'count' working days
    while (days.length < count && iterations < 60) {
        iterations++;
        const fullDayName = format(checkDate, 'EEEE').toLowerCase();
        const shortDayName = format(checkDate, 'EEE').toLowerCase();

        if (normalizedWorkingDays.includes(fullDayName) || normalizedWorkingDays.includes(shortDayName)) {
            days.push(new Date(checkDate));
        }
        checkDate = subDays(checkDate, 1);
    }

    return days;
};

const runAlerts = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('MongoDB Connected');

        const Models = require('../models/SchemaDefinitions');
        const { User, User_timesheets, Notification, Task, Project } = Models;
        const emailService = require('../services/emailService');

        console.log(`\n=== UTILIZATION & IDLE TIME CHECK ===`);

        const users = await User.find({ status: 'active' });
        console.log(`Checking ${users.length} active users...`);

        for (const user of users) {
            console.log(`\n--- User: ${user.email} ---`);
            const dailyAvailabilityHours = user.working_hours_per_day || 8;
            const dailyAvailabilityMinutes = dailyAvailabilityHours * 60;

            // --- 1. IDLE TIME CHECK (Daily for Yesterday) ---
            const lastWorkingDay = getLastWorkingDays(user, 1)[0];
            if (lastWorkingDay) {
                const dateStr = format(lastWorkingDay, 'yyyy-MM-dd');
                const timesheetRecord = await User_timesheets.findOne({
                    user_email: user.email,
                    timesheet_date: dateStr
                });

                const loggedMinutes = timesheetRecord ? (timesheetRecord.total_time_submitted_in_day || 0) : 0;
                const idleMinutes = dailyAvailabilityMinutes - loggedMinutes;
                const idlePercentage = (idleMinutes / dailyAvailabilityMinutes) * 100;

                console.log(`   [Idle Check] ${dateStr}: Logged ${loggedMinutes}m / ${dailyAvailabilityMinutes}m (${idlePercentage.toFixed(1)}% Idle)`);

                if (idlePercentage > 25) {
                    console.log(`      -> Alert: Idle time exceeds 25%.`);

                    // Get suggested tasks
                    // Find tasks assigned to user (todo/backlog) or unassigned tasks in user's projects
                    const userProjects = await Project.find({ "team_members.email": user.email }).select('_id');
                    const projectIds = userProjects.map(p => p._id.toString());

                    const suggestedTasks = await Task.find({
                        $or: [
                            { assigned_to: user.email },
                            { project_id: { $in: projectIds }, assigned_to: { $size: 0 } }
                        ],
                        status: { $in: ['todo', 'backlog', 'backlog_task'] },
                        tenant_id: user.tenant_id
                    }).limit(3).select('title priority');

                    const suggestionText = suggestedTasks.length > 0
                        ? `\n\n**Suggested Tasks:**\n` + suggestedTasks.map(t => `- ${t.title} (${t.priority})`).join('\n')
                        : "";

                    // Create In-App Notification
                    const existingIdleNotif = await Notification.findOne({
                        recipient_email: user.email,
                        type: 'idle_time_alert',
                        created_date: { $gte: startOfDay(new Date()) }
                    });

                    if (!existingIdleNotif) {
                        await Notification.create({
                            tenant_id: user.tenant_id,
                            recipient_email: user.email,
                            user_id: user._id,
                            type: 'idle_time_alert',
                            category: 'general',
                            title: 'Significant Idle Time Detected',
                            message: `Significant idle time detected (${idlePercentage.toFixed(1)}%). Please check task allocation.${suggestionText}`,
                            read: false,
                            status: 'OPEN',
                            created_date: new Date()
                        });
                        console.log(`      -> In-app notification created.`);
                    }
                }
            }

            // --- 2. UNDER-UTILIZATION CHECK (30 Working Days) ---
            const last30WorkingDays = getLastWorkingDays(user, 30);
            if (last30WorkingDays.length > 0) {
                let totalLoggedMinutes = 0;
                let totalAvailableMinutes = 0;

                for (const day of last30WorkingDays) {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const record = await User_timesheets.findOne({
                        user_email: user.email,
                        timesheet_date: dateStr
                    });
                    totalLoggedMinutes += record ? (record.total_time_submitted_in_day || 0) : 0;
                    totalAvailableMinutes += dailyAvailabilityMinutes;
                }

                const avgUtilization = (totalLoggedMinutes / totalAvailableMinutes) * 100;
                console.log(`   [Utilization Check] Last ${last30WorkingDays.length} days: ${totalLoggedMinutes}m / ${totalAvailableMinutes}m (${avgUtilization.toFixed(1)}% Utilization)`);

                if (avgUtilization < 60) {
                    console.log(`      -> Alert: Utilization is below 60%.`);

                    const existingUtilNotif = await Notification.findOne({
                        recipient_email: user.email,
                        type: 'under_utilization_alert',
                        created_date: { $gte: startOfDay(new Date()) }
                    });

                    if (!existingUtilNotif) {
                        // In-App
                        await Notification.create({
                            tenant_id: user.tenant_id,
                            recipient_email: user.email,
                            user_id: user._id,
                            type: 'under_utilization_alert',
                            category: 'alert',
                            title: 'Under-Utilization Alert',
                            message: `You appear under-utilized (${avgUtilization.toFixed(1)}% over last 30 days). Please discuss allocation with your manager.`,
                            read: false,
                            status: 'OPEN',
                            created_date: new Date()
                        });

                        // Email
                        try {
                            await emailService.sendEmail({
                                to: user.email,
                                templateType: 'under_utilization_alert',
                                data: {
                                    userName: user.full_name || user.email,
                                    userEmail: user.email,
                                    utilizationPercentage: avgUtilization.toFixed(1),
                                    durationDays: last30WorkingDays.length,
                                    dashboardUrl: `${process.env.FRONTEND_URL}/Timesheets`
                                }
                            });
                            console.log(`      -> In-app + Email sent.`);
                        } catch (emailErr) {
                            console.error(`      -> Email failed:`, emailErr.message);
                        }
                    }
                }
            }
        }

        console.log('\n=== CHECK COMPLETE ===');
        process.exit(0);
    } catch (err) {
        console.error('Error running utilization alerts:', err);
        process.exit(1);
    }
};

runAlerts();
