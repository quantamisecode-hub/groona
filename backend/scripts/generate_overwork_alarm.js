const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const SchemaDefinitions = require('../models/SchemaDefinitions');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/groona_dev';
const HOURS_THRESHOLD = 11;
const isDev = process.env.NODE_ENV === 'development';
// Consecutve days doesn't apply cleanly to "Weekly Planned Load", 
// but we interpret ">11 hrs/day" as "Weekly Avg > 11h" or "Total > 66h".
// In Dev (1 day), "Total > 11h".
const WORK_DAYS_PER_WEEK = 6;
const WEEKLY_THRESHOLD = HOURS_THRESHOLD * WORK_DAYS_PER_WEEK; // 66 hours
const DEV_THRESHOLD = HOURS_THRESHOLD; // 11 hours (for quick testing)

const THRESHOLD_TOTAL = isDev ? DEV_THRESHOLD : WEEKLY_THRESHOLD;

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
        const Task = mongoose.model('Task');
        const Notification = mongoose.model('Notification');
        const emailService = require('../services/emailService');

        console.log(`\n=== OVERWORK ALARM CHECK (PLANNED WORKLOAD) ===`);
        console.log(`Environment: ${process.env.NODE_ENV}`);
        console.log(`Threshold: > ${THRESHOLD_TOTAL} estimated hours (Weekly/Total)`);

        // Get all active members
        const users = await User.find({ role: 'member', status: 'active' });
        console.log(`Checking ${users.length} active members...`);

        // Date Window for "Planned This Week"
        const now = new Date();
        const startOfWeek = new Date(now);
        const day = startOfWeek.getDay() || 7; // Get current day number, converting Sun(0) to 7
        if (day !== 1) startOfWeek.setHours(-24 * (day - 1)); // Set to Monday
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6); // End on Sunday
        endOfWeek.setHours(23, 59, 59, 999);

        for (const user of users) {
            // Fetch ALL tasks where user is assigned
            const userTasks = await Task.find({
                assigned_to: user.email
            });

            // Filter tasks relevant to "Current Workload" (Matching ResourceAllocation.jsx UI Logic)
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            const relevantTasks = userTasks.filter(t => {
                const status = (t.status || '').toLowerCase();
                const isCompleted = ['completed', 'done', 'closed', 'resolved'].includes(status);

                if (isCompleted) return false;

                // Condition 1: Overdue Pending (Checked against week start in UI, but then filtered by today)
                const isOverduePending = t.due_date && new Date(t.due_date) < startOfWeek;

                // Condition 2: Current Week Tasks
                const isCurrentWeek = t.due_date && new Date(t.due_date) >= startOfWeek && new Date(t.due_date) <= endOfWeek;

                // Condition 3: Active Work (In Progress / Review)
                const isActiveWork = ['in_progress', 'review'].includes(status);

                // If it matches any category...
                if (isOverduePending || isCurrentWeek || isActiveWork) {
                    // EXCLUDE if Due Date is strictly before Today (As per UI Requirement)
                    if (t.due_date) {
                        const dueDate = new Date(t.due_date);
                        if (dueDate < todayStart) return false;
                    }
                    return true;
                }

                return false;
            });

            // Calculate Total Estimated Hours
            const totalHours = relevantTasks.reduce((sum, t) => {
                let h = t.estimated_hours || 0;
                if (!h && t.story_points) h = t.story_points * 2; // Fallback
                return sum + h;
            }, 0);

            console.log(`User: ${user.email} | Workload: ${totalHours.toFixed(1)}h | Active Tasks: ${relevantTasks.length}`);

            let isOverloaded = false;
            if (totalHours > THRESHOLD_TOTAL) {
                isOverloaded = true;
            }

            // Update user state if changed
            if (isOverloaded) {
                console.log(`   -> [FLAG] OVERLOADED (> ${THRESHOLD_TOTAL}h)`);

                // 1. Update User Flag if not already set
                if (!user.is_overloaded) {
                    await User.updateOne({ _id: user._id }, { $set: { is_overloaded: true } });
                }

                // 2. Notify USER (In-App + Email) - Check if already notified today
                const todayStart = new Date();
                todayStart.setHours(0, 0, 0, 0);

                const existingNotification = await Notification.findOne({
                    user_id: user._id,
                    type: 'overwork_alarm',
                    created_date: { $gte: todayStart }
                });

                if (!existingNotification) {
                    const userAlertMessage = `You’ve been working long hours consistently. Please discuss workload adjustment with your manager.`;

                    await Notification.create({
                        tenant_id: user.tenant_id,
                        recipient_email: user.email,
                        user_id: user._id,
                        title: '🚨 Overwork Alert',
                        message: userAlertMessage,
                        type: 'overwork_alarm',
                        category: 'alarm',
                        status: 'OPEN',
                        read: false,
                        created_date: new Date()
                    });

                    try {
                        await emailService.sendEmail({
                            to: user.email,
                            templateType: 'overwork_alarm',
                            data: {
                                userName: user.full_name || user.email,
                                userEmail: user.email,
                                totalHours: totalHours
                            }
                        });
                        console.log(`      -> Email sent to user ${user.email}`);
                    } catch (emailErr) {
                        console.error(`      -> Failed to send email to user ${user.email}:`, emailErr.message);
                    }
                } else {
                    console.log(`      -> User already notified today. Skipping repeat.`);
                }

                // 3. Notify PMs (Only on first transition or maybe also daily?)
                // Assuming PMs only want one alert per overload period to avoid spam.
                if (!user.is_overloaded) {
                    const pms = await User.find({
                        tenant_id: user.tenant_id,
                        custom_role: 'project_manager'
                    });

                    if (pms.length > 0) {
                        for (const pm of pms) {
                            await Notification.create({
                                tenant_id: pm.tenant_id,
                                recipient_email: pm.email,
                                user_id: pm._id,
                                start_date: new Date(),
                                title: '🚨 Overwork Plan Alert',
                                message: `User ${user.full_name} is planned for ${totalHours.toFixed(1)}h this week (> Limit). Overtime disabled to prevent burnout.`,
                                type: 'overwork_alarm',
                                category: 'alarm',
                                status: 'OPEN',
                                read: false,
                                created_date: new Date()
                            });
                        }
                        console.log(`      -> Notified ${pms.length} PMs`);
                    }
                } else {
                    console.log(`      -> PMs already notified for this overload period.`);
                }
            } else if (user.is_overloaded) {
                console.log(`   -> [RESET] Normal Workload.`);
                await User.updateOne({ _id: user._id }, { $set: { is_overloaded: false } });
            } else {
                console.log(`   -> [OK] Workload within limits.`);
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
