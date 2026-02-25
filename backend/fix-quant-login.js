// aivorabackend/fix-quant-login.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import Models
const Models = require('./models/SchemaDefinitions');

const fixLogin = async () => {
  try {
    // 1. Connect to Database
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing in .env file");
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB Connected');

    const email = 'quant@gmail.com';
    const newPassword = '123456789';
    
    // 2. Generate Hash
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // 3. Find User
    let user = await Models.User.findOne({ email });

    if (user) {
      // --- CASE A: User exists, just update password ---
      console.log(`Found user: ${user.full_name} (${user._id})`);
      user.password = hashedPassword;
      // Ensure role is owner if it's the main account
      if (!user.role || user.role === 'user') user.role = 'owner';
      
      await user.save();
      console.log('✅ Password updated successfully.');
    } else {
      // --- CASE B: User missing (orphan tenant), create user ---
      console.log('User not found. checking for Tenant...');
      
      const tenant = await Models.Tenant.findOne({ owner_email: email });
      
      if (!tenant) {
        console.error('❌ No Tenant found for this email either. Please register a new account.');
        process.exit(1);
      }

      console.log(`Found Tenant: ${tenant.name} (${tenant._id})`);
      console.log('Creating missing User record...');

      // Create the user linked to this tenant
      user = new Models.User({
        full_name: tenant.owner_name || 'Quant Owner',
        email: email,
        password: hashedPassword,
        role: 'owner',
        tenant_id: tenant._id.toString(), // Link to existing tenant
        is_super_admin: false,
        status: 'active'
      });

      const savedUser = await user.save();
      
      // Update Tenant to point to this new user ID
      tenant.owner_user_id = savedUser._id.toString();
      await tenant.save();
      
      console.log('✅ User created and linked to Tenant successfully.');
    }

    console.log(`\n---------------------------------------------------`);
    console.log(`🎉 LOGIN FIXED!`);
    console.log(`Email:    ${email}`);
    console.log(`Password: ${newPassword}`);
    console.log(`---------------------------------------------------`);

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
};

fixLogin();