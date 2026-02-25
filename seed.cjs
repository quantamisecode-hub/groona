// seed.cjs
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

console.log('cwd:', process.cwd());
const modelsDir = path.join(process.cwd(), 'models');

try {
  console.log('models dir exists?', fs.existsSync(modelsDir));
  if (fs.existsSync(modelsDir)) {
    console.log('models folder listing:\n', fs.readdirSync(modelsDir).map(f => '  ' + f).join('\n'));
  } else {
    console.log('No models directory found at', modelsDir);
  }
} catch (e) {
  console.warn('Error reading models dir:', e.message);
}

// Try to require the models file
let Models;
try {
  Models = require('./models/SchemaDefinitions');
  console.log('✅ Loaded ./models/SchemaDefinitions');
} catch (err) {
  console.error('❌ Could not require ./models/SchemaDefinitions —', err.message);
  process.exit(1);
}

const subscriptionPlans = [
  { name: "Free", description: "Essential tools for small teams just getting started.", monthly_price: 0, annual_price: 0, currency: "USD", features: { max_users: 5, max_workspaces: 1, max_projects: 10, max_storage_gb: 5, ai_assistant_enabled: false, advanced_analytics_enabled: false }, is_active: true, sort_order: 1 },
  { name: "Starter", description: "Great for growing teams that need more space and flexibility.", monthly_price: 29, annual_price: 290, currency: "USD", features: { max_users: 15, max_workspaces: 3, max_projects: 50, max_storage_gb: 25, ai_assistant_enabled: true, advanced_analytics_enabled: false }, is_active: true, sort_order: 2 },
  { name: "Professional", description: "Advanced features for scaling organizations and power users.", monthly_price: 99, annual_price: 990, currency: "USD", features: { max_users: 50, max_workspaces: 10, max_projects: 200, max_storage_gb: 100, ai_assistant_enabled: true, advanced_analytics_enabled: true }, is_active: true, sort_order: 3 },
  { name: "Enterprise", description: "Unlimited power and custom solutions for large enterprises.", monthly_price: 299, annual_price: 2990, currency: "USD", features: { max_users: 9999, max_workspaces: 999, max_projects: 9999, max_storage_gb: 1000, ai_assistant_enabled: true, advanced_analytics_enabled: true }, is_active: true, sort_order: 4 }
];

const seedDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI not set in .env');
    }
    await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('✅ MongoDB Connected');

    const PlanModel = Models.SubscriptionPlan;
    if (!PlanModel) {
      throw new Error("SubscriptionPlan model not found in SchemaDefinitions (ensure module.exports = { SubscriptionPlan })");
    }

    await PlanModel.deleteMany({});
    console.log('🗑️  Existing subscription plans cleared');

    await PlanModel.insertMany(subscriptionPlans);
    console.log('🌱 Subscription plans seeded successfully');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
};

seedDB();
