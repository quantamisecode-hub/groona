const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Tenant, User } = require('../models/SchemaDefinitions');
const { sendEmail } = require('../services/emailService');

// MongoDB Connection
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected for Subscription Check');
    } catch (err) {
        console.error('MongoDB Connection Error:', err);
        process.exit(1);
    }
};

const checkSubscriptionStatus = async () => {
    await connectDB();
    console.log('--- Starting Subscription Check ---');

    const now = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(now.getDate() + 3);

    try {
        // 1. Check for Expiring Trials (Ending in 3 days)
        const expiringTrials = await Tenant.find({
            status: 'trial',
            trial_ends_at: {
                $gt: now,
                $lt: threeDaysFromNow
            },
            'features_enabled.trial_warning_sent': { $ne: true } // Avoid spamming
        });

        console.log(`Found ${expiringTrials.length} expiring trials.`);

        for (const tenant of expiringTrials) {
            if (tenant.owner_email) {
                const user = await User.findOne({ email: tenant.owner_email });
                await sendEmail({
                    to: tenant.owner_email,
                    templateType: 'trial_ending',
                    data: {
                        userName: user ? user.full_name : 'Valued Customer',
                        userEmail: tenant.owner_email,
                        trialEndDate: tenant.trial_ends_at,
                        upgradeUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/Billing`
                    }
                });

                // Mark warning as sent to avoid duplicates (assuming we can add this flag or use a separate tracking mechanism)
                // For now, let's just log it. Real implementation might require schema update or separate log.
                if (!tenant.features_enabled) tenant.features_enabled = {};
                tenant.features_enabled.trial_warning_sent = true;
                // Mark the field as modified since it's a mixed/nested type
                tenant.markModified('features_enabled');
                await tenant.save();

                console.log(`Sent trial warning to ${tenant.owner_email}`);
            }
        }

        // 2. Check for EXPIRED Trials -> Move to 'past_due' (or 'free' if that's the flow, but usually limits apply)
        // For this example, we'll mark them as 'past_due' if they haven't upgraded
        const expiredTrials = await Tenant.find({
            status: 'trial',
            trial_ends_at: { $lt: now }
        });

        console.log(`Found ${expiredTrials.length} expired trials.`);

        for (const tenant of expiredTrials) {
            tenant.status = 'past_due';
            tenant.subscription_status = 'past_due';
            await tenant.save();

            const user = await User.findOne({ email: tenant.owner_email });
            if (tenant.owner_email) {
                await sendEmail({
                    to: tenant.owner_email,
                    templateType: 'subscription_expired',
                    data: {
                        userName: user ? user.full_name : 'Valued Customer',
                        userEmail: tenant.owner_email,
                        planName: 'Free Trial',
                        expiryDate: tenant.trial_ends_at,
                        renewalUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/Billing`
                    }
                });
                console.log(`Marked trial as expired for ${tenant.name}`);
            }
        }

        // 3. Check for Active Subscriptions that have Expired
        const expiredSubscriptions = await Tenant.find({
            status: 'active',
            subscription_ends_at: { $lt: now }
        });

        console.log(`Found ${expiredSubscriptions.length} expired subscriptions.`);

        for (const tenant of expiredSubscriptions) {
            // Logic: Give a grace period? For now, immediate past_due
            tenant.status = 'past_due';
            tenant.subscription_status = 'past_due';
            await tenant.save();

            const user = await User.findOne({ email: tenant.owner_email });
            if (tenant.owner_email) {
                await sendEmail({
                    to: tenant.owner_email,
                    templateType: 'subscription_expired',
                    data: {
                        userName: user ? user.full_name : 'Valued Customer',
                        userEmail: tenant.owner_email,
                        planName: tenant.subscription_plan || 'Premium',
                        expiryDate: tenant.subscription_ends_at,
                        renewalUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/Billing`
                    }
                });
                console.log(`Marked subscription as past_due for ${tenant.name}`);
            }
        }

    } catch (error) {
        console.error('Error during subscription check:', error);
    } finally {
        console.log('--- Subscription Check Complete ---');
        process.exit(0);
    }
};

checkSubscriptionStatus();
