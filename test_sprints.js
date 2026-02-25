const mongoose = require('mongoose');
require('dotenv').config({ path: '.env' });
const Models = require('./backend/models/SchemaDefinitions');
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/groona_dev').then(async () => {
  const Project = mongoose.model('Project');
  const Sprint = mongoose.model('Sprint');
  const projects = await Project.find({ status: { $in: ['active', 'in_progress'] } });
  for (const p of projects) {
    const sprints = await Sprint.find({ project_id: p._id });
    console.log(`Project: ${p.name}, Sprint Count: ${sprints.length}, Statuses: ${sprints.map(s => s.status).join(', ')}`);
  }
  process.exit(0);
});
