require('dotenv').config();
const mongoose = require('mongoose');
require('./models/SchemaDefinitions');

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const PUR = mongoose.model('ProjectUserRole');
        const Project = mongoose.model('Project');
        
        console.log("Checking project 692402e1346324eade524167:");
        const p = await Project.findById('692402e1346324eade524167');
        console.log("Project Name:", p ? p.name : "Not found in Project collection!");

        // Check if the project has roles
        const rolesForP = await PUR.find({ project_id: '692402e1346324eade524167' });
        console.log("Roles for this project count:", rolesForP.length);
        console.log(rolesForP);
    } catch(err) {
        console.log("ERROR:", err);
    }
    process.exit(0);
}
check();
