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
    header: "background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 32px 0; text-align: center;", // Amber header for Alert
    headerTitle: "color: #ffffff; font-size: 26px; font-weight: 700; margin: 0; letter-spacing: -0.5px;",
    content: "padding: 40px 40px;",
    greeting: "font-size: 20px; font-weight: 600; color: #1e293b; margin-bottom: 16px;",
    text: "font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 24px;",
    infoBox: "background-color: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 20px; margin: 24px 0;", // Amber tint for alert
    infoRow: "margin: 8px 0; font-size: 14px; color: #475569;",
    label: "font-weight: 600; color: #92400e; display: inline-block; min-width: 140px;",
    value: "color: #475569;",
    buttonGroup: "text-align: center; margin-top: 32px; margin-bottom: 16px;",
    primaryBtn: "display: inline-block; background-color: #f59e0b; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 4px rgba(245, 158, 11, 0.2);",
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
        This is an automated alert from Groona. Please review team allocation.
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

function getAlertHtml(project, utilizationData) {
    const isAlarm = utilizationData.isAlarm;
    const title = isAlarm ? '🚨 Critical Underutilization Alarm' : '⚠️ Low Team Utilization Alert';
    const color = isAlarm ? '#ef4444' : '#d97706'; // Red vs Amber
    const bgColor = isAlarm ? '#fef2f2' : '#fffbeb';
    const borderColor = isAlarm ? '#fee2e2' : '#fcd34d';

    const content = `
    <p style="${styles.text}">
        ${isAlarm
            ? `<strong>🚨 CRITICAL ALARM:</strong> Critical underutilization detected for project <strong>${project.name}</strong>. Project efficiency is at risk.`
            : `<strong>⚠️ LOW UTILIZATION ALERT:</strong> Team utilization for project <strong>${project.name}</strong> has dropped below expected levels.`
        }
        (Current: <strong>${utilizationData.utilizationPercentage.toFixed(1)}%</strong>).
    </p>
    
    <div style="${styles.infoBox}">
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Project:</span>
        <span style="${styles.value}"><strong>${project.name}</strong></span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Team Size:</span>
        <span style="${styles.value}">${utilizationData.memberCount} Members</span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Recorded Hours:</span>
        <span style="${styles.value}">${utilizationData.totalHoursLogged.toFixed(1)} Hours</span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Expected Capacity:</span>
        <span style="${styles.value}">${utilizationData.totalCapacity.toFixed(1)} Hours</span>
      </div>
       <div style="${styles.infoRow}">
        <span style="${styles.label}">Utilization:</span>
        <span style="${styles.value}">
             <strong style="color: ${color};">${utilizationData.utilizationPercentage.toFixed(1)}%</strong>
        </span>
      </div>
    </div>

    <p style="${styles.text}">
        <strong>System Action:</strong> ${isAlarm ? 'Admin has been notified. Please provide utilization explanation.' : 'Consider redistributing tasks or checking for blockers.'}
    </p>

    <div style="${styles.buttonGroup}">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/project/${project._id}?tab=team" 
           style="${styles.primaryBtn}">
           View Team Efficiency
        </a>
    </div>
    `;

    return getBaseTemplate(
        title,
        'Hello Team',
        content
    );
}

