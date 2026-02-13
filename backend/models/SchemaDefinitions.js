const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// 1. Helper: Convert JSON types to Mongoose types
const convertType = (field) => {
  let schemaType = {};

  if (field.type === 'string') {
    if (field.format === 'date' || field.format === 'date-time') {
      schemaType.type = Date;
    } else {
      schemaType.type = String;
    }
  } else if (field.type === 'number' || field.type === 'integer') {
    schemaType.type = Number;
  } else if (field.type === 'boolean') {
    schemaType.type = Boolean;
  } else if (field.type === 'array') {
    if (field.items && field.items.type === 'object') {
      const nestedSchema = {};
      if (field.items.properties) {
        Object.keys(field.items.properties).forEach(key => {
          nestedSchema[key] = convertType(field.items.properties[key]);
        });
      }
      schemaType.type = [nestedSchema];
    } else if (field.items && field.items.type) {
      const innerType = convertType({ type: field.items.type });
      schemaType.type = [innerType.type];
    } else {
      schemaType.type = [mongoose.Schema.Types.Mixed];
    }
  } else if (field.type === 'object') {
    const nestedSchema = {};
    if (field.properties) {
      Object.keys(field.properties).forEach(key => {
        nestedSchema[key] = convertType(field.properties[key]);
      });
    }
    schemaType = nestedSchema;
    return schemaType;
  } else {
    schemaType.type = mongoose.Schema.Types.Mixed;
  }

  if (field.enum) schemaType.enum = field.enum;
  if (field.default !== undefined) schemaType.default = field.default;
  if (field.unique) schemaType.unique = true;

  return schemaType;
};

// 2. Load definitions from JSON files
const modelsPath = path.join(__dirname, 'definitions');
const Models = {};

