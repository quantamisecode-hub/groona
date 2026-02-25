const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectDB = require('../config/db');
const { Tenant } = require('../models/SchemaDefinitions');

const checkTrialStatus = async () => {
    try {
        await connectDB();
        console.log('Connected to database for trial check...');

        const today = new Date();
        // Reset time to start of day for accurate comparison if needed, 
        // but typically we just check if trial_ends_at is < now.

        console.log(`Checking for expired trials as of: ${today.toISOString()}`);

        // Find tenants with status 'trial' whose trial_ends_at is in the past
        const expiredTenants = await Tenant.find({
            status: 'trial',
            trial_ends_at: { $lt: today }
        });

        console.log(`Found ${expiredTenants.length} expired trial tenants.`);

        for (const tenant of expiredTenants) {
            console.log(`Processing tenant: ${tenant.name} (${tenant._id}) - Trial ended at: ${tenant.trial_ends_at}`);

            tenant.status = 'suspended';
            tenant.subscription_status = 'past_due';

            // Optional: Add an internal note
            const note = `Trial expired on ${new Date().toISOString()}. Suspended automatically.`;
            tenant.internal_notes = tenant.internal_notes ? tenant.internal_notes + '\n' + note : note;

            await tenant.save();
            console.log(`Tenant ${tenant.name} suspended.`);

            // Sync with TenantSubscription collection
            try {
                const subscriptions = mongoose.connection.collection('tenantsubscriptions');
                await subscriptions.updateOne(
                    { tenant_id: tenant._id },
                    {
                        $set: {
                            status: 'past_due',
                            trial_ends_at: tenant.trial_ends_at,
                            plan_name: tenant.subscription_plan,
                            subscription_type: tenant.subscription_type,
                            start_date: tenant.subscription_start_date,
                            end_date: tenant.subscription_ends_at,
                            max_users: tenant.max_users,
                            max_projects: tenant.max_projects,
                            max_workspaces: tenant.max_workspaces,
                            max_storage_gb: tenant.max_storage_gb,
                            updated_at: new Date()
                        },
                        $setOnInsert: {
                            tenant_id: tenant._id,
                            created_at: new Date()
                        }
                    },
                    { upsert: true }
                );
                console.log(`TenantSubscription synced for ${tenant.name}`);
            } catch (sycnError) {
                console.error(`Failed to sync TenantSubscription for ${tenant.name}:`, sycnError);
            }
        }

        console.log('Trial check completed successfully.');
        process.exit(0);

    } catch (error) {
        console.error('Error checking trial status:', error);
        process.exit(1);
    }
};

checkTrialStatus();
