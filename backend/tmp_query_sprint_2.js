const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
const envPath = path.resolve(__dirname, '.env');
dotenv.config({ path: envPath });

const Models = require('./models/SchemaDefinitions');

async function testQuery() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const Sprint = mongoose.model('Sprint');
        const SprintVelocity = mongoose.model('SprintVelocity');
        
        const projectId = '694e27a734e787edf1234aff';
        
        console.log(`Looking for sprints in project ${projectId}...`);
        const sprints = await Sprint.find({ project_id: projectId });
        console.log(`Sprints in Project: ${sprints.length}`);
        
        for (const s of sprints) {
            console.log(`- Sprint ID: ${s._id}, Name: ${s.name}, Status: ${s.status}`);
        }
        
        console.log('\nLooking for SprintVelocity in project...');
        const vels = await SprintVelocity.find({ project_id: projectId }).sort({ created_at: -1 });
        console.log(`Velocity Records in Project: ${vels.length}`);
        for (const v of vels) {
            console.log(`- Sprint ID: ${v.sprint_id}, Name: ${v.sprint_name}`);
        }
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
testQuery();
