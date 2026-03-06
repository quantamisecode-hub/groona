const Models = require('../models/SchemaDefinitions');

/**
 * Enterprise Project Health Scoring Engine
 * 
 * Weights:
 * - Completion (45%)
 * - Schedule Performance (25%)
 * - Budget Performance (15%)
 * - Task Risk Factors (15%)
 */

const SCORING_WEIGHTS = {
    COMPLETION: 0.45,
    SCHEDULE: 0.25,
    BUDGET: 0.15,
    RISK: 0.15
};

const RISK_LEVEL_THRESHOLDS = {
    LOW: { min: 85, label: 'low' },
    MEDIUM: { min: 70, label: 'medium' },
    HIGH: { min: 50, label: 'high' },
    CRITICAL: { min: 0, label: 'critical' }
};

const TASK_PRIORITY_WEIGHTS = {
    urgent: 3.0,
    high: 2.0,
    medium: 1.0,
    low: 0.5
};

/**
 * 1. Completion Score (45% Weight)
 * Based on total tasks vs completed tasks.
 */
function calculateCompletionScore(project, tasks) {
    if (!tasks || tasks.length === 0) {
        return project.progress || 0;
    }
    const completedCount = tasks.filter(t => t.status === 'completed').length;
    return (completedCount / tasks.length) * 100;
}

/**
 * 2. Schedule Performance Score (25% Weight)
 * SPI = Actual Progress / Expected Progress
 */
function calculateScheduleScore(project, actualProgress) {
    if (!project.start_date || !project.deadline) return 100;

    const start = new Date(project.start_date);
    const end = new Date(project.deadline);
    const now = new Date();

    if (now <= start) return 100; // Haven't started yet
    if (actualProgress >= 100) return 100;

    const totalDuration = end - start;
    const elapsedDuration = now - start;

    if (totalDuration <= 0) return 100;

    // Expected completion percentage if progress was linear
    const expectedProgress = (elapsedDuration / totalDuration) * 100;

    if (actualProgress >= expectedProgress) return 100;

    // Schedule Performance Index (SPI) logic
    // If we are behind, the score is the ratio of where we are vs where we should be
    const spi = actualProgress / expectedProgress;
    return Math.max(0, Math.min(100, spi * 100));
}

/**
 * 3. Budget Performance Score (15% Weight)
 * Based on actual cost vs total budget.
 */
function calculateBudgetScore(project, actualCost) {
    const budget = project.budget || project.budget_amount || 0;
    if (budget <= 0) return 100;

    if (actualCost <= budget) return 100;

    // Exponential decay for budget overrun
    // 10% over -> ~90 score, 50% over -> ~50 score, 100% over -> 0 score
    const overrunRatio = (actualCost - budget) / budget;
    const score = 100 - (overrunRatio * 100);

    return Math.max(0, score);
}

/**
 * 4. Task Risk Intelligence (15% Weight)
 * Penalizes heavily for blocked, overdue, and urgent tasks.
 */
function calculateRiskScore(tasks) {
    if (!tasks || tasks.length === 0) return 100;

    let totalRiskPoints = 0;
    const now = new Date();

    tasks.forEach(task => {
        if (task.status === 'completed') return;

        let taskRisk = 0;
        const priorityWeight = TASK_PRIORITY_WEIGHTS[task.priority] || 1.0;

        // Base penalty for being incomplete
        taskRisk += 1 * priorityWeight;

        // Blocked tasks are high risk
        if (task.status === 'blocked' || (task.blocked_by && task.blocked_by.length > 0)) {
            taskRisk += 5 * priorityWeight;
        }

        // Overdue tasks are high risk
        if (task.due_date && new Date(task.due_date) < now) {
            const daysOverdue = Math.ceil((now - new Date(task.due_date)) / (1000 * 60 * 60 * 24));
            taskRisk += Math.min(10, daysOverdue * 0.5) * priorityWeight;
        }

        totalRiskPoints += taskRisk;
    });

    // Normalize risk points against number of tasks
    // Theoretical "max risk" per task is (~16 points)
    const averageRisk = totalRiskPoints / tasks.length;
    const score = 100 - (averageRisk * 10); // Scalar to convert to 0-100 scale

    return Math.max(0, Math.min(100, score));
}

/**
 * Main Health Scoring Engine
 * Recalculates and saves project health metrics.
 */
async function updateProjectHealth(projectId) {
    if (!projectId) return null;

    try {
        const Project = Models.Project;
        const Task = Models.Task;
        const ProjectExpense = Models.ProjectExpense;

        const project = await Project.findById(projectId);
        if (!project) return null;

        // Fetch related data
        const [tasks, expenses] = await Promise.all([
            Task.find({ project_id: projectId }),
            ProjectExpense.find({ project_id: projectId, status: 'approved' })
        ]);

        // 1. Calculate base metrics
        const actualCost = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

        // 2. Individual Category Scores
        const completionScore = calculateCompletionScore(project, tasks);
        const scheduleScore = calculateScheduleScore(project, completionScore);
        const budgetScore = calculateBudgetScore(project, actualCost);
        const riskScore = calculateRiskScore(tasks);

        // 3. Weighted Final Calculation
        let healthScore = (
            (completionScore * SCORING_WEIGHTS.COMPLETION) +
            (scheduleScore * SCORING_WEIGHTS.SCHEDULE) +
            (budgetScore * SCORING_WEIGHTS.BUDGET) +
            (riskScore * SCORING_WEIGHTS.RISK)
        );

        // Special override: If project is completed, health is 100
        if (project.status === 'completed') healthScore = 100;

        // 4. Clamp and Round
        healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

        // 5. Risk Level Classification
        let riskLevel = 'low';
        if (healthScore < RISK_LEVEL_THRESHOLDS.HIGH.min) {
            riskLevel = RISK_LEVEL_THRESHOLDS.CRITICAL.label;
        } else if (healthScore < RISK_LEVEL_THRESHOLDS.MEDIUM.min) {
            riskLevel = RISK_LEVEL_THRESHOLDS.HIGH.label;
        } else if (healthScore < RISK_LEVEL_THRESHOLDS.LOW.min) {
            riskLevel = RISK_LEVEL_THRESHOLDS.MEDIUM.label;
        }

        // 6. Persistence
        if (tasks.length === 0) {
            project.health_score = null;
            project.risk_level = null;
        } else {
            project.health_score = healthScore;
            project.risk_level = riskLevel;
        }
        project.actual_cost = actualCost;
        project.progress = Math.round(completionScore);

        await project.save();

        console.log(`[HealthSync] Project: ${project.name} | Score: ${project.health_score} | Level: ${project.risk_level}`);

        return {
            health_score: healthScore,
            risk_level: riskLevel,
            actual_cost: actualCost,
            scores: {
                completion: Math.round(completionScore),
                schedule: Math.round(scheduleScore),
                budget: Math.round(budgetScore),
                risk: Math.round(riskScore)
            }
        };
    } catch (err) {
        console.error('Core Project Health Engine Error:', err);
        return null;
    }
}

module.exports = {
    updateProjectHealth,
    calculateCompletionScore,
    calculateScheduleScore,
    calculateBudgetScore,
    calculateRiskScore
};
