const express = require('express');
const router = express.Router();
const Models = require('../models/SchemaDefinitions');
const otpGenerator = require('otp-generator');
// nodemailer removed - using Resend SDK now
const { GoogleGenerativeAI } = require("@google/generative-ai");
const jwt = require('jsonwebtoken');
const pdf = require('html-pdf-node');

// --- IMPORT NEW HANDLERS ---
const allocateIndividualLeave = require('../handlers/allocateIndividualLeave');
const updateLeaveStatus = require('../handlers/updateLeaveStatus');

const { sendEmail } = require('../services/emailService');

// Default template
const getDefaultTemplate = (otp) => `<p>Your code is: <b>${otp}</b></p>`;

// --- FUNCTION IMPLEMENTATIONS ---

const functionHandlers = {
  // 1. Auth: Send OTP
  sendOTP: async (data) => {
    const { email, emailTemplate } = data;
    const otp = otpGenerator.generate(6, { digits: true, lowerCaseAlphabets: false, upperCaseAlphabets: false, specialChars: false });

    await Models.OTPVerification.findOneAndUpdate(
      { email },
      { email, otp, expiresAt: new Date(Date.now() + 10 * 60000) },
      { upsert: true, new: true }
    );

    const emailHtml = emailTemplate ? emailTemplate.replace('{{OTP}}', otp) : getDefaultTemplate(otp);
    await sendEmail({ to: email, subject: "Your Aivora Verification Code", html: emailHtml });
    return { success: true, message: "OTP sent" };
  },

  // 2. Auth: Verify OTP
  verifyOTP: async (data) => {
    const { email, otp } = data;
    const record = await Models.OTPVerification.findOne({ email, otp });

    if (!record) throw new Error("Invalid OTP");
    if (new Date() > record.expiresAt) throw new Error("OTP Expired");

    await Models.OTPVerification.deleteOne({ _id: record._id });
    const user = await Models.User.findOne({ email });
    if (!user) throw new Error("User not found");

    const token = jwt.sign({ user: { id: user.id, tenant_id: user.tenant_id } }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return { success: true, token, user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role, tenant_id: user.tenant_id } };
  },

  // 3. AI: Generate Proposal Draft
  generateProposalDraft: async (data) => {
    const { clientName, projectType, requirements } = data;
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `Write a professional proposal for ${clientName} regarding a ${projectType} project. Requirements: ${requirements}`;
    const result = await model.generateContent(prompt);
    return { draft: result.response.text() };
  },

  // 4. Utils: Update User Profile
  updateUserProfile: async (data) => {
    const { userId, updates } = data;
    return await Models.User.findByIdAndUpdate(userId, updates, { new: true });
  },

  // 5. PDF: Generate Document PDF
  generateDocumentPdf: async (data) => {
    const { title, content, author, created_date } = data;
    const htmlContent = `
      <html>
        <head>
          <style>
            body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 40px; color: #334155; line-height: 1.6; }
            .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
            h1 { font-size: 32px; font-weight: 800; color: #0f172a; margin: 0 0 10px 0; }
            .meta { font-size: 14px; color: #64748b; }
            .content h1 { font-size: 28px; font-weight: 800; color: #0f172a; margin-top: 30px; border-bottom: 1px solid #e2e8f0; }
            .content h2 { font-size: 24px; font-weight: 700; color: #0f172a; margin-top: 24px; }
            .content h3 { font-size: 20px; font-weight: 600; color: #1e293b; margin-top: 20px; }
            .content ul, .content ol { padding-left: 24px; margin-bottom: 16px; }
            .content blockquote { border-left: 4px solid #3b82f6; padding-left: 16px; font-style: italic; background-color: #f8fafc; padding: 10px 16px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${title}</h1>
            <div class="meta"><strong>Author:</strong> ${author} | <strong>Created:</strong> ${new Date(created_date).toLocaleDateString()}</div>
          </div>
          <div class="content">${content}</div>
        </body>
      </html>
    `;
    const file = { content: htmlContent };
    const pdfBuffer = await pdf.generatePdf(file, { format: 'A4', printBackground: true });
    return { data: pdfBuffer.toString('base64'), encoding: 'base64', filename: `${title.replace(/[^a-z0-9]/gi, '_')}.pdf` };
  },

  // 6. Leave: Run Annual Allocation
  runAnnualLeaveAllocation: async (data) => {
    const { tenant_id, year, dry_run } = data;
    const targetYear = parseInt(year);

    // Fetch resources
    const users = await Models.User.find({ tenant_id });
    const leaveTypes = await Models.LeaveType.find({ tenant_id });

    if (!users.length || !leaveTypes.length) {
      return { success: false, message: "No users or leave types found for this tenant.", results: [] };
    }

    let stats = { created: 0, updated: 0, carried_forward: 0, total_users: users.length };

    // Execution Loop
    for (const user of users) {
      for (const type of leaveTypes) {
        // Skip Comp Off from annual allocation
        if (type.is_comp_off) continue;

        // --- FIX: Handle both field names (days_allowed OR annual_allowance) ---
        const allowance = type.annual_allowance || type.days_allowed || 0;

        // If no allowance set and no carry forward, nothing to allocate
        if (allowance === 0 && !type.carry_forward) continue;

        // 1. Calculate Carry Forward
        let carriedAmount = 0;
        if (type.carry_forward) {
          const prevBalance = await Models.LeaveBalance.findOne({
            tenant_id,
            user_id: user._id,
            leave_type_id: type._id,
            year: targetYear - 1
          });

          if (prevBalance && prevBalance.remaining > 0) {
            carriedAmount = prevBalance.remaining;
            // Apply Max Carry Forward Cap if set
            if (type.max_carry_forward && carriedAmount > type.max_carry_forward) {
              carriedAmount = type.max_carry_forward;
            }
            stats.carried_forward++;
          }
        }

        const totalAvailable = allowance + carriedAmount;

        // Dry Run Check
        if (dry_run) {
          const exists = await Models.LeaveBalance.findOne({ tenant_id, user_id: user._id, leave_type_id: type._id, year: targetYear });
          if (exists) stats.updated++; else stats.created++;
          continue;
        }

        // 2. Check/Update Balance for Target Year
        const existingBalance = await Models.LeaveBalance.findOne({
          tenant_id,
          user_id: user._id,
          leave_type_id: type._id,
          year: targetYear
        });

        if (existingBalance) {
          // Update: Reset allocation and carry forward, keep used amount
          existingBalance.allocated = allowance;
          existingBalance.carried_over = carriedAmount;
          // Recalculate remaining
          existingBalance.remaining = totalAvailable - (existingBalance.used || 0);

          await existingBalance.save();
          stats.updated++;
        } else {
          // Create New
          await Models.LeaveBalance.create({
            tenant_id,
            user_id: user._id,
            user_email: user.email,
            leave_type_id: type._id,
            leave_type_name: type.name,
            year: targetYear,
            allocated: allowance,
            carried_over: carriedAmount,
            used: 0,
            pending: 0,
            remaining: totalAvailable
          });
          stats.created++;
        }
      }
    }

    return { success: true, year: targetYear, results: [stats] };
  },

  // 7. AI: Generate Sprint Goal
  generateSprintGoal: async (data) => {
    const { prompt } = data;
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const enhancedPrompt = `${prompt}\n\nReturn ONLY a JSON object with a "goal" key. 
    Format: {"goal": "your generated goal here"}
    Do not include any other text or markdown formatting.`;

    const result = await model.generateContent(enhancedPrompt);
    const text = result.response.text();

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { goal: text.trim() };
    } catch (e) {
      return { goal: text.trim() };
    }
  },

  // 8. Register the imported handler
  allocateIndividualLeave: allocateIndividualLeave,
  updateLeaveStatus: updateLeaveStatus,

  // 9. Work Hierarchy: Fetch projects, stories and tasks for a user
  getUserWorkHierarchy: async (data) => {
    const { userEmail, userId, tenantId, isAdmin, isOwner, isProjectManager } = data;

    if (!tenantId) {
      return { projects: [], stories: [], tasks: [] };
    }

    try {
      // 1. Fetch Project Access
      let projectQuery = { tenant_id: tenantId };
      let pmProjectIds = [];

      if (!isAdmin && !isOwner) {
        const roles = await Models.ProjectUserRole.find({
          tenant_id: tenantId,
          $or: [{ user_id: userId }, { user_email: userEmail }]
        });
        const roleProjectIds = roles.map(r => r.project_id?.toString()).filter(Boolean);

        // Identify projects where they are specifically a Project Manager
        pmProjectIds = roles
          .filter(r => r.role === 'project_manager')
          .map(r => r.project_id?.toString())
          .filter(Boolean);

        projectQuery = {
          tenant_id: tenantId,
          $or: [
            { _id: { $in: roleProjectIds } },
            { id: { $in: roleProjectIds } },
            { "team_members.email": userEmail }
          ]
        };
      }
      const projects = await Models.Project.find(projectQuery);
      const accessibleProjectIds = projects.map(p => p._id.toString());

      // 2. Fetch Tasks assigned to the target user
      const tasks = await Models.Task.find({
        tenant_id: tenantId,
        project_id: { $in: accessibleProjectIds },
        $or: [
          { assigned_to: userEmail },
          { assigned_to: userId },
          { assignee: userEmail },
          { assignee: userId },
          { assignee_email: userEmail },
          { "assignee_id.email": userEmail },
          { "assignee_id.id": userId },
          { "assignee_id._id": userId }
        ]
      });

      const assignedStoryIds = [...new Set(tasks.map(t => t.story_id?.toString()).filter(Boolean))];

      // 3. Fetch Stories
      // For Admins/Owners: All stories in accessible projects.
      // For PMs: All stories in projects they manage OR stories they are explicitly assigned to OR stories from tasks.
      let storyQuery;
      if (isAdmin || isOwner) {
        storyQuery = { project_id: { $in: accessibleProjectIds } };
      } else {
        storyQuery = {
          $or: [
            { _id: { $in: assignedStoryIds } },
            { project_id: { $in: pmProjectIds } },
            { assigned_to: userEmail }
          ]
        };
      }

      const stories = await Models.Story.find(storyQuery);

      const result = {
        projects: projects.map(p => {
          const obj = p.toObject();
          return { ...obj, id: obj._id.toString() };
        }),
        stories: stories.map(s => {
          const obj = s.toObject();
          return { ...obj, id: obj._id.toString() };
        }),
        tasks: tasks.map(t => {
          const obj = t.toObject();
          return {
            ...obj,
            id: obj._id.toString(),
            // Ensure frontend filters find the match
            assignee_email: userEmail,
            assignee: userEmail,
            // Normalize IDs for frontend comparison
            project_id: obj.project_id?.toString(),
            story_id: obj.story_id?.toString()
          };
        })
      };

      console.log('[getUserWorkHierarchy] Success. Returning counts:', {
        projects: result.projects.length,
        stories: result.stories.length,
        tasks: result.tasks.length
      });
      return result;
    } catch (error) {
      throw error;
    }
  },

  // 17. Ops: Resolve Lockout Appeal (Reset Ignored Count)
  resolveLockoutAppeal: async (data) => {
    const { notificationId, /* status, resolvedBy */ } = data;
    // 1. Resolve the Notification
    await Models.Notification.updateOne(
      { _id: notificationId },
      {
        status: 'RESOLVED',
        read: true,
        resolved_at: new Date(),
        resolved_by: data.resolvedBy
      }
    );

    // 2. Find the notification to get the user
    // (Or we could pass userId/email from frontend, but fetching is safer)
    const notif = await Models.Notification.findById(notificationId);
    if (notif && notif.user_id) {
      // 3. Reset the ignored_alert_count on the LATEST activity log
      // We assume the open alarm corresponds to the latest/current activity block.
      const latestLog = await Models.UserActivityLog.findOne({ user_id: notif.user_id })
        .sort({ timestamp: -1 });

      if (latestLog) {
        latestLog.ignored_alert_count = 0;
        await latestLog.save();
        console.log(`[resolveLockoutAppeal] Reset ignored_alert_count for user ${notif.recipient_email}`);
      }
    }
    return { success: true };
  },

  // 18. Notifications: Send Email
  sendNotificationEmail: async (data) => {
    const { to, subject, html, templateType, templateData } = data;
    console.log(`[function:sendNotificationEmail] Triggered for ${to}`);

    // Use the robust emailService
    // It handles: SMTP vs Resend fallback, templates, etc.
    const result = await sendEmail({
      to,
      subject,
      html, // Can be direct HTML
      templateType, // OR a template name
      data: templateData // Data for the template
    });

    return result;
  }
};


// --- MAIN ROUTE HANDLER ---
router.post('/invoke', async (req, res) => {
  const { functionName, payload } = req.body;

  if (!functionHandlers[functionName]) {
    return res.status(404).json({ error: `Function '${functionName}' not implemented on backend.` });
  }

  try {
    const result = await functionHandlers[functionName](payload);
    res.json(result);
  } catch (error) {
    console.error(`Error in ${functionName}:`, error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;