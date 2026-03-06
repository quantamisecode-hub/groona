const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const connectDB = require('../backend/config/db');
const Models = require('../backend/models/SchemaDefinitions');

async function handleCascadeDelete(entity, id) {
    try {
        if (entity === 'Project') {
            const filter = { project_id: id };
            const modelsToClean = [
                'Task', 'Story', 'Sprint', 'Epic', 'Activity', 'Milestone',
                'ProjectExpense', 'ProjectFile', 'ProjectClient', 'ProjectReport',
                'Timesheet', 'ProjectUserRole', 'Impediment'
            ];

            for (const mName of modelsToClean) {
                try {
                    if (Models[mName]) {
                        await Models[mName].deleteMany(filter);
                    }
                } catch (e) {
                    console.error(`[CascadeDelete] Failed to clean ${mName} for project ${id}:`, e.message);
                }
            }

            try {
                await Models.Comment.deleteMany({ entity_type: 'project', entity_id: id });
            } catch (e) {
                console.error(`[CascadeDelete] Failed to clean Comments for project ${id}:`, e.message);
            }
        }
    } catch (err) {
        console.error(`[CascadeDelete] General error cleaning up ${entity} ${id}:`, err);
    }
}

async function runTest() {
    await connectDB();

    try {
        console.log('--- Starting Project Deletion Verification ---');

        // 1. Create a dummy project
        const project = new Models.Project({
            name: 'Test Project for Deletion',
            tenant_id: 'test_tenant_123',
        });
        const savedProject = await project.save();
        const projectId = savedProject._id.toString();
        console.log(`Created Test Project: ${projectId}`);

        // 2. Create a dummy task associated with this project
        const task = new Models.Task({
            title: 'Test Task for Deletion',
            project_id: projectId,
            tenant_id: 'test_tenant_123'
        });
        const savedTask = await task.save();
        console.log(`Created Test Task: ${savedTask._id}`);

        // 3. Verify they exist
        const projectBefore = await Models.Project.findById(projectId);
        const taskBefore = await Models.Task.findOne({ project_id: projectId });

        if (!projectBefore || !taskBefore) {
            throw new Error('Failed to create test data correctly');
        }
        console.log('Test data verified in DB.');

        // 4. Perform Deletion (Simulating Route Logic)
        console.log('Executing cascade deletion...');
        await handleCascadeDelete('Project', projectId);

        console.log('Deleting project itself...');
        await Models.Project.findByIdAndDelete(projectId);

        // 5. Verify Deletion
        const projectAfter = await Models.Project.findById(projectId);
        const taskAfter = await Models.Task.findOne({ project_id: projectId });

        if (!projectAfter && !taskAfter) {
            console.log('✅ SUCCESS: Project and associated Task were both deleted.');
        } else {
            console.log('❌ FAILURE: Deletion was incomplete.');
            if (projectAfter) console.log('Project still exists!');
            if (taskAfter) console.log('Task still exists!');
        }

    } catch (error) {
        console.error('Test Error:', error);
    } finally {
        await mongoose.connection.close();
        console.log('DB Connection Closed.');
    }
}

runTest();
