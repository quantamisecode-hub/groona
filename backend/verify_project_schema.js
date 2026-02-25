const mongoose = require('mongoose');
require('dotenv').config();

const { Schema } = mongoose;

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
};

const run = async () => {
    await connectDB();

    // Define Project Schema strictly to see if it allows the field
    // Or just use 'strict: false' to emulate dynamic schema if that's what is used
    // But usually Mongoose needs the path defined in schema to save it unless strict: false

    // Using strict: false for inspection, but I want to test the ACTUAL app behavior?
    // The actual app uses the SchemaDefinitions.

    // Let's try to load the SchemaDefinitions if possible, or manual.
    // I'll try to insert raw first to see if DB accepts it (MongoDB always does).
    // The issue is likely the Application Layer (Mongoose Schema) stripping it.

    // I'll check if the schema file Project.json corresponds to what Mongoose uses.

    const ProjectSchema = new Schema({}, { strict: false });
    const Project = mongoose.model('Project', ProjectSchema, 'projects');

    const testId = new mongoose.Types.ObjectId();
    const testUserId = "test-user-id-123";

    try {
        const newProject = new Project({
            _id: testId,
            name: "Schema Test Project",
            client_user_id: testUserId, // The field in question
            status: "planning"
        });

        await newProject.save();
        console.log("Saved test project.");

        const fetched = await Project.findById(testId);
        console.log("Fetched Project:");
        console.log(`- ID: ${fetched._id}`);
        console.log(`- Name: ${fetched.name}`);
        console.log(`- Client User ID: ${fetched.client_user_id}`); // Should print value

        if (fetched.client_user_id === testUserId) {
            console.log("SUCCESS: client_user_id persisted.");
        } else {
            console.error("FAILURE: client_user_id LOST.");
        }

        // Cleanup
        await Project.findByIdAndDelete(testId);
        console.log("Cleanup done.");

    } catch (err) {
        console.error(err);
    } finally {
        mongoose.disconnect();
    }
};

run();
