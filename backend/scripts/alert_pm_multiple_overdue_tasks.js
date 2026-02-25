const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('../config/db');
const path = require('path');

// Load Env
dotenv.config({ path: path.join(__dirname, '../.env') });

const IGNORE_STATUSES = ['completed', 'done', 'closed', 'resolved', 'verified'];

const runChecks = async () => {
    try {
        await connectDB();
        console.log('MongoDB Connected via config/db');

        const Models = require('../models/SchemaDefinitions');
        const Sprint = Models.Sprint;
        const Task = Models.Task;
        const ProjectUserRole = Models.ProjectUserRole;
        const User = Models.User;
        const Project = Models.Project;
        const Notification = Models.Notification;
        const Tenant = Models.Tenant;

        console.log(`\n=== PM MULTIPLE OVERDUE TASKS ALARM CHECK (>20% Threshold) ===`);

        const tenants = await Tenant.find({});
        console.log(`Found ${tenants.length} tenants.`);

        const now = new Date();

        for (const tenant of tenants) {
            console.log(`\n--- Tenant: ${tenant.name || tenant._id} ---`);

            // 1. Find all sprints for the tenant (excluding completed if we want, but let's check all as requested)
            const sprints = await Sprint.find({
                tenant_id: tenant._id
            });

            console.log(`Found ${sprints.length} sprints in tenant.`);

            for (const sprint of sprints) {
                // 2. Find tasks for this sprint
                const tasks = await Task.find({
                    tenant_id: tenant._id,
                    sprint_id: String(sprint._id || sprint.id),
                });

                if (tasks.length === 0) {
                    continue; // Cannot check percentage if there are no tasks
                }

                // Count Overdue tasks
                const overdueTasks = tasks.filter(task => {
                    const statusMatch = !IGNORE_STATUSES.includes((task.status || '').toLowerCase());
                    if (!statusMatch || !task.due_date) return false;
                    const dueDate = new Date(task.due_date);
                    return dueDate < now;
                });

                const overduePercentage = overdueTasks.length / tasks.length;

                console.log(`   -> [SPRINT: ${sprint.name} | Status: ${sprint.status || 'unknown'}] Tasks: ${tasks.length}, Overdue Tasks: ${overdueTasks.length}, Overdue %: ${(overduePercentage * 100).toFixed(2)}%`);

                if (overduePercentage > 0.20) {
                    console.log(`      ⚠️ Overdue boundary exceeded for Sprint: ${sprint.name}`);

                    // 3. Find Project Managers (or Owners depending on assignment logic)
                    // Find PMs in the project
                    let recipients = new Set();

                    const pmRoles = await ProjectUserRole.find({
                        project_id: sprint.project_id,
                        role: 'project_manager'
                    });

                    for (const role of pmRoles) {
                        const user = await User.findById(role.user_id);
                        if (user) {
                            recipients.add(user.email);
                        }
                    }

                    // Fallback to project owner if no PMs found
                    if (recipients.size === 0) {
                        const project = await Project.findById(sprint.project_id);
                        if (project && project.owner) {
                            const owner = await User.findOne({
                                $or: [
                                    { _id: project.owner },
                                    { email: project.owner }
                                ]
                            });
                            if (owner) {
                                recipients.add(owner.email);
                            }
                        }
                    }

                    if (recipients.size === 0) {
                        console.log(`      -> No PMs or Owners found for Project ID ${sprint.project_id}. Skipping alert.`);
                        continue;
                    }

                    for (const pmEmail of recipients) {
                        const pmUser = await User.findOne({ email: pmEmail });
                        if (!pmUser) continue;

                        const alertTitle = `🚨 ALARM: Sprint Health at Risk (${sprint.name})`;
                        const alertMessage = `⚠️ Multiple overdue tasks detected (${overdueTasks.length} tasks / ${(overduePercentage * 100).toFixed(1)}%). Suggest reprioritization for Sprint: ${sprint.name}.`;

                        const cooldownPeriod = 24 * 60 * 60 * 1000; // 24 hours cooldown for spam protection

                        const testMode = process.argv.includes('--force');

                        // Check existing alerts to avoid spam
                        const existingAlert = await Notification.findOne({
                            user_id: pmUser._id,
                            type: 'PM_MULTIPLE_OVERDUE_TASKS',
                            entity_id: sprint._id.toString()
                        }).sort({ created_date: -1 }); // Get latest

                        if (testMode || !existingAlert || (now - new Date(existingAlert.created_date)) > cooldownPeriod) {
                            await Notification.create({
                                tenant_id: pmUser.tenant_id || tenant._id,
                                recipient_email: pmUser.email,
                                user_id: pmUser._id,
                                rule_id: 'PM_MULTIPLE_OVERDUE_TASKS',
                                scope: 'project',
                                status: 'OPEN',
                                type: 'PM_MULTIPLE_OVERDUE_TASKS',
                                category: 'alert', // High severity ALERT
                                title: alertTitle,
                                message: alertMessage,
                                project_id: sprint.project_id,
                                entity_type: 'sprint',
                                entity_id: sprint._id.toString(),
                                read: false,
                                link: `/ProjectDetail?id=${sprint.project_id}&sprintId=${sprint._id.toString()}`,
                                created_date: new Date()
                            });
                            console.log(`      -> Sent Sprint Overdue Alert to ${pmUser.email}`);
                        } else {
                            console.log(`      -> Cooldown active for PM ${pmUser.email} on Sprint ${sprint.name}`);
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
