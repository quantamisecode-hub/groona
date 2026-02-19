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

        // Middleware for Sprint Completion (PM_VELOCITY_DROP Trigger)
        if (modelName === 'Sprint') {
          const checkVelocityDrop = async (doc) => {
            if (!doc || doc.status !== 'completed') return;

            try {
              const Notification = mongoose.model('Notification');

              // === DUPLICATE CHECK ===
              // Check if we already sent a 'PM_VELOCITY_DROP' alert for this sprint
              const existingAlert = await Notification.findOne({
                entity_id: doc._id || doc.id,
                type: 'PM_VELOCITY_DROP'
              });

              if (existingAlert) {
                console.log(`[Sprint Hook] Alert already sent for sprint ${doc._id}. Skipping.`);
                return;
              }
              // =======================

              // Models
              const Task = mongoose.model('Task');
              const Story = mongoose.model('Story');

              const sprintId = String(doc._id || doc.id);

              // 1. Fetch Stories and Tasks
              const sprintStories = await Story.find({ sprint_id: sprintId });
              const allTasks = await Task.find({
                $or: [
                  { sprint_id: sprintId },
                  { story_id: { $in: sprintStories.map(s => s._id) } }
                ]
              });

              // 2. Calculate Committed Points
              // Use stored committed_points if available, else sum of story points
              const totalStoryPoints = sprintStories.reduce((sum, s) => sum + (Number(s.story_points) || 0), 0);
              const plannedPoints = (doc.committed_points !== undefined && doc.committed_points !== null)
                ? Number(doc.committed_points)
                : totalStoryPoints;

              // 3. Calculate Completed Points (Partial Completion Logic)
              const completedPoints = sprintStories.reduce((sum, story) => {
                const storyId = String(story._id);
                const storyStatus = (story.status || '').toLowerCase();
                const storyPoints = Number(story.story_points) || 0;

                // If story is done, 100% points
                if (storyStatus === 'done' || storyStatus === 'completed') {
                  return sum + storyPoints;
                }

                // Find tasks for this story
                const storyTasks = allTasks.filter(t => String(t.story_id) === storyId);

                if (storyTasks.length === 0) {
                  return sum; // No tasks, not done -> 0
                }

                // Calculate task completion %
                const completedTasksCount = storyTasks.filter(t => t.status === 'completed').length;
                const totalTasksCount = storyTasks.length;
                const completionRatio = totalTasksCount > 0 ? (completedTasksCount / totalTasksCount) : 0;

                return sum + (storyPoints * completionRatio);
              }, 0);

              // 4. Check Condition (< 85%)
              console.log(`[Sprint Hook] Velocity Check: Completed ${completedPoints.toFixed(2)} / Committed ${plannedPoints}`);

              if (plannedPoints > 0 && completedPoints < (0.85 * plannedPoints)) {
                console.log(`[Sprint Hook] LOW ACCURACY DETECTED. Sending Alert...`);

                // 5. Find Product Manager(s)
                const ProjectUserRole = mongoose.model('ProjectUserRole');
                const User = mongoose.model('User');

                // Find users with 'project_manager' role for this project
                const pmRoles = await ProjectUserRole.find({
                  project_id: doc.project_id,
                  role: 'project_manager'
                });

                let recipients = [];
                if (pmRoles.length > 0) {
                  const pmIds = pmRoles.map(r => r.user_id);
                  recipients = await User.find({ _id: { $in: pmIds } });
                } else {
                  // Fallback: Admin
                  const adminRoles = await ProjectUserRole.find({
                    project_id: doc.project_id,
                    role: 'admin'
                  });
                  const adminIds = adminRoles.map(r => r.user_id);
                  recipients = await User.find({ _id: { $in: adminIds } });
                }

                if (recipients.length === 0) {
                  console.log('[Sprint Hook] No PM/Admin found to notify about velocity drop.');
                  return;
                }

                // 6. Send Notifications
                const emailService = require('../services/emailService'); // Lazy load

                for (const recipient of recipients) {
                  // A. In-App Notification
                  await Notification.create({
                    tenant_id: doc.tenant_id,
                    recipient_email: recipient.email,
                    user_id: recipient._id,
                    type: 'PM_VELOCITY_DROP',
                    category: 'alert',
                    title: 'Sprint Velocity Alert',
                    message: `⚠️ Sprint velocity has dropped below planned levels (${completedPoints.toFixed(2)}/${plannedPoints}). Review capacity and blockers.`,
                    entity_type: 'sprint',
                    entity_id: doc._id || doc.id,
                    project_id: doc.project_id,
                    sender_name: 'System',
                    read: false,
                    created_date: new Date()
                  });

                  // B. Email Notification
                  try {
                    await emailService.sendEmail({
                      to: recipient.email,
                      subject: `Velocity Alert: ${doc.name}`,
                      html: `
                        <div style="font-family: Arial, sans-serif; color: #333;">
                          <h2 style="color: #d97706;">⚠️ High Velocity Drop Detected</h2>
                          <p><strong>Sprint:</strong> ${doc.name}</p>
                          <p>The actual velocity for this sprint was significantly lower than planned.</p>
                          
                          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                            <tr style="background-color: #f3f4f6;">
                              <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: left;">Planned</th>
                              <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: left;">Actual</th>
                              <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: left;">Performance</th>
                            </tr>
                            <tr>
                              <td style="padding: 10px; border: 1px solid #e5e7eb;">${plannedPoints} pts</td>
                              <td style="padding: 10px; border: 1px solid #e5e7eb;">${completedPoints.toFixed(2)} pts</td>
                              <td style="padding: 10px; border: 1px solid #e5e7eb; color: #dc2626; font-weight: bold;">
                                ${Math.round((completedPoints / plannedPoints) * 100)}%
                              </td>
                            </tr>
                          </table>

                          <p>Please review the sprint retrospective to identify blockers or capacity issues.</p>
                          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/project/${doc.project_id}/sprint/${doc._id || doc.id}" 
                             style="display: inline-block; background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px;">
                            View Sprint Report
                          </a>
                        </div>
                      `
                    });
                  } catch (emailErr) {
                    console.error(`[Sprint Hook] Failed to send email to ${recipient.email}:`, emailErr);
                  }
                }
              }
            } catch (err) {
              console.error("[Sprint Hook] Error processing velocity check:", err);
            }
          };

          schema.post('save', checkVelocityDrop);
          schema.post('findOneAndUpdate', checkVelocityDrop);

          // Middleware to automatically sync SprintVelocity records
          const syncSprintVelocity = async (doc) => {
            // Only sync if sprint is locked or completed
            if (!doc || (!doc.locked_date && doc.status !== 'completed')) return;

            try {
              const SprintVelocity = mongoose.model('SprintVelocity');
              const Task = mongoose.model('Task');
              const Story = mongoose.model('Story');
              const Project = mongoose.model('Project');
              const ProjectUserRole = mongoose.model('ProjectUserRole');
              const User = mongoose.model('User');

              const sprintId = String(doc._id || doc.id);

              // Determine user_id (PM or owner)
              let userId = 'system';
              let userName = 'System';

              const project = await Project.findById(doc.project_id);
              if (project) {
                const pmRoles = await ProjectUserRole.find({
                  project_id: doc.project_id,
                  role: 'project_manager'
                });

                if (pmRoles.length > 0) {
                  const pmUser = await User.findById(pmRoles[0].user_id);
                  if (pmUser) {
                    userId = pmUser.email;
                    userName = pmUser.name || pmUser.email;
                  }
                } else if (project.owner) {
                  const ownerUser = await User.findOne({ email: project.owner });
                  if (ownerUser) {
                    userId = ownerUser.email;
                    userName = ownerUser.name || ownerUser.email;
                  }
                }
              }

              // Fetch stories and tasks
              const sprintStories = await Story.find({ sprint_id: sprintId });
              const allTasks = await Task.find({
                $or: [
                  { sprint_id: sprintId },
                  { story_id: { $in: sprintStories.map(s => s._id) } }
                ]
              });

              // Calculate metrics
              const totalStoryPoints = sprintStories.reduce((sum, s) => sum + (Number(s.story_points) || 0), 0);
              const committedPoints = (doc.committed_points !== undefined && doc.committed_points !== null)
                ? Number(doc.committed_points)
                : totalStoryPoints;

              const completedPoints = sprintStories.reduce((sum, story) => {
                const storyId = String(story._id);
                const storyStatus = (story.status || '').toLowerCase();
                const storyPoints = Number(story.story_points) || 0;

                if (storyStatus === 'done' || storyStatus === 'completed') {
                  return sum + storyPoints;
                }

                const storyTasks = allTasks.filter(t => String(t.story_id) === storyId);
                if (storyTasks.length === 0) return sum;

                const completedTasksCount = storyTasks.filter(t => t.status === 'completed').length;
                const completionRatio = completedTasksCount / storyTasks.length;
                return sum + (storyPoints * completionRatio);
              }, 0);

              const velocityPercentage = committedPoints > 0 ? (completedPoints / committedPoints) * 100 : 0;
              const totalTasks = allTasks.length;
              const completedTasks = allTasks.filter(t => t.status === 'completed').length;
              const inProgressTasks = allTasks.filter(t =>
                t.status === 'in_progress' || t.status === 'in progress'
              ).length;
              const notStartedTasks = allTasks.filter(t =>
                t.status === 'todo' || t.status === 'to do'
              ).length;

              const completedStories = sprintStories.filter(story => {
                const storyStatus = (story.status || '').toLowerCase();
                if (storyStatus === 'done' || storyStatus === 'completed') return true;
                const storyTasks = allTasks.filter(t => String(t.story_id) === String(story._id));
                return storyTasks.length > 0 && storyTasks.every(t => t.status === 'completed');
              }).length;

              const velocityData = {
                tenant_id: doc.tenant_id,
                project_id: doc.project_id,
                sprint_id: sprintId,
                user_id: userId,
                sprint_name: doc.name,
                sprint_start_date: doc.start_date,
                sprint_end_date: doc.end_date,
                committed_points: committedPoints,
                completed_points: completedPoints,
                planned_velocity: committedPoints,
                actual_velocity: completedPoints,
                velocity_percentage: velocityPercentage,
                commitment_accuracy: velocityPercentage,
                total_tasks: totalTasks,
                completed_tasks: completedTasks,
                in_progress_tasks: inProgressTasks,
                not_started_tasks: notStartedTasks,
                sprint_status: doc.status,
                measurement_date: new Date(),
                is_final_measurement: doc.status === 'completed',
                impediments_count: doc.impediments ? doc.impediments.length : 0,
                notes: `Auto-synced via database hook. User: ${userName}`,
                metadata: {
                  total_stories: sprintStories.length,
                  completed_stories: completedStories,
                  sync_source: 'database_hook',
                  sync_date: new Date().toISOString()
                }
              };

              // Update or create velocity record
              await SprintVelocity.findOneAndUpdate(
                {
                  sprint_id: sprintId,
                  is_final_measurement: doc.status === 'completed'
                },
                velocityData,
                { upsert: true, new: true }
              );

              console.log(`[Sprint Hook] ✅ Synced SprintVelocity for ${doc.name}`);

            } catch (err) {
              console.error('[Sprint Hook] Error syncing SprintVelocity:', err);
            }
          };

          schema.post('save', syncSprintVelocity);
          schema.post('findOneAndUpdate', syncSprintVelocity);
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