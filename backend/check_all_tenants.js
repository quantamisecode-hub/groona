const mongoose = require('mongoose');
const URI = 'mongodb+srv://admin:Khuddus%40781@cluster0.20wpttn.mongodb.net/project_ai_db?appName=Cluster0&retryWrites=true&w=majority';

async function check() {
    await mongoose.connect(URI);
    const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false }));
    const all = await Tenant.find({});
    console.log(`Total Tenants: ${all.length}`);
    all.forEach(t => {
        console.log(`ID: ${t._id}, Name: ${t.get('name')}, Co: ${t.get('company_name')}, Org: ${t.get('organization_name')}`);
    });
    process.exit();
}

check().catch(err => {
    console.error(err);
    process.exit(1);
});