if (fs.existsSync(modelsPath)) {
  fs.readdirSync(modelsPath).forEach(file => {
    if (file.endsWith('.json')) {
      try {
        const definition = require(path.join(modelsPath, file));
        const modelName = definition.name || path.parse(file).name;

        // Helper: Get IST Date
        const getISTDate = () => new Date(Date.now() + (330 * 60000));

        const schemaObj = {};
        schemaObj.created_date = { type: Date, default: getISTDate };
        schemaObj.updated_date = { type: Date, default: getISTDate };

        if (definition.properties) {
          Object.keys(definition.properties).forEach(propName => {
            const fieldDef = definition.properties[propName];
            const mongooseDef = convertType(fieldDef);

            if (definition.required && definition.required.includes(propName)) {
              if (mongooseDef.type) mongooseDef.required = true;
            }
            if (fieldDef.unique) mongooseDef.unique = true;

            schemaObj[propName] = mongooseDef;
          });
        }

        const schema = new mongoose.Schema(schemaObj, { strict: false });

        // Middleware to sync Tenant changes to TenantSubscription
        if (modelName === 'Tenant') {
          const syncSubscription = async (doc) => {
            if (!doc) return;
            try {
              // Ensure TenantSubscription model is available (it might be loaded later if files processed alphabetically)
              // But since this is a post hook, it runs at runtime, so all models should be loaded.
              // However, to be safe, we can use mongoose.connection.db if model not found, like in check_trial_status.
              // Better: use mongoose.model if possible, catch if missing.
              let TenantSubscription;
              try {
                TenantSubscription = mongoose.model('TenantSubscription');
              } catch (e) {
                // If not registered yet, we can't sync via Mongoose model. 
                // But typically schemas are registered synchronously in this loop.
                console.warn("[Middleware] TenantSubscription model not found yet. Skipping sync.");
                return;
              }

              const updateData = {
                tenant_id: doc._id || doc.id,
                status: doc.subscription_status || 'trialing',
                trial_ends_at: doc.trial_ends_at,
                subscription_plan_id: doc.subscription_plan_id,
                plan_name: doc.subscription_plan,
                subscription_type: doc.subscription_type,
                start_date: doc.subscription_start_date,
                end_date: doc.subscription_ends_at,
                max_users: doc.max_users,
                max_projects: doc.max_projects,
                max_workspaces: doc.max_workspaces,
                max_storage_gb: doc.max_storage_gb,
                updated_at: new Date()
              };

              await TenantSubscription.findOneAndUpdate(
                { tenant_id: doc._id || doc.id },
                {
                  $set: updateData,
                  $setOnInsert: { created_at: new Date() }
                },
                { upsert: true, new: true }
              );
              console.log(`[Middleware] Synced TenantSubscription for tenant ${doc._id}`);
            } catch (err) {
              console.error(`[Middleware] Failed to sync TenantSubscription for tenant ${doc?._id}:`, err);
            }
          };

          schema.post('save', syncSubscription);
          schema.post('findOneAndUpdate', syncSubscription);
        }

        // Middleware for Comments (Preserved from your code)
        if (modelName === 'Comment') {
          schema.post('save', async function (doc) {
            try {
              if (doc.mentions && Array.isArray(doc.mentions) && doc.mentions.length > 0) {
                const Notification = mongoose.model('Notification');
                const Mention = mongoose.model('Mention');
                const Task = mongoose.model('Task');
                const Project = mongoose.model('Project');
                const Sprint = mongoose.model('Sprint');

                // Try to get rich context
                let contextName = doc.entity_type;
                let previewText = (doc.content || '').trim();
                // Clean @mentions from preview
                previewText = previewText.replace(/@[A-Za-z][A-Za-z\s'-]*/g, '').replace(/\s+/g, ' ').trim();
                if (previewText.length > 50) previewText = previewText.substring(0, 50) + '...';
                const suffix = previewText ? `: "${previewText}"` : '';

                // Capture project_id for the notification
                let resolvedProjectId = doc.project_id;

                if (doc.entity_type === 'task') {
                  try {
                    // Try both findById and findOne({id}) for robustness
                    let task = null;
                    try { task = await Task.findById(doc.entity_id); } catch (e) { }
                    if (!task) task = await Task.findOne({ id: doc.entity_id });

                    if (task) {
                      let project = null;
                      try { project = await Project.findById(task.project_id); } catch (e) { }
                      if (!project) project = await Project.findOne({ id: task.project_id });

                      if (project) {
                        resolvedProjectId = project.id; // Capture ID
                      }

                      let sprintName = '';
                      if (task.sprint_id) {
                        let sprint = null;
                        try { sprint = await Sprint.findById(task.sprint_id); } catch (e) { }
                        if (!sprint) sprint = await Sprint.findOne({ id: task.sprint_id });
                        if (sprint) sprintName = sprint.name;
                      }

                      const projLabel = project ? `Project: **${project.name}**` : 'Project: **Unknown**';
                      const taskLabel = `Task: **${task.title}**`;

                      if (sprintName) {
                        contextName = `${projLabel} > Sprint: **${sprintName}** > ${taskLabel}`;
                      } else {
                        contextName = `${projLabel} > ${taskLabel}`;
                      }
                    }
                  } catch (e) {
                    console.error("[Middleware] Error fetching task context:", e);
                  }
                } else if (doc.entity_type === 'project') {
                  try {
                    let project = null;
                    try { project = await Project.findById(doc.entity_id); } catch (e) { }
                    if (!project) project = await Project.findOne({ id: doc.entity_id });

                    if (project) {
                      contextName = `Project: **${project.name}**`;
                      resolvedProjectId = project.id;
                    }
                  } catch (e) {
                    console.error("[Middleware] Error fetching project context:", e);
                  }
                }

                const notifications = doc.mentions.map(email => ({
                  tenant_id: doc.tenant_id,
                  recipient_email: email,
                  type: 'mention',
                  title: 'You were mentioned',
                  message: `${doc.author_name} mentioned you in ${contextName}${suffix}`,
                  entity_type: doc.entity_type,
                  entity_id: doc.entity_id,
                  project_id: resolvedProjectId || (doc.entity_type === 'project' ? doc.entity_id : undefined),
                  comment_id: doc._id, // <--- ADDED COMMENT ID
                  sender_name: doc.author_name,
                  read: false,
                  created_date: new Date()
                }));

                const mentionRecords = doc.mentions.map(email => ({
                  tenant_id: doc.tenant_id,
                  recipient_email: email,
                  sender_email: doc.author_email,
                  sender_name: doc.author_name,
                  entity_type: doc.entity_type,
                  entity_id: doc.entity_id,
                  entity_title: contextName.toUpperCase(),
                  comment_content: doc.content,
                  read: false,
                  created_date: new Date()
                }));

                await Notification.insertMany(notifications);
                await Mention.insertMany(mentionRecords);
              }
            } catch (err) {
              console.error("[Middleware] Error processing comment mentions:", err);
            }
          });
        }

        Models[modelName] = mongoose.model(modelName, schema);
        console.log(`✅ Model Loaded: ${modelName}`);
      } catch (err) {
        console.error(`❌ Failed to load model ${file}:`, err.message);
      }
    }
  });
}

// 3. Manual Fallback for 'User' - UPDATED WITH RESET FIELDS
if (!Models.User) {
  const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    full_name: String,
    role: { type: String, default: 'user' },
    tenant_id: String,
    created_date: { type: Date, default: Date.now },
    // === Added Reset Fields ===
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date }
  }, { strict: false });
  Models.User = mongoose.model('User', UserSchema);
}

module.exports = Models;