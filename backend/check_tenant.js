const mongoose = require('mongoose');
const URI = 'mongodb+srv://admin:Khuddus%40781@cluster0.20wpttn.mongodb.net/project_ai_db?appName=Cluster0&retryWrites=true&w=majority';

async function check() {
    await mongoose.connect(URI);
    const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false }));
    const t = await Tenant.findById('6923ec1463fc4ea11bf7234f');
    console.log(JSON.stringify(t, null, 2));
    process.exit();
}

check().catch(err => {
    console.error(err);
    process.exit(1);
});
