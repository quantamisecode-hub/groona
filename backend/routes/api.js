const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Models = require('../models/SchemaDefinitions');
const emailService = require('../services/emailService');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// === CURRENCY CONVERSION ENDPOINT ===
router.get('/currency/convert', async (req, res) => {
  const { from, to, amount } = req.query;

  if (!from || !to) {
    return res.status(400).json({ error: 'Missing "from" or "to" currency parameters' });
  }

  const sourceUpper = from.toUpperCase();
  const targetUpper = to.toUpperCase();
  const amountVal = parseFloat(amount) || 1;

  if (sourceUpper === targetUpper) {
    return res.json({
      from: sourceUpper,
      to: targetUpper,
      rate: 1,
      result: amountVal,
      fetched_at: new Date(),
      source: 'identity'
    });
  }

  try {
    const ExchangeRate = Models.ExchangeRate;
    if (!ExchangeRate) {
      throw new Error("ExchangeRate model not registered");
    }

    // --- REFINEMENT: BULK CACHE & CROSS-RATE LOGIC ---
    // Fixer.io Free Tier provides rates relative to EUR.
    // Strategy: Ensure we have fresh "EUR -> *" rates in DB.

    // 1. Check if we have a fresh 'EUR' -> 'USD' (as a proxy for "cache is warm")
    // We check just one common pair to decide if we need to refresh ALL.
    const sentinelRate = await ExchangeRate.findOne({
      from_currency: 'EUR',
      to_currency: 'USD'
    });

    const now = new Date();
    const isCacheFresh = sentinelRate && ((now - new Date(sentinelRate.fetched_at)) < 24 * 60 * 60 * 1000);

    if (!isCacheFresh) {
      // 2. Refresh Cache (Fetch ALL from Fixer)
      console.log("[Currency] Cache stale or missing. Fetching fresh rates from Fixer.io...");
      const fixerUrl = process.env.RATE;

      if (!fixerUrl) {
        console.error("Missing RATE env var for Fixer.io");
        return res.status(500).json({ error: "Currency service configuration missing" });
      }

      const response = await axios.get(fixerUrl);

      if (response.data.success && response.data.rates) {
        const rates = response.data.rates; // Base is EUR
        const fetchedAt = new Date();
        const bulkOps = [];

        // Prepare bulk upserts
        Object.entries(rates).forEach(([currency, rate]) => {
          bulkOps.push({
            updateOne: {
              filter: { from_currency: 'EUR', to_currency: currency },
              update: {
                $set: {
                  rate: rate,
                  fetched_at: fetchedAt,
                  provider: 'fixer.io'
                }
              },
              upsert: true
            }
          });
        });

        // Also ensure EUR->EUR is 1 (sometimes not in list)
        bulkOps.push({
          updateOne: {
            filter: { from_currency: 'EUR', to_currency: 'EUR' },
            update: { $set: { rate: 1, fetched_at: fetchedAt, provider: 'fixer.io' } },
            upsert: true
          }
        });

        if (bulkOps.length > 0) {
          await ExchangeRate.bulkWrite(bulkOps);
          console.log(`[Currency] Cached ${bulkOps.length} rates.`);
        }
      } else {
        console.error("Fixer.io Error:", response.data.error);
        if (!sentinelRate) {
          return res.status(502).json({ error: "Failed to fetch exchange rates" });
        }
        console.warn("[Currency] Using stale cache due to API failure.");
      }
    }

    // 3. Perform Conversion using DB Data (Cross-Rate)
    // We need EUR->Source and EUR->Target
    // If Source is EUR, rate is 1. If Target is EUR, rate is 1.
    // However, since we stored EUR->EUR above or we can query it, let's just query efficiently.

    const rates = await ExchangeRate.find({
      from_currency: 'EUR',
      to_currency: { $in: [sourceUpper, targetUpper] }
    });

    const sourceRateDoc = rates.find(r => r.to_currency === sourceUpper);
    const targetRateDoc = rates.find(r => r.to_currency === targetUpper);

    if (!sourceRateDoc || !targetRateDoc) {
      return res.status(400).json({ error: `Rates for ${sourceUpper} or ${targetUpper} not available.` });
    }

    // Cross-Rate Formula:
    // Source -> Target = (EUR -> Target) / (EUR -> Source)
    const rateSource = sourceRateDoc.rate;
    const rateTarget = targetRateDoc.rate;

    const finalRate = rateTarget / rateSource;

    res.json({
      from: sourceUpper,
      to: targetUpper,
      rate: finalRate,
      result: amountVal * finalRate,
      fetched_at: sourceRateDoc.fetched_at, // Use timestamp of data source
      source: isCacheFresh ? 'cache' : 'api-refreshed'
    });

  } catch (error) {
    console.error("Currency conversion error:", error);
    res.status(500).json({ error: error.message });
  }
});
// nodemailer removed - using Resend SDK now
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const modelHelper = require('../helpers/geminiModelHelper');

// --- CONFIGURATION ---
// Use helper to get default model (gemini-2.5-flash-native-audio-dialog)
const DEFAULT_MODEL = modelHelper.getDefaultModel();

// --- HELPER: FILE PROCESSING ---
function findFileLocally(filename) { const cleanName = path.basename(filename); const possiblePaths = [path.join(__dirname, '..', 'uploads', cleanName), path.join(process.cwd(), 'uploads', cleanName), path.join(process.cwd(), 'public', 'uploads', cleanName), path.join(__dirname, 'uploads', cleanName), path.join('/tmp', cleanName)]; for (const p of possiblePaths) { if (fs.existsSync(p)) return p; } return null; }
function getFileHandler(filePath) { const ext = path.extname(filePath).toLowerCase(); const mediaTypes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.pdf': 'application/pdf', '.heic': 'image/heic', '.heif': 'image/heif' }; const textTypes = ['.txt', '.md', '.csv', '.json', '.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.scss', '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.go', '.rb', '.php', '.swift', '.kt', '.sql', '.sh', '.bat', '.ps1', '.env', '.xml', '.yaml', '.yml', '.ini', '.log', '.conf']; if (mediaTypes[ext]) return { type: 'media', mimeType: mediaTypes[ext] }; if (textTypes.includes(ext)) return { type: 'text' }; return { type: 'unsupported' }; }
async function processFilesForGemini(fileUrls, req) { const parts = []; if (!fileUrls || !Array.isArray(fileUrls) || fileUrls.length === 0) return parts; for (const url of fileUrls) { try { const cleanUrl = decodeURIComponent(url); const filename = cleanUrl.split('/').pop(); const handler = getFileHandler(filename); if (handler.type === 'unsupported') continue; let processed = false; const localPath = findFileLocally(filename); if (localPath) { try { if (handler.type === 'text') { const textContent = fs.readFileSync(localPath, 'utf8'); parts.push({ text: `\n\n--- FILE START: ${filename} ---\n${textContent}\n--- FILE END ---\n` }); processed = true; } else if (handler.type === 'media') { const fileBuffer = fs.readFileSync(localPath); parts.push({ inlineData: { data: fileBuffer.toString('base64'), mimeType: handler.mimeType } }); processed = true; } } catch (e) { console.error("Local file read error:", e); } } if (!processed) { let downloadUrl = url; if (url.startsWith('/')) { const protocol = req.protocol || 'http'; const host = req.get('host'); downloadUrl = `${protocol}://${host}${url}`; } const response = await axios.get(downloadUrl, { responseType: 'arraybuffer' }); if (handler.type === 'text') { const textContent = Buffer.from(response.data).toString('utf8'); parts.push({ text: `\n\n--- FILE START: ${filename} ---\n${textContent}\n--- FILE END ---\n` }); } else { parts.push({ inlineData: { data: Buffer.from(response.data).toString('base64'), mimeType: response.headers['content-type'] || handler.mimeType } }); } } } catch (fileError) { console.error("Attachment Error:", fileError.message); } } return parts; }

// --- CASCADE DELETE HELPER ---
// --- USER TIMESHEET SYNC HELPER ---
async function syncUserTimesheetDay(userEmail, date, tenantId) {
  try {
    const UserTimesheets = Models.User_timesheets;
    const TimesheetModel = Models.Timesheet;
    const UserModel = Models.User;

    if (!UserTimesheets || !TimesheetModel || !UserModel) return;

    const user = await UserModel.findOne({ email: userEmail });
    if (!user) return;

    // 1. Calculate cumulative total minutes for this user on this date (only SUBMITTED/APPROVED)
    // FORCE UTC MIDNIGHT NORMALIZATION
    let dateStr = date;
    if (date instanceof Date) {
      dateStr = date.toISOString().split('T')[0];
    } else if (typeof date === 'string' && date.includes('T')) {
      dateStr = date.split('T')[0];
    } else if (typeof date === 'string') {
      dateStr = date.substring(0, 10);
    }

    const startOfDay = new Date(dateStr + 'T00:00:00.000Z');
    const endOfDay = new Date(dateStr + 'T23:59:59.999Z');

    const dayTimesheets = await TimesheetModel.find({
      user_email: userEmail,
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $ne: 'rejected' } // Include drafts/pending/etc, exclude rejected
    });

    const totalMinutes = dayTimesheets.reduce((acc, ts) => acc + (ts.total_minutes || 0), 0);
    const reworkMinutes = dayTimesheets.reduce((acc, ts) => {
      return acc + (ts.work_type === 'rework' ? (ts.total_minutes || 0) : 0);
    }, 0);

    // Determine day-level status: if any entry is NOT draft/rejected, it's 'submitted'
    const hasOfficialEntry = dayTimesheets.some(ts =>
      !['draft', 'rejected'].includes(ts.status)
    );
    const dailyStatus = hasOfficialEntry ? 'submitted' : (dayTimesheets.length > 0 ? 'draft' : null);

    if (totalMinutes === 0 || !dailyStatus) {
      // Delete record if no time logged
      await UserTimesheets.deleteMany({
        user_email: userEmail,
        timesheet_date: { $gte: startOfDay, $lte: endOfDay }
      });
      console.log(`[Sync] Deleted UserTimesheets for ${userEmail} on ${dateStr} (0 total)`);
    } else {
      // Upsert record
      const latestTs = dayTimesheets.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0];

      const updateData = {
        tenant_id: tenantId,
        user_id: user._id,
        user_email: userEmail,
        timesheet_date: startOfDay,
        actual_date: new Date(),
        status: dailyStatus,
        work_type: latestTs?.work_type || 'other',
        start_time: latestTs?.start_time || startOfDay,
        end_time: latestTs?.end_time || endOfDay,
        location: latestTs?.location || {},
        total_time_submitted_in_day: totalMinutes,
        rework_time_in_day: reworkMinutes,
        created_at: new Date()
      };

      await UserTimesheets.findOneAndUpdate(
        { user_email: userEmail, timesheet_date: { $gte: startOfDay, $lte: endOfDay } },
        { $set: updateData },
        { upsert: true }
      );
      console.log(`[Sync] Updated UserTimesheets for ${userEmail} on ${dateStr}. Total: ${totalMinutes}m`);
    }
  } catch (err) {
    console.error("[Sync] Error syncUserTimesheetDay:", err);
  }
}

