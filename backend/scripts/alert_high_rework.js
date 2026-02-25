const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const Models = require('../models/SchemaDefinitions');
const emailService = require('../services/emailService');

const styles = {
    body: "font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 0; color: #334155;",
    container: "max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0;",
    header: "background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 32px 0; text-align: center;", // Red header for Critical Alert
    headerTitle: "color: #ffffff; font-size: 26px; font-weight: 700; margin: 0; letter-spacing: -0.5px;",
    content: "padding: 40px 40px;",
    greeting: "font-size: 20px; font-weight: 600; color: #1e293b; margin-bottom: 16px;",
    text: "font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 24px;",
    infoBox: "background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 24px 0;", // Red tint for alert
    infoRow: "margin: 8px 0; font-size: 14px; color: #475569;",
    label: "font-weight: 600; color: #991b1b; display: inline-block; min-width: 140px;",
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
        This is an automated alert from Groona. Please review project quality.
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

function getAlertHtml(project, sprint1Data, sprint2Data) {
    const title = '🚨 High Rework Trend Detected';

    const content = `
    <p style="${styles.text}">
        <strong>⚠️ Rework increasing. Check quality process.</strong>
    </p>
    <p style="${styles.text}">
        The team's rework percentage has exceeded 15% for the last 2 consecutive sprints on project <strong>${project.name}</strong>.
    </p>
    
    <div style="${styles.infoBox}">
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Project:</span>
        <span style="${styles.value}"><strong>${project.name}</strong></span>
      </div>
      <div style="${styles.divider}" style="margin: 12px 0;"></div>
      
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Sprint 1 (Recent):</span>
        <span style="${styles.value}"><strong>${sprint1Data.sprintName}</strong></span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Rework Ratio:</span>
        <span style="${styles.value}">
            <strong style="color: #ef4444;">${sprint1Data.reworkPercentage.toFixed(1)}%</strong> 
            (${sprint1Data.reworkHours.toFixed(1)} / ${sprint1Data.totalHours.toFixed(1)} hours)
        </span>
      </div>
      
      ${sprint2Data ? `
      <div style="${styles.divider}" style="margin: 12px 0;"></div>
      
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Sprint 2 (Previous):</span>
        <span style="${styles.value}"><strong>${sprint2Data.sprintName}</strong></span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Rework Ratio:</span>
        <span style="${styles.value}">
            <strong style="color: #ef4444;">${sprint2Data.reworkPercentage.toFixed(1)}%</strong>
            (${sprint2Data.reworkHours.toFixed(1)} / ${sprint2Data.totalHours.toFixed(1)} hours)
        </span>
      </div>
      ` : ''}
    </div>

    <p style="${styles.text}">
        <strong>System Actions Recommended:</strong>
        <ul style="color: #475569; font-size: 15px; margin-top: 5px;">
           <li>Suggest QA review</li>
           <li>Show rework heatmap</li>
        </ul>
    </p>

    <div style="${styles.buttonGroup}">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/project/${project._id}?tab=timesheets" 
           style="${styles.primaryBtn}">
           View Timesheets & Quality
        </a>
    </div>
    `;

    return getBaseTemplate(
        title,
        'Hello Project Manager',
        content
    );
}

function getRunawayAlertHtml(project, sprint1Data, sprint2Data, sprint3Data) {
    const title = '🚨 Runaway Rework Detected';

    const content = `
    <p style="${styles.text}">
        <strong>🚨 Runaway rework detected. Immediate action needed.</strong>
    </p>
    <p style="${styles.text}">
        The team's rework percentage has critically exceeded 25% for the last 3 consecutive sprints on project <strong>${project.name}</strong>.
    </p>
    
    <div style="${styles.infoBox}">
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Project:</span>
        <span style="${styles.value}"><strong>${project.name}</strong></span>
      </div>
      <div style="${styles.divider}" style="margin: 12px 0;"></div>
      
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Sprint 1 (Recent):</span>
        <span style="${styles.value}"><strong>${sprint1Data.sprintName}</strong></span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Rework Ratio:</span>
        <span style="${styles.value}">
            <strong style="color: #ef4444;">${sprint1Data.reworkPercentage.toFixed(1)}%</strong> 
            (${sprint1Data.reworkHours.toFixed(1)} / ${sprint1Data.totalHours.toFixed(1)} hours)
        </span>
      </div>
      
      <div style="${styles.divider}" style="margin: 12px 0;"></div>
      
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Sprint 2 (Previous):</span>
        <span style="${styles.value}"><strong>${sprint2Data.sprintName}</strong></span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Rework Ratio:</span>
        <span style="${styles.value}">
            <strong style="color: #ef4444;">${sprint2Data.reworkPercentage.toFixed(1)}%</strong>
            (${sprint2Data.reworkHours.toFixed(1)} / ${sprint2Data.totalHours.toFixed(1)} hours)
        </span>
      </div>
      
      <div style="${styles.divider}" style="margin: 12px 0;"></div>
      
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Sprint 3 (Oldest):</span>
        <span style="${styles.value}"><strong>${sprint3Data.sprintName}</strong></span>
      </div>
      <div style="${styles.infoRow}">
        <span style="${styles.label}">Rework Ratio:</span>
        <span style="${styles.value}">
            <strong style="color: #ef4444;">${sprint3Data.reworkPercentage.toFixed(1)}%</strong>
            (${sprint3Data.reworkHours.toFixed(1)} / ${sprint3Data.totalHours.toFixed(1)} hours)
        </span>
      </div>
    </div>

    <p style="${styles.text}">
        <strong>System Actions Recommended:</strong>
        <ul style="color: #475569; font-size: 15px; margin-top: 5px;">
           <li>Freeze backlog</li>
           <li>Auto-create tech-debt sprint</li>
           <li>Escalate to Admin</li>
        </ul>
    </p>

    <div style="${styles.buttonGroup}">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/project/${project._id}?tab=timesheets" 
           style="${styles.primaryBtn}">
           View Timesheets & Quality
        </a>
    </div>
    `;

    return getBaseTemplate(
        title,
        'Hello Project Manager',
        content
    );
}

const REWORK_THRESHOLD_PERCENT = 15.0;
const RUNAWAY_REWORK_PERCENT = 25.0;

async function checkHighReworkTrend() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB.\n');

        const Project = mongoose.model('Project');
        const Sprint = mongoose.model('Sprint');
        const User_timesheets = mongoose.model('User_timesheets');
        const User = mongoose.model('User');
        const ProjectUserRole = mongoose.model('ProjectUserRole');
        const Notification = mongoose.model('Notification');

        const testMode = process.argv.includes('--force');
        if (testMode) {
            console.log('⚠️  FORCE MODE ENABLED: Skipping duplicate checks.\n');
        }

        const activeProjects = await Project.find({
            status: { $in: ['active', 'in_progress'] }
        });

        console.log(`🔍 Checking ${activeProjects.length} active projects for high rework trend (>${REWORK_THRESHOLD_PERCENT}% in 2 sprints)...\n`);

        let alertsSent = 0;
        let projectsSkipped = 0;

        for (const project of activeProjects) {
            try {
                // Fetch the 3 most recent sprints for this project regardless of their status
                const latestSprints = await Sprint.find({
                    project_id: project._id
                }).sort({ end_date: -1 }).limit(3);

                if (latestSprints.length === 0) {
                    console.log(`    ℹ️  Project "${project.name}": 0 sprints found. Skipping.`);
                    projectsSkipped++;
                    continue;
                }

                // Process sprints
                const sprintMetrics = [];

                for (const sprint of latestSprints) {
                    // Try to get team members for the project to filter timesheets
                    let memberEmails = [];
                    if (project.team_members && project.team_members.length > 0) {
                        memberEmails = project.team_members.map(m => m.email);
                    } else {
                        const teamRoles = await ProjectUserRole.find({
                            project_id: project._id,
                            role: { $in: ['team_member', 'project_manager'] }
                        });
                        const fallbackUsers = await User.find({ _id: { $in: teamRoles.map(r => r.user_id) } });
                        memberEmails = fallbackUsers.map(u => u.email);
                    }

                    if (memberEmails.length === 0) {
                        break; // can't reliably calculate timesheets without members
                    }

                    memberEmails = [...new Set(memberEmails)];

                    // Fetch timesheets within sprint dates
                    const timesheets = await User_timesheets.find({
                        user_email: { $in: memberEmails },
                        timesheet_date: {
                            $gte: new Date(sprint.start_date),
                            $lte: new Date(sprint.end_date)
                        }
                    });

                    let sprintTotalMins = 0;
                    let sprintReworkMins = 0;

                    timesheets.forEach(ts => {
                        sprintTotalMins += (ts.total_time_submitted_in_day || 0);
                        sprintReworkMins += (ts.rework_time_in_day || 0);
                    });

                    const percentage = sprintTotalMins > 0 ? (sprintReworkMins / sprintTotalMins) * 100 : 0;

                    sprintMetrics.push({
                        sprintId: sprint._id,
                        sprintName: sprint.name,
                        totalHours: sprintTotalMins / 60,
                        reworkHours: sprintReworkMins / 60,
                        reworkPercentage: percentage
                    });
                }

                if (sprintMetrics.length === 0) continue;

                const sprint1 = sprintMetrics[0]; // Most recent
                const sprint2 = sprintMetrics.length > 1 ? sprintMetrics[1] : null; // Previous
                const sprint3 = sprintMetrics.length > 2 ? sprintMetrics[2] : null; // Oldest

                console.log(`Project: ${project.name}`);
                console.log(`  - ${sprint1.sprintName}: ${sprint1.reworkPercentage.toFixed(1)}%`);
                if (sprint2) console.log(`  - ${sprint2.sprintName}: ${sprint2.reworkPercentage.toFixed(1)}%`);
                if (sprint3) console.log(`  - ${sprint3.sprintName}: ${sprint3.reworkPercentage.toFixed(1)}%`);

                // CHECK CONDITION 1: Runaway Rework (3 consecutive sprints > 25%)
                let maxConsecutiveRunaway = 0;
                let currentRunawayStreak = 0;
                for (let i = sprintMetrics.length - 1; i >= 0; i--) {
                    if (sprintMetrics[i].reworkPercentage > RUNAWAY_REWORK_PERCENT) {
                        currentRunawayStreak++;
                        maxConsecutiveRunaway = Math.max(maxConsecutiveRunaway, currentRunawayStreak);
                    } else {
                        currentRunawayStreak = 0;
                    }
                }
                const isRunawayRework = maxConsecutiveRunaway >= 3;

                // CHECK CONDITION 2: High Rework (2 consecutive sprints > 15%)
                let maxConsecutiveHigh = 0;
                let currentHighStreak = 0;
                for (let i = sprintMetrics.length - 1; i >= 0; i--) {
                    // Check if strictly > 15%, but we must ensure we aren't counting the runaway ones if already handled,
                    // though if runaway is true, it processes runaway first so it's fine.
                    if (sprintMetrics[i].reworkPercentage > REWORK_THRESHOLD_PERCENT) {
                        currentHighStreak++;
                        maxConsecutiveHigh = Math.max(maxConsecutiveHigh, currentHighStreak);
                    } else {
                        currentHighStreak = 0;
                    }
                }
                const isHighRework = maxConsecutiveHigh >= 2;

                if (isRunawayRework) {
                    console.log(`    🚨 RUNAWAY REWORK TREND DETECTED! (>25% for 3 sprints)`);

                    if (!testMode) {
                        const startOfDay = new Date();
                        startOfDay.setHours(0, 0, 0, 0);
                        const existingAlert = await Notification.findOne({
                            type: 'PM_RUNAWAY_REWORK_ALARM',
                            project_id: project._id,
                            created_date: { $gte: startOfDay }
                        });
                        if (existingAlert) {
                            console.log(`    ⏭️  Runaway Alert already sent today. Skipping.`);
                            projectsSkipped++;
                            continue;
                        }
                    }

                    // Find PMs
                    let pmEmails = [];
                    if (project.team_members && project.team_members.length > 0) {
                        pmEmails = project.team_members.filter(m => m.role === 'project_manager' || m.role === 'owner').map(m => m.email);
                    }
                    let recipients = [];
                    if (pmEmails.length > 0) {
                        recipients = await User.find({ email: { $in: pmEmails }, status: 'active' });
                    } else {
                        const pmRoles = await ProjectUserRole.find({
                            project_id: project._id,
                            $or: [{ role: 'project_manager' }, { role: 'admin', custom_role: 'project_manager' }]
                        });
                        if (pmRoles.length > 0) {
                            recipients = await User.find({ _id: { $in: pmRoles.map(r => r.user_id) }, status: 'active' });
                        }
                    }

                    // System Action 3: Escalate to Admin
                    const admins = await User.find({ role: 'admin', status: 'active' });
                    // Merge admins avoiding duplicates
                    for (const admin of admins) {
                        if (!recipients.find(r => r._id.toString() === admin._id.toString())) {
                            recipients.push(admin);
                        }
                    }

                    if (recipients.length === 0) continue;

                    // System Action 1: Freeze backlog
                    await Project.updateOne({ _id: project._id }, { $set: { status: 'on_hold' } });
                    console.log(`    ✅ System Action: Backlog frozen (Project set to on_hold).`);

                    // System Action 2: Auto-create tech-debt sprint
                    const today = new Date();
                    const nextTwoWeeks = new Date(today);
                    nextTwoWeeks.setDate(nextTwoWeeks.getDate() + 14);

                    await Sprint.create({
                        tenant_id: project.tenant_id,
                        project_id: project._id,
                        name: "Tech-Debt Sprint (Auto)",
                        start_date: today,
                        end_date: nextTwoWeeks,
                        status: 'planning',
                        goal: '🚨 Auto-generated sprint to address runaway rework (> 25% for 3 sprints).'
                    });
                    console.log(`    ✅ System Action: Auto-created tech-debt sprint.`);

                    for (const recipient of recipients) {
                        await Notification.create({
                            tenant_id: project.tenant_id,
                            recipient_email: recipient.email,
                            user_id: recipient._id,
                            type: 'PM_RUNAWAY_REWORK_ALARM',
                            category: 'alarm',
                            title: '🚨 Runaway Rework Detected',
                            message: '🚨 Runaway rework detected. Immediate action needed.',
                            entity_type: 'project',
                            entity_id: project._id,
                            project_id: project._id,
                            sender_name: 'System',
                            read: false,
                            created_date: new Date(),
                            link: `/ProjectDetail?id=${project._id}&showReworkPopup=true`,
                            metadata: {
                                recentSprints: sprintMetrics.slice(0, 3).map(s => ({
                                    name: s.sprintName,
                                    rework: s.reworkPercentage
                                }))
                            }
                        });
                        console.log(`    ✅ In-app notification saved for ${recipient.email}`);
                        try {
                            const emailHtml = getRunawayAlertHtml(project, sprint1, sprint2, sprint3);
                            await emailService.sendEmail({
                                to: recipient.email,
                                subject: `🚨 Runaway Rework Alarm: ${project.name}`,
                                html: emailHtml
                            });
                            console.log(`    ✅ Email sent to ${recipient.email}`);
                        } catch (emailErr) {
                            console.error(`    ❌ Failed to send email to ${recipient.email}:`, emailErr.message);
                        }
                    }
                    alertsSent++;

                } else if (isHighRework) {
                    console.log(`    ⚠️ HIGH REWORK TREND DETECTED! (>15% for 2 sprints)`);

                    // Duplicate check
                    if (!testMode) {
                        const startOfDay = new Date();
                        startOfDay.setHours(0, 0, 0, 0);

                        const existingAlert = await Notification.findOne({
                            type: 'PM_HIGH_REWORK',
                            project_id: project._id,
                            created_date: { $gte: startOfDay }
                        });

                        // Optionally, also check if a runaway alert was sent today so we don't spam both
                        const runawayExisting = await Notification.findOne({
                            type: 'PM_RUNAWAY_REWORK_ALARM',
                            project_id: project._id,
                            created_date: { $gte: startOfDay }
                        });

                        if (existingAlert || runawayExisting) {
                            console.log(`    ⏭️  Alert/Alarm already sent today. Skipping.`);
                            projectsSkipped++;
                            continue;
                        }
                    }

                    // Find Project Manager
                    let pmEmails = [];
                    if (project.team_members && project.team_members.length > 0) {
                        pmEmails = project.team_members
                            .filter(m => m.role === 'project_manager' || m.role === 'owner')
                            .map(m => m.email);
                    }

                    let recipients = [];
                    if (pmEmails.length > 0) {
                        recipients = await User.find({ email: { $in: pmEmails }, status: 'active' });
                    } else {
                        const pmRoles = await ProjectUserRole.find({
                            project_id: project._id,
                            $or: [{ role: 'project_manager' }, { role: 'admin', custom_role: 'project_manager' }]
                        });
                        if (pmRoles.length > 0) {
                            const pmIds = pmRoles.map(r => r.user_id);
                            const pms = await User.find({ _id: { $in: pmIds }, status: 'active' });
                            recipients.push(...pms);
                        }
                    }

                    // Add Admins to recipients (Ensure Admin also gets rework notifications)
                    const admins = await User.find({ role: { $in: ['admin', 'owner'] }, status: 'active' });
                    for (const admin of admins) {
                        if (!recipients.find(r => r._id.toString() === admin._id.toString())) {
                            recipients.push(admin);
                        }
                    }

                    if (recipients.length === 0) {
                        console.log(`    ❌ No Project Manager found for ${project.name}. Cannot send alert.`);
                        continue;
                    }

                    for (const recipient of recipients) {
                        // In-app Notification
                        await Notification.create({
                            tenant_id: project.tenant_id,
                            recipient_email: recipient.email,
                            user_id: recipient._id,
                            type: 'PM_HIGH_REWORK',
                            category: 'alert',
                            title: 'High Rework Trend',
                            message: '⚠️ Rework increasing. Check quality process.',
                            entity_type: 'project',
                            entity_id: project._id,
                            project_id: project._id,
                            sender_name: 'System',
                            read: false,
                            created_date: new Date(),
                            link: `/ProjectDetail?id=${project._id}&showReworkPopup=true`,
                            metadata: {
                                recentSprints: sprintMetrics.slice(0, 2).map(s => ({
                                    name: s.sprintName,
                                    rework: s.reworkPercentage
                                }))
                            }
                        });
                        console.log(`    ✅ In-app notification saved for ${recipient.email}`);

                        // Email removed as per requirement: only in-app notification for > 15%
                    }
                    alertsSent++;
                }

            } catch (pErr) {
                console.error(`    ❌ Error processing project ${project.name}:`, pErr.message);
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('⚠️  HIGH REWORK CHECK SUMMARY');
        console.log('='.repeat(60));
        console.log(`Projects Checked: ${activeProjects.length}`);
        console.log(`✅ Alerts Triggered: ${alertsSent}`);
        console.log(`⏭️  Skipped (Not enough sprints or duplicate): ${projectsSkipped}`);
        console.log('='.repeat(60) + '\n');

        mongoose.connection.close();
        process.exit(0);

    } catch (err) {
        console.error('❌ Fatal Error:', err);
        mongoose.connection.close();
        process.exit(1);
    }
}

checkHighReworkTrend();
