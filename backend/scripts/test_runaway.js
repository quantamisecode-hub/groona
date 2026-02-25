const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const Models = require('../models/SchemaDefinitions');
const emailService = require('../services/emailService');

// Dummy styles and templates from alert_high_rework.js
const styles = {
    body: "font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 0; color: #334155;",
    container: "max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0;",
    header: "background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 32px 0; text-align: center;",
    headerTitle: "color: #ffffff; font-size: 26px; font-weight: 700; margin: 0; letter-spacing: -0.5px;",
    content: "padding: 40px 40px;",
    greeting: "font-size: 20px; font-weight: 600; color: #1e293b; margin-bottom: 16px;",
    text: "font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 24px;",
    infoBox: "background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 24px 0;",
    infoRow: "display: flex; justify-content: space-between; margin-bottom: 12px; align-items: center;",
    label: "font-size: 14px; color: #64748b; font-weight: 500;",
    value: "font-size: 15px; color: #1e293b; font-weight: 600;",
    divider: "height: 1px; background-color: #e2e8f0; margin: 20px 0;",
    buttonGroup: "text-align: center; margin-top: 32px;",
    primaryBtn: "display: inline-block; background-color: #ef4444; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 15px; border: 1px solid #dc2626;"
};

function getBaseTemplate(title, greeting, customContent) {
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
                <h1 style="${styles.headerTitle}">${title}</h1>
            </div>
            <div style="${styles.content}">
                ${greeting ? `<div style="${styles.greeting}">${greeting},</div>` : ''}
                ${customContent}
            </div>
        </div>
    </body>
    </html>
    `;
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
      <div style="${styles.divider}"></div>
      
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
      
      <div style="${styles.divider}"></div>
      
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
      
      <div style="${styles.divider}"></div>
      
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
        <strong>System Actions Applied:</strong>
        <ul style="color: #475569; font-size: 15px; margin-top: 5px;">
           <li>Backlog Status set to "On Hold"</li>
           <li>Tech-debt sprint auto-created</li>
           <li>Escalated to Admin</li>
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

const RUNAWAY_REWORK_PERCENT = 25.0;

async function testRunawayRework() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB.\\n');

        const Project = mongoose.model('Project');
        const Sprint = mongoose.model('Sprint');
        const User = mongoose.model('User');
        const ProjectUserRole = mongoose.model('ProjectUserRole');
        const Notification = mongoose.model('Notification');

        // Let's test using the "Marketing Team" project
        const project = await Project.findOne({ name: "Marketing Team" });
        if (!project) {
            console.log("❌ Could not find 'Marketing Team' project.");
            process.exit(1);
        }

        console.log(`🧪 Running TEST for Runaway Rework on Project: ${project.name}`);

        // Mock 3 sprints with > 25% rework
        const sprintMetrics = [
            { sprintId: "1", sprintName: "Testing", totalHours: 100, reworkHours: 35, reworkPercentage: 35.0 }, // [0] Recent
            { sprintId: "2", sprintName: "sprint 1", totalHours: 100, reworkHours: 30, reworkPercentage: 30.0 }, // [1] Previous
            { sprintId: "3", sprintName: "sprint 2", totalHours: 100, reworkHours: 26, reworkPercentage: 26.0 }  // [2] Oldest
        ];

        console.log(`  - ${sprintMetrics[0].sprintName}: ${sprintMetrics[0].reworkPercentage.toFixed(1)}%`);
        console.log(`  - ${sprintMetrics[1].sprintName}: ${sprintMetrics[1].reworkPercentage.toFixed(1)}%`);
        console.log(`  - ${sprintMetrics[2].sprintName}: ${sprintMetrics[2].reworkPercentage.toFixed(1)}%`);

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

        if (isRunawayRework) {
            console.log(`\n    🚨 RUNAWAY REWORK TREND DETECTED! (>25% for 3 sprints)`);

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

            // Escalate to Admin
            const admins = await User.find({ role: 'admin', status: 'active' });
            for (const admin of admins) {
                if (!recipients.find(r => r._id.toString() === admin._id.toString())) {
                    recipients.push(admin);
                }
            }

            console.log(`    ✅ System Action: Backlog frozen (Project set to on_hold). (Simulated)`);
            // await Project.updateOne({ _id: project._id }, { $set: { status: 'on_hold' } });

            console.log(`    ✅ System Action: Auto-created tech-debt sprint. (Simulated)`);

            for (const recipient of recipients) {
                console.log(`    ✅ In-app notification would be saved for ${recipient.email}`);
                try {
                    const emailHtml = getRunawayAlertHtml(project, sprintMetrics[0], sprintMetrics[1], sprintMetrics[2]);
                    await emailService.sendEmail({
                        to: recipient.email,
                        subject: `🚨 TEST - Runaway Rework Alarm: ${project.name}`,
                        html: emailHtml
                    });
                    console.log(`    ✅ Email sent to ${recipient.email}`);
                } catch (emailErr) {
                    console.error(`    ❌ Failed to send email to ${recipient.email}:`, emailErr.message);
                }
            }
        }

        console.log('\n✅ Test complete.');
        mongoose.connection.close();
        process.exit(0);

    } catch (err) {
        console.error('❌ Fatal Error:', err);
        mongoose.connection.close();
        process.exit(1);
    }
}

testRunawayRework();