async function syncSprintVelocity(sprintId, tenantId) {
  try {
    const SprintModel = Models.Sprint;
    const StoryModel = Models.Story;
    const TaskModel = Models.Task;
    const VelocityModel = Models.SprintVelocity;
    const NotificationModel = Models.Notification;
    const ProjectUserRoleModel = Models.ProjectUserRole;
    const UserModel = Models.User;

    if (!SprintModel || !StoryModel || !TaskModel || !VelocityModel) return;

    const sprint = await SprintModel.findById(sprintId);
    if (!sprint) return;

    // 1. Get all stories for this sprint
    const sprintStories = await StoryModel.find({ sprint_id: sprintId, tenant_id: tenantId });

    // 2. Committed Points (set when sprint locked)
    const totalStoryPointsInSprint = sprintStories.reduce((sum, s) => sum + (Number(s.story_points) || 0), 0);
    const committedPoints = (sprint.committed_points !== undefined && sprint.committed_points !== null)
      ? Number(sprint.committed_points)
      : totalStoryPointsInSprint;

    // 3. Completed Points (Partial Completion Logic)
    const sprintStoryIds = sprintStories.map(s => s._id.toString());
    const allRelevantTasks = await TaskModel.find({
      $or: [
        { sprint_id: sprintId },
        { story_id: { $in: sprintStoryIds } }
      ],
      tenant_id: tenantId
    });

    let completedPoints = 0;
    let completedStoriesCount = 0;

    for (const story of sprintStories) {
      const storyId = story._id.toString();
      const storyStatus = (story.status || '').toLowerCase();
      const storyPoints = Number(story.story_points) || 0;

      if (storyStatus === 'done' || storyStatus === 'completed') {
        completedPoints += storyPoints;
        completedStoriesCount++;
        continue;
      }

      const storyTasks = allRelevantTasks.filter(t => t.story_id?.toString() === storyId);
      if (storyTasks.length > 0) {
        const completedTasksCount = storyTasks.filter(t => t.status === 'completed').length;
        const taskCompletionRatio = completedTasksCount / storyTasks.length;
        completedPoints += (storyPoints * taskCompletionRatio);

        if (taskCompletionRatio === 1) completedStoriesCount++;
      }
    }

    const totalTasks = allRelevantTasks.length;
    const completedTasks = allRelevantTasks.filter(t => t.status === 'completed').length;
    const accuracy = committedPoints > 0 ? (completedPoints / committedPoints) * 100 : 0;

    // Upsert into SprintVelocity
    const updateData = {
      tenant_id: tenantId,
      project_id: sprint.project_id,
      sprint_id: sprintId,
      sprint_name: sprint.name,
      committed_points: committedPoints,
      completed_points: parseFloat(completedPoints.toFixed(2)),
      total_stories: sprintStories.length,
      completed_stories: completedStoriesCount,
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      accuracy: parseFloat(accuracy.toFixed(2)),
      last_synced_at: new Date()
    };

    await VelocityModel.findOneAndUpdate(
      { sprint_id: sprintId },
      { $set: updateData },
      { upsert: true }
    );

    console.log(`[VelocitySync] Updated velocity for sprint: ${sprint.name} (${sprintId}). Accuracy: ${accuracy.toFixed(2)}%`);

    // 🚨 ALERT: Check if accuracy < 85% and send notifications
    if (accuracy < 85 && committedPoints > 0 && NotificationModel && ProjectUserRoleModel && UserModel) {
      try {
        // Check if alert already sent for this sprint
        const existingAlert = await NotificationModel.findOne({
          entity_id: sprintId,
          type: 'PM_VELOCITY_DROP'
        });

        if (!existingAlert) {
          // Find Project Managers
          const pmRoles = await ProjectUserRoleModel.find({
            project_id: sprint.project_id,
            role: 'project_manager'
          });

          let recipients = [];
          if (pmRoles.length > 0) {
            const pmIds = pmRoles.map(r => r.user_id);
            recipients = await UserModel.find({ _id: { $in: pmIds } });
          } else {
            // Fallback: Admin
            const adminRoles = await ProjectUserRoleModel.find({
              project_id: sprint.project_id,
              role: 'admin'
            });
            const adminIds = adminRoles.map(r => r.user_id);
            recipients = await UserModel.find({ _id: { $in: adminIds } });
          }

          if (recipients.length > 0) {
            const emailService = require('../services/emailService');

            for (const recipient of recipients) {
              // Create in-app notification
              await NotificationModel.create({
                tenant_id: tenantId,
                recipient_email: recipient.email,
                user_id: recipient._id,
                type: 'PM_VELOCITY_DROP',
                category: 'alert',
                title: '⚠️ Sprint Velocity Alert',
                message: `Sprint "${sprint.name}" velocity has dropped below 85% (${accuracy.toFixed(1)}%). Committed: ${committedPoints} pts, Completed: ${completedPoints.toFixed(2)} pts. Review capacity and blockers.`,
                entity_type: 'sprint',
                entity_id: sprintId,
                project_id: sprint.project_id,
                sender_name: 'System',
                read: false,
                created_date: new Date()
              });

              // Send email notification
              try {
                await emailService.sendEmail({
                  to: recipient.email,
                  subject: `⚠️ Velocity Alert: ${sprint.name}`,
                  html: `
                    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px;">
                      <h2 style="color: #d97706; border-bottom: 3px solid #d97706; padding-bottom: 10px;">
                        ⚠️ Sprint Velocity Alert
                      </h2>
                      
                      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
                        <strong style="color: #92400e;">ALERT:</strong> Sprint velocity has dropped below the 85% threshold
                      </div>

                      <h3 style="color: #374151; margin-top: 30px;">Sprint Details</h3>
                      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                        <tr style="background-color: #f3f4f6;">
                          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold;">Sprint Name</td>
                          <td style="padding: 12px; border: 1px solid #e5e7eb;">${sprint.name}</td>
                        </tr>
                        <tr>
                          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold;">Committed Points</td>
                          <td style="padding: 12px; border: 1px solid #e5e7eb;">${committedPoints} pts</td>
                        </tr>
                        <tr style="background-color: #f3f4f6;">
                          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold;">Completed Points</td>
                          <td style="padding: 12px; border: 1px solid #e5e7eb;">${completedPoints.toFixed(2)} pts</td>
                        </tr>
                        <tr>
                          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold;">Accuracy</td>
                          <td style="padding: 12px; border: 1px solid #e5e7eb; color: #dc2626; font-weight: bold; font-size: 18px;">
                            ${accuracy.toFixed(1)}%
                          </td>
                        </tr>
                        <tr style="background-color: #f3f4f6;">
                          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold;">Tasks Progress</td>
                          <td style="padding: 12px; border: 1px solid #e5e7eb;">${completedTasks}/${totalTasks} completed</td>
                        </tr>
                      </table>

                      <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
                        <h4 style="margin-top: 0; color: #1e40af;">📋 Recommended Actions</h4>
                        <ul style="margin: 10px 0; padding-left: 20px;">
                          <li>Review sprint retrospective to identify blockers</li>
                          <li>Check team capacity and availability</li>
                          <li>Identify impediments affecting velocity</li>
                          <li>Consider scope adjustment if needed</li>
                        </ul>
                      </div>

                      <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/project/${sprint.project_id}/sprint/${sprintId}" 
                           style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                          View Sprint Details
                        </a>
                      </div>

                      <p style="color: #6b7280; font-size: 12px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 15px;">
                        This is an automated alert from Groona Sprint Velocity Tracking System.
                      </p>
                    </div>
                  `
                });
                console.log(`[VelocityAlert] ✅ Email sent to ${recipient.email}`);
              } catch (emailErr) {
                console.error(`[VelocityAlert] ❌ Failed to send email to ${recipient.email}:`, emailErr);
              }
            }

            console.log(`[VelocityAlert] 🚨 Sent velocity alerts for sprint: ${sprint.name}. Accuracy: ${accuracy.toFixed(1)}% (< 85%)`);
          }
        }
      } catch (alertErr) {
        console.error('[VelocityAlert] Error sending velocity alert:', alertErr);
      }
    }
  } catch (err) {
    console.error("[VelocitySync] Error syncing sprint velocity:", err);
  }
}

async function handleCascadeDelete(entity, id) {
  try {
    if (entity === 'Project') {
      const filter = { project_id: id };
      await Models.Task.deleteMany(filter);
      await Models.Story.deleteMany(filter);
      await Models.Sprint.deleteMany(filter);
      await Models.Epic.deleteMany(filter);
      await Models.Activity.deleteMany(filter);
      await Models.Milestone.deleteMany(filter);
      await Models.ProjectExpense.deleteMany(filter);
      await Models.ProjectFile.deleteMany(filter);
      await Models.ProjectClient.deleteMany(filter);
      await Models.ProjectReport.deleteMany(filter);
      await Models.Timesheet.deleteMany(filter);
      await Models.ProjectUserRole.deleteMany(filter);
      await Models.Impediment.deleteMany(filter);
      await Models.Comment.deleteMany({ entity_type: 'project', entity_id: id });
    } else if (entity === 'Epic') {
      const stories = await Models.Story.find({ epic_id: id });
      for (const story of stories) {
        await Models.Task.deleteMany({ story_id: story._id });
        await Models.Story.findByIdAndDelete(story._id);
        await Models.Impediment.deleteMany({ story_id: story._id });
        await Models.Comment.deleteMany({ entity_type: 'story', entity_id: story._id });
      }
      await Models.Impediment.deleteMany({ epic_id: id });
    } else if (entity === 'Story') {
      await Models.Task.deleteMany({ story_id: id });
      await Models.Impediment.deleteMany({ story_id: id });
      await Models.Comment.deleteMany({ entity_type: 'story', entity_id: id });
    } else if (entity === 'Sprint') {
      await Models.Task.deleteMany({ sprint_id: id });
      await Models.Impediment.deleteMany({ sprint_id: id });
    } else if (entity === 'Task') {
      await Models.Comment.deleteMany({ entity_type: 'task', entity_id: id });
      await Models.Impediment.deleteMany({ task_id: id });
    }
  } catch (err) {
    console.error(`[CascadeDelete] Error cleaning up ${entity} ${id}:`, err);
  }
}

// ==========================================
// 1. WEBSOCKET WRAPPER (Live API)
// ==========================================
async function generateViaSocket(apiKey, model, fullPrompt) {
  return new Promise((resolve, reject) => {
    const host = "generativelanguage.googleapis.com";
    let cleanModel = model;
    if (model.includes('native-audio') || model.includes('live')) {
      cleanModel = model.startsWith('models/') ? model : `models/${model}`;
    }

    // Use v1beta for native-audio-dialog models (required for gemini-2.5-flash-native-audio-dialog)
    // v1alpha doesn't support this model
    const apiVersion = model.includes('native-audio-dialog') ? 'v1beta' : 'v1alpha';
    const url = `wss://${host}/ws/google.ai.generativelanguage.${apiVersion}.GenerativeService.BidiGenerateContent?key=${apiKey}`;

    console.log(`[Socket] Connecting to: ${url.split('?')[0]} (Model: ${cleanModel})`);

    const ws = new WebSocket(url);

    let responseText = "";
    let hasResolved = false;

    const timeout = setTimeout(() => {
      if (!hasResolved) {
        ws.terminate();
        reject(new Error("Live API Timeout - No response in 30s"));
      }
    }, 30000);

    ws.on('open', () => {
      const setupMsg = {
        setup: {
          model: cleanModel,
          generation_config: { response_modalities: ["TEXT"] }
        }
      };
      ws.send(JSON.stringify(setupMsg));
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.setupComplete) {
          const clientMsg = {
            client_content: {
              turns: [{ role: "user", parts: [{ text: fullPrompt }] }],
              turn_complete: true
            }
          };
          ws.send(JSON.stringify(clientMsg));
          return;
        }
        if (msg.serverContent?.modelTurn?.parts) {
          for (const part of msg.serverContent.modelTurn.parts) {
            if (part.text) responseText += part.text;
          }
        }
        if (msg.serverContent?.turnComplete) {
          hasResolved = true;
          clearTimeout(timeout);
          ws.close();
          resolve({ text: responseText, usedModel: cleanModel });
        }
      } catch (e) {
        console.error("[Socket] Parse Error:", e.message);
      }
    });

    ws.on('error', (err) => {
      if (!hasResolved) {
        clearTimeout(timeout);
        reject(err);
      }
    });

    ws.on('close', (code, reason) => {
      if (!hasResolved) {
        clearTimeout(timeout);
        if (responseText.length > 0) resolve({ text: responseText, usedModel: cleanModel });
        else reject(new Error(`Socket closed (Code: ${code}).`));
      }
    });
  });
}

