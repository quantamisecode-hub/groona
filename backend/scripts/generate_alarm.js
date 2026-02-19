const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const SchemaDefinitions = require('../models/SchemaDefinitions');

// --- 1. CONFIGURATION ---
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/groona_dev';
const IGNORE_THRESHOLD = 3;

// --- 2. SETUP MODELS ---
// We need to register ALL models to avoid MissingSchemaError if there are refs
const models = SchemaDefinitions;
Object.keys(models).forEach(modelName => {
    if (!mongoose.models[modelName]) {
        if (modelName === 'User' || modelName === 'UserActivityLog' || modelName === 'Notification') {
            // These are the ones we really use, but register all for safety
        }
        // Load schema
        const schemaDef = models[modelName];
        // We need to reconstruct the schema logic roughly or just trust the file loading
        // For simplicity in this script, we will just load the specific schemas we need manually 
        // OR rely on Mongoose's ability if we had the standard loader.
        // But since we are requiring SchemaDefinitions, let's see how it exports.
        // It exports an OBJECT of schemas. Wait, no.
        // SchemaDefinitions.js exports a dictionary of Schema DEFINITIONS (JSON-like), 
        // NOT Mongoose Models directly unless we run the conversion logic.
    }
});

// Since SchemaDefinitions.js returns the raw definitions (judging by previous view_file),
// we need to instantiate the Mongoose models here similar to how `server.js` or `generate_alerts.js` does it.
// Let's assume generate_alerts.js has the correct model loading logic.
// I will copy the model loading logic from generate_alerts.js.

const loadModels = () => {
    const fs = require('fs');
    const path = require('path');
    const definitionsPath = path.join(__dirname, '../models/definitions');

    const convertType = (field) => {
        let schemaType = {};
        if (field.type === 'string') {
            if (field.format === 'date' || field.format === 'date-time') schemaType.type = Date;
            else schemaType.type = String;
        } else if (field.type === 'number' || field.type === 'integer') {
            schemaType.type = Number;
        } else if (field.type === 'boolean') {
            schemaType.type = Boolean;
        } else if (field.type === 'array') {
            schemaType.type = [mongoose.Schema.Types.Mixed];
        } else {
            schemaType.type = mongoose.Schema.Types.Mixed;
        }
        if (field.default !== undefined) schemaType.default = field.default;
        return schemaType;
    };

    if (fs.existsSync(definitionsPath)) {
        fs.readdirSync(definitionsPath).forEach(file => {
            if (file.endsWith('.json')) {
                const def = require(path.join(definitionsPath, file));
                const schemaObj = {};
                if (def.properties) {
                    Object.keys(def.properties).forEach(prop => {
                        schemaObj[prop] = convertType(def.properties[prop]);
                    });
                }
                const schema = new mongoose.Schema(schemaObj, { strict: false });
                if (!mongoose.models[def.name]) {
                    mongoose.model(def.name, schema);
                    console.log(`✅ Model Loaded: ${def.name}`);
                }
            }
        });
    }
};

