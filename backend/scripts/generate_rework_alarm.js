const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Import centralized models and services
const { User, User_timesheets, Notification, UserActivityLog } = require('../models/SchemaDefinitions');
const emailService = require('../services/emailService');

// --- CONFIGURATION ---
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/groona_dev';
const REWORK_THRESHOLD_PERCENT = 15; // 15%
const LOOKBACK_DAYS = 7;

const runChecks = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('MongoDB Connected');

        console.log(`\n=== REWORK ALARM CHECK (Threshold: >${REWORK_THRESHOLD_PERCENT}% in last ${LOOKBACK_DAYS} days) ===`);

        // Get all active members
        const users = await User.find({ role: 'member', status: 'active' });
        console.log(`Checking ${users.length} active members...`);

        const startDate = new Date();
        startDate.setUTCDate(startDate.getUTCDate() - LOOKBACK_DAYS);
        startDate.setUTCHours(0, 0, 0, 0, 0);

        for (const user of users) {
            // Fetch aggregated data from User_timesheets (much more efficient)
            const dailyData = await User_timesheets.find({
                user_email: user.email,
                timesheet_date: { $gte: startDate }
            });

            if (dailyData.length === 0) {
                console.log(`User: ${user.email} | No timesheets in last ${LOOKBACK_DAYS} days.`);
                continue;
            }

            let totalMinutes = 0;
            let reworkMinutes = 0;

            dailyData.forEach(day => {
                totalMinutes += (day.total_time_submitted_in_day || 0);
                reworkMinutes += (day.rework_time_in_day || 0);
            });

            if (totalMinutes === 0) {
                console.log(`User: ${user.email} | Total Hours: 0 (Skipping)`);
                continue;
            }

            const reworkPercent = (reworkMinutes / totalMinutes) * 100;
            const formattedPercent = reworkPercent.toFixed(1);

            console.log(`User: ${user.email} | Total: ${(totalMinutes / 60).toFixed(1)}h | Rework: ${(reworkMinutes / 60).toFixed(1)}h | Ratio: ${formattedPercent}%`);

            // --- LOG ACTIVITY ---
            try {
                await UserActivityLog.create({
                    user_id: user.id || user._id,
                    email: user.email,
                    tenant_id: user.tenant_id,
                    event_type: 'rework_check',
                    rework_percentage: parseFloat(formattedPercent),
                    rework_minutes: reworkMinutes,
                    total_minutes: totalMinutes,
                    timestamp: new Date()
                });
                console.log(`   -> [LOG] Rework percentage logged.`);
            } catch (logErr) {
                console.error(`   -> [ERROR] Failed to log rework activity:`, logErr.message);
            }

            // Always notify if ANY rework detected, but use thresholds for alarm severity
            if (reworkMinutes > 0) {
                if (reworkPercent > 25) {
                    console.log(`   -> [FLAG] CRITICAL REWORK (> 25%)`);

                    // Check if active HIGH alarm exists
                    const existingAlarm = await Notification.findOne({
                        recipient_email: user.email,
                        type: 'high_rework_alarm',
                        status: { $in: ['OPEN', 'APPEALED'] }
                    });

                    if (existingAlarm) {
                        console.log('   -> High Rework Alarm already exists. Skipping notification/email.');
                    } else {
                        console.log('   -> Creating CRITICAL High Rework Alarm (Freeze Activated)...');
                        await Notification.create({
                            tenant_id: user.tenant_id,
                            recipient_email: user.email,
                            user_id: user.id || user._id,
                            type: 'high_rework_alarm',
                            category: 'alarm',
                            title: 'Critical Rework Detected',
                            message: `Your rework time is at ${formattedPercent}%, exceeding the 25% threshold. Task assignments are frozen. Peer review required.`,
                            entity_type: 'user',
                            entity_id: user.id || user._id,
                            scope: 'user',
                            status: 'OPEN',
                            sender_name: 'Groona Bot',
                            created_date: new Date()
                        });

                        try {
                            await emailService.sendEmail({
                                to: user.email,
                                templateType: 'high_rework_alarm',
                                data: {
                                    userName: user.full_name || user.email,
                                    userEmail: user.email,
                                    reworkPercent: formattedPercent,
                                    threshold: 25,
                                    dashboardUrl: `${process.env.FRONTEND_URL || 'https://groona.quantumisecode.com'}/timesheets`
                                }
                            });
                            console.log('      -> High Rework Email Sent ✅');
                        } catch (emailErr) {
                            console.error('      -> Failed to send high rework email:', emailErr.message);
                        }
                    }

                } else if (reworkPercent > REWORK_THRESHOLD_PERCENT) {
                    console.log(`   -> [FLAG] HIGH REWORK (> ${REWORK_THRESHOLD_PERCENT}%)`);

                    // Check if active alarm exists
                    const existingAlarm = await Notification.findOne({
                        recipient_email: user.email,
                        type: { $in: ['rework_alarm', 'high_rework_alarm'] },
                        status: { $in: ['OPEN', 'APPEALED'] }
                    });

                    if (existingAlarm) {
                        console.log('   -> Rework Alarm already exists. Skipping notification/email.');
                    } else {
                        console.log('   -> Creating NEW Rework Alarm...');
                        await Notification.create({
                            tenant_id: user.tenant_id,
                            recipient_email: user.email,
                            user_id: user.id || user._id,
                            type: 'rework_alarm',
                            category: 'alarm',
                            title: 'High Rework Detected',
                            message: `Your rework time is at ${formattedPercent}%, exceeding the ${REWORK_THRESHOLD_PERCENT}% threshold. Peer review is recommended.`,
                            entity_type: 'user',
                            entity_id: user.id || user._id,
                            scope: 'user',
                            status: 'OPEN',
                            sender_name: 'Groona Bot',
                            created_date: new Date()
                        });

                        try {
                            await emailService.sendEmail({
                                to: user.email,
                                templateType: 'rework_alarm',
                                data: {
                                    userName: user.full_name || user.email,
                                    userEmail: user.email,
                                    reworkPercent: formattedPercent,
                                    threshold: REWORK_THRESHOLD_PERCENT,
                                    dashboardUrl: `${process.env.FRONTEND_URL || 'https://groona.quantumisecode.com'}/timesheets`
                                }
                            });
                            console.log('      -> Rework Email Sent ✅');
                        } catch (emailErr) {
                            console.error('      -> Failed to send rework email:', emailErr.message);
                        }
                    }
                } else {
                    // Normal rework notification (Informational)
                    console.log(`   -> [INFO] Rework detected (${formattedPercent}%). Below threshold.`);

                    // Optional: Create a general notification for any rework? 
                    // The user said: "if any user had rework then send him inapp notification and mail"
                    // So let's create a 'general' notification for any rework > 0 but < 15%

                    const existingNotif = await Notification.findOne({
                        recipient_email: user.email,
                        type: 'rework_alert',
                        created_date: { $gte: startDate } // Check if alert already sent in lookback period
                    });

                    if (!existingNotif) {
                        await Notification.create({
                            tenant_id: user.tenant_id,
                            recipient_email: user.email,
                            user_id: user.id || user._id,
                            type: 'rework_alert',
                            category: 'alert',
                            title: 'Rework Logged',
                            message: `You have logged rework time recently (${formattedPercent}% of total). Please ensure quality and clarity of requirements.`,
                            link: '/Timesheets?tab=rework-info',
                            status: 'OPEN',
                            read: false,
                            created_date: new Date()
                        });
                        console.log('      -> General Rework Information Notification Created.');

                        try {
                            await emailService.sendEmail({
                                to: user.email,
                                templateType: 'rework_alert',
                                data: {
                                    userName: user.full_name || user.email,
                                    userEmail: user.email,
                                    reworkPercent: formattedPercent,
                                    dashboardUrl: `${process.env.FRONTEND_URL || 'https://groona.quantumisecode.com'}/timesheets`
                                }
                            });
                            console.log('      -> General Rework Email Sent ✅');
                        } catch (emailErr) {
                            console.error('      -> Failed to send general rework email:', emailErr.message);
                        }
                    }
                }
            }
        }

        console.log('\nChecks complete.');
        process.exit(0);

    } catch (error) {
        console.error('Check failed:', error);
        process.exit(1);
    }
};

runChecks();
