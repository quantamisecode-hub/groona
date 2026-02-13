import React, { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sparkles, TrendingUp, AlertTriangle, DollarSign, Users, Loader2, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { createPageUrl } from "@/utils";

export default function AISubscriptionManagement() {
  const [currentUser, setCurrentUser] = useState(null);
  const [aiInsights, setAiInsights] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [recommendations, setRecommendations] = useState([]);

  useEffect(() => {
    groonabackend.auth.me().then(user => {
      if (!user.is_super_admin) {
        window.location.href = createPageUrl("Dashboard");
      }
      setCurrentUser(user);
    }).catch(() => {
      window.location.href = createPageUrl("Dashboard");
    });
  }, []);

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => groonabackend.entities.Tenant.list('-created_date'),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => groonabackend.entities.User.list(),
  });

  const { data: allProjects = [] } = useQuery({
    queryKey: ['all-projects'],
    queryFn: () => groonabackend.entities.Project.list(),
  });

  // Generate AI insights
  const generateAIInsights = async () => {
    setLoadingInsights(true);
    try {
      const prompt = `Analyze the following SaaS subscription data and provide strategic insights:

**Platform Overview:**
- Total Tenants: ${tenants.length}
- Total Users: ${allUsers.length}
- Total Projects: ${allProjects.length}

**Tenant Breakdown:**
${tenants.map(t => {
  const userCount = allUsers.filter(u => u.tenant_id === t.id).length;
  const projectCount = allProjects.filter(p => p.tenant_id === t.id).length;
  return `- ${t.name}: ${t.subscription_plan} plan, ${t.status} status, ${userCount} users, ${projectCount} projects`;
}).join('\n')}

**Plan Distribution:**
- Free: ${tenants.filter(t => t.subscription_plan === 'free').length}
- Starter: ${tenants.filter(t => t.subscription_plan === 'starter').length}
- Professional: ${tenants.filter(t => t.subscription_plan === 'professional').length}
- Enterprise: ${tenants.filter(t => t.subscription_plan === 'enterprise').length}

**Status Distribution:**
- Active: ${tenants.filter(t => t.status === 'active').length}
- Trial: ${tenants.filter(t => t.status === 'trial').length}
- Suspended: ${tenants.filter(t => t.status === 'suspended').length}

Please provide:
1. Revenue optimization opportunities
2. Churn risk analysis
3. Upsell candidates (trial → paid, free → starter, etc.)
4. Tenants approaching resource limits
5. Growth trends and predictions
6. Action items for subscription management

Format as structured JSON with sections: revenue_opportunities, churn_risks, upsell_candidates, resource_warnings, growth_insights, action_items`;

      const response = await groonabackend.integrations.Core.InvokeLLM({
        prompt: prompt,
        response_json_schema: {
          type: "object",
          properties: {
            revenue_opportunities: { type: "array", items: { type: "string" } },
            churn_risks: { type: "array", items: { type: "string" } },
            upsell_candidates: { type: "array", items: { type: "string" } },
            resource_warnings: { type: "array", items: { type: "string" } },
            growth_insights: { type: "array", items: { type: "string" } },
            action_items: { type: "array", items: { type: "string" } }
          }
        }
      });

      setAiInsights(response);
      setRecommendations(response.action_items || []);
      toast.success("AI insights generated!");
    } catch (error) {
      console.error("Failed to generate insights:", error);
      toast.error("Failed to generate AI insights");
    } finally {
      setLoadingInsights(false);
    }
  };

  // AI Chat for subscription questions
  const handleAIChat = async () => {
    if (!chatInput.trim()) return;
    
    setChatLoading(true);
    try {
      const context = `Platform Data:
- Total Tenants: ${tenants.length}
- Plans: Free(${tenants.filter(t => t.subscription_plan === 'free').length}), Starter(${tenants.filter(t => t.subscription_plan === 'starter').length}), Pro(${tenants.filter(t => t.subscription_plan === 'professional').length}), Enterprise(${tenants.filter(t => t.subscription_plan === 'enterprise').length})
- Status: Active(${tenants.filter(t => t.status === 'active').length}), Trial(${tenants.filter(t => t.status === 'trial').length})

Tenant Details:
${tenants.slice(0, 10).map(t => `${t.name}: ${t.subscription_plan} (${t.status})`).join('\n')}`;

      const response = await groonabackend.integrations.Core.InvokeLLM({
        prompt: `${context}\n\nUser Question: ${chatInput}\n\nProvide a strategic answer for the platform administrator.`
      });

      toast.success("AI Response: " + response);
      setChatInput("");
    } catch (error) {
      console.error("Chat error:", error);
      toast.error("Failed to get AI response");
    } finally {
      setChatLoading(false);
    }
  };

  // Calculate metrics
  const metrics = {
    totalRevenue: tenants.reduce((sum, t) => {
      const prices = { free: 0, starter: 29, professional: 99, enterprise: 299 };
      return sum + (prices[t.subscription_plan] || 0);
    }, 0),
    avgRevenuePerTenant: tenants.length > 0 ? 
      tenants.reduce((sum, t) => {
        const prices = { free: 0, starter: 29, professional: 99, enterprise: 299 };
        return sum + (prices[t.subscription_plan] || 0);
      }, 0) / tenants.length : 0,
    trialConversionRate: tenants.filter(t => t.status === 'trial').length > 0 ?
      (tenants.filter(t => t.status === 'active' && t.subscription_plan !== 'free').length / 
       tenants.filter(t => t.status === 'trial').length * 100) : 0,
    atRiskTenants: tenants.filter(t => 
      t.status === 'trial' && t.trial_ends_at && 
      new Date(t.trial_ends_at) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    ).length,
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2 flex items-center gap-3">
              <Sparkles className="h-8 w-8 text-purple-600" />
              AI Subscription Management
            </h1>
            <p className="text-slate-600">AI-powered insights for subscription optimization and revenue growth</p>
          </div>
          <Button
            onClick={generateAIInsights}
            disabled={loadingInsights}
            className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700"
          >
            {loadingInsights ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate AI Insights
              </>
            )}
          </Button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Monthly Recurring Revenue</p>
                  <p className="text-3xl font-bold text-green-600">${metrics.totalRevenue.toLocaleString()}</p>
                </div>
                <DollarSign className="h-10 w-10 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Avg Revenue/Tenant</p>
                  <p className="text-3xl font-bold text-blue-600">${metrics.avgRevenuePerTenant.toFixed(0)}</p>
                </div>
                <TrendingUp className="h-10 w-10 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Trial Conversion</p>
                  <p className="text-3xl font-bold text-purple-600">{metrics.trialConversionRate.toFixed(1)}%</p>
                </div>
                <Users className="h-10 w-10 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">At-Risk Tenants</p>
                  <p className="text-3xl font-bold text-red-600">{metrics.atRiskTenants}</p>
                </div>
                <AlertTriangle className="h-10 w-10 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AI Chat Interface */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              Ask AI About Subscriptions
            </CardTitle>
            <CardDescription>
              Get instant strategic advice on subscription management, pricing, and revenue optimization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="e.g., Which tenants should I prioritize for upselling?"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAIChat()}
                disabled={chatLoading}
              />
              <Button 
                onClick={handleAIChat} 
                disabled={chatLoading || !chatInput.trim()}
                className="bg-gradient-to-r from-purple-500 to-pink-600"
              >
                {chatLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* AI Insights Display */}
        {aiInsights && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Revenue Opportunities */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <DollarSign className="h-5 w-5" />
                  Revenue Opportunities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {aiInsights.revenue_opportunities?.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <span className="text-green-600 font-bold">•</span>
                      <span className="text-slate-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Churn Risks */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  Churn Risks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {aiInsights.churn_risks?.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <span className="text-red-600 font-bold">•</span>
                      <span className="text-slate-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Upsell Candidates */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-600">
                  <TrendingUp className="h-5 w-5" />
                  Upsell Candidates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {aiInsights.upsell_candidates?.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <span className="text-blue-600 font-bold">•</span>
                      <span className="text-slate-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Resource Warnings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="h-5 w-5" />
                  Resource Warnings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {aiInsights.resource_warnings?.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <span className="text-amber-600 font-bold">•</span>
                      <span className="text-slate-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Growth Insights */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-purple-600">
                  <Sparkles className="h-5 w-5" />
                  Growth Insights & Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {aiInsights.growth_insights?.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <span className="text-purple-600 font-bold">•</span>
                      <span className="text-slate-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Action Items */}
        {recommendations.length > 0 && (
          <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-900">
                <RefreshCw className="h-5 w-5" />
                Recommended Actions
              </CardTitle>
              <CardDescription>Priority action items based on AI analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recommendations.map((action, idx) => (
                  <div 
                    key={idx} 
                    className="flex items-start gap-3 p-3 bg-white rounded-lg border border-purple-200 hover:shadow-md transition-shadow"
                  >
                    <Badge className="mt-1 bg-purple-600">{idx + 1}</Badge>
                    <p className="text-sm text-slate-800 flex-1">{action}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

