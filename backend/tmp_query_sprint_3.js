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
        const SprintVelocity = mongoose.model('SprintVelocity');
        
        const sprintId = '6999802266df68ed0b627fbf';
        
        const vels = await SprintVelocity.find({ sprint_id: sprintId });
        console.log(JSON.stringify(vels, null, 2));
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
testQuery();
