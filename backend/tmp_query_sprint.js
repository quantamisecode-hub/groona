require('dotenv').config();
const mongoose = require('mongoose');
require('./models/SchemaDefinitions');

async function check() {
    await mongoose.connect(process.env.MONGO_URI);
    const Sprint = mongoose.model('Sprint');
    const SprintVelocity = mongoose.model('SprintVelocity');

    console.log("Looking for sprint 'Groona Feature Enahncement'...");
    const sprints = await Sprint.find({ name: /Groona Feature Enahncement/i });
    console.log("Sprints found:", sprints.length);
    for (const sprint of sprints) {
        console.log(`- Sprint ID: ${sprint._id}, Project ID: ${sprint.project_id}, Status: ${sprint.status}`);
        const vels = await SprintVelocity.find({ sprint_id: sprint._id });
        console.log(`  Velocity records: ${vels.length}`);
        if (vels.length > 0) {
            console.log(`  Velocity details:`, vels.map(v => ({ accuracy: v.accuracy, name: v.sprint_name })));
        } else {
            console.log("  No SprintVelocity record found. Is the sprint active/completed and processed?");
        }
    }
    process.exit(0);
}
check();