async function checkTeamUtilization() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB.\n');

        const Project = mongoose.model('Project');
        const User = mongoose.model('User');
        const Timesheet = mongoose.model('Timesheet');
        const ProjectUserRole = mongoose.model('ProjectUserRole');
        const Notification = mongoose.model('Notification');
        const emailService = require('../services/emailService');

        // 1. Fetch Active Projects
        const projects = await Project.find({
            status: { $in: ['active', 'in_progress'] }
        });

        // Check for --force flag
        const forceRun = process.argv.includes('--force');
        if (forceRun) {
            console.log('⚠️  FORCE MODE ENABLED: Skipping duplicate checks.\n');
        }

        console.log(`🔍 Checking ${projects.length} active projects for low utilization...\n`);

        let alertsSent = 0;
        let alertsSkipped = 0;
        let alertsFailed = 0;
        let lowUtilProjects = 0;

        const today = new Date();
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(today.getDate() - 7);
        // Start of 7 days ago
        sevenDaysAgo.setHours(0, 0, 0, 0);

        for (const project of projects) {
            try {
                // A. Get Team Members
                // Fix: Use project.team_members array as primary source of truth, fallback to ProjectUserRole
                let memberEmails = [];
                let pmEmails = [];

                if (project.team_members && project.team_members.length > 0) {
                    memberEmails = project.team_members.map(m => m.email);
                    pmEmails = project.team_members
                        .filter(m => m.role === 'project_manager' || m.role === 'owner')
                        .map(m => m.email);
                } else {
                    // Fallback to ProjectUserRole
                    const teamRoles = await ProjectUserRole.find({
                        project_id: project._id,
                        role: { $in: ['team_member', 'project_manager'] }
                    });
                    const fallbackUsers = await User.find({ _id: { $in: teamRoles.map(r => r.user_id) } });
                    memberEmails = fallbackUsers.map(u => u.email);
                }

                if (memberEmails.length === 0) {
                    console.log(`    ℹ️  Project "${project.name}": No team members assigned. Skipping.`);
                    continue;
                }

                // Check for duplicates
                memberEmails = [...new Set(memberEmails)];

                const members = await User.find({ email: { $in: memberEmails }, status: 'active' });

                if (members.length === 0) continue;

                // B. Calculate Capacity & Actuals

                // Helper to get utilization for a date range
                const getUtilization = async (days) => {
                    const startDate = new Date();
                    startDate.setDate(today.getDate() - days);
                    startDate.setHours(0, 0, 0, 0);

                    let capacity = 0;
                    // Capacity: 5 days per week approximation
                    // days / 7 * 5 * dailyHours
                    // Simple approximation: (days * (5/7)) * dailyHours
                    const workingDaysFactor = 5 / 7;

                    for (const member of members) {
                        const dailyHours = member.working_hours_per_day || 8;
                        capacity += (days * workingDaysFactor) * dailyHours;
                    }

                    const timesheets = await Timesheet.find({
                        project_id: project._id,
                        user_email: { $in: members.map(m => m.email) },
                        date: { $gte: startDate.toISOString().split('T')[0] }
                    });

                    const logged = timesheets.reduce((sum, t) => sum + (Number(t.hours) || 0), 0);
                    const percentage = capacity > 0 ? (logged / capacity) * 100 : 0;

                    return { capacity, logged, percentage };
                };

                const stat30Days = await getUtilization(30);
                const stat7Days = await getUtilization(7);

                console.log(`stats for "${project.name}":`);
                console.log(`    - Team Size: ${members.length}`);
                console.log(`    - 30-Day Util: ${stat30Days.percentage.toFixed(1)}% (${stat30Days.logged.toFixed(1)} / ${stat30Days.capacity.toFixed(0)})`);
                console.log(`    - 7-Day Util : ${stat7Days.percentage.toFixed(1)}% (${stat7Days.logged.toFixed(1)} / ${stat7Days.capacity.toFixed(0)})`);

                // PRIORITY CHECK:
                // 1. Critical Alarm: < 65% for 30 days
                if (stat30Days.percentage < 65) {
                    lowUtilProjects++;
                    console.log(`    🚨 CRITICAL UNDERUTILIZATION! (< 65% in 30 days)`);

                    if (!forceRun) {
                        const startOfDay = new Date();
                        startOfDay.setHours(0, 0, 0, 0);

                        const existingAlarm = await Notification.findOne({
                            type: 'PM_CRITICAL_UNDERUTILIZATION_ALARM',
                            project_id: project._id,
                            created_date: { $gt: startOfDay }
                        });

                        if (existingAlarm) {
                            console.log(`    ⏭️  Alarm already sent today. Skipping.`);
                            alertsSkipped++;
                            continue;
                        }
                    } else {
                        console.log(`    ⚠️  (Force Run: Skipping duplicate check)`);
                    }

                    // Find Recipients (PMs + Admin fallback)
                    // Code reused from before...
                    let recipientEmails = [];
                    if (project.team_members && project.team_members.length > 0) {
                        recipientEmails = project.team_members
                            .filter(m => m.role === 'project_manager' || m.role === 'owner')
                            .map(m => m.email);
                    }

                    let recipients = [];
                    if (recipientEmails.length > 0) {
                        recipients = await User.find({ email: { $in: recipientEmails } });
                    }

                    if (recipients.length === 0) {
                        const pmRoles = await ProjectUserRole.find({
                            project_id: project._id,
                            $or: [{ role: 'project_manager' }, { role: 'admin', custom_role: 'project_manager' }]
                        });
                        if (pmRoles.length > 0) {
                            const pmIds = pmRoles.map(r => r.user_id);
                            recipients = await User.find({ _id: { $in: pmIds } });
                        }
                    }

                    // User Request: Notify Admin as well
                    const adminUsers = await User.find({ role: 'admin', status: 'active' });

                    // Combine PMs and Admins
                    recipients = [...recipients, ...adminUsers];

                    // Fallback to Owner ONLY if no PM or Admin found
                    if (recipients.length === 0) {
                        // Check Tenant Owner
                        if (project.tenant_id) {
                            const tenant = await mongoose.model('Tenant').findById(project.tenant_id);
                            if (tenant && tenant.owner_email) {
                                recipients = await User.find({ email: tenant.owner_email });
                            }
                        }

                        // If still no one, fallback to any Admin (extreme fallback)
                        if (recipients.length === 0) {
                            recipients = await User.find({ role: 'admin', status: 'active' });
                        }
                    }

                    const uniqueRecipients = [...recipients];

                    if (uniqueRecipients.length === 0) {
                        console.log(`    ❌ No recipients found.`);
                        alertsFailed++;
                        continue;
                    }

                    for (const recipient of uniqueRecipients) {
                        await Notification.create({
                            tenant_id: project.tenant_id,
                            recipient_email: recipient.email,
                            user_id: recipient._id,
                            type: 'PM_CRITICAL_UNDERUTILIZATION_ALARM',
                            category: 'alarm', // Severity ALARM
                            title: '🚨 Critical Underutilization',
                            message: `🚨 Critical underutilization detected for ${project.name} (${stat30Days.percentage.toFixed(0)}% over 30 days). Project efficiency may be impacted. Review and redistribute tasks.`,
                            system_action: "Require utilization explanation",
                            entity_type: 'project',
                            entity_id: project._id,
                            project_id: project._id,
                            sender_name: 'System',
                            read: false,
                            created_date: new Date(),
                            link: `/ProjectDetail?id=${project._id}&tab=team`
                        });
                        console.log(`    ✅ ALARM sent to ${recipient.email}`);

                        // Email (Simulated for now, use existing template but modify content?)
                        try {
                            // We could add getAlarmHtml here if needed, reused getAlertHtml with urgency
                            const emailHtml = getAlertHtml(project, {
                                memberCount: members.length,
                                totalCapacity: stat30Days.capacity,
                                totalHoursLogged: stat30Days.logged,
                                utilizationPercentage: stat30Days.percentage,
                                isAlarm: true
                            });
                            await emailService.sendEmail({
                                to: recipient.email,
                                subject: `🚨 Critical Underutilization Alarm: ${project.name}`,
                                html: emailHtml
                            });
                            console.log(`    ✅ Email sent to ${recipient.email}`);
                        } catch (e) { console.error(e.message); }
                    }
                    alertsSent++;

                }
                // 2. Warning Alert: < 75% for 7 days (ONLY if critical condition NOT met)
                else if (stat7Days.percentage < 75) {
                    lowUtilProjects++;
                    console.log(`    ⚠️  LOW UTILIZATION DETECTED! (< 75% in 7 days)`);

                    // Check duplicate alert today
                    const startOfDay = new Date();
                    startOfDay.setHours(0, 0, 0, 0);

                    const existingAlert = await Notification.findOne({
                        type: 'PM_LOW_TEAM_UTILIZATION',
                        project_id: project._id,
                        created_date: { $gt: startOfDay }
                    });

                    if (existingAlert) {
                        console.log(`    ⏭️  Alert already sent today. Skipping.`);
                        alertsSkipped++;
                        continue;
                    }

                    // Find Recipients (PMs only)
                    let recipientEmails = [];
                    if (project.team_members && project.team_members.length > 0) {
                        recipientEmails = project.team_members
                            .filter(m => m.role === 'project_manager' || m.role === 'owner')
                            .map(m => m.email);
                    }

                    let recipients = [];
                    if (recipientEmails.length > 0) {
                        recipients = await User.find({ email: { $in: recipientEmails } });
                    }

                    if (recipients.length === 0) {
                        const pmRoles = await ProjectUserRole.find({
                            project_id: project._id,
                            $or: [{ role: 'project_manager' }, { role: 'admin', custom_role: 'project_manager' }]
                        });
                        if (pmRoles.length > 0) {
                            const pmIds = pmRoles.map(r => r.user_id);
                            recipients = await User.find({ _id: { $in: pmIds } });
                        }
                    }

                    // Fallback to Owner
                    if (recipients.length === 0 && project.tenant_id) {
                        const tenant = await mongoose.model('Tenant').findById(project.tenant_id);
                        if (tenant && tenant.owner_email) {
                            recipients = await User.find({ email: tenant.owner_email });
                        }
                    }

                    if (recipients.length === 0) {
                        console.log(`    ❌ No recipients found.`);
                        alertsFailed++;
                        continue;
                    }

                    // Send Notifications
                    for (const recipient of recipients) {
                        // In-App
                        await Notification.create({
                            tenant_id: project.tenant_id,
                            recipient_email: recipient.email,
                            user_id: recipient._id,
                            type: 'PM_LOW_TEAM_UTILIZATION',
                            category: 'alert', // Severity ALERT
                            title: '⚠️ Low Team Utilization',
                            message: `⚠️ Team utilization for ${project.name} is ${stat7Days.percentage.toFixed(0)}% (Target > 75%). Consider reallocation.`,
                            entity_type: 'project',
                            entity_id: project._id,
                            project_id: project._id,
                            sender_name: 'System',
                            read: false,
                            created_date: new Date(),
                            link: `/ProjectDetail?id=${project._id}&tab=team`
                        });

                        console.log(`    ✅ In-app notification sent to ${recipient.email}`);

                        // Email
                        try {
                            const emailHtml = getAlertHtml(project, {
                                memberCount: members.length,
                                totalCapacity: stat7Days.capacity,
                                totalHoursLogged: stat7Days.logged,
                                utilizationPercentage: stat7Days.percentage,
                                isAlarm: false
                            });

                            await emailService.sendEmail({
                                to: recipient.email,
                                subject: `⚠️ Low Utilization Alert: ${project.name}`,
                                html: emailHtml
                            });
                            console.log(`    ✅ Email sent to ${recipient.email}`);
                        } catch (emailErr) {
                            console.error(`    ❌ Failed to send email to ${recipient.email}:`, emailErr.message);
                        }
                    }
                    alertsSent++;
                }

            } catch (pErr) {
                console.error(`    ❌ Error processing project ${project.name}:`, pErr.message);
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('⚠️  TEAM UTILIZATION CHECK SUMMARY');
        console.log('='.repeat(60));
        console.log(`Projects Checked: ${projects.length}`);
        console.log(`Low Util Projects: ${lowUtilProjects}`);
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

checkTeamUtilization();
