const mongoose = require('mongoose');
const URI = 'mongodb+srv://admin:Khuddus%40781@cluster0.20wpttn.mongodb.net/project_ai_db?appName=Cluster0&retryWrites=true&w=majority';

async function check() {
    await mongoose.connect(URI);
    const Client = mongoose.model('Client', new mongoose.Schema({}, { strict: false }));
    const c = await Client.find({});
    console.log(`Total Clients: ${c.length}`);
    c.forEach(i => {
        console.log(`ID: ${i._id}, Name: ${i.get('name')}, Co: ${i.get('company_name')}`);
    });
    process.exit();
}

check().catch(err => {
    console.error(err);
    process.exit(1);
});
