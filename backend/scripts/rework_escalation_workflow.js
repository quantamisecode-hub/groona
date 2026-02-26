const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const Models = require('../models/SchemaDefinitions');
const emailService = require('../services/emailService');

async function processEscalations() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB.\n');

        const Notification = mongoose.model('Notification');
        const User = mongoose.model('User');
        const Project = mongoose.model('Project');
        const ProjectUserRole = mongoose.model('ProjectUserRole');

        const now = new Date();
        const eightHoursAgo = new Date(now.getTime() - (8 * 60 * 60 * 1000));
        const twoHoursAgo = new Date(now.getTime() - (2 * 60 * 60 * 1000));
        const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
        const twelveHoursAgo = new Date(now.getTime() - (12 * 60 * 60 * 1000));

        console.log(`🔍 Checking for pending acknowledgments...`);

        // --- 1. REMINDERS ---
        const pendingReminders = await Notification.find({
            type: { $in: ['PM_HIGH_REWORK', 'PM_RUNAWAY_REWORK_ALARM'] },
            acknowledged: false,
            reminder_sent: false
        });

        for (const note of pendingReminders) {
            const createdDate = new Date(note.created_date);
            let shouldRemind = false;

            if (note.type === 'PM_HIGH_REWORK' && createdDate < eightHoursAgo) {
                shouldRemind = true;
            } else if (note.type === 'PM_RUNAWAY_REWORK_ALARM' && createdDate < twoHoursAgo) {
                shouldRemind = true;
            }

            if (shouldRemind) {
                console.log(`⏰ Sending reminder for notification ${note._id} (User: ${note.recipient_email})`);

                await Notification.create({
                    tenant_id: note.tenant_id,
                    recipient_email: note.recipient_email,
                    user_id: note.user_id,
                    type: 'PM_ALERT_REMINDER',
                    category: 'info',
                    title: "Reminder: Rework alert pending acknowledgement",
                    message: "Please acknowledge the rework alert.",
                    entity_type: note.entity_type,
                    entity_id: note.entity_id,
                    project_id: note.project_id,
                    sender_name: 'System',
                    read: false,
                    created_date: new Date(),
                    link: note.link
                });

                note.reminder_sent = true;
                await note.save();
            }
        }

        // --- 2. ESCALATIONS ---
        const pendingEscalations = await Notification.find({
            type: { $in: ['PM_HIGH_REWORK', 'PM_RUNAWAY_REWORK_ALARM'] },
            acknowledged: false,
            escalated_to_admin: false
        });

        for (const note of pendingEscalations) {
            const createdDate = new Date(note.created_date);
            let shouldEscalate = false;
            let hoursPassed = Math.round((now - createdDate) / (1000 * 60 * 60));

            if (note.type === 'PM_HIGH_REWORK' && createdDate < twentyFourHoursAgo) {
                shouldEscalate = true;
            } else if (note.type === 'PM_RUNAWAY_REWORK_ALARM' && createdDate < twelveHoursAgo) {
                shouldEscalate = true;
            }

            if (shouldEscalate) {
                console.log(`🚨 Escalating notification ${note._id} to admins...`);

                const project = await Project.findById(note.project_id);
                const projectName = project ? project.name : 'Unknown Project';

                // Find all admins for this tenant
                const admins = await User.find({
                    role: { $in: ['admin', 'owner'] },
                    tenant_id: note.tenant_id,
                    status: 'active'
                });

                for (const admin of admins) {
                    await Notification.create({
                        tenant_id: note.tenant_id,
                        recipient_email: admin.email,
                        user_id: admin._id,
                        type: 'PM_ALERT_ESCALATED',
                        category: 'alarm',
                        title: "PM did not acknowledge rework alert",
                        message: `Project: ${projectName}\nAlert pending for ${hoursPassed} hours\nAction recommended.`,
                        entity_type: 'project',
                        entity_id: note.project_id,
                        project_id: note.project_id,
                        sender_name: 'System',
                        read: false,
                        created_date: new Date(),
                        link: note.link
                    });
                }

                note.escalated_to_admin = true;
                await note.save();
            }
        }

        console.log('\n✅ Workflow processing complete.');
        mongoose.connection.close();
        process.exit(0);

    } catch (err) {
        console.error('❌ Fatal Error:', err);
        mongoose.connection.close();
        process.exit(1);
    }
}

processEscalations();
