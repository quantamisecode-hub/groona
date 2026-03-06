const mongoose = require('mongoose');
const URI = 'mongodb+srv://admin:Khuddus%40781@cluster0.20wpttn.mongodb.net/project_ai_db?appName=Cluster0&retryWrites=true&w=majority';

async function check() {
    await mongoose.connect(URI);
    const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false }));
    const t = await Tenant.findById('6923ec1463fc4ea11bf7234f');
    // Log all top level keys
    console.log(Object.keys(t.toObject()));
    console.log('Values:', {
        name: t.get('name'),
        company_name: t.get('company_name'),
        organization_name: t.get('organization_name')
    });
    process.exit();
}

check().catch(err => {
    console.error(err);
    process.exit(1);
});
