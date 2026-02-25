const express = require('express');
const router = express.Router();
const Models = require('../models/SchemaDefinitions');

// Endpoint: POST /api/subtasks/update
router.post('/update', async (req, res) => {
    try {
        const { taskId, subtaskIndex, updates } = req.body;

        if (!taskId || subtaskIndex === undefined || !updates) {
            return res.status(400).json({ error: "Missing required fields: taskId, subtaskIndex, or updates" });
        }

        // Find the parent task
        const task = await Models.Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ error: "Task not found" });
        }

        // Validate subtask existence
        if (!task.subtasks || !task.subtasks[subtaskIndex]) {
            return res.status(404).json({ error: "Subtask index out of bounds" });
        }

        // Apply updates directly to the specific subtask object
        const subtask = task.subtasks[subtaskIndex];

        if (updates.hasOwnProperty('assigned_to')) {
            subtask.assigned_to = updates.assigned_to;

            // Notification Logic: If assigning a user (not unassigning)
            if (updates.assigned_to) {
                const { assignedBy, assignedByName, tenantId } = req.body;

                // Don't notify if assigning self, and ensure tenants/users valid
                if (updates.assigned_to !== assignedBy && tenantId) {
                    try {
                        const project = await Models.Project.findById(task.project_id);
                        const projectName = project ? project.name : 'Unknown Project';

                        await Models.Notification.create({
                            tenant_id: tenantId,
                            recipient_email: updates.assigned_to,
                            type: 'task_assigned',
                            title: 'New Subtask Assigned',
                            message: `${assignedByName || 'A team member'} assigned you a subtask: "${subtask.title}" in project "${projectName}"`,
                            entity_type: 'task',
                            entity_id: taskId,
                            sender_name: assignedByName || 'System',
                            read: false
                        });
                    } catch (notifErr) {
                        console.error("[Subtask Notification Error]:", notifErr);
                        // Continue - do not fail the request just because notification failed
                    }
                }
            }
        }
        if (updates.hasOwnProperty('due_date')) {
            subtask.due_date = updates.due_date;
        }
        if (updates.hasOwnProperty('completed')) {
            subtask.completed = updates.completed;

            // Optional: Notify reporter/assignee on completion? (Not requested yet, skipping)
        }
        if (updates.hasOwnProperty('title')) {
            subtask.title = updates.title;
        }

        // IMPORTANT: Mark the array as modified so Mongoose knows to save it
        task.markModified('subtasks');

        const updatedTask = await task.save();

        // Return the full updated task so frontend can refresh
        res.json({
            success: true,
            task: updatedTask,
            message: "Subtask updated successfully"
        });

    } catch (error) {
        console.error("[Subtask Update Error]:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

module.exports = router;