const cron = require('node-cron');
const { spawn } = require('child_process');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

// --------------------------------------------
// ENV CONFIG
// --------------------------------------------
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const SCHEDULE = IS_PRODUCTION
    ? '0 */8 * * *'   // Every 8 hours
    : '*/1 * * * *';  // Every minute for testing

console.clear();
console.log('=================================================');
console.info(`[Scheduler] 🚀 Starting Cron Scheduler`);
console.info(`[Scheduler] 🌍 Mode: ${IS_PRODUCTION ? 'PRODUCTION' : 'TESTING/DEV'}`);
console.info(`[Scheduler] ⏰ Schedule: ${SCHEDULE} (${IS_PRODUCTION ? 'Every 8 Hours' : 'Every 1 Minute'})`);
console.log('=================================================');


// --------------------------------------------
// SCRIPTS LIST
// --------------------------------------------
const SCRIPTS = [
    'user_consistent_compliance.js',
    'sync_user_timesheets.js',
    'sync_sprint_velocity.js',
    'generate_alarm.js',
    'generate_alerts.js',
    'generate_low_workload_alert.js',
    'generate_multiple_overdue_alarm.js',
    'generate_task_overdue.js',
    'generate_rework_alarm.js',
    'generate_overwork_alarm.js',
    'timesheet_reminder_alerts.js',
    'alert_low_logged_hours.js',
    'alert_availability_update.js',
    'generate_context_switching_alert.js',
    'check_low_velocity_alerts.js',
    'pm_consistent_velocity_drop.js',
    'check_deadline_risk.js',
    'generate_utilization_alerts.js',
    'alert_pending_timesheets.js',
    'check_team_utilization.js',
    'check_user_overload.js',
    'rework_escalation_workflow.js'
];


// --------------------------------------------
// HELPER: TIMESTAMP
// --------------------------------------------
function timestamp() {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
}


// --------------------------------------------
// RUN SCRIPT (PROMISE BASED)
// --------------------------------------------
function runScript(scriptName) {
    return new Promise((resolve, reject) => {

        const scriptPath = path.join(__dirname, 'scripts', scriptName);

        console.log(`[${timestamp()}] ⏳ Starting ${scriptName}...`);

        const child = spawn(process.execPath, [scriptPath], {
            stdio: 'inherit',
            env: process.env
        });

        child.on('close', (code) => {
            console.log(`[${timestamp()}] ✅ ${scriptName} finished with code ${code}`);
            resolve(code);
        });

        child.on('error', (err) => {
            console.error(`[${timestamp()}] ❌ Failed to start ${scriptName}:`, err);
            reject(err);
        });

    });
}


// --------------------------------------------
// RUN ALL SCRIPTS SEQUENTIALLY
// --------------------------------------------
async function runScriptsSequentially() {

    console.log(`\n-------------------------------------------------`);
    console.log(`[Cron] 🔄 Triggering scheduled tasks...`);
    console.log(`-------------------------------------------------\n`);

    for (const script of SCRIPTS) {
        try {
            await runScript(script);

            // Small delay between scripts to reduce DB spikes
            await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error) {
            console.error(`[${timestamp()}] ⚠️ Error running ${script}:`, error);
        }
    }

    console.log(`\n[${timestamp()}] 🎉 All scheduled scripts completed.\n`);
}


// --------------------------------------------
// PREVENT OVERLAPPING RUNS
// --------------------------------------------
let isRunning = false;


// --------------------------------------------
// CRON SCHEDULER
// --------------------------------------------
cron.schedule(SCHEDULE, async () => {

    if (isRunning) {
        console.log(`[${timestamp()}] ⚠️ Previous job still running. Skipping this cycle.`);
        return;
    }

    isRunning = true;

    try {
        await runScriptsSequentially();
    } catch (err) {
        console.error(`[${timestamp()}] ❌ Scheduler error:`, err);
    }

    isRunning = false;

});