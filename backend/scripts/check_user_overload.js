const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

async function checkUserOverload() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB.\n');

        // Load Models safely
        let User, Story, Project, Notification, ProjectUserRole;
        try {
            User = mongoose.model('User');
            Story = mongoose.model('Story');
            Project = mongoose.model('Project');
            Notification = mongoose.model('Notification');
            ProjectUserRole = mongoose.model('ProjectUserRole');
        } catch (e) {
            require('../models/SchemaDefinitions');
            User = mongoose.model('User');
            Story = mongoose.model('Story');
            Project = mongoose.model('Project');
            Notification = mongoose.model('Notification');
            ProjectUserRole = mongoose.model('ProjectUserRole');
        }

        // Check for --force flag
        const forceRun = process.argv.includes('--force');
        if (forceRun) {
            console.log('⚠️  FORCE MODE ENABLED: Skipping duplicate checks.\n');
        }

        console.log('🔍 Starting User Overload Check (Threshold: > 120%)...\n');

        // 1. Fetch ALL Stories
        // The frontend calculates workload based on ALL assigned stories, regardless of sprint status or story status.
        // To match the 190% figure observed by the user, we must include all stories.
        const stories = await Story.find({});

        console.log(`Found ${stories.length} total stories.`);

        // 2. User Load Calculation
        // Map: UserEmail -> { loadHours: 0, stories: [], projectIds: Set }
        const userWorkload = {};

        for (const story of stories) {
            if (!story.assigned_to || story.assigned_to.length === 0) continue;

            const points = Number(story.story_points) || 0;
            const totalHours = points * 2;

            for (const email of story.assigned_to) {
                if (!email) continue;
                const userEmail = email.toLowerCase();

                if (!userWorkload[userEmail]) {
                    userWorkload[userEmail] = {
                        loadHours: 0,
                        stories: [],
                        projectIds: new Set(),
                        tenant_id: story.tenant_id
                    };
                }

                userWorkload[userEmail].loadHours += totalHours;

                // Only track active/interesting stories for logs, but count ALL for load
                if (story.status !== 'done' && story.status !== 'cancelled') {
                    userWorkload[userEmail].stories.push(story.title);
                }

                if (story.project_id) userWorkload[userEmail].projectIds.add(story.project_id.toString());
            }
        }

        // 3. Evaluate and Notify
        const FIXED_CAPACITY_HOURS = 40;
        const THRESHOLD_PERCENT = 120;

        let alertsGenerated = 0;

        for (const [email, data] of Object.entries(userWorkload)) {
            const utilization = (data.loadHours / FIXED_CAPACITY_HOURS) * 100;

            if (utilization > THRESHOLD_PERCENT) {
                const user = await User.findOne({ email: email });
                if (!user) continue;

                console.log(`⚠️  User ${user.full_name} (${email}) is OVERLOADED: ${utilization.toFixed(1)}% (${data.loadHours}h / 40h)`);

                // Check for duplicate alert TODAY by message regex to capture percentage changes if significant? 
                // Or just avoid spamming same user same day?
                // Let's stick to avoiding same user same day.
                if (!forceRun) {
                    const startOfDay = new Date();
                    startOfDay.setHours(0, 0, 0, 0);

                    const existingAlert = await Notification.findOne({
                        type: 'PM_OVERALLOCATION_RISK',
                        // Check if we already alerted about THIS user today
                        // The message contains the user name.
                        message: { $regex: new RegExp(`${user.full_name}.*allocated`, 'i') },
                        created_date: { $gt: startOfDay }
                    });

                    if (existingAlert) {
                        // Check if utilization changed significantly? 
                        // For now, simple suppression to avoid spam.
                        console.log(`   ⏭️  Alert already sent today for ${user.email}. Skipping.`);
                        continue;
                    }
                }

                // Find Recipients: Admin or PM
                const projectIds = Array.from(data.projectIds);
                const projects = await Project.find({ _id: { $in: projectIds } });

                let recipients = [];
                const recipientEmails = new Set();

                // Strategy: Find PMs for these projects
                for (const proj of projects) {
                    if (proj.team_members) {
                        proj.team_members.forEach(member => {
                            if (member.role === 'project_manager' || member.role === 'owner') {
                                if (!recipientEmails.has(member.email)) {
                                    recipientEmails.add(member.email);
                                    console.log(`      Found PM: ${member.email} for Project: ${proj.name}`);
                                }
                            }
                        });
                    }
                }

                // Fallback to ProjectUserRole
                if (recipientEmails.size === 0) {
                    const pmRoles = await ProjectUserRole.find({
                        project_id: { $in: projectIds },
                        role: { $in: ['project_manager', 'owner'] }
                    }).populate('user_id').populate('project_id'); // Populate project too to log name

                    pmRoles.forEach(role => {
                        if (role.user_id && role.user_id.email) {
                            if (!recipientEmails.has(role.user_id.email)) {
                                recipientEmails.add(role.user_id.email);
                                const projName = role.project_id ? role.project_id.name : role.project_id;
                                console.log(`      Found PM (via Role): ${role.user_id.email} for Project: ${projName}`);
                            }
                        }
                    });
                }

                // Fallback to Admins
                if (recipientEmails.size === 0) {
                    console.log(`   ℹ️  No PM found. Fallback to Admins.`);
                    const admins = await User.find({ role: 'admin', status: 'active', tenant_id: user.tenant_id });
                    admins.forEach(admin => recipientEmails.add(admin.email));
                }

                // Create Notifications
                for (const recipientEmail of recipientEmails) {
                    const recipient = await User.findOne({ email: recipientEmail });
                    if (!recipient) continue;

                    await Notification.create({
                        tenant_id: user.tenant_id,
                        recipient_email: recipientEmail,
                        user_id: recipient._id,
                        type: 'PM_OVERALLOCATION_RISK',
                        category: 'alert',
                        title: '⚠️ Critical Workload Alert',
                        message: `⚠️ Resource overallocation detected. Burnout risk possible for ${user.full_name} (${utilization.toFixed(0)}% allocated).`,
                        entity_type: 'user',
                        entity_id: user._id,
                        sender_name: 'System',
                        read: false,
                        created_date: new Date(),
                        link: '/ResourcePlanning'
                    });

                    console.log(`   ✅ Notification sent to ${recipient.full_name} (${recipient.role})`);
                    alertsGenerated++;
                }
            }
        }

        console.log(`\nJob Complete. Generated ${alertsGenerated} notifications.`);
        process.exit(0);

    } catch (err) {
        console.error('❌ Check Failed:', err);
        process.exit(1);
    }
}

checkUserOverload();
