const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

const Models = require('../models/SchemaDefinitions');

async function syncSprintVelocity() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB.');

        const Sprint = mongoose.model('Sprint');
        const Task = mongoose.model('Task');
        const Story = mongoose.model('Story');
        const Project = mongoose.model('Project');
        const ProjectUserRole = mongoose.model('ProjectUserRole');
        const User = mongoose.model('User');
        const SprintVelocity = mongoose.model('SprintVelocity');

        // Fetch all sprints that are locked or completed
        const sprints = await Sprint.find({
            $or: [
                { status: 'completed' },
                { status: 'active', locked_date: { $exists: true, $ne: null } },
                { locked_date: { $exists: true, $ne: null } }
            ]
        });

        console.log(`\n🔍 Found ${sprints.length} sprints (locked or completed) to sync.\n`);

        let createdCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const sprint of sprints) {
            const sprintId = String(sprint._id);

            try {
                console.log(`\n📊 Processing: "${sprint.name}" (${sprint.status})`);

                // Check if velocity record already exists (avoid duplicates)
                const existingRecord = await SprintVelocity.findOne({
                    sprint_id: sprintId,
                    is_final_measurement: sprint.status === 'completed'
                });

                if (existingRecord) {
                    console.log(`   ⏭️  Velocity record already exists, skipping...`);
                    skippedCount++;
                    continue;
                }

                // Get the project
                const project = await Project.findById(sprint.project_id);
                if (!project) {
                    console.log(`   ⚠️  Project not found, skipping...`);
                    errorCount++;
                    continue;
                }

                console.log(`   ✅ Project found: "${project.name}"`);

                // Determine user_id (Project Manager or Owner)
                let userId = null;
                let userName = 'System';

                // Try to find Project Manager
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

                // Fallback to project owner
                if (!userId && project.owner) {
                    const ownerUser = await User.findOne({ email: project.owner });
                    if (ownerUser) {
                        userId = ownerUser.email;
                        userName = ownerUser.name || ownerUser.email;
                    }
                }

                // Last fallback to system
                if (!userId) {
                    userId = 'system';
                    console.log(`   ⚠️  No PM or owner found, using system user`);
                }

                // Fetch stories and tasks for this sprint
                const sprintStories = await Story.find({ sprint_id: sprintId });

                const allTasks = await Task.find({
                    $or: [
                        { sprint_id: sprintId },
                        { story_id: { $in: sprintStories.map(s => s._id) } }
                    ]
                });

                // Calculate committed points
                const totalStoryPoints = sprintStories.reduce((sum, s) => sum + (Number(s.story_points) || 0), 0);
                const committedPoints = (sprint.committed_points !== undefined && sprint.committed_points !== null)
                    ? Number(sprint.committed_points)
                    : totalStoryPoints;

                // Calculate completed points (using partial completion logic from VelocityTracker)
                const completedPoints = sprintStories.reduce((sum, story) => {
                    const storyId = String(story._id);
                    const storyStatus = (story.status || '').toLowerCase();
                    const storyPoints = Number(story.story_points) || 0;

                    // If story status is "done" or "completed", contribute 100%
                    if (storyStatus === 'done' || storyStatus === 'completed') {
                        return sum + storyPoints;
                    }

                    // Get tasks for this story
                    const storyTasks = allTasks.filter(t => String(t.story_id) === storyId);

                    // If no tasks, story contributes 0 (unless status is done)
                    if (storyTasks.length === 0) {
                        return sum;
                    }

                    // Calculate partial completion based on task completion
                    const completedTasksCount = storyTasks.filter(t => t.status === 'completed').length;
                    const totalTasksCount = storyTasks.length;
                    const completionRatio = totalTasksCount > 0 ? (completedTasksCount / totalTasksCount) : 0;

                    return sum + (storyPoints * completionRatio);
                }, 0);

                // Calculate velocity and accuracy
                const actualVelocity = completedPoints;
                const plannedVelocity = committedPoints;
                const velocityPercentage = committedPoints > 0 ? (completedPoints / committedPoints) * 100 : 0;
                const commitmentAccuracy = velocityPercentage;

                // Task metrics
                const totalTasks = allTasks.length;
                const completedTasks = allTasks.filter(t => t.status === 'completed').length;
                const inProgressTasks = allTasks.filter(t =>
                    t.status === 'in_progress' || t.status === 'in progress'
                ).length;
                const notStartedTasks = allTasks.filter(t =>
                    t.status === 'todo' || t.status === 'to do'
                ).length;

                // Count completed stories
                const completedStories = sprintStories.filter(story => {
                    const storyStatus = (story.status || '').toLowerCase();
                    if (storyStatus === 'done' || storyStatus === 'completed') {
                        return true;
                    }
                    const storyTasks = allTasks.filter(t => String(t.story_id) === String(story._id));
                    return storyTasks.length > 0 && storyTasks.every(t => t.status === 'completed');
                }).length;

                // Calculate average task completion time (for completed tasks only)
                const tasksWithCompletionTime = allTasks.filter(t =>
                    t.status === 'completed' && t.completed_date && t.created_date
                );
                let avgCompletionTime = null;
                if (tasksWithCompletionTime.length > 0) {
                    const totalCompletionTime = tasksWithCompletionTime.reduce((sum, t) => {
                        const created = new Date(t.created_date);
                        const completed = new Date(t.completed_date);
                        const hoursToComplete = (completed - created) / (1000 * 60 * 60);
                        return sum + hoursToComplete;
                    }, 0);
                    avgCompletionTime = totalCompletionTime / tasksWithCompletionTime.length;
                }

                // Count impediments if available
                const impedimentsCount = sprint.impediments ? sprint.impediments.length : 0;

                // Create velocity record
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
                    planned_velocity: plannedVelocity,
                    actual_velocity: actualVelocity,
                    velocity_percentage: velocityPercentage,
                    commitment_accuracy: commitmentAccuracy,
                    total_tasks: totalTasks,
                    completed_tasks: completedTasks,
                    in_progress_tasks: inProgressTasks,
                    not_started_tasks: notStartedTasks,
                    sprint_status: sprint.status,
                    measurement_date: new Date(),
                    is_final_measurement: sprint.status === 'completed',
                    impediments_count: impedimentsCount,
                    notes: `Synced from existing sprint data. User: ${userName}`,
                    metadata: {
                        total_stories: sprintStories.length,
                        completed_stories: completedStories,
                        sync_source: 'sync_sprint_velocity.js',
                        sync_date: new Date().toISOString()
                    }
                };

                // Add average completion time if available
                if (avgCompletionTime !== null) {
                    velocityData.average_task_completion_time = avgCompletionTime;
                }

                await SprintVelocity.create(velocityData);

                console.log(`   ✅ Created velocity record`);
                console.log(`      - Committed: ${committedPoints} pts`);
                console.log(`      - Completed: ${completedPoints.toFixed(2)} pts`);
                console.log(`      - Accuracy: ${commitmentAccuracy.toFixed(1)}%`);
                console.log(`      - Tasks: ${completedTasks}/${totalTasks}`);
                console.log(`      - User: ${userName} (${userId})`);

                createdCount++;

            } catch (err) {
                console.error(`   ❌ Error processing sprint "${sprint.name}":`, err.message);
                errorCount++;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('📈 SYNC COMPLETE');
        console.log('='.repeat(60));
        console.log(`✅ Created: ${createdCount} velocity records`);
        console.log(`⏭️  Skipped: ${skippedCount} (already exist)`);
        console.log(`❌ Errors: ${errorCount}`);
        console.log(`📊 Total Sprints Processed: ${sprints.length}`);
        console.log('='.repeat(60) + '\n');

        process.exit(0);

    } catch (err) {
        console.error('❌ Fatal Error:', err);
        process.exit(1);
    }
}

// Run the sync
syncSprintVelocity();
