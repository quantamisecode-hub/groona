const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('../config/db');
const path = require('path');
const emailService = require('../services/emailService');

// Load Env
dotenv.config({ path: path.join(__dirname, '../.env') });

const styles = {
    body: "font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 0; color: #334155;",
    container: "max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0;",
    header: "background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 32px 0; text-align: center;",
    headerTitle: "color: #ffffff; font-size: 26px; font-weight: 700; margin: 0; letter-spacing: -0.5px;",
    content: "padding: 40px 40px;",
    greeting: "font-size: 20px; font-weight: 600; color: #1e293b; margin-bottom: 16px;",
    text: "font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 24px;",
    infoBox: "background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 24px 0;",
    infoRow: "margin: 8px 0; font-size: 14px; color: #475569;",
    label: "font-weight: 600; color: #991b1b; display: inline-block; min-width: 140px;",
    value: "color: #475569;",
    buttonGroup: "text-align: center; margin-top: 32px; margin-bottom: 16px;",
    primaryBtn: "display: inline-block; background-color: #ef4444; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 4px rgba(239, 68, 68, 0.2);",
    footer: "background-color: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;",
    divider: "height: 1px; background-color: #e2e8f0; margin: 32px 0;"
};

function getCriticalAlertHtml(project, healthScore, indicators = []) {
    const currentYear = new Date().getFullYear();
    const indicatorList = indicators.length > 0
        ? indicators.map(ind => `<li style="margin-bottom: 4px;">${ind}</li>`).join('')
        : '<li>No specific indicators recorded</li>';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🚨 Alarm: High Financial Risk</title>
</head>
<body style="${styles.body}">
  <div style="${styles.container}">
    <div style="${styles.header}">
      <h1 style="${styles.headerTitle}">Groona ALARM</h1>
    </div>
    
    <div style="${styles.content}">
      <div style="${styles.greeting}">Critical Project Alert</div>
      <p style="${styles.text}">
          <strong>🚨 High financial risk detected for this project.</strong>
      </p>
      <p style="${styles.text}">
          Project <strong>${project.name}</strong> has a health index of ${healthScore}%, dropping below the critical 50% threshold. Immediate action and escalation is required.
      </p>
      
      <div style="${styles.infoBox}">
        <div style="${styles.infoRow}">
          <span style="${styles.label}">Project:</span>
          <span style="${styles.value}"><strong>${project.name}</strong></span>
        </div>
        <div style="${styles.infoRow}">
          <span style="${styles.label}">Health Score:</span>
          <span style="${styles.value}">
              <strong style="color: #ef4444;">${healthScore}%</strong> 
          </span>
        </div>
        <div style="${styles.infoRow}">
          <span style="${styles.label}">Status:</span>
          <span style="${styles.value}"><strong>${project.status}</strong></span>
        </div>
      </div>

      <p style="${styles.text}">
          <strong>Root Cause Indicators:</strong>
          <ul style="color: #475569; font-size: 15px; margin-top: 5px;">
             ${indicatorList}
          </ul>
      </p>

      <p style="${styles.text}">
          <strong>System Actions Taken/Recommended:</strong>
          <ul style="color: #475569; font-size: 15px; margin-top: 5px;">
             <li>Lock expansion</li>
             <li>Escalate to Admin</li>
          </ul>
      </p>

      <div style="${styles.buttonGroup}">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/ProjectDetail?id=${project._id}" 
             style="${styles.primaryBtn}">
             View Project Details
          </a>
      </div>
      
      <div style="${styles.divider}"></div>
      
      <p style="font-size: 13px; color: #64748b; margin: 0;">
        This represents an automated ALARM from Groona. Please review project risk immediately.
      </p>
    </div>

    <div style="${styles.footer}">
      <p style="margin: 0 0 8px 0;">&copy; ${currentYear} Groona Platform. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;
}

