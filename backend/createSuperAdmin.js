// aivorabackend/createSuperAdmin.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config(); // Load environment variables

// Import Models
const Models = require('./models/SchemaDefinitions');

const createSuperAdmin = async () => {
  try {
    // 1. Connect to Database
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing in .env file");
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB Connected');

    const email = 'admin@groona.com';
    const plainPassword = 'password@123';
    
    // 2. Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(plainPassword, salt);

    // 3. Check if user already exists
    let user = await Models.User.findOne({ email });

    if (user) {
      // UPDATE existing user
      console.log('User already exists. Updating privileges...');
      user.password = hashedPassword;
      user.is_super_admin = true;
      user.role = 'admin';
      user.status = 'active';
      // Ensure they have a tenant_id (even if dummy) to satisfy validation
      if (!user.tenant_id) user.tenant_id = new mongoose.Types.ObjectId().toString();
      
      await user.save();
      console.log('✅ User updated to Super Admin successfully.');

    } else {
      // CREATE new user
      console.log('Creating new Super Admin user...');
      
      // We generate a random ObjectId for tenant_id to bypass "required" validation
      // This ensures the user isn't linked to a real tenant that might be deleted later
      const dummyTenantId = new mongoose.Types.ObjectId().toString();

      user = new Models.User({
        email: email,
        password: hashedPassword,
        full_name: 'Groona Super Admin',
        role: 'admin',
        is_super_admin: true,       // Grant Super Admin Access
        tenant_id: dummyTenantId,   // Placeholder to prevent validation error
        status: 'active',
        created_date: new Date(),
        updated_date: new Date()
      });

      await user.save();
      console.log('✅ Super Admin created successfully.');
    }

    console.log(`\nLogin Credentials:\nEmail: ${email}\nPassword: ${plainPassword}`);

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
};

createSuperAdmin();