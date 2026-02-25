const Models = require('../models/SchemaDefinitions');

const allocateIndividualLeave = async (data) => {
    const { tenant_id, user_id, leave_type_id, days, year } = data;
    
    // 1. Fetch all predefined leave types to validate (as requested)
    const leaveType = await Models.LeaveType.findById(leave_type_id);
    const user = await Models.User.findById(user_id);
    
    if (!user || !leaveType) {
        throw new Error("Invalid User or Leave Type");
    }

    // 2. Security Check
    if (user.tenant_id !== tenant_id || leaveType.tenant_id !== tenant_id) {
        throw new Error("Tenant mismatch: Unauthorized action.");
    }

    const targetYear = parseInt(year);
    const allocatedAmount = parseFloat(days);

    // 3. Find or Create Balance
    let balance = await Models.LeaveBalance.findOne({
      tenant_id,
      user_id,
      leave_type_id,
      year: targetYear
    });

    if (balance) {
      // Update existing allocation
      // Logic: New Remaining = New Allocation + Carried - Used
      balance.allocated = allocatedAmount;
      balance.remaining = allocatedAmount + (balance.carried_over || 0) - (balance.used || 0);
      await balance.save();
    } else {
      // Create new allocation
      balance = await Models.LeaveBalance.create({
        tenant_id,
        user_id,
        user_email: user.email,
        leave_type_id,
        leave_type_name: leaveType.name,
        year: targetYear,
        allocated: allocatedAmount,
        carried_over: 0,
        used: 0,
        pending: 0,
        remaining: allocatedAmount
      });
    }

    return { success: true, balance };
};

module.exports = allocateIndividualLeave;