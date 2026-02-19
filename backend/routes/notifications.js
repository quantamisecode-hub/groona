const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const path = require('path');
const emailService = require('../services/emailService');

// Models
// We assume Models are already registered in server.js or SchemaDefinitions.js
// But to be safe, get them via mongoose.model
const getModel = (name) => mongoose.model(name);

// POST /api/notifications/trigger-velocity-alert
router.post('/trigger-velocity-alert', async (req, res) => {
    try {
        const { sprintId, projectId, committed, completed, accuracy, sprintName, tenantId } = req.body;

        console.log(`[Velocity Alert] START trigger for Sprint "${sprintName}" (${sprintId})`);

        let Notification, ProjectUserRole, User;
        try {
            Notification = mongoose.model('Notification');
            ProjectUserRole = mongoose.model('ProjectUserRole');
            User = mongoose.model('User');
        } catch (modelError) {
            console.error('[Velocity Alert] ❌ Model loading failed:', modelError);
            return res.status(500).json({ error: 'Model loading failed: ' + modelError.message });
        }

        // 1. Duplicate Check
        // We check if we ALREADY sent an alert for this active sprint to avoid spamming on every page load
        const existingAlert = await Notification.findOne({
            entity_id: sprintId,
            type: 'PM_VELOCITY_DROP_ACTIVE'
        });

        if (existingAlert) {
            console.log(`[Velocity Alert] Alert already sent for ${sprintId}. Skipping.`);
            return res.status(200).json({ message: 'Alert already sent', sent: false });
        }

        // 2. Find Recipients (PM -> Admin)
        let recipients = [];

        // Try finding PM
        const pmRoles = await ProjectUserRole.find({
            project_id: projectId,
            role: 'project_manager'
        });
        console.log(`[Velocity Alert Debug] Project ${projectId}: Found ${pmRoles.length} PM roles.`);

        if (pmRoles.length > 0) {
            const userIds = pmRoles.map(r => r.user_id);
            recipients = await User.find({ _id: { $in: userIds } });
        }

        // Fallback to Admin if no PM
        if (recipients.length === 0) {
            console.log(`[Velocity Alert] No PM found for project ${projectId}. Checking Admins...`);
            const adminRoles = await ProjectUserRole.find({
                project_id: projectId,
                role: 'admin'
            });
            console.log(`[Velocity Alert Debug] Found ${adminRoles.length} Admin roles.`);

            if (adminRoles.length > 0) {
                const userIds = adminRoles.map(r => r.user_id);
                recipients = await User.find({ _id: { $in: userIds } });
            }
        }

        // Fallback: If still no one, try finding the workspace/tenant owner? 
        // Or just fail.
        if (recipients.length === 0) {
            console.log(`[Velocity Alert] ❌ CRITICAL: No PM or Admin found for project ${projectId}.`);
            // We return 200 to not break frontend, but we log it.
            return res.status(200).json({ message: 'No recipients found', sent: false });
        }

        // 3. Send Notifications
        for (const recipient of recipients) {
            // A. In-App
            await Notification.create({
                tenant_id: tenantId,
                recipient_email: recipient.email,
                user_id: recipient._id,
                type: 'PM_VELOCITY_DROP_ACTIVE', // Distinct type for active triggers
                category: 'alert',
                title: 'Low Sprint Velocity Alert',
                message: `⚠️ Active Sprint "${sprintName}" accuracy is ${accuracy}% (${completed}/${committed}).`,
                entity_type: 'sprint',
                entity_id: sprintId,
                project_id: projectId,
                sender_name: 'System',
                read: false,
                created_date: new Date()
            });

            // B. Email
            try {
                await emailService.sendEmail({
                    to: recipient.email,
                    subject: `Velocity Alert: ${sprintName}`,
                    html: `
                    <div style="font-family: Arial, sans-serif; color: #333;">
                        <h2 style="color: #d97706;">⚠️ Low Sprint Accuracy Detected</h2>
                        <p><strong>Sprint:</strong> ${sprintName} (Active)</p>
                        <p>The current accuracy for this sprint is below 85%.</p>
                        
                        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                        <tr style="background-color: #f3f4f6;">
                            <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: left;">Committed</th>
                            <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: left;">Completed</th>
                            <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: left;">Accuracy</th>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border: 1px solid #e5e7eb;">${committed} pts</td>
                            <td style="padding: 10px; border: 1px solid #e5e7eb;">${completed} pts</td>
                            <td style="padding: 10px; border: 1px solid #e5e7eb; color: #dc2626; font-weight: bold;">
                            ${accuracy}%
                            </td>
                        </tr>
                        </table>

                        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/project/${projectId}/sprint/${sprintId}" 
                            style="display: inline-block; background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px;">
                        View Dashboard
                        </a>
                    </div>
                    `
                });
                console.log(`[Velocity Alert] Email sent to ${recipient.email}`);
            } catch (err) {
                console.error(`[Velocity Alert] Failed to send email to ${recipient.email}:`, err);
            }
        }

        res.status(200).json({ message: 'Alert sent successfully', sent: true, recipients: recipients.length });

    } catch (error) {
        console.error('[Velocity Alert] Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
