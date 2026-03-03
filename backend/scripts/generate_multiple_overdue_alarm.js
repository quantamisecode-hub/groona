const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('../config/db');
const path = require('path');
const { sendEmail } = require('../services/emailService');

// Load Env
dotenv.config({ path: path.join(__dirname, '../.env') });

const IGNORE_STATUSES = ['Completed', 'Done', 'Closed', 'Resolved', 'done', 'completed', 'verified', 'closed'];
const THRESHOLD_COUNT = 3;

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

        console.log(`\n=== MULTIPLE OVERDUE ALARM CHECK (Threshold: >= ${THRESHOLD_COUNT} Tasks) ===`);

        const tenants = await Tenant.find({});
        console.log(`Found ${tenants.length} tenants.`);

        const now = new Date();

        for (const tenant of tenants) {
            console.log(`\n--- Tenant: ${tenant.name || tenant._id} ---`);

            // 2. Find All Relevant Members in this Tenant
            const members = await User.find({
                tenant_id: tenant._id,
                role: { $in: ['member', 'employee', 'user'] },
                custom_role: { $nin: ['project_manager', 'owner', 'client'] },
                status: 'active'
            });
            console.log(`Found ${members.length} potentially applicable members in tenant.`);

            for (const user of members) {
                // 3. Find Overdue Tasks for this User
                const overdueTasks = await Task.find({
                    assigned_to: user.email,
                    status: { $nin: IGNORE_STATUSES },
                    due_date: { $lt: now }
                }).sort({ due_date: 1 });

                const hasMultipleOverdue = overdueTasks.length >= THRESHOLD_COUNT;

                // Sync User Lock Flag
                if (user.is_overdue_blocked !== hasMultipleOverdue) {
                    await User.updateOne({ _id: user._id }, { $set: { is_overdue_blocked: hasMultipleOverdue } });
                    console.log(`   -> [STATUS] User ${user.email} is_overdue_blocked set to ${hasMultipleOverdue}`);
                }

                if (hasMultipleOverdue) {
                    console.log(`   -> [ALARM] User ${user.email} has ${overdueTasks.length} overdue tasks!`);

                    // A. Notify USER (Alarm)
                    // Link to the most overdue task
                    const mostOverdueTask = overdueTasks[0];
                    const alarmTitle = `🚨 ALARM: ${overdueTasks.length} Tasks Overdue!`;
                    const alarmMessage = `You have ${overdueTasks.length} overdue tasks. Immediately consultation with Project Manager required.`;

                    const existingAlarm = await Notification.findOne({
                        user_id: user._id,
                        type: 'multiple_overdue_alarm',
                        status: 'OPEN'
                    });

                    const isViewOnlyMember = user.role === 'member' && user.custom_role === 'viewer';

                    let shouldSendEmail = false;

                    if (!existingAlarm) {
                        await Notification.create({
                            tenant_id: user.tenant_id || 'default',
                            recipient_email: user.email,
                            user_id: user._id,
                            rule_id: 'VIEWER_ALARM_MULTIPLE_OVERDUE',
                            scope: 'user',
                            status: 'OPEN',
                            type: 'multiple_overdue_alarm',
                            category: 'alarm',
                            title: alarmTitle,
                            message: alarmMessage,
                            project_id: mostOverdueTask.project_id,
                            entity_type: 'task',
                            entity_id: mostOverdueTask._id.toString(),
                            read: false,
                            hide_action: isViewOnlyMember,
                            link: `/ProjectDetail?id=${mostOverdueTask.project_id}&taskId=${mostOverdueTask._id.toString()}`,
                            created_date: new Date(),
                            last_email_sent: new Date()
                        });
                        console.log(`      -> Sent User Alarm to ${user.email} (Hide Action: ${isViewOnlyMember})`);
                        shouldSendEmail = true;
                    } else {
                        // Cooldown: 4 hours
                        const lastSent = existingAlarm.last_email_sent;
                        const cooldownPeriod = 4 * 60 * 60 * 1000;
                        if (!lastSent || (new Date() - new Date(lastSent)) > cooldownPeriod) {
                            shouldSendEmail = true;
                        }

                        await Notification.updateOne(
                            { _id: existingAlarm._id },
                            {
                                $set: {
                                    title: alarmTitle,
                                    message: alarmMessage,
                                    created_date: new Date(),
                                    hide_action: isViewOnlyMember,
                                    read: false,
                                    link: `/ProjectDetail?id=${mostOverdueTask.project_id}&taskId=${mostOverdueTask._id.toString()}`,
                                    ...(shouldSendEmail ? { last_email_sent: new Date() } : {})
                                }
                            }
                        );
                        console.log(`      -> Updated User Alarm for ${user.email} (Email Should Send: ${shouldSendEmail})`);
                    }

                    if (shouldSendEmail) {
                        // Send Email Notification
                        await sendEmail({
                            to: user.email,
                            templateType: 'multiple_overdue_alarm',
                            data: {
                                userName: user.full_name || user.email,
                                userEmail: user.email,
                                overdueCount: overdueTasks.length,
                                taskTitles: overdueTasks.slice(0, 3).map(t => t.title).join(', '),
                                dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/Dashboard`
                            },
                            subject: alarmTitle
                        }).catch(e => console.error(`      -> Failed to send email to ${user.email}:`, e.message));
                        console.log(`      -> Sent User Alarm Email to ${user.email}`);
                    }

                    // B. Notify MANAGERS (Escalation)
                    // We need to notify managers for ALL projects involved? Or just the primary/most critical one?
                    // Let's notify managers of the Project associated with the most overdue task for simplicity and focus.
                    // OR we could collect all unique projects.
                    // Requirement: "system should Suggest Reprioritization... alarm to meet Project manager"
                    // "project manger and owner should get notified about it"

                    // Let's target the project of the most critical task.
                    const projectId = mostOverdueTask.project_id;
                    if (projectId) {
                        const project = await Project.findById(projectId);
                        if (project) {
                            const recipients = new Set();
                            const userIdsToCheck = new Set();
                            const emailsToCheck = new Set();

                            // (Copying Manager Discovery Logic from generate_task_overdue.js)
                            if (project.owner) {
                                if (project.owner.includes('@')) {
                                    recipients.add(project.owner);
                                    emailsToCheck.add(project.owner);
                                } else {
                                    userIdsToCheck.add(project.owner);
                                }
                            }

                            if (project.team_members && Array.isArray(project.team_members)) {
                                project.team_members.forEach(m => {
                                    if (typeof m === 'object') {
                                        if (m.user_id) userIdsToCheck.add(m.user_id);
                                        if (m.email) {
                                            emailsToCheck.add(m.email);
                                            if (m.role === 'project_manager') recipients.add(m.email);
                                        }
                                    } else if (typeof m === 'string') userIdsToCheck.add(m);
                                });
                            }

                            const pmRoles = await ProjectUserRole.find({ project_id: projectId });
                            pmRoles.forEach(r => { if (r.user_id) userIdsToCheck.add(r.user_id); });

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
                                    if (project.team_members && Array.isArray(project.team_members)) {
                                        const memberRec = project.team_members.find(m =>
                                            m.user_id === u.id || m.user_id === u._id.toString() || m.email === u.email
                                        );
                                        if (memberRec && memberRec.role === 'project_manager') isManager = true;
                                    }
                                    const userPmRole = pmRoles.find(r => r.user_id === u.id || r.user_id === u._id.toString());
                                    if (userPmRole && userPmRole.role === 'project_manager') isManager = true;

                                    if (isManager && u.email) recipients.add(u.email);
                                });
                            }

                            // Send Escalation to Managers
                            for (const managerEmail of recipients) {
                                const manager = await User.findOne({ email: managerEmail });
                                if (!manager) continue;

                                const escalationTitle = `🛡️ ESCALATION: Multiple Overdue Tasks (${user.full_name || user.email})`;
                                const escalationMessage = `User ${user.full_name || user.email} has ${overdueTasks.length} overdue tasks. Please schedule a reprioritization meeting immediately.`;

                                const existingEscalation = await Notification.findOne({
                                    user_id: manager._id,
                                    type: 'multiple_overdue_escalation',
                                    entity_id: user._id.toString(), // Entity is the User causing the alarm? Or the task? Let's say user.
                                    // Actually better to link to the Task so they can jump there.
                                    // entity_id: mostOverdueTask._id.toString(), 
                                    status: 'OPEN'
                                });

                                if (!existingEscalation) {
                                    await Notification.create({
                                        tenant_id: manager.tenant_id || 'default',
                                        recipient_email: manager.email,
                                        user_id: manager._id,
                                        rule_id: 'MANAGER_ESCALATION_MULTIPLE_OVERDUE',
                                        scope: 'user',
                                        status: 'OPEN',
                                        type: 'multiple_overdue_escalation',
                                        category: 'alarm', // High severity
                                        title: escalationTitle,
                                        message: escalationMessage,
                                        project_id: projectId,
                                        entity_type: 'task',
                                        entity_id: mostOverdueTask._id.toString(),
                                        read: false,
                                        link: `/ProjectDetail?id=${projectId}&taskId=${mostOverdueTask._id.toString()}`,
                                        created_date: new Date()
                                    });
                                    console.log(`      -> Sent Manager Escalation to ${manager.email}`);
                                } else {
                                    await Notification.updateOne(
                                        { _id: existingEscalation._id },
                                        {
                                            $set: {
                                                title: escalationTitle,
                                                message: escalationMessage,
                                                created_date: new Date(),
                                                read: false,
                                                link: `/ProjectDetail?id=${projectId}&taskId=${mostOverdueTask._id.toString()}`
                                            }
                                        }
                                    );
                                    console.log(`      -> Updated Manager Escalation for ${manager.email}`);
                                }
                            }
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
