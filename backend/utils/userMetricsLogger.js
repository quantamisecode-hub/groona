const Models = require('../models/SchemaDefinitions');
const { User, Task, Timesheet, UserActivityLog } = Models;

// --- HELPER: Get IST Date ---
const getISTDate = () => new Date(Date.now() + (330 * 60000));

/**
 * Logs a snapshot of the user's metrics (Tasks, Timesheets, Schedule)
 * @param {string} userEmail - Email of the user to log
 * @param {string} eventType - 'login', 'timesheet_submission', 'task_assignment', etc.
 * @param {string} tenantId - Optional (will fetch from user if missing)
 */
async function logUserMetrics(userEmail, eventType, tenantId) {
    try {
        const Models = require('../models/SchemaDefinitions');
        const User = Models.User;
        const Task = Models.Task;
        const Timesheet = Models.Timesheet;
        const UserActivityLog = Models.UserActivityLog;

        if (!userEmail) return;

        // 1. Fetch User
        const user = await User.findOne({ email: userEmail });
        if (!user) return;

        // 2. Calculate Stats
        let assignedCount = 0;
        let pendingCount = 0;
        let submittedCount = 0;

        // A. Active Assigned Tasks
        // A. Total Assigned Tasks (Include 'done'/'completed', exclude 'archived')
        const allAssignedTasks = await Task.find({
            assigned_to: userEmail,
            status: { $ne: 'archived' }
        });
        assignedCount = allAssignedTasks.length;

        // DEBUG: Print statuses found
        const statuses = allAssignedTasks.map(t => t.status);
        console.log(`[MetricsDebug] User: ${userEmail} | Total Assigned: ${assignedCount} | Statuses: ${JSON.stringify(statuses)}`);

        // Filter for Pending Counts (Exclude Done/Completed - Case Insensitive)
        // [User Request Update]: Include ALL assigned tasks in pending, regardless of status (unless archived)
        const activeTasks = allAssignedTasks;
        console.log(`[MetricsDebug] Pending Candidates (All Assigned): ${activeTasks.length}`);


        // B. Todays Timesheets (IST)
        const istNow = getISTDate();
        const dateString = istNow.toISOString().split('T')[0];

        const todaysTimesheets = await Timesheet.find({
            user_email: userEmail,
            date: dateString
        });
        submittedCount = todaysTimesheets.length;

        // C. Pending Logs (Active tasks without timesheet today)
        const loggedTaskIds = new Set(todaysTimesheets.map(t => t.task_id));
        const pendingTasks = activeTasks.filter(t => !loggedTaskIds.has(t._id.toString()));
        pendingCount = pendingTasks.length;

        // 3. Create or Update Log Entry for Today (IST)
        const startOfDay = new Date(istNow);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(istNow);
        endOfDay.setHours(23, 59, 59, 999);

        // Define the update payload
        const updateData = {
            user_id: user._id,
            email: user.email,
            tenant_id: tenantId || user.tenant_id,
            // Update to the latest event type causing the change
            event_type: eventType,
            timestamp: istNow,

            scheduled_working_start: user.working_hours_start || "",
            scheduled_working_end: user.working_hours_end || "",
            scheduled_working_days: user.working_days || [],
            present_working_day: istNow.toLocaleDateString('en-US', { weekday: 'short' }),

            total_assigned_tasks: assignedCount,
            pending_log_count: pendingCount,
            submitted_timesheets_count: submittedCount
        };

        // Find log for today and update, or create if not exists
        await UserActivityLog.findOneAndUpdate(
            {
                email: userEmail,
                timestamp: { $gte: startOfDay, $lte: endOfDay }
            },
            updateData,
            { upsert: true, new: true }
        );

        console.log(`[UserActivityLog] Updated daily log for ${userEmail}. Event: ${eventType} | Pending: ${pendingCount}`);

        console.log(`[UserActivityLog] Logged ${eventType} for ${userEmail}. pending: ${pendingCount}`);

    } catch (err) {
        console.error(`[UserActivityLog] Error logging metrics for ${userEmail}:`, err);
    }
}

module.exports = { logUserMetrics };
