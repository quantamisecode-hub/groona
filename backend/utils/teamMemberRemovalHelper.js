/**
 * Helper function to detect and handle team member removal from projects
 * This should be called when a project's team_members array is updated
 */

const Models = require('../models/SchemaDefinitions');
const emailService = require('../services/emailService');

/**
 * Compare old and new team member lists and send emails to removed members
 * @param {Object} oldProject - Project before update
 * @param {Object} newProject - Project after update
 * @param {string} updatedBy - Email of user who made the update
 */
async function handleTeamMemberRemoval(oldProject, newProject, updatedBy) {
  if (!oldProject || !newProject) return;

  const oldMembers = (oldProject.team_members || []).map(m => {
    const email = typeof m === 'string' ? m : m.email;
    return email?.toLowerCase();
  }).filter(Boolean);

  const newMembers = (newProject.team_members || []).map(m => {
    const email = typeof m === 'string' ? m : m.email;
    return email?.toLowerCase();
  }).filter(Boolean);

  // Find removed members
  const removedMembers = oldMembers.filter(email => !newMembers.includes(email));

  if (removedMembers.length === 0) return;

  // Get updater info
  const updater = await Models.User.findOne({ email: updatedBy });
  const updaterName = updater?.full_name || updatedBy;

  // Send email to each removed member
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
          projectName: newProject.name,
          removedBy: updaterName,
          reason: null // Can be added if reason is tracked
        }
      });
    } catch (error) {
      console.error(`Failed to send removal email to ${memberEmail}:`, error);
      // Continue with other members even if one fails
    }
  }
}

module.exports = {
  handleTeamMemberRemoval
};
