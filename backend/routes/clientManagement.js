const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
// nodemailer removed - using Resend SDK now
const { User, ProjectClient } = require('../models/SchemaDefinitions');
const auth = require('../middleware/auth');
const { getClientInvitationTemplate, getClientResetPasswordTemplate } = require('../utils/clientEmailTemplates');

// --- HELPER: Send Email using Resend ---
async function sendClientEmail(to, subject, html) {
    if (!process.env.RESEND_API_KEY) {
        console.warn('[Email] RESEND_API_KEY is missing. Skipping email.');
        return;
    }

    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const from = process.env.MAIL_FROM || 'Groona <no-reply@quantumisecode.com>';

    try {
        console.log(`[Email] Sending "${subject}" to ${to}...`);
        await resend.emails.send({
            from: from,
            to: Array.isArray(to) ? to : [to],
            subject: subject,
            html: html
        });
        console.log(`[Email] Sent successfully to ${to}`);
    } catch (error) {
        console.error(`[Email] Failed to send to ${to}:`, error);
    }
}

// --- HELPER: Get Frontend URL ---
const getFrontendUrl = (req) => {
    // FRONTEND_URL must be set in .env
    if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL;

    // Fallback: Try to infer from request (for development only)
    const host = req.get('host');
    if (host && (host.includes('localhost') || host.includes('127.0.0.1'))) {
        console.warn('FRONTEND_URL not set in .env, using inferred localhost URL. Please set FRONTEND_URL in .env');
        return 'http://localhost:5173';
    }
    if (host && host.startsWith('api.')) {
        return `${req.protocol}://${host.replace('api.', 'app.')}`;
    }
    if (host) {
        return `${req.protocol}://${host.replace('api.', '')}`;
    }

    throw new Error('FRONTEND_URL not configured and could not be inferred from request');
};