// ==========================================
// 2. RETRY LOGIC (Standard HTTP Models)
// ==========================================
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function generateStandardWithRetry(genAI, params, modelName) {
  let cleanName = modelName.replace('models/', '');

  if (cleanName.toLowerCase().startsWith('gemma') && !cleanName.includes('-it')) {
    cleanName += '-it';
  }

  let modifiedContent = params.content;
  let systemInstructionConfig = params.systemInstruction;

  // [MODIFICATION] Handle Gemma System Instructions
  if (cleanName.toLowerCase().includes('gemma') && params.systemInstruction) {
    const sysText = params.systemInstruction.parts?.[0]?.text || "";
    if (Array.isArray(modifiedContent)) {
      modifiedContent = [{ text: `SYSTEM: ${sysText}\n\nUSER:` }, ...modifiedContent];
    } else {
      modifiedContent = `SYSTEM: ${sysText}\n\nUSER:\n${modifiedContent}`;
    }
    systemInstructionConfig = undefined;
  }

  // [MODIFICATION] Handle Gemma JSON Mode Incompatibility
  // Gemma models do NOT support responseMimeType: "application/json"
  let finalConfig = params.generationConfig ? { ...params.generationConfig } : {};
  if (cleanName.toLowerCase().includes('gemma') && finalConfig.responseMimeType === 'application/json') {
    console.warn(`[AI API] Disabling JSON mode for ${cleanName} (Not Supported)`);
    delete finalConfig.responseMimeType;
  }

  const model = genAI.getGenerativeModel({
    model: cleanName,
    systemInstruction: systemInstructionConfig,
    generationConfig: finalConfig
  });

  try {
    const safetySettings = [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
    ];

    let result;
    if (params.history && !cleanName.includes('gemma')) {
      const chat = model.startChat({ history: params.history, safetySettings });
      result = await chat.sendMessage(modifiedContent);
    } else {
      const parts = Array.isArray(modifiedContent) ? modifiedContent : [{ text: modifiedContent }];
      result = await model.generateContent({ contents: [{ role: 'user', parts: parts }], safetySettings });
    }
    return { text: result.response.text(), usage: result.response.usageMetadata, model: cleanName };

  } catch (error) {
    throw error;
  }
}

// --- DYNAMIC CONTROLLER ---
async function generateController(genAI, params, requestedModel, retryCount = 0) {
  // Use helper to get model (always defaults to gemini-2.5-flash-native-audio-dialog)
  let targetModel = modelHelper.getModel(requestedModel);
  const modelConfig = modelHelper.createModelConfig(targetModel);

  try {
    console.log(`[AI API] Attempting: ${targetModel} (Try: ${retryCount + 1})`);

    if (modelConfig.isLive) {
      let fullPrompt = "";
      if (params.systemInstruction?.parts?.[0]?.text) fullPrompt += `SYSTEM: ${params.systemInstruction.parts[0].text}\n`;
      if (params.history) params.history.forEach(h => fullPrompt += `${h.role}: ${h.parts[0].text}\n`);
      let currentText = Array.isArray(params.content) ? params.content.map(p => p.text).join('\n') : params.content;
      fullPrompt += `User: ${currentText}`;

      return await generateViaSocket(process.env.GEMINI_API_KEY, targetModel, fullPrompt);
    } else {
      return await generateStandardWithRetry(genAI, params, targetModel);
    }

  } catch (error) {
    // Use helper to determine if we should fallback (only on technical errors, not quota)
    const shouldTryFallback = modelHelper.shouldFallback(error, targetModel);
    const fallbackModel = modelHelper.getFallbackModel(targetModel);

    // Only fallback in rare cases (technical errors, not quota issues)
    if (shouldTryFallback && fallbackModel && retryCount < 2) {
      console.warn(`[AI API] Model ${targetModel} failed with technical error. Falling back to ${fallbackModel} (Retry: ${retryCount + 1})`);
      return await generateController(genAI, params, fallbackModel, retryCount + 1);
    }

    throw new Error(`AI Generation Failed (${targetModel}): ${error.message}`);
  }
}

// === UPDATED: CONTEXT LOADER WITH DUE DATES ===
async function buildDeepContext(tenant_id, user_id, content) {
  let contextStr = "";
  if (!content) return contextStr;
  const lowerQ = content.toLowerCase();
  const needsDb = lowerQ.match(/task|project|assign|team|manager|status|due|ticket/);

  if (needsDb) {
    const currentUser = await Models.User.findById(user_id);
    if (currentUser) contextStr += `CURRENT USER: ${currentUser.full_name}\n`;

    const tasks = await Models.Task.find({ tenant_id }).sort({ due_date: 1 }).limit(50);

    contextStr += `\n=== DATABASE: RELEVANT TASKS ===\n`;
    contextStr += tasks.map(t => {
      const dueStr = t.due_date ? new Date(t.due_date).toLocaleDateString() : 'No Due Date';
      return `* Task: "${t.title}" | Status: ${t.status} | Priority: ${t.priority} | Due: ${dueStr}`;
    }).join('\n');
  }
  return contextStr;
}

