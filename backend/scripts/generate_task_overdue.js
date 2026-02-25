const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('../config/db');
const path = require('path');

// Load Env
dotenv.config({ path: path.join(__dirname, '../.env') });

const OVERDUE_DAYS = 2; // Threshold
const ESCALATION_DAYS = 5; // Manager Escalation
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

        console.log(`\n=== TASK OVERDUE CHECK (> ${OVERDUE_DAYS} Days) ===`);
        console.log(`       ESCALATION THRESHOLD: ${ESCALATION_DAYS} Days`);

        const now = new Date();
        const thresholdDate = new Date();
        thresholdDate.setDate(now.getDate() - OVERDUE_DAYS);
        console.log(`Threshold Date: ${thresholdDate.toLocaleString()}`);

        // 1. Find pending tasks overdue beyond threshold
        const overdueTasks = await Task.find({
            status: { $nin: IGNORE_STATUSES },
            due_date: { $lt: thresholdDate }
        });

        console.log(`Found ${overdueTasks.length} potentially overdue tasks.`);

        for (const task of overdueTasks) {

            // --- LOGIC 1: Notify Assignee (Viewer) ---
            if (task.assigned_to && task.assigned_to.length > 0) {
                for (const email of task.assigned_to) {
                    const user = await User.findOne({ email: email });
                    if (!user) continue;

                    // CHECK ROLE: Strictly 'viewer'
                    if (user.custom_role !== 'viewer') continue;

                    // Calculate exact days overdue
                    const oneDay = 24 * 60 * 60 * 1000;
                    const dueDate = new Date(task.due_date);
                    const today = new Date();
                    const diffDays = Math.round(Math.abs((today - dueDate) / oneDay));

                    console.log(`   -> [ALERT] User ${user.email} has overdue task "${task.title}" (Overdue by ${diffDays} days)`);

                    if (diffDays >= 2) {
                        const existingAlert = await Notification.findOne({
                            user_id: user._id,
                            type: 'task_overdue_alert',
                            entity_id: task._id.toString(),
                            status: 'OPEN'
                        });

                        const message = `Task "${task.title}" is overdue by ${diffDays} days. due date was ${dueDate.toLocaleDateString()}. Immediate action required.`;

                        if (!existingAlert) {
                            await Notification.create({
                                tenant_id: user.tenant_id || 'default',
                                recipient_email: user.email,
                                user_id: user._id,
                                rule_id: 'VIEWER_ALERT_TASK_OVERDUE',
                                scope: 'user',
                                status: 'OPEN',
                                type: 'task_overdue_alert',
                                category: 'alert',
                                title: `🚨 Task Overdue (${diffDays} Days)`,
                                message: message,
                                entity_type: 'task',
                                entity_id: task._id.toString(),
                                project_id: task.project_id,
                                read: false,
                                created_date: new Date()
                            });
                            console.log(`      -> Created alert for ${user.email}`);
                        } else {
                            // Update existing
                            await Notification.updateOne(
                                { _id: existingAlert._id },
                                {
                                    $set: {
                                        title: `🚨 Task Overdue (${diffDays} Days)`,
                                        message: message,
                                        read: false,
                                        created_date: new Date() // Bump to top
                                    }
                                }
                            );
                            console.log(`      -> Updated existing alert for ${user.email}`);
                        }
                    }
                }
            }

            // --- LOGIC 2: Escalate to Manager (> 5 Days) ---
            const oneDay = 24 * 60 * 60 * 1000;
            const dueDate = new Date(task.due_date);
            const today = new Date();
            const diffDays = Math.round(Math.abs((today - dueDate) / oneDay));

            if (diffDays >= ESCALATION_DAYS) {
                console.log(`   -> [ESCALATION] Task "${task.title}" is ${diffDays} days overdue. Notifying Managers.`);

                // Identify Managers
                const recipients = new Set();
                const userIdsToCheck = new Set();
                const emailsToCheck = new Set();

                if (task.project_id) {
                    const project = await Project.findById(task.project_id);
                    if (project) {
                        // A. Owner
                        if (project.owner) {
                            if (project.owner.includes('@')) {
                                recipients.add(project.owner);
                                emailsToCheck.add(project.owner);
                            } else {
                                userIdsToCheck.add(project.owner);
                            }
                        }

                        // B. Team Members
                        if (project.team_members && Array.isArray(project.team_members)) {
                            project.team_members.forEach(m => {
                                if (typeof m === 'object') {
                                    if (m.user_id) userIdsToCheck.add(m.user_id);
                                    if (m.email) {
                                        emailsToCheck.add(m.email);
                                        if (m.role === 'project_manager') recipients.add(m.email);
                                    }
                                } else if (typeof m === 'string') {
                                    userIdsToCheck.add(m);
                                }
                            });
                        }

                        // C. ProjectUserRole
                        const pmRoles = await ProjectUserRole.find({ project_id: task.project_id });
                        pmRoles.forEach(r => {
                            if (r.user_id) userIdsToCheck.add(r.user_id);
                        });

                        // D. Resolve
                        if (userIdsToCheck.size > 0 || emailsToCheck.size > 0) {
                            const users = await User.find({
                                $or: [
                                    { _id: { $in: Array.from(userIdsToCheck) } },
                                    { email: { $in: Array.from(emailsToCheck) } }
                                ]
                            });

                            users.forEach(u => {
                                let isManager = false;
                                if (project.owner === u.id || project.owner === u._id.toString() || project.owner === u.email) isManager = true;
                                if (u.role === 'project_manager' || u.custom_role === 'project_manager') isManager = true;

                                // Check Explicit Project Role in Team Members
                                if (project.team_members && Array.isArray(project.team_members)) {
                                    const memberRec = project.team_members.find(m =>
                                        m.user_id === u.id || m.user_id === u._id.toString() || m.email === u.email
                                    );
                                    if (memberRec && memberRec.role === 'project_manager') isManager = true;
                                }

                                // Check ProjectUserRole
                                const userPmRole = pmRoles.find(r => r.user_id === u.id || r.user_id === u._id.toString());
                                if (userPmRole && userPmRole.role === 'project_manager') isManager = true;

                                if (isManager && u.email) {
                                    recipients.add(u.email);
                                }
                            });
                        }
                    }
                }

                console.log(`      -> Managers to Notify:`, Array.from(recipients));

                // Send Notifications
                for (const email of recipients) {
                    const user = await User.findOne({ email });
                    if (!user) continue;

                    const existingAlert = await Notification.findOne({
                        user_id: user._id,
                        type: 'task_escalation_alert',
                        entity_id: task._id.toString(),
                        status: 'OPEN'
                    });

                    const message = `ESCALATION: Task "${task.title}" is overdue by ${diffDays} days. Immediate intervention required.`;

                    if (!existingAlert) {
                        await Notification.create({
                            tenant_id: user.tenant_id || 'default',
                            recipient_email: user.email,
                            user_id: user._id,
                            rule_id: 'MANAGER_ESCALATION_TASK_OVERDUE',
                            scope: 'user',
                            status: 'OPEN',
                            type: 'task_escalation_alert',
                            category: 'alert',
                            title: `🔥 Escalation: Task Overdue (${diffDays} Days)`,
                            message: message,
                            entity_type: 'task',
                            entity_id: task._id.toString(),
                            project_id: task.project_id,
                            read: false,
                            created_date: new Date(),
                            // Deep Link to Blockers/Task view? Or just project detail
                            // Usually: /ProjectDetail?id={projectId}&tab=planning (to see task?) or Backlog?
                            deep_link: `/ProjectDetail?id=${task.project_id}`
                        });
                        console.log(`      -> Sent escalation to ${email}`);
                    } else {
                        await Notification.updateOne(
                            { _id: existingAlert._id },
                            {
                                $set: {
                                    title: `🔥 Escalation: Task Overdue (${diffDays} Days)`,
                                    message: message,
                                    read: false,
                                    created_date: new Date()
                                }
                            }
                        );
                        console.log(`      -> Updated escalation for ${email}`);
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
