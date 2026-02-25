const express = require('express');
const router = express.Router();
const Models = require('../models/SchemaDefinitions');

// Date utility functions (since date-fns might not be available in Node.js backend)
function parseISO(dateString) {
    return new Date(dateString);
}

function format(date, formatStr) {
    const d = new Date(date);
    if (formatStr === 'yyyy-MM-dd') {
        return d.toISOString().split('T')[0];
    }
    if (formatStr.includes('MMM')) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    }
    return d.toISOString();
}

function startOfWeek(date, options = { weekStartsOn: 1 }) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = (day < options.weekStartsOn ? 7 : 0) + day - options.weekStartsOn;
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function endOfWeek(date, options = { weekStartsOn: 1 }) {
    const d = startOfWeek(date, options);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
}

function differenceInDays(dateLeft, dateRight) {
    const left = new Date(dateLeft);
    const right = new Date(dateRight);
    const diffTime = left - right;
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Auto-add comp off credits when overtime is worked
 * This function checks timesheets for overtime (daily > 8h or weekly > 40h)
 * and automatically creates comp off credits
 */
async function processOvertimeForCompOff(tenantId, userEmail, date) {
    try {
        // Get all timesheets for this user for the week
        const weekStart = startOfWeek(parseISO(date), { weekStartsOn: 1 });
        const weekEnd = endOfWeek(parseISO(date), { weekStartsOn: 1 });
        
        const weekTimesheets = await Models.Timesheet.find({
            tenant_id: tenantId,
            user_email: userEmail,
            date: {
                $gte: format(weekStart, 'yyyy-MM-dd'),
                $lte: format(weekEnd, 'yyyy-MM-dd')
            }
        });

        // Calculate daily and weekly totals
        const dailyHours = {};
        let weeklyTotal = 0;

        weekTimesheets.forEach(ts => {
            const hours = (ts.hours || 0) + ((ts.minutes || 0) / 60);
            const dayKey = ts.date;
            
            if (!dailyHours[dayKey]) {
                dailyHours[dayKey] = 0;
            }
            dailyHours[dayKey] += hours;
            weeklyTotal += hours;
        });

        // Check for daily overtime (> 8 hours)
        let totalOvertimeDays = 0;
        Object.entries(dailyHours).forEach(([day, hours]) => {
            if (hours > 8) {
                const overtimeHours = hours - 8;
                // Convert overtime to days (8 hours = 1 day)
                totalOvertimeDays += overtimeHours / 8;
            }
        });

        // Check for weekly overtime (> 40 hours)
        if (weeklyTotal > 40) {
            const weeklyOvertimeHours = weeklyTotal - 40;
            totalOvertimeDays += weeklyOvertimeHours / 8;
        }

        // If there's overtime, create comp off credit
        if (totalOvertimeDays > 0) {
            // Round to nearest 0.5 days
            const compOffDays = Math.round(totalOvertimeDays * 2) / 2;
            
            // Check if comp off already exists for this week
            const existingCredit = await Models.CompOffCredit.findOne({
                tenant_id: tenantId,
                user_email: userEmail,
                reason: { $regex: `Overtime.*${format(weekStart, 'yyyy-MM-dd')}`, $options: 'i' }
            });

            if (!existingCredit) {
                // Get user info
                const user = await Models.User.findOne({ email: userEmail, tenant_id: tenantId });
                
                if (user) {
                    // Find comp off leave type
                    const compOffType = await Models.LeaveType.findOne({
                        tenant_id: tenantId,
                        is_comp_off: true,
                        is_active: true
                    });

                    if (compOffType) {
                        const compOffCredit = new Models.CompOffCredit({
                            tenant_id: tenantId,
                            user_id: user._id || user.id,
                            user_email: userEmail,
                            user_name: user.full_name || user.name || userEmail,
                            credited_days: compOffDays,
                            used_days: 0,
                            remaining_days: compOffDays,
                            reason: `Auto-credited for overtime work (Week of ${format(weekStart, 'MMM d, yyyy')})`,
                            credited_by: 'system',
                            expires_at: format(endOfWeek(weekEnd, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
                            is_expired: false
                        });

                        await compOffCredit.save();
                        console.log(`[Leave Management] Auto-credited ${compOffDays} comp off days to ${userEmail} for overtime`);
                        return { credited: true, days: compOffDays };
                    }
                }
            }
        }

        return { credited: false, days: 0 };
    } catch (error) {
        console.error('[Leave Management] Error processing overtime:', error);
        return { credited: false, error: error.message };
    }
}

/**
 * Calculate capacity reduction for a user based on approved leaves
 */
router.get('/capacity/:userEmail', async (req, res) => {
    try {
        const { userEmail } = req.params;
        const { week_start } = req.query; // Format: yyyy-MM-dd
        const { tenant_id } = req.query;

        if (!userEmail || !week_start || !tenant_id) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        const weekStart = parseISO(week_start);
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

        // Get approved leaves for this week
        const leaves = await Models.Leave.find({
            tenant_id,
            user_email: userEmail,
            status: 'approved',
            $or: [
                {
                    start_date: { $lte: format(weekEnd, 'yyyy-MM-dd') },
                    end_date: { $gte: format(weekStart, 'yyyy-MM-dd') }
                }
            ]
        });

        let totalDays = 0;
        leaves.forEach(leave => {
            const leaveStart = parseISO(leave.start_date);
            const leaveEnd = parseISO(leave.end_date);
            
            // Calculate intersection with week
            const start = leaveStart > weekStart ? leaveStart : weekStart;
            const end = leaveEnd < weekEnd ? leaveEnd : weekEnd;
            
            if (start <= end) {
                const days = differenceInDays(end, start) + 1;
                if (leave.duration === 'half_day') {
                    totalDays += days * 0.5;
                } else {
                    totalDays += days;
                }
            }
        });

        const hoursReduction = totalDays * 8;
        const originalCapacity = 5 * 8; // 5 days * 8 hours
        const adjustedCapacity = Math.max(0, originalCapacity - hoursReduction);

        res.json({
            user_email: userEmail,
            week_start: format(weekStart, 'yyyy-MM-dd'),
            week_end: format(weekEnd, 'yyyy-MM-dd'),
            leave_days: totalDays,
            hours_reduction: hoursReduction,
            original_capacity: originalCapacity,
            adjusted_capacity: adjustedCapacity,
            capacity_percentage: (adjustedCapacity / originalCapacity) * 100
        });
    } catch (error) {
        console.error('[Leave Management] Error calculating capacity:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Process overtime and auto-add comp off (called when timesheet is created/updated)
 */
router.post('/process-overtime', async (req, res) => {
    try {
        const { tenant_id, user_email, date } = req.body;

        if (!tenant_id || !user_email || !date) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const result = await processOvertimeForCompOff(tenant_id, user_email, date);
        res.json(result);
    } catch (error) {
        console.error('[Leave Management] Error processing overtime:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
