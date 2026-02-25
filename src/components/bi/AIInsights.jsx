import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Sparkles, 
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Target,
  Users,
  Clock,
  Loader2,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";

export default function AIInsights({ projects, tasks, users, activities, timesheets, sprints }) {
  const [insights, setInsights] = useState(null);
  const [generating, setGenerating] = useState(false);

  const generateInsights = async () => {
    setGenerating(true);
    try {
      // Prepare comprehensive data summary
      const activeProjects = projects.filter(p => p.status === 'active');
      const completedProjects = projects.filter(p => p.status === 'completed');
      const overdueTasks = tasks.filter(t => 
        t.due_date && 
        new Date(t.due_date) < new Date() && 
        t.status !== 'completed'
      );
      const highPriorityTasks = tasks.filter(t => 
        (t.priority === 'high' || t.priority === 'urgent') && 
        t.status !== 'completed'
      );

      // Calculate average task completion time
      const completedTasks = tasks.filter(t => t.status === 'completed');
      
      // Calculate workload distribution
      const userWorkloads = users.map(user => {
        const userTasks = tasks.filter(t => t.assigned_to === user.email && t.status !== 'completed');
        const estimatedHours = userTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
        return { name: user.full_name, hours: estimatedHours, tasks: userTasks.length };
      }).filter(u => u.hours > 0);

      // Calculate sprint velocity
      const completedSprints = sprints.filter(s => s.status === 'completed');
      const avgSprintVelocity = completedSprints.length > 0
        ? Math.round(completedSprints.reduce((sum, s) => {
            const sprintTasks = tasks.filter(t => t.sprint_id === s.id && t.status === 'completed');
            return sum + sprintTasks.reduce((taskSum, t) => taskSum + (t.story_points || 0), 0);
          }, 0) / completedSprints.length)
        : 0;

      const prompt = `As an AI business intelligence analyst, analyze the following project management data and provide actionable insights:

**Organization Overview:**
- Total Projects: ${projects.length} (${activeProjects.length} active, ${completedProjects.length} completed)
- Total Tasks: ${tasks.length} (${completedTasks.length} completed, ${overdueTasks.length} overdue)
- Team Size: ${users.length} members
- Total Logged Hours: ${Math.round(timesheets.reduce((sum, ts) => sum + (ts.total_minutes || 0), 0) / 60)}
- Active Sprints: ${sprints.filter(s => s.status === 'active').length}

**Current Challenges:**
- High Priority Tasks Pending: ${highPriorityTasks.length}
- Overdue Tasks: ${overdueTasks.length}
- Projects On Hold: ${projects.filter(p => p.status === 'on_hold').length}

**Team Workload:**
${userWorkloads.slice(0, 5).map(u => `- ${u.name}: ${u.hours} hours across ${u.tasks} tasks`).join('\n')}

**Sprint Performance:**
- Average Velocity: ${avgSprintVelocity} story points per sprint
- Completed Sprints: ${completedSprints.length}

Please provide:
1. **Key Findings**: 3-5 critical insights about the current state
2. **Risk Assessment**: Identify top 3 risks that need immediate attention
3. **Opportunities**: 3 areas where the team is excelling or could improve efficiency
4. **Actionable Recommendations**: 5 specific actions the admin should take in the next 2 weeks
5. **Resource Optimization**: Suggestions for better resource allocation
6. **Predictive Insights**: Forecast potential issues in the next 30 days

Format the response in clear sections with bullet points.`;

      console.log('[AI Insights] Generating insights with prompt...');
      
      const response = await groonabackend.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: false,
      });

      console.log('[AI Insights] Generated insights:', response);

      // Parse the response into structured sections
      const sections = response.split('\n\n');
      const parsedInsights = {
        keyFindings: [],
        risks: [],
        opportunities: [],
        recommendations: [],
        resourceOptimization: [],
        predictions: [],
        rawText: response
      };

      sections.forEach(section => {
        if (section.includes('Key Findings') || section.includes('key findings')) {
          parsedInsights.keyFindings = section.split('\n').filter(line => line.trim().startsWith('-') || line.trim().match(/^\d+\./)).map(line => line.trim().replace(/^[-\d.]\s*/, ''));
        } else if (section.includes('Risk') || section.includes('risk')) {
          parsedInsights.risks = section.split('\n').filter(line => line.trim().startsWith('-') || line.trim().match(/^\d+\./)).map(line => line.trim().replace(/^[-\d.]\s*/, ''));
        } else if (section.includes('Opportunities') || section.includes('opportunities')) {
          parsedInsights.opportunities = section.split('\n').filter(line => line.trim().startsWith('-') || line.trim().match(/^\d+\./)).map(line => line.trim().replace(/^[-\d.]\s*/, ''));
        } else if (section.includes('Recommendations') || section.includes('recommendations')) {
          parsedInsights.recommendations = section.split('\n').filter(line => line.trim().startsWith('-') || line.trim().match(/^\d+\./)).map(line => line.trim().replace(/^[-\d.]\s*/, ''));
        } else if (section.includes('Resource') || section.includes('resource')) {
          parsedInsights.resourceOptimization = section.split('\n').filter(line => line.trim().startsWith('-') || line.trim().match(/^\d+\./)).map(line => line.trim().replace(/^[-\d.]\s*/, ''));
        } else if (section.includes('Predictive') || section.includes('Forecast') || section.includes('predict')) {
          parsedInsights.predictions = section.split('\n').filter(line => line.trim().startsWith('-') || line.trim().match(/^\d+\./)).map(line => line.trim().replace(/^[-\d.]\s*/, ''));
        }
      });

      setInsights(parsedInsights);
      toast.success('AI insights generated successfully!');
    } catch (error) {
      console.error('[AI Insights] Error generating insights:', error);
      toast.error('Failed to generate insights. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Generate Button */}
      <Card className="bg-gradient-to-br from-purple-500 to-blue-600 text-white border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                <Sparkles className="h-6 w-6" />
                AI-Powered Business Intelligence
              </h3>
              <p className="text-white/80 mb-4">
                Generate comprehensive insights, risk assessments, and actionable recommendations based on your data.
              </p>
            </div>
          </div>
          <Button
            onClick={generateInsights}
            disabled={generating}
            className="bg-white text-purple-600 hover:bg-white/90"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing Data...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate AI Insights
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Insights Display */}
      {insights && (
        <div className="space-y-6">
          {/* Key Findings */}
          {insights.keyFindings.length > 0 && (
            <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-600" />
                  Key Findings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {insights.keyFindings.map((finding, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <Badge className="bg-blue-500 mt-0.5">#{idx + 1}</Badge>
                      <p className="text-slate-700 flex-1">{finding}</p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Risk Assessment */}
          {insights.risks.length > 0 && (
            <Card className="bg-white/80 backdrop-blur-xl border-red-200/60">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  Risk Assessment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Alert variant="destructive" className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {insights.risks.length} critical risks identified that require immediate attention.
                  </AlertDescription>
                </Alert>
                <ul className="space-y-3">
                  {insights.risks.map((risk, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <p className="text-slate-700 flex-1">{risk}</p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Opportunities */}
          {insights.opportunities.length > 0 && (
            <Card className="bg-white/80 backdrop-blur-xl border-emerald-200/60">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                  Opportunities for Growth
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {insights.opportunities.map((opportunity, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <TrendingUp className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <p className="text-slate-700 flex-1">{opportunity}</p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Actionable Recommendations */}
          {insights.recommendations.length > 0 && (
            <Card className="bg-white/80 backdrop-blur-xl border-amber-200/60">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-amber-600" />
                  Actionable Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {insights.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-amber-700">{idx + 1}</span>
                      </div>
                      <p className="text-slate-700 flex-1">{rec}</p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Resource Optimization */}
          {insights.resourceOptimization.length > 0 && (
            <Card className="bg-white/80 backdrop-blur-xl border-purple-200/60">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-purple-600" />
                  Resource Optimization
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {insights.resourceOptimization.map((suggestion, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <Users className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                      <p className="text-slate-700 flex-1">{suggestion}</p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Predictive Insights */}
          {insights.predictions.length > 0 && (
            <Card className="bg-white/80 backdrop-blur-xl border-blue-200/60">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  30-Day Forecast
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {insights.predictions.map((prediction, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <Clock className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <p className="text-slate-700 flex-1">{prediction}</p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Regenerate Button */}
          <div className="flex justify-center">
            <Button
              onClick={generateInsights}
              disabled={generating}
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
              Regenerate Insights
            </Button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!insights && !generating && (
        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
          <CardContent className="py-16">
            <div className="text-center">
              <Sparkles className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">No Insights Yet</h3>
              <p className="text-slate-600 mb-6">
                Click the "Generate AI Insights" button above to analyze your data and receive intelligent recommendations.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

