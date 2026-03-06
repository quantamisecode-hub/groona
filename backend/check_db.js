const mongoose = require('mongoose');
const URI = 'mongodb+srv://admin:Khuddus%40781@cluster0.20wpttn.mongodb.net/project_ai_db?appName=Cluster0&retryWrites=true&w=majority';

async function check() {
    await mongoose.connect(URI);
    const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false }));
    const t = await Tenant.find({
        $or: [
            { name: /quant/i },
            { organization_name: /quant/i },
            { company_name: /quant/i }
        ]
    });
    console.log(JSON.stringify(t, null, 2));

    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const u = await User.find({ email: /quant/i }).limit(5);
    console.log('--- Users ---');
    console.log(JSON.stringify(u, null, 2));

    process.exit();
}

check().catch(err => {
    console.error(err);
    process.exit(1);
});
