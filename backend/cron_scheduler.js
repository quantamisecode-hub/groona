const cron = require('node-cron');
const { spawn } = require('child_process');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Configuration
// Default to 'development' if not set. Change to 'production' in your .env or start command for 8hr interval.
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Schedule: 
// Production: "0 */8 * * *" (At minute 0 past every 8th hour)
// Testing/Development: "*/1 * * * *" (Every minute)
const SCHEDULE = IS_PRODUCTION ? '0 */8 * * *' : '*/1 * * * *';

console.clear();
console.log('=================================================');
console.info(`[Scheduler] 🚀 Starting Cron Scheduler`);
console.info(`[Scheduler] 🌍 Mode: ${IS_PRODUCTION ? 'PRODUCTION' : 'TESTING/DEV'}`);
console.info(`[Scheduler] ⏰ Schedule: ${SCHEDULE} (${IS_PRODUCTION ? 'Every 8 Hours' : 'Every 1 Minute'})`);
console.log('=================================================');

const SCRIPTS = [
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
];

const runScript = (scriptName) => {
    const scriptPath = path.join(__dirname, 'scripts', scriptName);
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

    console.log(`[${timestamp}] ⏳ Starting ${scriptName}...`);

    const child = spawn('node', [scriptPath], {
        stdio: 'inherit', // Pipe output to parent so we see the script's logs
        env: process.env  // Pass environment variables (DB credentials, etc.)
    });

    child.on('close', (code) => {
        const endTimestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        console.log(`[${endTimestamp}] ✅ ${scriptName} finished with code ${code}`);
    });

    child.on('error', (err) => {
        const errorTimestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        console.error(`[${errorTimestamp}] ❌ Failed to start ${scriptName}:`, err);
    });
};

// Ensure scripts exist before scheduling
SCRIPTS.forEach(script => {
    const fullPath = path.join(__dirname, 'scripts', script);
    // Simple check could go here, but spawn will error if missing anyway.
});

// Schedule the tasks
cron.schedule(SCHEDULE, () => {
    console.log(`\n-------------------------------------------------`);
    console.log(`[Cron] 🔄 Triggering scheduled tasks...`);
    console.log(`-------------------------------------------------`);

    SCRIPTS.forEach((script, index) => {
        // Stagger execution slightly (2 seconds apart) to prevent 
        // simultaneous massive DB connection spikes if scripts are heavy.
        setTimeout(() => {
            runScript(script);
        }, index * 2000);
    });
});