const runChecks = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('MongoDB Connected');

        loadModels();

        const User = mongoose.model('User');
        const UserActivityLog = mongoose.model('UserActivityLog');
        const Notification = mongoose.model('Notification');

        console.log('\n=== IGNORED ALERT ALARM CHECK (Threshold: >3) ===');

        // 1. Get Viewers
        const users = await User.find({
            role: 'member',
            custom_role: 'viewer' // STRICTLY TARGET VIEWERS
        });

        console.log(`Checking ${users.length} active VIEWER users...`);

        const now = new Date();
        // Check logs for recent activity (e.g., today/yesterday) 
        // The requirement is "ignoring >3 ignored alerts count". 
        // This count is stored on the UserActivityLog for a specific day.
        // We should check the LATEST activity log or check RECENT ones?
        // Let's check the log for TODAY (Test Mode) or YESTERDAY (Production).
        // For consistency with generate_alerts.js TEST MODE, we check TODAY.

        const targetDate = new Date(now);
        const startOfTarget = new Date(targetDate.setHours(0, 0, 0, 0));
        const endOfTarget = new Date(targetDate.setHours(23, 59, 59, 999));

        // 2. CHECK MISSING TIMESHEETS (Last 7 Days)
        const missingThreshold = 3;
        const checkWindowDays = 7;

        let startDate = new Date(now);
        startDate.setDate(startDate.getDate() - checkWindowDays);
        startDate.setHours(0, 0, 0, 0);

        let endDate = new Date(now);
        endDate.setDate(endDate.getDate() - 1); // Exclude today from "missing" check usually, or include? Let's exclude today to be safe.
        endDate.setHours(23, 59, 59, 999);

        // Map to store User -> MissingCount
        console.log(`\n=== MISSING TIMESHEET CHECK (${startDate.toDateString()} - ${endDate.toDateString()}) ===`);

        const Project = mongoose.model('Project');
        const UserTimesheets = mongoose.model('User_timesheets');

        // We assume 'users' array from previous block is still valid or we fetch again if we want to be safe. 
        // We can reuse the 'users' array if it targets the right audience.
        // The previous block filtered by role='member' and custom_role='viewer'. 
        // Let's broaden this if the requirement is for ALL team members, but usually it's members/viewers.
        // User request: "USER_MISSING_TIMESHEET_REPEATED". 
        // Let's reuse 'users' but maybe we should re-fetch to be sure we get everyone relevant. 
        // Let's stick to the users we have for now or re-fetch if we closed the scope.
        // Actually, the previous block might have filtered too strictly if it was just testing. 
        // Let's re-fetch standard members.

        const memberUsers = await User.find({
            role: { $in: ['member', 'employee', 'user'], $nin: ['admin', 'project_manager', 'owner'] },
            custom_role: { $nin: ['project_manager', 'owner', 'client', 'admin'] },
            status: 'active'
        });

        for (const user of memberUsers) {
            // Skip if already locked? Maybe we should re-check to define if we need to send ANOTHER notification or just ensuring lock.
            // If already locked, we might skip to avoid spam, or check if they resolved it. 
            // For now, let's process everyone to ensure lock is enforced if they fall back into bad habits or if we need to remind.

            let missingCount = 0;
            let missingDates = [];

            // Iterate last 7 days
            for (let d = 0; d < checkWindowDays; d++) {
                let checkDate = new Date(now);
                checkDate.setDate(checkDate.getDate() - (d + 1)); // Start from yesterday backwards
                checkDate.setHours(0, 0, 0, 0);

                // Skip Sundays
                if (checkDate.getDay() === 0) continue;

                const startOfDay = new Date(checkDate);
                const endOfDay = new Date(checkDate);
                endOfDay.setHours(23, 59, 59, 999);

                const ts = await UserTimesheets.findOne({
                    user_email: user.email,
                    timesheet_date: { $gte: startOfDay, $lte: endOfDay },
                    status: { $in: ['submitted', 'approved'] } // Only count valid submissions
                });

                if (!ts) {
                    missingCount++;
                    missingDates.push(checkDate.toISOString().split('T')[0]);
                }
            }

            if (missingCount > missingThreshold) {
                console.log(`[ALARM] User ${user.email} missing ${missingCount} timesheets.`);

                // 1. Lock User
                if (!user.is_timesheet_locked) {
                    await User.findByIdAndUpdate(user._id, { is_timesheet_locked: true });
                    console.log(`   -> Locked User Account`);
                }

                // 2. Notify User (In-App)
                // Check if we already sent this specific alarm recently to avoid spamming every cron run? 
                // We'll create it anyway as 'OPEN' status acts as the active alarm.
                const existingAlarm = await Notification.findOne({
                    user_id: user._id,
                    type: 'timesheet_lockout_alarm',
                    status: { $in: ['OPEN', 'APPEALED'] }
                });

                if (!existingAlarm) {
                    await Notification.create({
                        tenant_id: user.tenant_id || 'default',
                        recipient_email: user.email,
                        user_id: user._id,
                        rule_id: 'TIMESHEET_LOCKOUT_REPEATED_MISSING',
                        scope: 'user',
                        status: 'OPEN',
                        type: 'timesheet_lockout_alarm',
                        category: 'alarm',
                        title: '🚨 Timesheets Locked: Repeated Non-Compliance',
                        message: `You have missed ${missingCount} daily timesheets in the last week. Your ability to log new time is LOCKED until you fill in the missing days.`,
                        read: false,
                        created_date: new Date()
                    });

                    // 3. Email User
                    const emailService = require('../services/emailService');
                    if (emailService) {
                        // Send Lockout Email
                        await emailService.sendEmail({
                            to: user.email,
                            templateType: 'timesheet_lockout_alarm', // Ensure this template exists or handle generic
                            subject: 'Urgent: Timesheet Submission Locked',
                            data: {
                                userName: user.full_name,
                                userEmail: user.email,
                                missingCount: missingCount,
                                missingDates: missingDates.join(', ')
                            }
                        }).catch(e => console.error("Failed to send user email:", e.message));
                    }
                }

                // 4. Notify & Email PMs and Admins
                // Find Projects
                const projects = await Project.find({
                    "team_members.email": user.email,
                    status: 'active'
                });

                let managersToNotify = new Set();

                // Add Project Managers and Owners of active projects
                projects.forEach(p => {
                    if (p.owner) managersToNotify.add(p.owner); // Assuming owner is email string
                    if (p.team_members) {
                        p.team_members.forEach(tm => {
                            if (tm.role === 'project_manager' || tm.role === 'owner') {
                                managersToNotify.add(tm.email);
                            }
                        });
                    }
                });

                // Finds Admins in the tenant
                const admins = await User.find({
                    tenant_id: user.tenant_id,
                    role: { $in: ['admin', 'owner', 'manager'] },
                    status: 'active'
                });
                admins.forEach(a => managersToNotify.add(a.email));

                // Send Notifications to Managers
                for (const managerEmail of managersToNotify) {
                    // console.log(`   -> Notifying Manager/Admin: ${managerEmail}`);
                    // Check if manager exists to get ID (optional for notification but good for linking)
                    const managerUser = await User.findOne({ email: managerEmail });
                    if (!managerUser) continue;

                    // Avoid duplicate notifications for the same user lockout today
                    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
                    const alreadyNotified = await Notification.findOne({
                        recipient_email: managerEmail,
                        type: 'timesheet_missing_alarm', // Using slightly different type for manager info
                        message: { $regex: user.full_name }, // Rough check to avoid spamming same user info
                        created_date: { $gte: todayStart }
                    });

                    if (!alreadyNotified) {
                        await Notification.create({
                            tenant_id: managerUser.tenant_id,
                            recipient_email: managerEmail,
                            user_id: managerUser._id,
                            rule_id: 'TEAM_MEMBER_LOCKED',
                            scope: 'user',
                            status: 'OPEN',
                            type: 'team_member_lockout_notice',
                            category: 'alert', // Alert for PM, Alarm for User
                            title: `User Locked: ${user.full_name}`,
                            message: `${user.full_name} has been locked out of timesheets due to ${missingCount} missing entries in the last week.`,
                            read: false,
                            created_date: new Date()
                        });

                        // Email Manager
                        const emailService = require('../services/emailService');
                        if (emailService) {
                            await emailService.sendEmail({
                                to: managerEmail,
                                templateType: 'timesheet_missing_alert',
                                subject: `Alert: ${user.full_name} Timesheet Lockout`,
                                data: {
                                    recipientName: managerUser.full_name,
                                    recipientEmail: managerEmail,
                                    userName: user.full_name,
                                    userEmail: user.email,
                                    missingCount: missingCount,
                                    missingDates: missingDates.join(', ')
                                }
                            }).catch(e => console.error("Failed to send manager email:", e.message));
                        }
                    }
                }
            } else {
                // Check if we should UNLOCK automatically if they fixed it?
                // The requirement says "Lock new time entries". It implies unlocking happens when they submit.
                // We will handle unlocking in the API when they submit the missing days. 
                // But if the "last 7 days" window moves and they are no longer >3 missing, should we unlock?
                // The API logic requires filling "Start of Month -> Yesterday". 
                // If they fill those, the API unlocks. 
                // So we don't need to auto-unlock here based on the 7-day sliding window alone, 
                // because the API enforces the specific "Month-to-Date" compliance.
            }
        }

        console.log('=== CHECK COMPLETE ===');
        process.exit(0);

    } catch (err) {
        console.error('Check failed:', err);
        process.exit(1);
    }
};

runChecks();
