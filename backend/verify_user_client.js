const mongoose = require('mongoose');
const URI = 'mongodb+srv://admin:Khuddus%40781@cluster0.20wpttn.mongodb.net/project_ai_db?appName=Cluster0&retryWrites=true&w=majority';

async function check() {
    await mongoose.connect(URI);
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const u = await User.findOne({ email: 'quant@gmail.com' });
    console.log('User:', {
        email: u.get('email'),
        client_id: u.get('client_id'),
        tenant_id: u.get('tenant_id')
    });

    if (u.get('client_id')) {
        const Client = mongoose.model('Client', new mongoose.Schema({}, { strict: false }));
        const c = await Client.findById(u.get('client_id'));
        console.log('Client:', JSON.stringify(c, null, 2));
    }
    process.exit();
}

check().catch(err => {
    console.error(err);
    process.exit(1);
});
