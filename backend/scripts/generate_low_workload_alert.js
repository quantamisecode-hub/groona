const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('../config/db');
const path = require('path');
const { startOfWeek, endOfWeek, isWithinInterval } = require('date-fns');

// Load Env
dotenv.config({ path: path.join(__dirname, '../.env') });

const IGNORE_STATUSES = ['Completed', 'Done', 'Closed', 'Resolved', 'done', 'completed', 'verified', 'closed'];

const runChecks = async () => {
    try {
        await connectDB();
        console.log('MongoDB Connected via config/db');

        const Models = require('../models/SchemaDefinitions');
        const Task = Models.Task;
        const User = Models.User;
        const Notification = Models.Notification;
        const Project = Models.Project;
        const ProjectUserRole = Models.ProjectUserRole;
        const Tenant = Models.Tenant;

        console.log(`\n=== LOW WORKLOAD CHECK (< 70% Capacity) ===`);

        const tenants = await Tenant.find({});
        console.log(`Found ${tenants.length} tenants.`);

        const now = new Date();
        const weekStart = startOfWeek(now, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

        for (const tenant of tenants) {
            console.log(`\n--- Tenant: ${tenant.name || tenant._id} ---`);

            // 1. Get Active Viewers/Members in Tenant
            const users = await User.find({
                status: { $ne: 'inactive' },
                tenant_id: tenant._id,
                // role: { $in: ['member', 'viewer'] }
            });
            console.log(`Checking ${users.length} users in tenant...`);

            for (const user of users) {
                // 2. Calculate Weekly Capacity
                // Default: 8 hours/day * 5 days = 40 hours
                const dailyHours = user.working_hours_per_day || 8;
                const weeklyCapacity = dailyHours * 5;
                const threshold = weeklyCapacity * 0.70;

                // 3. Calculate Assigned Workload for THIS WEEK
                // Tasks due this week OR active tasks (spanning this week?)
                // Requirement: "<70% hours of his workload capacity of the resource planning per week"
                // Interpretation: Sum of 'estimated_hours' for tasks assigned to user DUE this week.

                const assignedTasks = await Task.find({
                    assigned_to: user.email,
                    status: { $nin: IGNORE_STATUSES },
                    due_date: { $gte: weekStart, $lte: weekEnd }
                });

                let totalHours = 0;
                assignedTasks.forEach(t => {
                    totalHours += (t.estimated_hours || 0);
                });

                console.log(`   -> User ${user.email}: ${totalHours} / ${weeklyCapacity} hrs (${(totalHours / weeklyCapacity * 100).toFixed(1)}%)`);

                if (totalHours < threshold) {
                    console.log(`      -> [ALERT] Low Workload detected! (< ${threshold} hrs)`);

                    const alertTitle = `📉 Low Workload Alert`;
                    const alertMessage = `Low Hours Detected: ${totalHours} hrs / ${weeklyCapacity} hrs capacity this week.`;

                    // A. Notify USER
                    const existingAlert = await Notification.findOne({
                        user_id: user._id,
                        type: 'low_workload_alert',
                        // limit to this week? Or just update status 'OPEN'
                        // If we want one per week, we could check created_date. 
                        // For now, standard "update existing OPEN" logic.
                        status: 'OPEN'
                    });

                    if (!existingAlert) {
                        await Notification.create({
                            tenant_id: user.tenant_id || 'default',
                            recipient_email: user.email,
                            user_id: user._id,
                            rule_id: 'LOW_WORKLOAD_WEEKLY',
                            scope: 'user',
                            status: 'OPEN',
                            type: 'low_workload_alert',
                            category: 'alert', // 'advisory'? User said 'alert'
                            title: alertTitle,
                            message: alertMessage,
                            read: false,
                            created_date: new Date()
                        });
                        console.log(`         -> Sent Alert to User`);
                    } else {
                        await Notification.updateOne(
                            { _id: existingAlert._id },
                            { $set: { title: alertTitle, message: alertMessage, created_date: new Date(), read: false } }
                        );
                    }

                    // B. Notify MANAGERS (of active projects)
                    // Find projects user is active on (even if no tasks, check team membership)
                    // This is tricky: if they have NO tasks, which PM do we notify?
                    // Strategy: Check all projects where user is a team member.

                    // Find projects where user is in team_members
                    const projects = await Project.find({
                        "team_members.email": user.email
                    });

                    const managersToNotify = new Set();

                    for (const project of projects) {
                        // Identify PMs for this project
                        // (Detailed PM discovery logic reused)

                        // 1. Owner
                        if (project.owner) {
                            if (project.owner.includes('@')) managersToNotify.add(project.owner);
                            else {
                                const owner = await User.findById(project.owner);
                                if (owner) managersToNotify.add(owner.email);
                            }
                        }
                        // 2. Team PMs
                        if (project.team_members) {
                            project.team_members.forEach(m => {
                                if (m.role === 'project_manager' && m.email) managersToNotify.add(m.email);
                            });
                        }
                        // 3. User Role PMs (Simplified check)
                        // (Skipping deep check for speed, usually Owner/Team PM covers it)
                    }

                    for (const managerEmail of managersToNotify) {
                        // Don't notify the user about themselves if they are their own manager (rare but possible)
                        if (managerEmail === user.email) continue;

                        const manager = await User.findOne({ email: managerEmail });
                        if (!manager) continue;

                        const mgrAlertTitle = `📉 Low Workload: ${user.full_name || user.email}`;
                        const mgrAlertMessage = `${user.full_name || user.email} has only ${totalHours} hrs assigned this week (<70% of ${weeklyCapacity}).`;

                        const existingMgrAlert = await Notification.findOne({
                            user_id: manager._id,
                            type: 'low_workload_alert',
                            entity_id: user._id.toString(), // Valid to link to User?
                            status: 'OPEN'
                        });

                        if (!existingMgrAlert) {
                            await Notification.create({
                                tenant_id: manager.tenant_id || 'default',
                                recipient_email: manager.email,
                                user_id: manager._id,
                                rule_id: 'MANAGER_LOW_WORKLOAD',
                                scope: 'user',
                                status: 'OPEN',
                                type: 'low_workload_alert',
                                category: 'alert',
                                title: mgrAlertTitle,
                                message: mgrAlertMessage,
                                entity_type: 'user',
                                entity_id: user._id.toString(),
                                read: false,
                                created_date: new Date()
                            });
                            console.log(`         -> Sent Alert to Manager ${managerEmail}`);
                        } else {
                            await Notification.updateOne(
                                { _id: existingMgrAlert._id },
                                { $set: { title: mgrAlertTitle, message: mgrAlertMessage, created_date: new Date(), read: false } }
                            );
                        }
                    }
                }
            }

        }

        console.log('=== CHECK COMPLETE ===');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

runChecks();