// @route   POST api/clients/invite
// @desc    Create Client, Assign Projects, Send Email with Auto-Login & Change Password Links
router.post('/invite', auth, async (req, res) => {
    const { email, name, project_ids, can_comment, tenant_id, client_id } = req.body;
    const cleanEmail = email.toLowerCase().trim();

    try {
        let user = await User.findOne({ email: cleanEmail });
        let tempPassword = `Client${Math.random().toString(36).slice(-6)}!`;
        let isNew = false;

        // 1. Create or Update User
        if (!user) {
            isNew = true;
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(tempPassword, salt);

            user = new User({
                email: cleanEmail,
                full_name: name,
                password: hashedPassword,
                role: 'member',
                custom_role: 'client',
                tenant_id: tenant_id,
                client_id: client_id,
                status: 'active',
                account_status: 'active'
            });
            await user.save();
        } else {
            if (user.custom_role !== 'client') {
                user.custom_role = 'client';
                await user.save();
            }
        }

        // 2. Assign Projects
        if (project_ids && project_ids.length > 0) {
            const operations = project_ids.map(projectId => ({
                updateOne: {
                    filter: { tenant_id, project_id: projectId, client_user_id: user.id },
                    update: {
                        $set: {
                            client_email: cleanEmail,
                            client_name: name,
                            can_comment,
                            revoked: false,
                            assigned_by: req.user.email,
                            assigned_date: new Date()
                        }
                    },
                    upsert: true
                }
            }));
            await ProjectClient.bulkWrite(operations);
        }

        // 3. Send Email
        const baseUrl = getFrontendUrl(req);

        // AUTO LOGIN LINK: Passes credentials in URL (Note: Security Risk, but implemented as requested)
        // For existing users, we don't overwrite password, so we don't send auto-login for them unless we just reset it.
        // But for invites, we usually only send credentials for NEW users.
        let autoLoginLink = `${baseUrl}/SignIn`;
        if (isNew) {
            autoLoginLink = `${baseUrl}/SignIn?email=${encodeURIComponent(cleanEmail)}&password=${encodeURIComponent(tempPassword)}&autoLogin=true`;
        }

        // CHANGE PASSWORD LINK: Points to the new separate page
        // We pass the "oldPassword" (temp password) so the form can pre-fill it.
        let changePasswordLink = `${baseUrl}/ClientChangePassword?email=${encodeURIComponent(cleanEmail)}`;
        if (isNew) {
            changePasswordLink += `&oldPassword=${encodeURIComponent(tempPassword)}`;
        }

        const emailBody = getClientInvitationTemplate(
            name,
            cleanEmail,
            tempPassword,
            autoLoginLink,
            changePasswordLink,
            isNew
        );

        if (isNew) {
            sendClientEmail(cleanEmail, 'Your Project Access Credentials', emailBody)
                .catch(err => console.error("Async Email Error:", err));
        } else {
            sendClientEmail(cleanEmail, 'New Project Access Granted', emailBody)
                .catch(err => console.error("Async Email Error:", err));
        }

        res.json({
            success: true,
            message: 'Client invited successfully',
            credentials: isNew ? { email: cleanEmail, password: tempPassword } : null
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// @route   POST api/clients/change-password
// @desc    Allow client to change password using old password verification (No Auth Token needed initially)
router.post('/change-password', async (req, res) => {
    const { email, oldPassword, newPassword } = req.body;

    try {
        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Verify Old Password
        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) return res.status(400).json({ error: 'Invalid old password' });

        // Update to New Password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// @route   DELETE api/clients/:id
router.delete('/:id', auth, async (req, res) => {
    try {
        const userId = req.params.id;
        await User.findByIdAndDelete(userId);
        await ProjectClient.deleteMany({ client_user_id: userId });
        res.json({ success: true, message: 'Client deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// @route   PUT api/clients/:id
// @desc    Update client details AND sync project assignments
router.put('/:id', auth, async (req, res) => {
    try {
        const { full_name, email, project_ids, client_id, status } = req.body;
        const userId = req.params.id;
        const tenant_id = req.user.tenant_id; // Assumes admin is making the change

        // 1. Update User Profile
        const user = await User.findByIdAndUpdate(userId, { full_name, email, client_id, status }, { new: true });
        if (!user) return res.status(404).json({ error: 'Client not found' });

        // 2. Update cached names in ProjectClient table
        await ProjectClient.updateMany(
            { client_user_id: userId },
            { client_name: full_name, client_email: email }
        );

        // 3. Sync Project Assignments if project_ids is provided
        if (project_ids && Array.isArray(project_ids)) {
            // A. Get current assignments
            const existingAssignments = await ProjectClient.find({ client_user_id: userId });
            const existingProjectIds = existingAssignments.map(a => a.project_id.toString());

            // B. Identify Projects to ADD (New selection - Existing)
            const toAdd = project_ids.filter(id => !existingProjectIds.includes(id));

            // C. Identify Projects to REMOVE (Existing - New Selection)
            const toRemove = existingProjectIds.filter(id => !project_ids.includes(id));

            // D. Perform Removals
            if (toRemove.length > 0) {
                await ProjectClient.deleteMany({
                    client_user_id: userId,
                    project_id: { $in: toRemove }
                });
            }

            // E. Perform Additions
            if (toAdd.length > 0) {
                const newAssignments = toAdd.map(projectId => ({
                    tenant_id: tenant_id, // Ensure tenant context is maintained
                    project_id: projectId,
                    client_user_id: userId,
                    client_email: email,
                    client_name: full_name,
                    assigned_by: req.user.email,
                    assigned_date: new Date(),
                    revoked: false,
                    can_comment: true // Default permission, adjust if you have a field for this
                }));
                await ProjectClient.insertMany(newAssignments);
            }
        }

        res.json({ success: true, message: 'Client and projects updated successfully' });
    } catch (err) {
        console.error("Update Error:", err);
        res.status(500).json({ error: err.message });
    }
});
// @route   POST api/clients/reset-password
router.post('/reset-password', auth, async (req, res) => {
    const { user_id } = req.body;
    try {
        const user = await User.findById(user_id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const newPassword = `Reset${Math.random().toString(36).slice(-6)}!`;
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        const baseUrl = getFrontendUrl(req);
        // Auto Login Link for Reset
        const autoLoginLink = `${baseUrl}/SignIn?email=${encodeURIComponent(user.email)}&password=${encodeURIComponent(newPassword)}&autoLogin=true`;

        const emailBody = getClientResetPasswordTemplate(newPassword, autoLoginLink);

        sendClientEmail(user.email, 'Security Update: Password Reset', emailBody)
            .catch(err => console.error("Async Password Reset Email Error:", err));

        res.json({ success: true, new_password: newPassword });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;