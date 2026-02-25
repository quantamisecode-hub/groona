const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const Models = require('../models/SchemaDefinitions');

async function checkAndAlertLowVelocity() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB.\n');

        const SprintVelocity = mongoose.model('SprintVelocity');
        const Sprint = mongoose.model('Sprint');
        const Notification = mongoose.model('Notification');
        const ProjectUserRole = mongoose.model('ProjectUserRole');
        const User = mongoose.model('User');
        const Project = mongoose.model('Project');
        const emailService = require('../services/emailService');

        // 1. Get all unique projects that have velocity data
        const projectsWithVelocity = await SprintVelocity.distinct('project_id');
        console.log(`🔍 Checking ${projectsWithVelocity.length} projects for consecutive low velocity...\n`);

        let lowVelocitySprints = [];

        // 2. Check each project for consecutive low velocity
        for (const projectId of projectsWithVelocity) {
            // Fetch all velocity records for the project, sorted by latest end date and creation
            const allVelocityRecords = await SprintVelocity.find({
                project_id: projectId
            }).sort({ sprint_end_date: -1, created_date: -1 });

            if (allVelocityRecords.length === 0) {
                continue;
            }

            // Deduplicate to get the latest record per unique sprint
            const uniqueSprintsMap = new Map();
            for (const record of allVelocityRecords) {
                if (!uniqueSprintsMap.has(record.sprint_id)) {
                    uniqueSprintsMap.set(record.sprint_id, record);
                }
            }

            const lastSprints = Array.from(uniqueSprintsMap.values()).slice(0, 2);

            const latestSprint = lastSprints[0];
            const previousSprint = lastSprints.length > 1 ? lastSprints[1] : null;

            if (latestSprint.accuracy < 85) {
                if (previousSprint && previousSprint.accuracy < 85) {
                    console.log(`⚠️  Project ${projectId} has critically low velocity (<85%) for 2 consecutive sprints:`);
                    console.log(`   - ${latestSprint.sprint_name}: ${latestSprint.accuracy.toFixed(1)}%`);
                    console.log(`   - ${previousSprint.sprint_name}: ${previousSprint.accuracy.toFixed(1)}%`);

                    latestSprint.alert_type = 'PM_CONSISTENT_VELOCITY_DROP';
                    latestSprint.alert_category = 'alarm';
                    latestSprint.prev_accuracy = previousSprint.accuracy;
                    latestSprint.prev_sprint_name = previousSprint.sprint_name;

                    lowVelocitySprints.push(latestSprint);
                } else {
                    console.log(`⚠️  Project ${projectId} velocity for the latest sprint dropped below 85%:`);
                    console.log(`   - ${latestSprint.sprint_name}: ${latestSprint.accuracy.toFixed(1)}%`);

                    latestSprint.alert_type = 'PM_VELOCITY_DROP';
                    latestSprint.alert_category = 'alert';

                    lowVelocitySprints.push(latestSprint);
                }
            }
        }

        if (lowVelocitySprints.length === 0) {
            console.log('✅ No projects found with 2 consecutive low-velocity sprints (<85%).\n');
            process.exit(0);
        }

        console.log(`\n🚨 Found ${lowVelocitySprints.length} projects requiring alerts.\n`);

        let alertsSent = 0;
        let alertsSkipped = 0;
        let alertsFailed = 0;

        for (const velocityRecord of lowVelocitySprints) {
            try {
                console.log(`\n📊 Processing Alert for Sprint: "${velocityRecord.sprint_name}"`);

                // Check if alert already sent
                // Check if alert already sent today (unless --force is used)
                const forceMode = process.argv.includes('--force');
                const startOfDay = new Date();
                startOfDay.setHours(0, 0, 0, 0);

                const existingAlert = await Notification.findOne({
                    type: velocityRecord.alert_type,
                    project_id: velocityRecord.project_id,
                    'data.sprint_id': velocityRecord.sprint_id,
                    created_date: { $gt: startOfDay }
                });

                if (existingAlert && !forceMode) {
                    console.log(`   ⏭️  Alert already sent on ${new Date(existingAlert.created_date).toLocaleString()}, skipping... (Use --force to ignore)`);
                    alertsSkipped++;
                    continue;
                }

                if (forceMode && existingAlert) {
                    console.log(`   ⚠️  Force Mode: Resending alert even though one was sent on ${new Date(existingAlert.created_date).toLocaleString()}`);
                }

                // Get sprint details
                const sprint = await Sprint.findById(velocityRecord.sprint_id);
                if (!sprint) {
                    console.log(`   ⚠️  Sprint not found in database, skipping...`);
                    alertsFailed++;
                    continue;
                }

                // Get project details
                const project = await Project.findById(velocityRecord.project_id);
                if (!project) {
                    console.log(`   ⚠️  Project not found in database, skipping...`);
                    alertsFailed++;
                    continue;
                }

                // Find Project Managers (Standard PMs OR Admins acting as PMs)
                const pmRoles = await ProjectUserRole.find({
                    project_id: velocityRecord.project_id,
                    $or: [
                        { role: 'project_manager' },
                        { role: 'admin', custom_role: 'project_manager' }
                    ]
                });

                let recipients = [];
                if (pmRoles.length > 0) {
                    const pmIds = pmRoles.map(r => r.user_id);
                    recipients = await User.find({ _id: { $in: pmIds } });
                    console.log(`   👤 Found ${recipients.length} Project Manager(s)`);
                } else {
                    // Fallback: Admin
                    const adminRoles = await ProjectUserRole.find({
                        project_id: velocityRecord.project_id,
                        role: 'admin'
                    });
                    const adminIds = adminRoles.map(r => r.user_id);
                    recipients = await User.find({ _id: { $in: adminIds } });
                    console.log(`   👤 No PM found, using ${recipients.length} Admin(s)`);
                }

                if (recipients.length === 0) {
                    console.log(`   ❌ No recipients found (no PM or Admin)`);
                    alertsFailed++;
                    continue;
                }

                // Apply System Actions: Freeze commitments if it's an ALARM
                if (velocityRecord.alert_type === 'PM_CONSISTENT_VELOCITY_DROP') {
                    await Project.findByIdAndUpdate(velocityRecord.project_id, {
                        commitments_frozen: true
                    });
                    console.log(`   ❄️  System Action Executed: Project ${velocityRecord.project_id} commitments frozen.`);
                }

                // Send notifications to each recipient
                for (const recipient of recipients) {
                    // Create in-app notification
                    await Notification.create({
                        tenant_id: velocityRecord.tenant_id,
                        recipient_email: recipient.email,
                        user_id: recipient._id,
                        type: velocityRecord.alert_type,
                        category: velocityRecord.alert_category,
                        title: velocityRecord.alert_type === 'PM_CONSISTENT_VELOCITY_DROP' ? '🚨 Consistent Low Velocity Alarm' : '⚠️ Low Velocity Alert',
                        message: velocityRecord.alert_type === 'PM_CONSISTENT_VELOCITY_DROP'
                            ? `**${project.name}** velocity is critically low (<85%) for 2 consecutive sprints. Latest: ${velocityRecord.accuracy.toFixed(1)}%, Previous: ${velocityRecord.prev_accuracy.toFixed(1)}%. Immediate review required.`
                            : `**${project.name}** velocity dropped below 85% for the latest sprint. Latest: ${velocityRecord.accuracy.toFixed(1)}%. Review required.`,
                        entity_type: 'sprint',
                        entity_id: velocityRecord.sprint_id,
                        project_id: velocityRecord.project_id,
                        sender_name: 'System',
                        read: false,
                        created_date: new Date()
                    });

                    console.log(`   ✅ In-app notification created for ${recipient.email}`);

                    // Send email notification ONLY for ALARMs (2 consecutive sprints)
                    if (velocityRecord.alert_type === 'PM_CONSISTENT_VELOCITY_DROP') {
                        try {
                            await emailService.sendEmail({
                                to: recipient.email,
                                subject: `🚨 Alarm: Consistent Low Velocity - ${project.name}`,
                                html: getAlertHtml(velocityRecord, project)
                            });
                            console.log(`   ✅ Email sent to ${recipient.email}`);
                        } catch (emailErr) {
                            console.error(`   ❌ Failed to send email to ${recipient.email}:`, emailErr.message);
                        }
                    } else {
                        console.log(`   ⏭️  Email skipped for ${recipient.email} (Only required for consecutive drops)`);
                    }

                    // Rate Limit safeguard: Wait 1s between emails
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                alertsSent++;
                console.log(`   🚨 Alert sent for "${velocityRecord.sprint_name}"`);

            } catch (err) {
                console.error(`   ❌ Error processing sprint "${velocityRecord.sprint_name}":`, err.message);
                alertsFailed++;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('🎯 VELOCITY ALERT SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total Projects with Consecutive Low Velocity: ${lowVelocitySprints.length}`);
        console.log(`✅ Alerts Sent: ${alertsSent}`);
        console.log(`⏭️  Alerts Skipped (already sent): ${alertsSkipped}`);
        console.log(`❌ Alerts Failed: ${alertsFailed}`);
        console.log('='.repeat(60) + '\n');

        process.exit(0);

    } catch (err) {
        console.error('❌ Fatal Error:', err);
        process.exit(1);
    }
}

const styles = {
    body: "font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 0; color: #334155;",
    container: "max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0;",
    header: "background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 32px 0; text-align: center;",
    headerTitle: "color: #ffffff; font-size: 26px; font-weight: 700; margin: 0; letter-spacing: -0.5px;",
    content: "padding: 40px 40px;",
    greeting: "font-size: 20px; font-weight: 600; color: #1e293b; margin-bottom: 16px;",
    text: "font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 24px;",
    infoBox: "background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; margin: 24px 0;",
    infoRow: "margin: 8px 0; font-size: 14px; color: #475569;",
    label: "font-weight: 600; color: #1e293b; display: inline-block; min-width: 120px;",
    value: "color: #475569;",
    buttonGroup: "text-align: center; margin-top: 32px; margin-bottom: 16px;",
    primaryBtn: "display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);",
    statusBadge: "display: inline-block; padding: 6px 12px; border-radius: 6px; font-size: 13px; font-weight: 600;",
    divider: "height: 1px; background-color: #e2e8f0; margin: 32px 0;",
    footer: "background-color: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;",
    link: "color: #2563eb; text-decoration: none;"
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
        This is an automated notification from Groona. If you have any questions, please contact your administrator.
      </p>
    </div>

    <div style="${styles.footer}">
      <p style="margin: 0 0 8px 0;">&copy; ${currentYear} Groona Platform. All rights reserved.</p>
      <p style="margin: 0;">Please do not reply to this email address.</p>
    </div>
  </div>
</body>
</html>
  `;
}

// Helper function to generate Email HTML
function getAlertHtml(velocityRecord, project) {
    const isAlarm = velocityRecord.alert_type === 'PM_CONSISTENT_VELOCITY_DROP';
    const alertTitle = isAlarm ? 'Consistent Low Velocity Detected' : 'Velocity Drop Detected';
    const description = isAlarm
        ? `The velocity for your project <strong>${project.name || 'Unknown Project'}</strong> is critically low (<85%) for 2 consecutive sprints. Immediate action is required.`
        : `The velocity for your project <strong>${project.name || 'Unknown Project'}</strong> dropped below the 85% threshold for the latest sprint. Please review to prevent further drops.`;

    const content = `
    <p style="${styles.text}">${description}</p>
    
    <div style="${styles.infoBox}">
      <div style="${styles.infoRow}">
          <span style="${styles.label}">Latest Sprint:</span>
          <span style="${styles.value}">
            <strong>${velocityRecord.sprint_name}</strong>: 
            <span style="color: #ef4444; font-weight: bold;">
                ${velocityRecord.accuracy.toFixed(1)}%
            </span>
          </span>
      </div>

      ${isAlarm && velocityRecord.prev_sprint_name ? `
      <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e2e8f0;">
        <div style="${styles.infoRow}">
          <span style="${styles.label}">Previous Sprint:</span>
          <span style="${styles.value}">
            ${velocityRecord.prev_sprint_name}: 
            <span style="color: #ef4444; font-weight: bold;">
                ${velocityRecord.prev_accuracy ? velocityRecord.prev_accuracy.toFixed(1) : '0.0'}%
            </span>
          </span>
        </div>
      </div>
      ` : ''}
    </div>
    
    <p style="${styles.text}">Consistent low velocity may indicate blockers or capacity issues. Please review recent retrospectives and sprint plans.</p>
    <div style="${styles.buttonGroup}">
       <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/project/${velocityRecord.project_id}/sprint/${velocityRecord.sprint_id}" 
           style="${styles.primaryBtn}">
           View Sprint Details
        </a>
    </div>`;

    return getBaseTemplate(alertTitle, 'Hello Project Manager', content);
}

// Run the alert check
checkAndAlertLowVelocity();
