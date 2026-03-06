const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('../config/db');
const path = require('path');
const { updateProjectHealth } = require('../utils/projectHealth');
const Models = require('../models/SchemaDefinitions');

dotenv.config({ path: path.join(__dirname, '../.env') });

const init = async () => {
    try {
        await connectDB();
        const projects = await Models.Project.find({});
        console.log(`Found ${projects.length} projects to update.`);

        let count = 0;
        for (const p of projects) {
            await updateProjectHealth(p._id);
            count++;
            console.log(`Updated ${count}/${projects.length}`);
        }

        console.log('Done updating project healths!');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

init();
