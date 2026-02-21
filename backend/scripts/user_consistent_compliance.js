const mongoose = require('mongoose');
const Models = require('../models/SchemaDefinitions');
require('dotenv').config({ path: __dirname + '/../.env' });

async function checkConsistentCompliance() {
    console.log('[Consistent Compliance] Starting check at', new Date().toISOString());

    try {
        // 1. Connect to MongoDB
        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(process.env.MONGO_URI, {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
            console.log('MongoDB Hooked in Consistent Compliance Check');
        }

        const User = Models.User;
        const Notification = Models.Notification;

        // Safety check
        if (!User || !Notification) {
            console.error('Critical models not loaded!');
            process.exit(1);
        }

        // 2. Define Time Windows
        const now = new Date();
        // 30 days ago for the violation check
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);

        // We only want to send this reward ONCE per ~30 days so we don't spam them daily if they keep being good
        // Check if they got a reward in the LAST 28 days to give a little buffer for periodic runs
        const twentyEightDaysAgo = new Date();
        twentyEightDaysAgo.setDate(now.getDate() - 28);

        // List of notification types that are considered "Violations" or negative feedback
        const violationTypes = [
            'timesheet_missing_alert',
            'timesheet_missing_alarm',
            'timesheet_incomplete_alert',
            'timesheet_lockout_alarm',
            'timesheet_late_submission',
            'timesheet_lock',
            'task_delay_alarm',
            'task_overdue_alert',
            'multiple_overdue_alarm',
            'multiple_overdue_escalation',
            'productivity_alert',
            'productivity_alarm',
            'efficiency_alert',
            'efficiency_alarm',
            'rework_alert',
            'rework_alarm',
            'high_rework_alarm',
            'PM_VELOCITY_DROP',
            'PM_CONSISTENT_VELOCITY_DROP',
            'idle_time_alert',
            'under_utilization_alert'
        ];

        // 3. Get all active users (exclude admins/owners if you want, but good to include everyone by default)
        const users = await User.find({ status: 'active', role: { $nin: ['admin', 'owner', 'client'] } });
        console.log(`[Consistent Compliance] Found ${users.length} active users to check.`);

        let rewardCount = 0;

        for (const user of users) {
            if (!user.email) continue;
            const userId = String(user._id || user.id);

            try {
                // Check A: Has the user received a reward recently?
                const recentReward = await Notification.findOne({
                    recipient_email: user.email,
                    type: 'USER_CONSISTENT',
                    created_date: { $gte: twentyEightDaysAgo }
                });

                if (recentReward) {
                    // Already rewarded recently, skip
                    console.log(`[Consistent Compliance] Skipped ${user.email} - Already rewarded recently.`);
                    continue;
                }

                // Check B: Have they had any violations in the last 30 days?
                const recentViolations = await Notification.findOne({
                    recipient_email: user.email,
                    type: { $in: violationTypes },
                    created_date: { $gte: thirtyDaysAgo }
                });

                if (recentViolations) {
                    console.log(`[Consistent Compliance] Skipped ${user.email} - Has recent violation: ${recentViolations.type}.`);
                }

                if (!recentViolations) {
                    // Hooray! No violations in the last 30 days AND no recent reward.
                    // Let's reward them.
                    await Notification.create({
                        tenant_id: user.tenant_id,
                        recipient_email: user.email,
                        user_id: userId,
                        type: 'USER_CONSISTENT',
                        category: 'general', // You can change this if you have a positive category
                        title: 'Great job!',
                        message: `You've maintained excellent compliance this month. Keep up the great work!`,
                        entity_type: 'user',
                        entity_id: userId,
                        sender_name: 'System',
                        read: false,
                        created_date: new Date()
                    });

                    console.log(`[Consistent Compliance] 🎉 Rewarded user: ${user.email}`);
                    rewardCount++;
                }

            } catch (err) {
                console.error(`[Consistent Compliance] Error processing user ${user.email}:`, err);
            }
        }

        console.log(`[Consistent Compliance] Finished check. Rewarded ${rewardCount} users.`);

    } catch (error) {
        console.error('[Consistent Compliance] Error during check:', error);
    } finally {
        // Terminate the process if run directly
        if (require.main === module) {
            mongoose.connection.close();
            process.exit(0);
        }
    }
}

// Allow running directly
if (require.main === module) {
    checkConsistentCompliance();
}

module.exports = { checkConsistentCompliance };