const runChecks = async () => {
    try {
        await connectDB();
        console.log('MongoDB Connected via config/db');

        const Models = require('../models/SchemaDefinitions');
        const ProjectUserRole = Models.ProjectUserRole;
        const User = Models.User;
        const Project = Models.Project;
        const Notification = Models.Notification;
        const Tenant = Models.Tenant;
        const Task = Models.Task;

        console.log(`\n=== PM PROJECT HEALTH RISK ALARM CHECK (< 70 Threshold) ===`);

        const tenants = await Tenant.find({});
        console.log(`Found ${tenants.length} tenants.`);

        const now = new Date();
        const testMode = process.argv.includes('--force');

        for (const tenant of tenants) {
            console.log(`\n--- Tenant: ${tenant.name || tenant._id} ---`);

            // Find all active/planning projects
            const projects = await Project.find({
                tenant_id: tenant._id,
                status: { $in: ['planning', 'active'] }
            });

            console.log(`Found ${projects.length} relevant projects in tenant.`);

            for (const project of projects) {
                // Fetch tasks for this project to calculate completion rate
                const tasks = await Task.find({ project_id: project._id });

                // --- Dynamic Health Score Calculation (Mirrors Frontend) ---
                let score = 70; // Base score
                let indicators = [];

                // Progress contribution (30 points)
                const progressContrib = (project.progress || 0) * 0.3;
                score += progressContrib;
                if ((project.progress || 0) < 40) {
                    indicators.push(`Low Project Progress: ${project.progress || 0}%`);
                }

                // Task completion rate (20 points)
                const completedTasks = tasks.filter(t => t.status === 'completed').length;
                const taskCompletionRate = tasks.length > 0 ? completedTasks / tasks.length : 0;
                score += taskCompletionRate * 20;
                if (taskCompletionRate < 0.5 && tasks.length > 0) {
                    indicators.push(`Low Task Completion: ${Math.round(taskCompletionRate * 100)}%`);
                }

                // Deadline check (deduct up to 20 points if overdue)
                if (project.deadline) {
                    const daysUntilDeadline = Math.ceil((new Date(project.deadline) - new Date()) / (1000 * 60 * 60 * 24));
                    if (daysUntilDeadline < 0) {
                        score -= 20; // Overdue
                        indicators.push(`Project is overdue by ${Math.abs(daysUntilDeadline)} days`);
                    } else if (daysUntilDeadline < 7) {
                        score -= 10; // Close to deadline
                        indicators.push(`Deadline is approaching (${daysUntilDeadline} days left)`);
                    }
                }

                // Status check
                if (project.status === 'on_hold') {
                    score -= 15;
                    indicators.push(`Project is currently 'On Hold'`);
                }
                if (project.status === 'completed') score = 100;

                // Risk level
                if (project.risk_level === 'critical') {
                    score -= 20;
                    indicators.push(`Critical Risk Level detected`);
                } else if (project.risk_level === 'high') {
                    score -= 15;
                    indicators.push(`High Risk Level flagged`);
                } else if (project.risk_level === 'medium') {
                    score -= 5;
                    indicators.push(`Medium Risk Level flagged`);
                }

                const healthScore = Math.max(0, Math.min(100, Math.round(score)));
                // ----------------------------------------------------------

                // Threshold check
                if (healthScore < 70) {
                    const isCritical = healthScore < 50;
                    console.log(`   -> [PROJECT: ${project.name} | Status: ${project.status}] Health Score: ${healthScore}% - ${isCritical ? '🚨 CRITICAL' : '⚠️ Below threshold'}`);

                    // Find Project Managers (or Owners depending on assignment logic)
                    let pmEmails = new Set();
                    let adminEmails = new Set();

                    const pmRoles = await ProjectUserRole.find({
                        project_id: project._id,
                        role: 'project_manager'
                    });

                    for (const role of pmRoles) {
                        const user = await User.findById(role.user_id);
                        if (user && user.status === 'active') pmEmails.add(user.email);
                    }

                    // Fallback to project owner if no PMs found
                    if (pmEmails.size === 0 && project.owner) {
                        const isObjectId = mongoose.Types.ObjectId.isValid(project.owner);
                        const query = isObjectId
                            ? { $or: [{ _id: project.owner }, { email: project.owner }] }
                            : { email: project.owner };

                        const owner = await User.findOne(query);
                        if (owner && owner.status === 'active') pmEmails.add(owner.email);
                    }

                    if (pmEmails.size === 0) {
                        console.log(`      -> No PMs or Owners found for Project ID ${project._id}. Skipping PM alert.`);
                        if (!isCritical) continue;
                    }

                    // If Critical, Escalate to Admin
                    if (isCritical) {
                        const admins = await User.find({ role: 'admin', status: 'active' });
                        admins.forEach(a => adminEmails.add(a.email));
                    }

                    // Combine and deduplicate
                    const allRecipients = new Set([...pmEmails, ...adminEmails]);

                    if (allRecipients.size === 0) continue;

                    for (const recipientEmail of allRecipients) {
                        const user = await User.findOne({ email: recipientEmail });
                        if (!user) continue;

                        const rootCauseMsg = indicators.length > 0
                            ? `\n\nRoot Cause Indicators:\n- ${indicators.join('\n- ')}`
                            : '';

                        const alertTitle = isCritical
                            ? `🚨 ALARM: Critical Health Risk (${healthScore}%) - ${project.name}`
                            : `🚨 ALERT: Declining Health Risk (${healthScore}%) - ${project.name}`;

                        const alertMessage = isCritical
                            ? `🚨 Critical health risk detected (${healthScore}%). Review root cause indicators.${rootCauseMsg}`
                            : `⚠️ Project health is declining (${healthScore}%). Review root cause indicators.${rootCauseMsg}`;

                        const alertType = isCritical ? 'PM_CRITICAL_PROJECT_HEALTH_RISK' : 'PM_PROJECT_HEALTH_RISK';
                        const alertCategory = isCritical ? 'alarm' : 'alert';

                        const cooldownPeriod = 24 * 60 * 60 * 1000; // 24 hours cooldown for spam protection

                        // Check existing alerts to avoid spam
                        const existingAlert = await Notification.findOne({
                            user_id: user._id,
                            type: alertType,
                            entity_id: project._id.toString()
                        }).sort({ created_date: -1 });

                        if (testMode || !existingAlert || (now - new Date(existingAlert.created_date)) > cooldownPeriod) {
                            let deepLink = `/ProjectDetail?id=${project._id.toString()}&highlightId=${project._id.toString()}`;

                            await Notification.create({
                                tenant_id: user.tenant_id || tenant._id,
                                recipient_email: user.email,
                                user_id: user._id,
                                rule_id: alertType,
                                scope: 'project',
                                status: 'OPEN',
                                type: alertType,
                                category: alertCategory,
                                title: alertTitle,
                                message: alertMessage,
                                project_id: project._id,
                                entity_type: 'project',
                                entity_id: project._id.toString(),
                                read: false,
                                link: deepLink,
                                created_date: new Date()
                            });
                            console.log(`      -> Sent ${alertType} to ${user.email}`);

                            if (isCritical) {
                                try {
                                    const emailHtml = getCriticalAlertHtml(project, healthScore, indicators);
                                    await emailService.sendEmail({
                                        to: user.email,
                                        subject: alertTitle,
                                        html: emailHtml
                                    });
                                    console.log(`      -> Sent Critical Email to ${user.email}`);
                                } catch (emailErr) {
                                    console.error(`      -> ❌ Failed to send email to ${user.email}:`, emailErr.message);
                                }
                            }
                        } else {
                            console.log(`      -> Cooldown active for ${user.email} on Project ${project.name}`);
                        }
                    }
                } else {
                    console.log(`   -> [PROJECT: ${project.name} | Status: ${project.status}] Health Score: ${healthScore} - OK`);
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
