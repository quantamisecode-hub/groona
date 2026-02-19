const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const Models = require('../models/SchemaDefinitions');

const styles = {
    body: "font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 0; color: #334155;",
    container: "max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0;",
    header: "background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); padding: 32px 0; text-align: center;", // Red header for Alarm
    headerTitle: "color: #ffffff; font-size: 26px; font-weight: 700; margin: 0; letter-spacing: -0.5px;",
    content: "padding: 40px 40px;",
    greeting: "font-size: 20px; font-weight: 600; color: #1e293b; margin-bottom: 16px;",
    text: "font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 24px;",
    infoBox: "background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px; padding: 20px; margin: 24px 0;", // Red tint for alarm
    infoRow: "margin: 8px 0; font-size: 14px; color: #475569;",
    label: "font-weight: 600; color: #7f1d1d; display: inline-block; min-width: 140px;",
    value: "color: #475569;",
    buttonGroup: "text-align: center; margin-top: 32px; margin-bottom: 16px;",
    primaryBtn: "display: inline-block; background-color: #ef4444; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 4px rgba(239, 68, 68, 0.2);",
    footer: "background-color: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;",
    divider: "height: 1px; background-color: #e2e8f0; margin: 32px 0;"
};

function getBaseTemplate(title, greeting, content) {
    const currentYear = new Date().getFullYear();
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="${styles.body}">
  <div style="${styles.container}">
    <div style="${styles.header}">
      <h1 style="${styles.headerTitle}">Groona</h1>
    </div>
    
    <div style="${styles.content}">
      <div style="${styles.greeting}">${greeting}</div>
      ${content}
      
      <div style="${styles.divider}"></div>
      
      <p style="font-size: 13px; color: #64748b; margin: 0;">
        This is an automated alarm from Groona. Immediate attention required.
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

function getAlertHtml(project, deadlineDate, forecastDate, daysOverdue, data) {
    const content = `
    <p style="${styles.text}">
        <strong>🚨 CRITICAL ALERT:</strong> The calculated forecast for project <strong>${project.name}</strong> indicates it will miss the deadline by <strong>${daysOverdue} days</strong>.
    </p>
    
    <div style="${styles.infoBox}">
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Planned Deadline:</span>
        <span style="${styles.value}"><strong>${deadlineDate.toLocaleDateString()}</strong></span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Forecasted End:</span>
        <span style="${styles.value}">
             <strong style="color: #ef4444;">${forecastDate.toLocaleDateString()}</strong>
        </span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Deviation:</span>
        <span style="${styles.value}"><strong>+${daysOverdue} Days</strong> (Threshold: >21 Days)</span>
      </div>
       <div style="${styles.infoRow}">
        <span style="${styles.label}">Remaining Scope:</span>
        <span style="${styles.value}">${data.remainingPoints} Points (Total: ${data.totalPoints})</span>
      </div>
       <div style="${styles.infoRow}">
        <span style="${styles.label}">Avg Velocity:</span>
        <span style="${styles.value}">${data.averageVelocity.toFixed(1)} Points/Sprint</span>
      </div>
    </div>

    <p style="${styles.text}">
        <strong>System Action Taken:</strong> Project scope has been automatically <strong>LOCKED</strong> to prevent further creep.
    </p>

    <div style="${styles.buttonGroup}">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/project/${project._id}" 
           style="${styles.primaryBtn}">
           View Project Dashboard
        </a>
    </div>
    `;

    return getBaseTemplate(
        '🚨 Project Deadline Risk Alert',
        'Hello Project Manager',
        content
    );
}

async function checkDeadlineRisk() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB.\n');

        const Project = mongoose.model('Project');
        const Story = mongoose.model('Story');
        const SprintVelocity = mongoose.model('SprintVelocity');
        const Notification = mongoose.model('Notification');
        const ProjectUserRole = mongoose.model('ProjectUserRole');
        const User = mongoose.model('User');
        const emailService = require('../services/emailService');

        // 1. Fetch Projects with deadlines
        const projects = await Project.find({
            deadline: { $exists: true, $ne: null },
            status: { $ne: 'completed' }
        });

        console.log(`🔍 Checking ${projects.length} active projects for deadline risk...\n`);

        let alertsSent = 0;
        let alertsSkipped = 0;
        let alertsFailed = 0;
        let risksFound = 0;

        for (const project of projects) {
            try {
                // A. Get Scope Data (Story Points)
                const stories = await Story.find({ project_id: project._id });
                const totalPoints = stories.reduce((sum, s) => sum + (Number(s.story_points) || 0), 0);

                // Completed points: status 'done' or 'completed'
                const completedPoints = stories.reduce((sum, s) => {
                    const status = (s.status || '').toLowerCase();
                    if (status === 'done' || status === 'completed') {
                        return sum + (Number(s.story_points) || 0);
                    }
                    return sum;
                }, 0);

                const remainingPoints = totalPoints - completedPoints;

                if (remainingPoints <= 0) {
                    // Project is effectively done or empty scope
                    continue;
                }

                // B. Get Velocity Data (Avg of last 3 sprints)
                const velocityRecords = await SprintVelocity.find({ project_id: project._id })
                    .sort({ measurement_date: -1 })
                    .limit(3);

                if (velocityRecords.length === 0) {
                    console.log(`    ℹ️  Project "${project.name}": No velocity data yet. Skipping forecast.`);
                    continue;
                }

                // Use 'completed_points' from velocity records
                const totalVelocity = velocityRecords.reduce((sum, v) => sum + (v.completed_points || 0), 0);
                const averageVelocity = totalVelocity / velocityRecords.length;

                if (averageVelocity === 0) {
                    console.log(`    ℹ️  Project "${project.name}": Average velocity is 0. Cannot forecast.`);
                    continue;
                }

                // C. Calculate Forecast
                // Assumption: 1 sprint = 14 days (2 weeks)
                const sprintsNeeded = remainingPoints / averageVelocity;
                const daysNeeded = Math.ceil(sprintsNeeded * 14);

                const today = new Date();
                const forecastDate = new Date();
                forecastDate.setDate(today.getDate() + daysNeeded);

                const deadline = new Date(project.deadline);

                // Calculate Overdue Days
                const diffTime = forecastDate - deadline;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                // Logging Calculation for Verification
                console.log(`stats for "${project.name}":`);
                console.log(`    - Scope: ${remainingPoints} remaining / ${totalPoints} total`);
                console.log(`    - Velocity: ${averageVelocity.toFixed(1)} avg (${velocityRecords.length} records)`);
                console.log(`    - Forecast: ${daysNeeded} days needed -> ${forecastDate.toLocaleDateString()}`);
                console.log(`    - Deadline: ${deadline.toLocaleDateString()}`);
                console.log(`    - Variation: ${diffDays} days`);

                // Trigger condition: > 21 days overdue
                if (diffDays > 21) {
                    risksFound++;
                    console.log(`    ⚠️  RISK DECTECTED! (+${diffDays} days)`);

                    // Check for duplicate alert (sent today)
                    const startOfDay = new Date();
                    startOfDay.setHours(0, 0, 0, 0);

                    const existingAlert = await Notification.findOne({
                        type: 'PM_DEADLINE_RISK',
                        project_id: project._id,
                        created_date: { $gt: startOfDay }
                    });

                    if (existingAlert) {
                        console.log(`    ⏭️  Alert already sent today. Skipping.`);
                        alertsSkipped++;
                        continue;
                    }

                    // Find Recipients
                    const pmRoles = await ProjectUserRole.find({
                        project_id: project._id,
                        $or: [
                            { role: 'project_manager' },
                            { role: 'admin', custom_role: 'project_manager' }
                        ]
                    });

                    let recipients = [];
                    if (pmRoles.length > 0) {
                        const pmIds = pmRoles.map(r => r.user_id);
                        recipients = await User.find({ _id: { $in: pmIds } });
                        console.log(`    👤 Found ${recipients.length} Project Manager(s)`);
                    } else {
                        // Fallback: Admin
                        const adminRoles = await ProjectUserRole.find({
                            project_id: project._id,
                            role: 'admin'
                        });
                        const adminIds = adminRoles.map(r => r.user_id);
                        recipients = await User.find({ _id: { $in: adminIds } });
                        console.log(`    👤 No PM found, utilizing ${recipients.length} Admin(s)`);
                    }

                    if (recipients.length === 0) {
                        console.log(`    ❌ No recipients found to alert.`);
                        alertsFailed++;
                        continue;
                    }

                    // Action: Update Project Scope Lock
                    if (project.scope_locked !== true) {
                        await Project.findByIdAndUpdate(project._id, { scope_locked: true });
                        console.log(`    🔒 LOCKED project scope due to risk.`);
                    } else {
                        console.log(`    🔒 Project scope already locked.`);
                    }

                    // Send Notifications
                    for (const recipient of recipients) {
                        // In-App
                        await Notification.create({
                            tenant_id: project.tenant_id,
                            recipient_email: recipient.email,
                            user_id: recipient._id,
                            type: 'PM_DEADLINE_RISK',
                            category: 'alarm', // Severity ALARM
                            title: '🚨 Project Deadline Risk',
                            message: `🚨 Deadline Risk: Forecast (${forecastDate.toLocaleDateString()}) exceeds deadline by ${diffDays} days based on current velocity. Scope locked.`,
                            entity_type: 'project',
                            entity_id: project._id,
                            project_id: project._id,
                            sender_name: 'System',
                            read: false,
                            created_date: new Date()
                        });

                        console.log(`    ✅ In-app notification sent to ${recipient.email}`);

                        // Email
                        try {
                            const emailHtml = getAlertHtml(project, deadline, forecastDate, diffDays, {
                                totalPoints,
                                remainingPoints,
                                averageVelocity
                            });

                            await emailService.sendEmail({
                                to: recipient.email,
                                subject: `🚨 Deadline Risk Alert: ${project.name}`,
                                html: emailHtml
                            });
                            console.log(`    ✅ Email sent to ${recipient.email}`);
                        } catch (emailErr) {
                            console.error(`    ❌ Failed to send email to ${recipient.email}:`, emailErr.message);
                        }

                        // Small delay to prevent rate limits
                        await new Promise(r => setTimeout(r, 500));
                    }

                    alertsSent++;
                    console.log(`    🚨 Alert processing complete for "${project.name}"`);
                }

            } catch (pErr) {
                console.error(`    ❌ Error processing project ${project.name}:`, pErr.message);
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('🚨 DEADLINE RISK CHECK SUMMARY');
        console.log('='.repeat(60));
        console.log(`Projects Checked: ${projects.length}`);
        console.log(`Risky Projects Found: ${risksFound}`);
        console.log(`✅ Alerts Triggered: ${alertsSent}`);
        console.log(`⏭️  Skipped (Duplicate): ${alertsSkipped}`);
        console.log(`❌ Failed (No Recipient): ${alertsFailed}`);
        console.log('='.repeat(60) + '\n');

        process.exit(0);

    } catch (err) {
        console.error('❌ Fatal Error:', err);
        process.exit(1);
    }
}

// Run the check
checkDeadlineRisk();
