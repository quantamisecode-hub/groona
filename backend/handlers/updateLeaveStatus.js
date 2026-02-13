const Models = require('../models/SchemaDefinitions');
const emailService = require('../services/emailService');

const updateLeaveStatus = async (data) => {
    const { leave_id, status, approver_id, rejection_reason } = data;

    const leave = await Models.Leave.findById(leave_id);
    if (!leave) throw new Error("Leave request not found");

    const previousStatus = leave.status;

    // Prevent double processing
    if (previousStatus === 'approved' || previousStatus === 'rejected') {
        throw new Error("Leave request has already been processed");
    }

    // Update Leave Status
    leave.status = status;
    leave.approved_by = approver_id;
    if (rejection_reason) leave.rejection_reason = rejection_reason;
    await leave.save();

    // --- CRITICAL: Update Balances ---
    const balance = await Models.LeaveBalance.findOne({
        tenant_id: leave.tenant_id,
        user_id: leave.user_id,
        leave_type_id: leave.leave_type_id,
        year: new Date(leave.start_date).getFullYear()
    });

    if (balance) {
        const days = leave.total_days;

        if (status === 'approved') {
            // Move from Pending -> Used
            // Remaining was already deducted during application, so we don't touch it here
            balance.pending = Math.max(0, balance.pending - days);
            balance.used += days;
        }
        else if (status === 'rejected' || status === 'cancelled') {
            // Revert the transaction
            // Remove from Pending, Add back to Remaining
            balance.pending = Math.max(0, balance.pending - days);
            balance.remaining += days;
        }

        await balance.save();
    }

    // Send email notification
    try {
        const user = await Models.User.findById(leave.user_id);
        const approver = approver_id ? await Models.User.findById(approver_id) : null;
        const leaveType = await Models.LeaveType.findById(leave.leave_type_id);

        const templateType = status === 'approved' ? 'leave_approved' : 'leave_cancelled';
        const approverName = approver?.full_name || approver?.email || 'Administrator';

        await emailService.sendEmail({
            to: leave.user_email || user?.email,
            templateType,
            data: {
                memberName: leave.user_name || user?.full_name || leave.user_email,
                memberEmail: leave.user_email || user?.email,
                leaveType: leave.leave_type_name || leaveType?.name || 'Leave',
                startDate: leave.start_date,
                endDate: leave.end_date,
                duration: leave.duration,
                totalDays: leave.total_days,
                approvedBy: status === 'approved' ? approverName : undefined,
                cancelledBy: status === 'cancelled' || status === 'rejected' ? approverName : undefined,
                reason: (status === 'cancelled' || status === 'rejected') ? (rejection_reason || 'No reason provided') : undefined,
                description: rejection_reason || (status === 'approved' ? 'Your leave has been approved.' : undefined)
            }
        });
    } catch (error) {
        console.error('Failed to send leave status email:', error);
        // Continue even if email fails
    }

    // --- LEAVE STATUS NOTIFICATION (IN-APP) ---
    try {
        const title = status === 'approved' ? 'Leave Approved' :
            (status === 'rejected' ? 'Leave Rejected' : 'Leave Cancelled');

        const type = status === 'approved' ? 'leave_approval' :
            (status === 'rejected' ? 'leave_rejection' : 'leave_cancellation');

        const message = status === 'approved'
            ? `Your leave application for ${leave.start_date} has been approved.`
            : `Your leave application for ${leave.start_date} has been ${status}. Reason: ${rejection_reason || 'None'}`;

        const recipientEmail = leave.user_email || user?.email;

        if (recipientEmail) {
            console.log(`[LeaveStatus] Sending in-app notification to ${recipientEmail} for status ${status}`);
            await Models.Notification.create({
                tenant_id: leave.tenant_id,
                recipient_email: recipientEmail,
                type: type,
                title: title,
                message: message,
                entity_type: 'leave',
                entity_id: leave._id,
                category: status === 'approved' ? 'general' : 'alert',
                read: false,
                sender_name: approver_id ? 'Manager' : 'System'
            });
        } else {
            console.error('[LeaveStatus] No recipient email found for notification', { leaveId: leave._id, userId: leave.user_id });
        }
    } catch (notifErr) {
        console.error('Failed to create in-app notification for leave status:', notifErr);
    }

    return { success: true, leave, balance };
};

module.exports = updateLeaveStatus;