// ... (GENERIC ROUTES) ...
router.post('/entities/:entity/filter', async (req, res) => { try { const Model = Models[req.params.entity]; if (!Model) return res.status(400).json({ msg: `Entity not found` }); const { filters = {}, sort } = req.body; let query = Model.find(filters); if (sort) { const sortObj = {}; if (sort.startsWith('-')) sortObj[sort.substring(1)] = -1; else sortObj[sort] = 1; query = query.sort(sortObj); } res.json(await query.exec()); } catch (err) { res.json([]); } });
router.post('/entities/:entity/create', async (req, res) => {
  try {
    const Model = Models[req.params.entity];
    const entityName = req.params.entity;

    // --- ASSIGNMENT FREEZE VALIDATION ---
    if (entityName === 'Task' && req.body.assigned_to) {
      let assignees = [];
      if (Array.isArray(req.body.assigned_to)) {
        assignees = req.body.assigned_to;
      } else if (typeof req.body.assigned_to === 'string') {
        assignees = req.body.assigned_to.split(',').map(s => s.trim()).filter(Boolean);
      }

      if (assignees.length > 0) {
        const Notification = Models.Notification;
        const frozenUsers = [];
        for (const email of assignees) {
          if (!email) continue;
          // Check for active high rework alarm (OPEN or APPEALED)
          const alarm = await Notification.findOne({
            recipient_email: email,
            type: 'high_rework_alarm',
            status: { $in: ['OPEN', 'APPEALED'] }
          });
          if (alarm) frozenUsers.push(email);
        }

        if (frozenUsers.length > 0) {
          return res.status(400).json({
            error: `Cannot assign task: User has too many rework tasks.`
          });
        }
      }
    }


    // --- TIMESHEET VALIDATION: OVERWORK LOCK ---
    if (entityName === 'Timesheet') {
      if (req.body.work_type === 'overtime') {
        const userEmail = req.body.user_email;
        if (userEmail) {
          const user = await Models.User.findOne({ email: userEmail });
          if (user && user.is_overloaded) {
            return res.status(400).json({
              error: 'Overtime is disabled because you have exceeded the work limit (>11h for 5 consecutive days). Please contact your Project Manager.'
            });
          }
        }
      }
    }

    // --- TIMESHEET VALIDATION: LOCKED ACCOUNT & MISSING DAYS ---
    if (entityName === 'Timesheet') {
      const userEmail = req.body.user_email;
      const submissionDateStr = req.body.timesheet_date || req.body.date; // Support both fields just in case
      const User = Models.User;

      if (userEmail && submissionDateStr) {
        const user = await User.findOne({ email: userEmail });

        // Only enforce if the user is currently locked
        if (user && user.is_timesheet_locked) {
          const UserTimesheets = Models.User_timesheets;

          // 1. Calculate Missing Days (Start of Month -> Yesterday)
          const now = new Date();
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          yesterday.setHours(23, 59, 59, 999);

          const missingDays = [];

          if (startOfMonth < yesterday) {
            let loopDate = new Date(startOfMonth);
            // Iterate until yesterday
            while (loopDate <= yesterday) {
              const d = loopDate.getDay();
              if (d !== 0) { // Skip Sundays
                const sDay = new Date(loopDate); sDay.setHours(0, 0, 0, 0);
                const eDay = new Date(loopDate); eDay.setHours(23, 59, 59, 999);

                // Check if a valid timesheet exists for this day
                // We consider 'submitted' or 'approved' as valid. 'draft' or missing is NOT valid.
                const exists = await UserTimesheets.exists({
                  user_email: userEmail,
                  timesheet_date: { $gte: sDay, $lte: eDay },
                  status: { $in: ['submitted', 'approved'] }
                });

                if (!exists) {
                  // Use local YYYY-MM-DD format to avoid UTC shift
                  const year = sDay.getFullYear();
                  const month = String(sDay.getMonth() + 1).padStart(2, '0');
                  const day = String(sDay.getDate()).padStart(2, '0');
                  missingDays.push(`${year}-${month}-${day}`);
                }
              }
              loopDate.setDate(loopDate.getDate() + 1);
            }
          }

          if (missingDays.length > 0) {
            // 2. Check if current submission is fixing a gap
            // submissionDateStr is usually YYYY-MM-DD from frontend OR ISO string.
            // convert to local YYYY-MM-DD to match missingDays format
            let subDate = submissionDateStr;
            if (submissionDateStr && submissionDateStr.includes('T')) {
              const sDate = new Date(submissionDateStr);
              const year = sDate.getFullYear();
              const month = String(sDate.getMonth() + 1).padStart(2, '0');
              const day = String(sDate.getDate()).padStart(2, '0');
              subDate = `${year}-${month}-${day}`;
            } else if (submissionDateStr && submissionDateStr.length >= 10) {
              // If it's already YYYY-MM-DD or similar string without T
              subDate = submissionDateStr.substring(0, 10);
            }

            if (!missingDays.includes(subDate)) {
              // User is trying to submit for Today/Future or a non-missing day, but they have gaps!

              // ONLY BLOCK IF SUBMITTING (Allow Drafts)
              // Check status from body. If undefined, assume submission? No, usually 'submitted' or 'draft'.
              // Safe default: only block if status explicitly 'submitted' or 'approved'
              const isSubmitting = req.body.status === 'submitted' || req.body.status === 'approved';

              if (isSubmitting) {
                return res.status(403).json({
                  error: 'ACCOUNT LOCKED. You have missing timesheets. Please submit timesheets for the following dates first: ' + missingDays.join(', '),
                  missingdates: missingDays,
                  locked: true
                });
              }
              // If draft, proceed.
            } else {
              // User is submitting one of the missing days. ALLOW.
              // Check if this was the ONLY missing day (i.e., they are clearing the backlog completely)
              if (missingDays.length === 1 && missingDays[0] === subDate) {
                await User.findByIdAndUpdate(user._id, { is_timesheet_locked: false });
                console.log(`[Timesheet] User ${userEmail} cleared backlog. Account UNLOCKED.`);
              }
              // If there are multiple missing days, we allow this one, but they remain locked until they clear the last one.
            }

          } else {
            // No missing days found (maybe they filled them but flag was stuck?)
            // Auto-unlock
            await User.findByIdAndUpdate(user._id, { is_timesheet_locked: false });
          }
        }
      }
    }

    // --- TIMESHEET SPECIAL LOGIC: SNAPSHOT CTC ---
    if (entityName === 'Timesheet') {
      try {
        const userEmail = req.body.user_email;
        if (userEmail) {
          const user = await Models.User.findOne({ email: userEmail });
          if (user && user.hourly_rate) {
            req.body.snapshot_hourly_rate = user.hourly_rate;
            // Calculate total cost using total_minutes for accuracy
            const totalMins = req.body.total_minutes || ((req.body.hours || 0) * 60 + (req.body.minutes || 0));
            if (totalMins > 0) {
              req.body.snapshot_total_cost = user.hourly_rate * (totalMins / 60);
            }
          }
        }
      } catch (tsError) {
        console.error("Error creating Timesheet snapshot:", tsError);
        // Continue creating timesheet even if snapshot fails
      }
    }

    const item = new Model(req.body);
    const savedItem = await item.save();

    res.json(savedItem);

    // --- TIMESHEET LOGGING: Dynamic Sync ---
    if (entityName === 'Timesheet') {
      try {
        await syncUserTimesheetDay(savedItem.user_email, savedItem.date, savedItem.tenant_id);
      } catch (err) {
        console.error("[Sync] Error in create sync:", err);
      }
    }



    // --- TIMESHEET SUBMISSION NOTIFICATION ---
    if (entityName === 'Timesheet' && savedItem.status === 'submitted') {
      setImmediate(async () => {
        try {
          const tsDate = new Date(savedItem.date);
          const now = new Date();

          // Normalized Dates (Midnight)
          const workDate = new Date(tsDate);
          workDate.setHours(0, 0, 0, 0);

          const actualDate = new Date(now);
          actualDate.setHours(0, 0, 0, 0);

          if (workDate < actualDate) {
            const Notification = Models.Notification;
            const User = Models.User;

            const user = await User.findOne({ email: savedItem.user_email });
            const fs = require('fs');
            const path = require('path');
            const logPath = path.join(__dirname, '../debug_notif.log');
            const log = (msg) => fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);

            log(`Timesheet submitted. WorkDate: ${workDate}, ActualDate: ${actualDate}, UserEmail: ${savedItem.user_email}`);

            if (user) {
              log(`User found: ${user._id}`);
              const notif = await Notification.create({
                tenant_id: savedItem.tenant_id,
                recipient_email: savedItem.user_email,
                user_id: user._id,
                type: 'timesheet_late_submission',
                category: 'general',
                title: 'Late Timesheet Submission',
                message: 'Your timesheet was submitted late. Please ensure timely updates',
                entity_type: 'timesheet',
                entity_id: savedItem._id,
                sender_name: 'System',
                read: false,
                created_date: new Date()
              });
              log(`Notification created: ${notif._id}`);

              if (req.io) {
                log(`Emitting socket to room: ${savedItem.tenant_id}`);
                req.io.to(savedItem.tenant_id).emit('new_notification', notif);
              } else {
                log('req.io is undefined!');
              }
            } else {
              log('User NOT found!');
            }
          } else {
            // OPTIONAL: Send "Timesheet Submitted" notification if ON TIME
            const fs = require('fs');
            const path = require('path');
            const logPath = path.join(__dirname, '../debug_notif.log');
            const log = (msg) => fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);

            log('Timesheet On Time.');

            const Notification = Models.Notification;
            const User = Models.User;
            const user = await User.findOne({ email: savedItem.user_email });
            if (user) {
              const notif = await Notification.create({
                tenant_id: savedItem.tenant_id,
                recipient_email: savedItem.user_email,
                user_id: user._id,
                type: 'timesheet_submission',
                category: 'general',
                title: 'Timesheet Submitted',
                message: 'Your timesheet has been successfully submitted.',
                entity_type: 'timesheet',
                entity_id: savedItem._id,
                sender_name: 'System',
                read: false,
                created_date: new Date()
              });
              log(`OnTime Notification created: ${notif._id}`);

              if (req.io) {
                log(`Emitting socket to room: ${savedItem.tenant_id}`);
                req.io.to(savedItem.tenant_id).emit('new_notification', notif);
              } else {
                log('req.io is undefined (OnTime)!');
              }
            }
          }
        } catch (err) {
          console.error("[LateSubmission] Error:", err);
        }
      });
    }

    // --- SPRINT VELOCITY SYNC (Create) ---
    if (['Task', 'Story', 'Sprint'].includes(entityName)) {
      setImmediate(async () => {
        try {
          let sprintId = null;
          if (entityName === 'Sprint') {
            sprintId = savedItem._id;
          } else if (savedItem.sprint_id) {
            sprintId = savedItem.sprint_id;
          } else if (entityName === 'Task' && savedItem.story_id) {
            const story = await Models.Story.findById(savedItem.story_id);
            if (story && story.sprint_id) sprintId = story.sprint_id;
          }

          if (sprintId) {
            await syncSprintVelocity(sprintId, savedItem.tenant_id);
          }
        } catch (err) {
          console.error("[VelocitySync] Error in create trigger:", err);
        }
      });
    }

    // --- ACTIVITY LOGGING ---
    setImmediate(async () => {
      try {
        const { logUserMetrics } = require('../utils/userMetricsLogger');

        // 1. Timesheet Created -> Log for User
        if (entityName === 'Timesheet') {
          await logUserMetrics(savedItem.user_email, 'timesheet_submission');
        }

        // 2. Task Created/Assigned -> Log for Assignees
        if (entityName === 'Task' && savedItem.assigned_to) {
          const assignees = Array.isArray(savedItem.assigned_to) ? savedItem.assigned_to : [savedItem.assigned_to];
          for (const email of assignees) {
            await logUserMetrics(email, 'task_assignment');
          }
        }
      } catch (err) {
        console.error("Activity Logging Error:", err);
      }
    });

    // --- TIMESHEET LOGGING: Update UserLog (Session) ---
    if (entityName === 'Timesheet') {
      setImmediate(async () => {
        try {
          const UserLog = Models.UserLog; // Ensure this is available in Models
          const userEmail = savedItem.user_email;
          if (userEmail && UserLog) {
            // Find the most recent active session (logged in, not logged out)
            // Or just the latest session for this user
            const activeLog = await UserLog.findOne({
              email: userEmail,
              $or: [
                { logout_time: { $exists: false } },
                { logout_time: null }
              ]
            }).sort({ login_time: -1 });

            if (activeLog) {
              // Determine IST Date for activity log
              const istNow = new Date(Date.now() + (330 * 60000));

              await UserLog.findByIdAndUpdate(activeLog._id, {
                $inc: {
                  submitted_timesheets_count: 1,
                  today_submitted_timesheets_count: 1,
                  pending_log_count: -1 // reduce pending count
                },
                $push: {
                  timesheet_activity_log: {
                    submission_time: istNow,
                    timesheet_id: savedItem._id,
                    task_id: savedItem.task_id,
                    hours: savedItem.hours,
                    task_title: savedItem.task_title
                  }
                }
              });
              // Ensure pending count doesn't go below 0 (though $inc logic is atomic, we can't condition it easily here, but it's fine)
            }
          }
        } catch (logErr) {
          console.error('[Timesheet] Failed to update UserLog:', logErr);
        }
      });
    }



    // --- LEAVE NOTIFICATION LOGIC ---
    if (entityName === 'Leave') {
      setImmediate(async () => {
        try {
          const Notification = Models.Notification;
          const user = await Models.User.findOne({ email: savedItem.user_email });

          // 1. Notify Applicant (Success Confirmation)
          await Notification.create({
            tenant_id: savedItem.tenant_id,
            recipient_email: savedItem.user_email,
            type: 'leave_application', // generic generic type or specific if added
            title: 'Leave Application Submitted',
            message: `Your leave application for ${savedItem.total_days} day(s) starting ${savedItem.start_date} has been submitted successfully.`,
            entity_type: 'leave',
            entity_id: savedItem._id,
            category: 'general',
            read: false,
            sender_name: 'System'
          });

          // 2. Notify Approvers (Admins/Managers)
          // Find all admins/owners/managers in the tenant
          const approvers = await Models.User.find({
            tenant_id: savedItem.tenant_id,
            role: { $in: ['admin', 'owner', 'manager'] },
            status: 'active'
          });

          const applicantName = savedItem.user_name || user?.full_name || savedItem.user_email;

          for (const approver of approvers) {
            // Don't notify the applicant if they are an admin applying for leave (optional, but good UX)
            if (approver.email === savedItem.user_email) continue;

            await Notification.create({
              tenant_id: savedItem.tenant_id,
              recipient_email: approver.email,
              type: 'leave_application',
              title: 'New Leave Application',
              message: `${applicantName} has applied for leave (${savedItem.leave_type_name}) from ${savedItem.start_date} to ${savedItem.end_date}.`,
              entity_type: 'leave',
              entity_id: savedItem._id,
              category: 'action_request',
              read: false,
              sender_name: applicantName
            });
          }

        } catch (err) {
          console.error("Leave Notification Error:", err);
        }
      });
    }

    // Handle email notifications asynchronously after response is sent
    // This ensures task creation is not affected by email failures
    if (entityName === 'Task' && savedItem.assigned_to && savedItem.assigned_to.length > 0) {
      // Fire and forget - don't await, run asynchronously
      setImmediate(async () => {
        try {
          const emailService = require('../services/emailService');
          const frontendUrl = process.env.FRONTEND_URL;
          if (!frontendUrl) {
            console.warn('FRONTEND_URL not set in environment variables');
            return;
          }

          // Get project info
          let projectName = 'No Project';
          if (savedItem.project_id) {
            const project = await Models.Project.findById(savedItem.project_id);
            if (project) projectName = project.name;
          }

          // Get assigner info
          const assignerEmail = req.user?.email || savedItem.reporter || 'System';
          const assigner = await Models.User.findOne({ email: assignerEmail });
          const assignerName = assigner?.full_name || assignerEmail;

          // Get assignees
          const assignees = Array.isArray(savedItem.assigned_to) ? savedItem.assigned_to : [savedItem.assigned_to];

          // Send email to each assignee
          for (const assigneeEmail of assignees) {
            try {
              const assignee = await Models.User.findOne({ email: assigneeEmail });
              const assigneeName = assignee?.full_name || assigneeEmail;

              await emailService.sendEmail({
                to: assigneeEmail,
                templateType: 'task_assigned',
                data: {
                  assigneeName,
                  assigneeEmail,
                  taskTitle: savedItem.title,
                  taskDescription: savedItem.description,
                  projectName,
                  assignedBy: assignerName,
                  dueDate: savedItem.due_date,
                  priority: savedItem.priority,
                  taskUrl: savedItem.project_id
                    ? `${frontendUrl}/projects/${savedItem.project_id}/tasks/${savedItem._id}`
                    : `${frontendUrl}/tasks/${savedItem._id}`
                }
              });
            } catch (error) {
              console.error(`Failed to send task assignment email to ${assigneeEmail}:`, error);
            }
          }
        } catch (error) {
          console.error('Failed to send task creation emails:', error);
          // Email failure does not affect task creation
        }
      });
    }

    // --- IMPEDIMENT NOTIFICATIONS ---
    if (entityName === 'Impediment') {
      console.log('[API] Impediment created. Starting notification logic...');
      setImmediate(async () => {
        try {
          const Notification = Models.Notification;
          const Project = Models.Project;
          const User = Models.User;
          const Task = Models.Task;
          const ProjectUserRole = Models.ProjectUserRole;

          console.log(`[API] Fetching details for Project: ${savedItem.project_id}, Task: ${savedItem.task_id}`);

          // 1. Get Details
          const project = await Project.findById(savedItem.project_id);
          const task = await Task.findById(savedItem.task_id);
          const reporter = await User.findOne({ email: savedItem.reported_by });

          if (!project || !task) {
            console.log('[API] Project or Task not found for notification.');
            return;
          }

          const reporterName = reporter?.full_name || savedItem.reported_by_name || savedItem.reported_by;
          const taskTitle = task.title;
          const projectName = project.name;
          const projectId = project._id;
          const sprintId = savedItem.sprint_id;

          // Construct Deep Link to Sprint Blockers
          // Correct Frontend Route: /SprintPlanningPage?sprintId=...&projectId=...&tab=blockers
          const deepLink = `/SprintPlanningPage?sprintId=${sprintId}&projectId=${projectId}&tab=blockers`;

          // 2. Identify Recipients
          const recipients = new Set();
          const userIdsToCheck = new Set();
          const emailsToCheck = new Set();

          // A. Owner
          if (project.owner) {
            if (project.owner.includes('@')) {
              recipients.add(project.owner);
              emailsToCheck.add(project.owner);
            } else {
              userIdsToCheck.add(project.owner);
            }
          }

          // B. Team Members (Array of objects/IDs)
          if (project.team_members && Array.isArray(project.team_members)) {
            project.team_members.forEach(m => {
              if (typeof m === 'object') {
                if (m.user_id) userIdsToCheck.add(m.user_id);
                if (m.email) {
                  emailsToCheck.add(m.email);
                  if (m.role === 'project_manager') recipients.add(m.email);
                }
              } else if (typeof m === 'string') {
                userIdsToCheck.add(m);
              }
            });
          }

          // C. ProjectUserRole (Custom Roles)
          const pmRoles = await ProjectUserRole.find({ project_id: projectId });
          pmRoles.forEach(r => {
            if (r.user_id) userIdsToCheck.add(r.user_id);
          });

          // D. Resolve Users and Check Roles
          if (userIdsToCheck.size > 0 || emailsToCheck.size > 0) {
            const users = await User.find({
              $or: [
                { _id: { $in: Array.from(userIdsToCheck) } },
                { email: { $in: Array.from(emailsToCheck) } }
              ]
            });

            users.forEach(u => {
              let isManager = false;

              // 1. Is Owner?
              if (project.owner === u.id || project.owner === u._id.toString() || project.owner === u.email) isManager = true;

              // 2. Has Global PM Role?
              if (u.role === 'project_manager' || u.custom_role === 'project_manager') isManager = true;

              // 3. Has Explicit Project Role?
              if (project.team_members && Array.isArray(project.team_members)) {
                const memberRec = project.team_members.find(m =>
                  m.user_id === u.id || m.user_id === u._id.toString() || m.email === u.email
                );
                if (memberRec && memberRec.role === 'project_manager') isManager = true;
              }
              // Check ProjectUserRole
              const userPmRole = pmRoles.find(r => r.user_id === u.id || r.user_id === u._id.toString());
              if (userPmRole && userPmRole.role === 'project_manager') isManager = true;

              if (isManager && u.email) {
                recipients.add(u.email);
              }
            });
          }

          recipients.delete(savedItem.reported_by);

          const notifications = [];

          // 3. Create Notifications for Manager/Owner
          const createdDate = new Date();

          console.log('[API] Using type: impediment_alert, category: alert');


          recipients.forEach(email => {
            notifications.push({
              tenant_id: savedItem.tenant_id,
              recipient_email: email,
              type: 'impediment_reported', // General notification for managers too
              category: 'general',
              title: 'New Impediment Reported',
              message: `${reporterName} reported an impediment on task "${taskTitle}".`,
              entity_type: 'impediment',
              entity_id: savedItem._id,
              project_id: projectId,
              deep_link: deepLink,
              sender_name: reporterName,
              read: false,
              created_date: createdDate
            });
          });

          // 4. Create Confirmation Notification for Reporter (Viewer/User)
          notifications.push({
            tenant_id: savedItem.tenant_id,
            recipient_email: savedItem.reported_by,
            type: 'impediment_reported', // Changed to avoid _alert suffix logic
            category: 'general',
            title: 'Impediment Reported',
            message: `You successfully reported an impediment for task "${taskTitle}".`,
            entity_type: 'impediment',
            entity_id: savedItem._id,
            project_id: projectId,
            // deep_link: deepLink, // Removed for reporter as per request
            sender_name: 'System',
            read: false,
            created_date: createdDate
          });

          console.log(`[API] Inserting ${notifications.length} notifications.`);

          if (notifications.length > 0) {
            const inserted = await Notification.insertMany(notifications);
            console.log(`[API] Inserted IDs:`, inserted.map(i => i._id));
            // Emit to socket if available?
            // Since 'req.io' is available in route, but we are in setImmediate... 
            // setImmediate generic callback might not capture req.io if not passed.
            // Usually req.io is available in the closure if we define it inside.
            // Yes, 'req' is in scope.
            if (req.io) {
              console.log('[API] Emitting via Socket.IO');
              notifications.forEach(n => {
                req.io.to(n.tenant_id).emit('new_notification', n);
              });
            } else {
              console.log('[API] req.io not available');
            }
          }

        } catch (err) {
          console.error('[Impediment] Notification Error:', err);
        }
      });
    }

    // --- PEER REVIEW NOTIFICATIONS ---
    if (entityName === 'PeerReviewRequest') {
      setImmediate(async () => {
        try {
          const Notification = Models.Notification;
          const User = Models.User;
          const emailService = require('../services/emailService');

          // 1. Create In-App Notification for Reviewer
          const notif = await Notification.create({
            tenant_id: savedItem.tenant_id,
            recipient_email: savedItem.reviewer_email,
            type: 'rework_peer_review',
            category: 'alert',
            title: 'Peer Review Requested',
            message: `${savedItem.requester_name} has requested a peer review for ${savedItem.task_title}. Click to view in Rework Reviews tab.`,
            entity_type: 'peer_review_request',
            entity_id: savedItem._id,
            link: '/Timesheets?tab=rework-reviews',
            scope: 'user',
            sender_name: savedItem.requester_name,
            status: 'OPEN'
          });

          if (req.io) {
            req.io.to(savedItem.tenant_id).emit('new_notification', notif);
          }

          // 2. Send Email to Reviewer
          const reviewer = await User.findOne({ email: savedItem.reviewer_email });
          const reviewerName = reviewer?.full_name || savedItem.reviewer_email;

          await emailService.sendEmail({
            to: savedItem.reviewer_email,
            templateType: 'peer_review_requested',
            data: {
              reviewerName,
              reviewerEmail: savedItem.reviewer_email,
              requesterName: savedItem.requester_name,
              taskTitle: savedItem.task_title,
              projectName: savedItem.project_name,
              message: savedItem.message,
              dashboardUrl: `${process.env.FRONTEND_URL}/Timesheets?tab=rework-reviews`
            }
          });
        } catch (err) {
          console.error('[PeerReview] Notification Error:', err);
        }
      });
    }

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
router.post('/entities/:entity/update', async (req, res) => {
  try {
    const Model = Models[req.params.entity];
    const entityName = req.params.entity;
    const { id, data } = req.body;

    // --- ASSIGNMENT FREEZE VALIDATION ---
    if (entityName === 'Task' && data && data.assigned_to) {
      let assignees = [];
      if (Array.isArray(data.assigned_to)) {
        assignees = data.assigned_to;
      } else if (typeof data.assigned_to === 'string') {
        assignees = data.assigned_to.split(',').map(s => s.trim()).filter(Boolean);
      }

      if (assignees.length > 0) {
        const Notification = Models.Notification;
        const frozenUsers = [];
        for (const email of assignees) {
          if (!email) continue;
          // Check for active high rework alarm (OPEN or APPEALED)
          const alarm = await Notification.findOne({
            recipient_email: email,
            type: 'high_rework_alarm',
            status: { $in: ['OPEN', 'APPEALED'] }
          });
          if (alarm) frozenUsers.push(email);
        }

        if (frozenUsers.length > 0) {
          return res.status(400).json({
            error: `Cannot assign task: User has too many rework tasks.`
          });
        }
      }
    }

    console.log(`[API] Update Request for ${entityName} ID: ${id}`);
    if (!Model) {
      console.error(`[API] Model ${entityName} not found in Models.`);
      return res.status(400).json({ error: `Model ${entityName} not supported` });
    }

    // Get old document before update
    const oldDoc = await Model.findById(id);
    if (!oldDoc) {
      console.error(`[API] Entity ${entityName} with ID ${id} NOT FOUND.`);
      return res.status(404).json({ error: 'Entity not found' });
    }


    // --- TIMESHEET VALIDATION: OVERWORK LOCK ---
    if (entityName === 'Timesheet') {
      // Check if modifying work_type to overtime OR if it's already overtime (though update might not change type)
      // If the user tries to SET it to overtime, check flag.
      if (data.work_type === 'overtime') {
        // We need to check the user. If user_email is in data, use it. If not, use oldDoc.
        const userEmail = data.user_email || oldDoc.user_email;
        if (userEmail) {
          const user = await Models.User.findOne({ email: userEmail });
          if (user && user.is_overloaded) {
            return res.status(400).json({
              error: 'Overtime is disabled because you have exceeded the work limit (>11h for 5 consecutive days). Please contact your Project Manager.'
            });
          }
        }
      }
    }

    // --- TIMESHEET SPECIAL LOGIC: UPDATE SNAPSHOT ---
    if (entityName === 'Timesheet') {
      try {
        // If status changes to 'submitted' OR hours changed OR it's just a general update, recalibrate cost.
        // We ALWAYS fetch the latest user rate to keep it fresh until it's 'approved'.
        // IF the timesheet is already approved, maybe we shouldn't change it?
        // For now, per requirement "create a timesheet snapshot at the time of submit", we update it here.
        if (oldDoc.status !== 'approved') {
          const userEmail = data.user_email || oldDoc.user_email;
          if (userEmail) {
            const user = await Models.User.findOne({ email: userEmail });
            if (user && user.hourly_rate) {
              data.snapshot_hourly_rate = user.hourly_rate;

              // Use new hours if provided, else old hours
              const relevantTotalMinutes = data.total_minutes !== undefined ? data.total_minutes : oldDoc.total_minutes;

              if (relevantTotalMinutes) {
                data.snapshot_total_cost = user.hourly_rate * (relevantTotalMinutes / 60);
              } else {
                // Fallback if total_minutes is missing in oldDoc (legacy)
                const h = data.hours !== undefined ? data.hours : oldDoc.hours;
                const m = data.minutes !== undefined ? data.minutes : oldDoc.minutes;
                const total = (h || 0) * 60 + (m || 0);
                if (total > 0) data.snapshot_total_cost = user.hourly_rate * (total / 60);
              }
            }
          }
        }
      } catch (tsError) {
        console.error("Error updating Timesheet snapshot:", tsError);
      }
    }

    // Perform update
    const updatedDoc = await Model.findByIdAndUpdate(id, data, { new: true });

    // --- TIMESHEET SUBMISSION NOTIFICATION (Update Route) ---
    if (entityName === 'Timesheet' && updatedDoc.status === 'submitted' && oldDoc.status !== 'submitted') {
      setImmediate(async () => {
        try {
          const Notification = Models.Notification;
          const User = Models.User;

          const tsDate = new Date(updatedDoc.date);
          const now = new Date();

          const workDate = new Date(tsDate);
          workDate.setHours(0, 0, 0, 0);

          const actualDate = new Date(now);
          actualDate.setHours(0, 0, 0, 0);

          const user = await User.findOne({ email: updatedDoc.user_email });

          if (user) {
            let type = 'timesheet_submission';
            let title = 'Timesheet Submitted';
            let message = 'Your timesheet has been successfully submitted.';

            if (workDate < actualDate) {
              type = 'timesheet_late_submission';
              title = 'Late Timesheet Submission';
              message = 'Your timesheet was submitted late. Please ensure timely updates';
            }

            const notif = await Notification.create({
              tenant_id: updatedDoc.tenant_id,
              recipient_email: updatedDoc.user_email,
              user_id: user._id,
              type: type,
              category: 'general',
              title: title,
              message: message,
              entity_type: 'timesheet',
              entity_id: updatedDoc._id,
              sender_name: 'System',
              read: false,
              created_date: new Date()
            });

            if (req.io) {
              req.io.to(updatedDoc.tenant_id).emit('new_notification', notif);
            }
          }
        } catch (notifErr) {
          console.error('[TimesheetUpdate] Notification Error:', notifErr);
        }
      });
    }

    // --- TIMESHEET REJECTION NOTIFICATION (Update Route) ---
    if (entityName === 'Timesheet' && updatedDoc.status === 'rejected' && oldDoc.status !== 'rejected') {
      setImmediate(async () => {
        try {
          const Notification = Models.Notification;
          const User = Models.User;

          // Requirement: Check if the user who performed the rejection is an Admin/PM
          const actorRole = req.user.role;
          const actorCustomRole = req.user.custom_role;

          const isAdminOrPM = actorRole === 'admin' || actorCustomRole === 'project_manager' || actorCustomRole === 'owner';

          if (isAdminOrPM) {
            const user = await User.findOne({ email: updatedDoc.user_email });
            if (user) {
              const notif = await Notification.create({
                tenant_id: updatedDoc.tenant_id,
                recipient_email: updatedDoc.user_email,
                user_id: user._id,
                type: 'timesheet_rejected',
                category: 'general',
                title: 'Time Entry Rejected',
                message: 'A time entry was rejected. Please correct and resubmit.',
                entity_type: 'timesheet',
                entity_id: updatedDoc._id,
                deep_link: `/Timesheets?tab=my-timesheets&editId=${updatedDoc._id}`,
                sender_name: req.user.full_name || 'System',
                read: false,
                created_date: new Date()
              });

              if (req.io) {
                req.io.to(updatedDoc.tenant_id).emit('new_notification', notif);
              }

              // Send Email notification
              try {
                await emailService.sendEmail({
                  to: updatedDoc.user_email,
                  templateType: 'timesheet_rejected',
                  data: {
                    memberName: user.full_name || updatedDoc.user_email,
                    memberEmail: updatedDoc.user_email,
                    taskTitle: updatedDoc.task_title || 'N/A',
                    date: updatedDoc.date,
                    hours: updatedDoc.hours,
                    minutes: updatedDoc.minutes,
                    rejectedBy: req.user.full_name || 'Project Manager',
                    comment: updatedDoc.rejection_reason || data.rejection_reason || 'No reason provided'
                  }
                });
              } catch (emailErr) {
                console.error('[Timesheet rejection] Email Error:', emailErr);
              }
            }
          }
        } catch (notifErr) {
          console.error('[TimesheetUpdate] Rejection Notification Error:', notifErr);
        }
      });
    }

    // --- TIMESHEET LOGGING: Dynamic Sync ---
    if (entityName === 'Timesheet') {
      try {
        // Sync both old date and new date in case the date was changed
        await syncUserTimesheetDay(updatedDoc.user_email, updatedDoc.date, updatedDoc.tenant_id);
        if (oldDoc.date && oldDoc.date.toString() !== updatedDoc.date.toString()) {
          await syncUserTimesheetDay(updatedDoc.user_email, oldDoc.date, updatedDoc.tenant_id);
        }
      } catch (err) {
        console.error("[Sync] Error in update sync:", err);
      }
    }

    // Send response immediately after update
    res.json(updatedDoc);

    // --- SPRINT VELOCITY SYNC (Update) ---
    if (['Task', 'Story', 'Sprint'].includes(entityName)) {
      setImmediate(async () => {
        try {
          const sprintIdsToSync = new Set();

          // Current sprint
          if (entityName === 'Sprint') {
            sprintIdsToSync.add(updatedDoc._id.toString());
          } else if (updatedDoc.sprint_id) {
            sprintIdsToSync.add(updatedDoc.sprint_id.toString());
          } else if (entityName === 'Task' && updatedDoc.story_id) {
            const story = await Models.Story.findById(updatedDoc.story_id);
            if (story && story.sprint_id) sprintIdsToSync.add(story.sprint_id.toString());
          }

          // Previous sprint (if changed)
          if (oldDoc.sprint_id && oldDoc.sprint_id.toString() !== (updatedDoc.sprint_id ? updatedDoc.sprint_id.toString() : '')) {
            sprintIdsToSync.add(oldDoc.sprint_id.toString());
          } else if (entityName === 'Task' && oldDoc.story_id && oldDoc.story_id.toString() !== (updatedDoc.story_id ? updatedDoc.story_id.toString() : '')) {
            const oldStory = await Models.Story.findById(oldDoc.story_id);
            if (oldStory && oldStory.sprint_id) sprintIdsToSync.add(oldStory.sprint_id.toString());
          }

          for (const sId of sprintIdsToSync) {
            await syncSprintVelocity(sId, updatedDoc.tenant_id);
          }
        } catch (err) {
          console.error("[VelocitySync] Error in update trigger:", err);
        }
      });
    }

    // --- ACTIVITY LOGGING ---
    setImmediate(async () => {
      try {
        const { logUserMetrics } = require('../utils/userMetricsLogger');

        // 1. Timesheet Updated -> Log for User (e.g. status change)
        if (entityName === 'Timesheet') {
          await logUserMetrics(updatedDoc.user_email, 'timesheet_submission');
        }

        // 2. Task Updated -> Log for NEW Assignees
        if (entityName === 'Task' && data.assigned_to) {
          const newAssignees = Array.isArray(updatedDoc.assigned_to) ? updatedDoc.assigned_to : [updatedDoc.assigned_to];
          // Log for everyone currently assigned
          for (const email of newAssignees) {
            await logUserMetrics(email, 'task_assignment');
          }
        }
      } catch (err) {
        console.error("Activity Logging Error (Update):", err);
      }
    });

    // Handle email notifications asynchronously after response is sent
    // This ensures team member add/remove operations are not affected by email failures
    if (entityName === 'Project' && data.team_members) {
      // Fire and forget - don't await, run asynchronously
      setImmediate(async () => {
        try {
          const { handleTeamMemberRemoval } = require('../utils/teamMemberRemovalHelper');
          const emailService = require('../services/emailService');
          const frontendUrl = process.env.FRONTEND_URL;
          if (!frontendUrl) {
            console.warn('FRONTEND_URL not set in environment variables');
            return;
          }

          // Detect added and removed members
          const oldMembers = (oldDoc.team_members || []).map(m => {
            const email = typeof m === 'string' ? m : m.email;
            return email?.toLowerCase();
          }).filter(Boolean);

          const newMembers = (updatedDoc.team_members || []).map(m => {
            const email = typeof m === 'string' ? m : m.email;
            return email?.toLowerCase();
          }).filter(Boolean);

          const addedMembers = newMembers.filter(email => !oldMembers.includes(email));
          const removedMembers = oldMembers.filter(email => !newMembers.includes(email));

          // Get updater info (from request if available, otherwise use project owner)
          const updaterEmail = req.user?.email || oldDoc.owner || 'System';
          const updater = await Models.User.findOne({ email: updaterEmail });
          const updaterName = updater?.full_name || updaterEmail;

          // Send emails to added members
          for (const memberEmail of addedMembers) {
            try {
              const member = await Models.User.findOne({ email: memberEmail });
              const memberName = member?.full_name || memberEmail;

              await emailService.sendEmail({
                to: memberEmail,
                templateType: 'project_member_added',
                data: {
                  memberName,
                  memberEmail,
                  projectName: updatedDoc.name,
                  projectDescription: updatedDoc.description,
                  addedBy: updaterName,
                  projectUrl: `${frontendUrl}/projects/${updatedDoc._id}`
                }
              });
            } catch (error) {
              console.error(`Failed to send email to ${memberEmail}:`, error);
            }
          }

          // Send emails to removed members
          for (const memberEmail of removedMembers) {
            try {
              const member = await Models.User.findOne({ email: memberEmail });
              const memberName = member?.full_name || memberEmail;

              await emailService.sendEmail({
                to: memberEmail,
                templateType: 'team_member_removed',
                data: {
                  memberName,
                  memberEmail,
                  projectName: updatedDoc.name,
                  removedBy: updaterName,
                  reason: null
                }
              });
            } catch (error) {
              console.error(`Failed to send removal email to ${memberEmail}:`, error);
            }
          }
        } catch (error) {
          console.error('Failed to send project team member emails:', error);
          // Email failure does not affect team member operations
        }
      });
    }

    // Handle email notifications for leave status changes asynchronously after response is sent
    // This ensures leave status updates are not affected by email failures
    if (entityName === 'Leave' && data.status && oldDoc.status !== data.status) {
      // Fire and forget - don't await, run asynchronously
      setImmediate(async () => {
        try {
          const emailService = require('../services/emailService');

          const newStatus = data.status;
          const oldStatus = oldDoc.status;

          // Send emails for status changes:
          // 1. submitted -> approved/rejected/cancelled
          // 2. approved -> cancelled (user cancelling approved leave)
          const shouldNotify = (
            ((newStatus === 'approved' || newStatus === 'rejected' || newStatus === 'cancelled') && oldStatus === 'submitted') ||
            (newStatus === 'cancelled' && oldStatus === 'approved')
          );

          if (shouldNotify) {
            const user = await Models.User.findById(updatedDoc.user_id);
            const approverEmail = data.approved_by || updatedDoc.approved_by || 'Administrator';
            const approver = await Models.User.findOne({ email: approverEmail });
            const approverName = approver?.full_name || approverEmail;
            const leaveType = await Models.LeaveType.findById(updatedDoc.leave_type_id);

            // Try to get comment from LeaveApproval if it exists
            let description = data.rejection_reason || updatedDoc.rejection_reason;
            if (!description && (newStatus === 'approved' || newStatus === 'rejected')) {
              const approval = await Models.LeaveApproval.findOne({
                leave_id: updatedDoc._id.toString()
              }).sort({ acted_at: -1 });
              if (approval && approval.comment) {
                description = approval.comment;
              }
            }

            if (!description) {
              description = newStatus === 'approved' ? 'Your leave has been approved.' :
                (newStatus === 'rejected' ? 'No reason provided' : 'No reason provided');
            }

            // --- 1. SEND EMAIL ---
            const templateType = newStatus === 'approved' ? 'leave_approved' : 'leave_cancelled';
            try {
              await emailService.sendEmail({
                to: updatedDoc.user_email || user?.email,
                templateType,
                data: {
                  memberName: updatedDoc.user_name || user?.full_name || updatedDoc.user_email,
                  memberEmail: updatedDoc.user_email || user?.email,
                  leaveType: updatedDoc.leave_type_name || leaveType?.name || 'Leave',
                  startDate: updatedDoc.start_date,
                  endDate: updatedDoc.end_date,
                  duration: updatedDoc.duration,
                  totalDays: updatedDoc.total_days,
                  approvedBy: newStatus === 'approved' ? approverName : undefined,
                  cancelledBy: (newStatus === 'cancelled' || newStatus === 'rejected') ? approverName : undefined,
                  reason: (newStatus === 'cancelled' || newStatus === 'rejected') ? description : undefined,
                  description: description
                }
              });
            } catch (emailErr) {
              console.error('Failed to send leave status email:', emailErr);
            }

            // --- 2. SEND IN-APP NOTIFICATION ---
            try {
              const title = newStatus === 'approved' ? 'Leave Approved' :
                (newStatus === 'rejected' ? 'Leave Rejected' : 'Leave Cancelled');

              const type = newStatus === 'approved' ? 'leave_approval' :
                (newStatus === 'rejected' ? 'leave_rejection' : 'leave_cancellation');

              const message = newStatus === 'approved'
                ? `Your leave application for ${updatedDoc.start_date} has been approved.`
                : `Your leave application for ${updatedDoc.start_date} has been ${newStatus}. Reason: ${description}`;

              const recipientEmail = updatedDoc.user_email || user?.email;

              if (recipientEmail) {
                await Models.Notification.create({
                  tenant_id: updatedDoc.tenant_id,
                  recipient_email: recipientEmail,
                  type: type,
                  title: title,
                  message: message,
                  entity_type: 'leave',
                  entity_id: updatedDoc._id,
                  category: 'general',
                  read: false,
                  sender_name: approverName || 'System'
                });
                console.log(`[LeaveStatus] In-app notification sent to ${recipientEmail}`);
              } else {
                console.warn('[LeaveStatus] No recipient email for in-app notification');
              }
            } catch (notifErr) {
              console.error('Failed to create in-app notification for leave status:', notifErr);
            }
          }
        } catch (error) {
          console.error('Failed to process leave status updates:', error);
        }
      });
    }

    // Handle email notifications for task assignments asynchronously after response is sent
    // This ensures task assignment updates are not affected by email failures
    if (entityName === 'Task') {
      // Fire and forget - don't await, run asynchronously
      setImmediate(async () => {
        try {
          const emailService = require('../services/emailService');
          const frontendUrl = process.env.FRONTEND_URL;
          if (!frontendUrl) {
            console.warn('FRONTEND_URL not set in environment variables');
            return;
          }

          // --- 1. MAIN TASK ASSIGNMENT NOTIFICATIONS ---
          if (data.assigned_to) {
            const oldAssignees = Array.isArray(oldDoc.assigned_to) ? oldDoc.assigned_to : (oldDoc.assigned_to ? [oldDoc.assigned_to] : []);
            const newAssignees = Array.isArray(updatedDoc.assigned_to) ? updatedDoc.assigned_to : (updatedDoc.assigned_to ? [updatedDoc.assigned_to] : []);

            // Find newly assigned members (not in old list)
            const newlyAssigned = newAssignees.filter(email => !oldAssignees.includes(email));

            if (newlyAssigned.length > 0) {
              // ... existing logic for main task assignment ...
              // Get project info
              let projectName = 'No Project';
              if (updatedDoc.project_id) {
                const project = await Models.Project.findById(updatedDoc.project_id);
                if (project) projectName = project.name;
              }

              // Get assigner info
              const assignerEmail = req.user?.email || updatedDoc.reporter || 'System';
              const assigner = await Models.User.findOne({ email: assignerEmail });
              const assignerName = assigner?.full_name || assignerEmail;

              // Send email to each newly assigned member
              for (const assigneeEmail of newlyAssigned) {
                try {
                  const assignee = await Models.User.findOne({ email: assigneeEmail });
                  const assigneeName = assignee?.full_name || assigneeEmail;

                  await emailService.sendEmail({
                    to: assigneeEmail,
                    templateType: 'task_assigned',
                    data: {
                      assigneeName,
                      assigneeEmail,
                      taskTitle: updatedDoc.title,
                      taskDescription: updatedDoc.description,
                      projectName,
                      assignedBy: assignerName,
                      dueDate: updatedDoc.due_date,
                      priority: updatedDoc.priority,
                      taskUrl: updatedDoc.project_id
                        ? `${frontendUrl}/projects/${updatedDoc.project_id}/tasks/${updatedDoc._id}`
                        : `${frontendUrl}/tasks/${updatedDoc._id}`
                    }
                  });
                } catch (error) {
                  console.error(`Failed to send task assignment email to ${assigneeEmail}:`, error);
                }
              }
            }

            // Find removed members (in old list but not in new list)
            const removedAssignees = oldAssignees.filter(email => !newAssignees.includes(email));

            if (removedAssignees.length > 0) {
              // Get project info
              let projectName = 'No Project';
              if (updatedDoc.project_id) {
                const project = await Models.Project.findById(updatedDoc.project_id);
                if (project) projectName = project.name;
              }

              // Get unassigner info
              const unassignerEmail = req.user?.email || 'System';
              const unassigner = await Models.User.findOne({ email: unassignerEmail });
              const unassignerName = unassigner?.full_name || unassignerEmail;

              for (const assigneeEmail of removedAssignees) {
                try {
                  const assignee = await Models.User.findOne({ email: assigneeEmail });
                  const assigneeName = assignee?.full_name || assigneeEmail;

                  await emailService.sendEmail({
                    to: assigneeEmail,
                    templateType: 'task_unassigned',
                    data: {
                      memberName: assigneeName,
                      memberEmail: assigneeEmail,
                      taskTitle: updatedDoc.title,
                      projectName,
                      unassignedBy: unassignerName,
                      taskUrl: updatedDoc.project_id
                        ? `${frontendUrl}/projects/${updatedDoc.project_id}/tasks/${updatedDoc._id}`
                        : `${frontendUrl}/tasks/${updatedDoc._id}`
                    }
                  });
                } catch (error) {
                  console.error(`Failed to send task unassignment email to ${assigneeEmail}:`, error);
                }
              }
            }
          }

          // --- 2. SUBTASK ASSIGNMENT NOTIFICATIONS ---
          if (updatedDoc.subtasks && Array.isArray(updatedDoc.subtasks)) {
            const oldSubtasks = Array.isArray(oldDoc.subtasks) ? oldDoc.subtasks : [];
            const newSubtasks = updatedDoc.subtasks;

            // Map old subtasks by some unique property if possible, ideally _id but fallback to title/index if needed.
            // Best effort: match by _id if available.
            const oldSubtaskMap = {};
            oldSubtasks.forEach(st => {
              if (st._id) oldSubtaskMap[st._id.toString()] = st;
            });

            for (const newSt of newSubtasks) {
              if (!newSt.assigned_to) continue; // Skip if no assignee

              let isNewAssignment = false;

              if (newSt._id && oldSubtaskMap[newSt._id.toString()]) {
                // Existing subtask: check if assignee changed
                const oldSt = oldSubtaskMap[newSt._id.toString()];
                if (oldSt.assigned_to !== newSt.assigned_to) {
                  isNewAssignment = true;
                }
              } else {
                // New subtask (or at least one we couldn't map by ID), consider it a new assignment
                isNewAssignment = true;
              }

              if (isNewAssignment) {
                const assigneeEmail = newSt.assigned_to;

                // Get project info (if not already fetched above)
                let projectName = 'No Project';
                if (updatedDoc.project_id) {
                  const project = await Models.Project.findById(updatedDoc.project_id);
                  if (project) projectName = project.name;
                }

                // Get assigner info
                const assignerEmail = req.user?.email || updatedDoc.reporter || 'System';
                const assigner = await Models.User.findOne({ email: assignerEmail });
                const assignerName = assigner?.full_name || assignerEmail;

                try {
                  const assignee = await Models.User.findOne({ email: assigneeEmail });
                  const assigneeName = assignee?.full_name || assigneeEmail;

                  // A. Send Email (Reusing task_assigned template but making title clear it's a subtask)
                  await emailService.sendEmail({
                    to: assigneeEmail,
                    templateType: 'task_assigned', // Reusing task_assigned template for simplicity
                    data: {
                      assigneeName,
                      assigneeEmail,
                      taskTitle: `[Subtask] ${newSt.title}`, // Prefix with [Subtask]
                      taskDescription: `Parent Task: ${updatedDoc.title}`,
                      projectName,
                      assignedBy: assignerName,
                      dueDate: newSt.due_date,
                      priority: 'Normal',
                      taskUrl: updatedDoc.project_id
                        ? `${frontendUrl}/projects/${updatedDoc.project_id}/tasks/${updatedDoc._id}`
                        : `${frontendUrl}/tasks/${updatedDoc._id}`
                    }
                  });

                  // B. Send In-App Notification
                  await Models.Notification.create({
                    tenant_id: updatedDoc.tenant_id,
                    recipient_email: assigneeEmail,
                    type: 'subtask_assignment', // New type
                    title: 'Subtask Assigned',
                    message: `You have been assigned a subtask: "${newSt.title}" in task "${updatedDoc.title}"`,
                    entity_type: 'task',
                    entity_id: updatedDoc._id,
                    project_id: updatedDoc.project_id, // Add project_id for faster navigation
                    category: 'general',
                    read: false,
                    sender_name: assignerName
                  });
                  console.log(`[SubtaskNotification] Sent to ${assigneeEmail}`);

                } catch (subErr) {
                  console.error(`Failed to send subtask notification to ${assigneeEmail}:`, subErr);
                }
              }
            }
          }

        } catch (error) {
          console.error('Failed to send task/subtask assignment emails:', error);
          // Email failure does not affect task assignment updates
        }
      });
    }

    // --- PEER REVIEW DECLINE NOTIFICATIONS ---
    if (entityName === 'PeerReviewRequest' && updatedDoc.status === 'DECLINED' && oldDoc.status !== 'DECLINED') {
      setImmediate(async () => {
        try {
          const Notification = Models.Notification;
          const User = Models.User;

          // 1. Create In-App Notification for Requester
          const notif = await Notification.create({
            tenant_id: updatedDoc.tenant_id,
            recipient_email: updatedDoc.requester_email,
            type: 'rework_peer_review_declined',
            category: 'alert',
            title: 'Peer Review Declined',
            message: `Your peer review request for "${updatedDoc.task_title}" has been declined by ${updatedDoc.reviewer_email}.`,
            entity_type: 'peer_review_request',
            entity_id: updatedDoc._id,
            link: '/Timesheets?tab=my-requests',
            scope: 'user',
            sender_name: updatedDoc.reviewer_email,
            status: 'OPEN'
          });

          if (req.io) {
            req.io.to(updatedDoc.tenant_id).emit('new_notification', notif);
          }

          // 2. Send Email to Requester
          const reviewer = await User.findOne({ email: updatedDoc.reviewer_email });
          const reviewerName = reviewer?.full_name || updatedDoc.reviewer_email;

          await emailService.sendEmail({
            to: updatedDoc.requester_email,
            templateType: 'peer_review_declined',
            data: {
              requesterName: updatedDoc.requester_name,
              requesterEmail: updatedDoc.requester_email,
              reviewerName,
              taskTitle: updatedDoc.task_title,
              projectName: updatedDoc.project_name,
              dashboardUrl: `${process.env.FRONTEND_URL}/Timesheets?tab=my-requests`
            }
          });
        } catch (err) {
          console.error('[PeerReviewDecline] Notification Error:', err);
        }
      });
    }

  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.post('/entities/:entity/delete', async (req, res) => {
  try {
    const { entity } = req.params;
    const { id } = req.body;

    // 1. Perform cascade deletion first
    await handleCascadeDelete(entity, id);

    // 2. Fetch doc before deletion for sync
    const Model = Models[entity];
    const docToDelete = await Model.findById(id);

    // 3. Delete the entity itself
    await Model.findByIdAndDelete(id);

    // --- TIMESHEET LOGGING: Dynamic Sync ---
    if (entity === 'Timesheet' && docToDelete) {
      try {
        await syncUserTimesheetDay(docToDelete.user_email, docToDelete.date, docToDelete.tenant_id);
      } catch (err) {
        console.error("[Sync] Error in delete sync:", err);
      }
    }

    // --- SPRINT VELOCITY SYNC (Delete) ---
    if (['Task', 'Story', 'Sprint'].includes(entity) && docToDelete) {
      setImmediate(async () => {
        try {
          let sprintId = null;
          if (entity === 'Sprint') {
            await Models.SprintVelocity.findOneAndDelete({ sprint_id: docToDelete._id });
            console.log(`[VelocitySync] Deleted velocity record for sprint: ${docToDelete.name}`);
            return;
          } else if (docToDelete.sprint_id) {
            sprintId = docToDelete.sprint_id;
          } else if (entity === 'Task' && docToDelete.story_id) {
            const story = await Models.Story.findById(docToDelete.story_id);
            if (story && story.sprint_id) sprintId = story.sprint_id;
          }

          if (sprintId) {
            await syncSprintVelocity(sprintId, docToDelete.tenant_id);
          }
        } catch (err) {
          console.error("[VelocitySync] Error in delete trigger:", err);
        }
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).send(err.message);
  }
});
router.post('/entities/:entity/get/:id', async (req, res) => {
  try {
    const Model = Models[req.params.entity];
    if (!Model) return res.status(400).json({ error: 'Entity not found' });
    const item = await Model.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// ... (AI HELPER ROUTES) ...
router.get('/ai/conversations', async (req, res) => { const { user_id, tenant_id } = req.query; if (!user_id || !tenant_id) return res.json([]); try { const conversations = await Models.Conversation.find({ user_id, tenant_id, is_active: true }).sort({ updated_date: -1 }).limit(20); res.json(conversations); } catch (err) { res.status(500).json({ error: err.message }); } });
router.post('/ai/conversations', async (req, res) => { try { const convo = new Models.Conversation({ ...req.body, messages: [] }); await convo.save(); res.json(convo); } catch (err) { res.status(500).json({ error: err.message }); } });
router.get('/ai/usage/stats', async (req, res) => { const { user_id, tenant_id } = req.query; try { const usage = await Models.TokenUsage.aggregate([{ $match: { user_id, tenant_id } }, { $group: { _id: null, total_tokens: { $sum: "$total_tokens" } } }]); res.json(usage[0] || { total_tokens: 0 }); } catch (err) { res.status(500).json({ error: err.message }); } });

// === CHAT ROUTE ===
router.post('/ai/chat', async (req, res) => {
  const { conversation_id, content, file_urls, context, model, user_id, tenant_id } = req.body;
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "AI Configuration Error" });

  try {
    const conversation = await Models.Conversation.findById(conversation_id);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });

    const userMsg = { role: 'user', content: content, file_urls, created_at: new Date() };
    conversation.messages.push(userMsg);
    conversation.updated_date = new Date();
    await conversation.save();

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const deepContext = await buildDeepContext(tenant_id, user_id, content);
    const fileParts = await processFilesForGemini(file_urls, req);

    let contextBlock = "";
    if (context) contextBlock += `${context}\n`;
    if (deepContext) contextBlock += `${deepContext}\n`;

    const finalParts = [
      ...fileParts,
      { text: contextBlock ? `SYSTEM DATA:\n${contextBlock}\n\nUSER QUERY: ${content}` : content }
    ];

    const systemInstruction = {
      parts: [{ text: `You are Aivora. Concise, helpful, professional.` }]
    };

    const result = await generateController(genAI, {
      content: finalParts,
      history: conversation.messages.slice(-6).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content || (m.file_urls?.length ? "File" : "") }]
      })),
      systemInstruction: systemInstruction
    }, model);

    conversation.messages.push({ role: 'assistant', content: result.text, created_at: new Date() });
    await conversation.save();

    if (result.usage?.totalTokenCount > 0) {
      await Models.TokenUsage.create({
        tenant_id, user_id, model: result.model,
        total_tokens: result.usage.totalTokenCount,
        created_date: new Date()
      });
    }

    res.json({ message: result.text, usage: result.usage, model: result.model });

  } catch (err) {
    console.error("AI Chat Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// === UPDATED SPRINT TASK GEN ROUTE (JSON FALLBACK HANDLING) ===
router.post('/ai/generate-sprint-tasks', async (req, res) => {
  const { sprintId, projectId, workspaceId, tenantId, goal, userEmail } = req.body;
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "AI Configuration Error" });

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const prompt = `Create tasks. Goal: "${goal}". Return JSON { "tasks": [] }.`;

    // Use default model (gemini-2.5-flash-native-audio-dialog) from helper
    const result = await generateController(genAI, {
      content: prompt,
      generationConfig: { responseMimeType: "application/json" }
    }, modelHelper.getDefaultModel());

    // [MODIFICATION] Robust JSON Parsing (Strips Markdown fences if JSON mode failed/was disabled)
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : result.text;

    let aiData;
    try {
      aiData = JSON.parse(jsonStr);
    } catch (e) {
      console.error("JSON Parse Failed:", result.text);
      return res.json({ message: "Failed to parse AI response", tasks: [] });
    }

    const tasksToCreate = (aiData.tasks || []).map(t => ({ ...t, tenant_id: tenantId, project_id: projectId, workspace_id: workspaceId, sprint_id: sprintId, status: 'todo', ai_generated: true, reporter: userEmail }));
    if (tasksToCreate.length > 0) {
      const createdTasks = await Models.Task.insertMany(tasksToCreate);
      return res.json({ success: true, tasks: createdTasks });
    }
    res.json({ message: "No tasks generated", tasks: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === UPDATED INTEGRATIONS LLM ROUTE (Fixes "Failed to draft" and JSON Parse Errors) ===
router.post('/integrations/llm', async (req, res) => {
  const { prompt, response_json_schema, context, file_urls } = req.body;

  // 1. Handle Missing API Key Gracefully
  if (!process.env.GEMINI_API_KEY) {
    console.warn("[AI] No API Key found. Returning mock response.");
    if (response_json_schema) {
      return res.json({
        description: "This is a drafted description generated by the system (Mock Mode). Please configure your GEMINI_API_KEY to get real AI suggestions.",
        priority: "medium",
        story_points: 3,
        reasoning: "Mock reasoning (API Key missing)",
        confidence: 90,
        tags: ["mock", "tag"],
        dependency_ids: []
      });
    }
    return res.json("AI Response (Mock): Please configure API Key.");
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const generationConfig = response_json_schema ? { responseMimeType: "application/json" } : {};

    const fileParts = await processFilesForGemini(file_urls, req);

    // 2. Handle undefined context safely
    let textPart = `USER QUERY: ${prompt}`;
    if (context && typeof context === 'string' && context.trim()) {
      textPart = `CONTEXT:\n${context}\n\n${textPart}`;
    }

    const parts = [...fileParts, { text: textPart }];

    // Use default model (gemini-2.5-flash-native-audio-dialog) from helper
    // This provides unlimited RPD/RPM to avoid quota issues
    const result = await generateController(genAI, {
      content: parts,
      generationConfig: generationConfig
    }, modelHelper.getDefaultModel());

    const text = result.text;

    if (response_json_schema) {
      // 3. Robust JSON Parsing & Fallback for Plain Text
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : text;

      try {
        const jsonObj = JSON.parse(jsonStr);
        return res.json(jsonObj);
      } catch (e) {
        // *** THE FIX: Auto-Correct Plain Text Responses ***
        console.warn("[AI] JSON Parse Failed. attempting text fallback.");

        // If the user requested a description and we got text, assume the text IS the description
        if (response_json_schema?.properties?.description) {
          return res.json({
            description: text.replace(/[*#]/g, ''), // Strip markdown artifacts
            priority: "medium",
            story_points: 1
          });
        }

        console.error("[AI] JSON Parse Failed (Unrecoverable):", text);
        return res.status(500).json({ error: "Failed to parse generated JSON", raw: text });
      }
    }
    res.json(text);
  } catch (err) {
    console.error("[AI] Endpoint Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// === EMAIL ROUTE USING RESEND SDK ===
router.post('/integrations/email', async (req, res) => {
  const { to, subject, body } = req.body;
  if (!process.env.RESEND_API_KEY) return res.status(500).json({ error: "Email config missing: RESEND_API_KEY not set" });

  try {
    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    const from = process.env.MAIL_FROM || 'Groona <no-reply@quantumisecode.com>';

    await resend.emails.send({
      from: from,
      to: Array.isArray(to) ? to : [to],
      subject: subject,
      html: body
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[API] Email send error:', err);
    res.status(500).json({ error: err.message || 'Failed to send email. Please check Resend API configuration.' });
  }
});

// Email with template endpoint
router.post('/email/send-template', async (req, res) => {
  const { to, templateType, data, subject } = req.body;

  if (!to || !templateType) {
    return res.status(400).json({ error: 'Missing required fields: to, templateType' });
  }

  try {
    await emailService.sendEmail({
      to,
      templateType,
      data,
      subject
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[API] Email template send error:', err);
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;