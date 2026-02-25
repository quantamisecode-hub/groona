const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Helper to get models
const getModel = (name) => mongoose.model(name);

// GET /api/sprint-velocity/project/:projectId
// Get all velocity records for a specific project
router.get('/project/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const SprintVelocity = getModel('SprintVelocity');

        const velocityRecords = await SprintVelocity.find({ project_id: projectId })
            .sort({ sprint_start_date: -1 });

        res.status(200).json({
            success: true,
            count: velocityRecords.length,
            data: velocityRecords
        });

    } catch (error) {
        console.error('[Sprint Velocity API] Error fetching project velocity:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch velocity records'
        });
    }
});

// GET /api/sprint-velocity/sprint/:sprintId
// Get velocity record for a specific sprint
router.get('/sprint/:sprintId', async (req, res) => {
    try {
        const { sprintId } = req.params;
        const SprintVelocity = getModel('SprintVelocity');

        const velocityRecord = await SprintVelocity.findOne({ sprint_id: sprintId })
            .sort({ measurement_date: -1 }); // Get latest measurement

        if (!velocityRecord) {
            return res.status(404).json({
                success: false,
                error: 'Velocity record not found for this sprint'
            });
        }

        res.status(200).json({
            success: true,
            data: velocityRecord
        });

    } catch (error) {
        console.error('[Sprint Velocity API] Error fetching sprint velocity:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch velocity record'
        });
    }
});

// GET /api/sprint-velocity/project/:projectId/stats
// Get velocity statistics for a project
router.get('/project/:projectId/stats', async (req, res) => {
    try {
        const { projectId } = req.params;
        const SprintVelocity = getModel('SprintVelocity');

        const stats = await SprintVelocity.aggregate([
            { $match: { project_id: projectId } },
            {
                $group: {
                    _id: null,
                    total_sprints: { $sum: 1 },
                    avg_velocity: { $avg: '$actual_velocity' },
                    avg_committed: { $avg: '$committed_points' },
                    avg_completed: { $avg: '$completed_points' },
                    avg_accuracy: { $avg: '$commitment_accuracy' },
                    total_points_delivered: { $sum: '$completed_points' },
                    completed_sprints: {
                        $sum: { $cond: [{ $eq: ['$is_final_measurement', true] }, 1, 0] }
                    }
                }
            }
        ]);

        const result = stats.length > 0 ? stats[0] : {
            total_sprints: 0,
            avg_velocity: 0,
            avg_committed: 0,
            avg_completed: 0,
            avg_accuracy: 0,
            total_points_delivered: 0,
            completed_sprints: 0
        };

        res.status(200).json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('[Sprint Velocity API] Error fetching project stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch velocity statistics'
        });
    }
});

// POST /api/sprint-velocity/sync/sprint/:sprintId
// Manually sync a specific sprint's velocity
router.post('/sync/sprint/:sprintId', async (req, res) => {
    try {
        const { sprintId } = req.params;

        const Sprint = getModel('Sprint');
        const Task = getModel('Task');
        const Story = getModel('Story');
        const Project = getModel('Project');
        const ProjectUserRole = getModel('ProjectUserRole');
        const User = getModel('User');
        const SprintVelocity = getModel('SprintVelocity');

        // Fetch the sprint
        const sprint = await Sprint.findById(sprintId);
        if (!sprint) {
            return res.status(404).json({
                success: false,
                error: 'Sprint not found'
            });
        }

        // Check if sprint is locked or completed
        if (sprint.status !== 'completed' && !sprint.locked_date) {
            return res.status(400).json({
                success: false,
                error: 'Sprint must be locked or completed to sync velocity'
            });
        }

        // Get project
        const project = await Project.findById(sprint.project_id);
        if (!project) {
            return res.status(404).json({
                success: false,
                error: 'Project not found'
            });
        }

        // Determine user_id
        let userId = null;
        let userName = 'System';

        const pmRoles = await ProjectUserRole.find({
            project_id: sprint.project_id,
            role: 'project_manager'
        });

        if (pmRoles.length > 0) {
            const pmUser = await User.findById(pmRoles[0].user_id);
            if (pmUser) {
                userId = pmUser.email;
                userName = pmUser.name || pmUser.email;
            }
        }

        if (!userId && project.owner) {
            const ownerUser = await User.findOne({ email: project.owner });
            if (ownerUser) {
                userId = ownerUser.email;
                userName = ownerUser.name || ownerUser.email;
            }
        }

        if (!userId) {
            userId = 'system';
        }

        // Fetch stories and tasks
        const sprintStories = await Story.find({ sprint_id: sprintId });
        const allTasks = await Task.find({
            $or: [
                { sprint_id: sprintId },
                { story_id: { $in: sprintStories.map(s => s._id) } }
            ]
        });

        // Calculate metrics (same logic as sync script)
        const totalStoryPoints = sprintStories.reduce((sum, s) => sum + (Number(s.story_points) || 0), 0);
        const committedPoints = (sprint.committed_points !== undefined && sprint.committed_points !== null)
            ? Number(sprint.committed_points)
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

        // Create or update velocity record
        const velocityData = {
            tenant_id: sprint.tenant_id,
            project_id: sprint.project_id,
            sprint_id: sprintId,
            user_id: userId,
            sprint_name: sprint.name,
            sprint_start_date: sprint.start_date,
            sprint_end_date: sprint.end_date,
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
            sprint_status: sprint.status,
            measurement_date: new Date(),
            is_final_measurement: sprint.status === 'completed',
            impediments_count: sprint.impediments ? sprint.impediments.length : 0,
            notes: `Manual sync via API. User: ${userName}`,
            metadata: {
                total_stories: sprintStories.length,
                completed_stories: completedStories,
                sync_source: 'API',
                sync_date: new Date().toISOString()
            }
        };

        // Update existing or create new
        const existingRecord = await SprintVelocity.findOne({
            sprint_id: sprintId,
            is_final_measurement: sprint.status === 'completed'
        });

        let velocityRecord;
        if (existingRecord) {
            velocityRecord = await SprintVelocity.findByIdAndUpdate(
                existingRecord._id,
                velocityData,
                { new: true }
            );
        } else {
            velocityRecord = await SprintVelocity.create(velocityData);
        }

        res.status(200).json({
            success: true,
            message: existingRecord ? 'Velocity record updated' : 'Velocity record created',
            data: velocityRecord
        });

    } catch (error) {
        console.error('[Sprint Velocity API] Error syncing sprint:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to sync sprint velocity'
        });
    }
});

// POST /api/sprint-velocity/sync/project/:projectId
// Sync all sprints in a project
router.post('/sync/project/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;

        const Sprint = getModel('Sprint');

        // Find all locked/completed sprints in project
        const sprints = await Sprint.find({
            project_id: projectId,
            $or: [
                { status: 'completed' },
                { locked_date: { $exists: true, $ne: null } }
            ]
        });

        let synced = 0;
        let errors = 0;

        // Sync each sprint
        for (const sprint of sprints) {
            try {
                // Call the single sprint sync internally
                const syncResult = await router.handle({
                    params: { sprintId: String(sprint._id) },
                    method: 'POST'
                }, res);
                synced++;
            } catch (err) {
                console.error(`Error syncing sprint ${sprint._id}:`, err);
                errors++;
            }
        }

        res.status(200).json({
            success: true,
            message: `Synced ${synced} sprints for project`,
            synced,
            errors,
            total: sprints.length
        });

    } catch (error) {
        console.error('[Sprint Velocity API] Error syncing project:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to sync project velocity'
        });
    }
});

module.exports = router;
