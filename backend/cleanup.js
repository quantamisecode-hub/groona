// 1. Load environment variables first
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

const mongoose = require('mongoose');
const connectDB = require('./config/db');

async function clean() {
    try {
        // 2. Connect using the URI now loaded into process.env
        await connectDB();

        // Use the model name defined in your SchemaDefinitions
        // If the model isn't registered yet, we register a basic schema to perform the deletion
        const Notification = mongoose.models.Notification || mongoose.model('Notification', new mongoose.Schema({}, { strict: false }));

        const result = await Notification.deleteMany({ status: 'OPEN' });
        console.log(`Successfully deleted ${result.deletedCount} open notifications.`);

    } catch (err) {
        console.error("Cleanup failed:", err.message);
    } finally {
        process.exit(0);
    }
}

clean();