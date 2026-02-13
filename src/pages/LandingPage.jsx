import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRight, 
  Sparkles, 
  CheckCircle, 
  Users, 
  Briefcase, 
  Target,
  Clock,
  Shield,
  Zap,
  TrendingUp,
  BarChart3,
  FileCheck,
  UserCheck,
  Globe,
  Code,
  Megaphone,
  Building2
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";

export default function LandingPage() {
  const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.6 }
  };

  const staggerContainer = {
    initial: {},
    whileInView: { transition: { staggerChildren: 0.1 } },
    viewport: { once: true }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900">Groona</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <Link to={createPageUrl("Features")} className="text-slate-600 hover:text-slate-900 font-medium transition-colors">
              Features
            </Link>
            <Link to={createPageUrl("Pricing")} className="text-slate-600 hover:text-slate-900 font-medium transition-colors">
              Pricing
            </Link>
            <Link to={createPageUrl("AboutUs")} className="text-slate-600 hover:text-slate-900 font-medium transition-colors">
              About
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link to={createPageUrl("SignIn")}>
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link to={createPageUrl("Register")}>
              <Button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
                Get Started Free
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <Badge className="mb-6 bg-blue-50 text-blue-700 border-blue-200 px-4 py-2">
              <Sparkles className="h-3 w-3 mr-2" />
              AI-Powered Project Management
            </Badge>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-slate-900 mb-6 leading-tight">
              Built for Teams That
              <span className="block bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Deliver Results
              </span>
            </h1>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto mb-10">
              Multi-tenant project management platform designed for software development companies, marketing agencies, and client-focused teams. Plan smarter with AI, track deeply with timesheets, and deliver confidently.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to={createPageUrl("Register")}>
                <Button size="lg" className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-lg px-8 py-6">
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to={createPageUrl("Features")}>
                <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                  View Features
                </Button>
              </Link>
            </div>
          </motion.div>

          <motion.div 
            className="relative"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-3xl blur-3xl" />
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-2xl">
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/groonabackend-prod/public/6910343c60b8b79479bc50a6/6d5176b54_DashboardOverview.png" 
                alt="Dashboard Overview" 
                className="w-full"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Who Is This For */}
      <section className="py-20 px-6 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <motion.div className="text-center mb-16" {...fadeInUp}>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Built for Modern Teams
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Whether you're building software, running campaigns, or managing clients—we understand your workflow.
            </p>
          </motion.div>

          <motion.div 
            className="grid md:grid-cols-3 gap-8"
            variants={staggerContainer}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
          >
            {[
              {
                icon: Code,
                title: "Software Development Companies",
                pain: "Juggling sprints, timesheets, and client updates becomes overwhelming",
                solution: "Task-to-timesheet linking, sprint management, and client-ready dashboards—all in one place"
              },
              {
                icon: Megaphone,
                title: "Marketing Agencies",
                pain: "Campaign tracking, client approvals, and team bandwidth feel scattered",
                solution: "Campaign workflows, approval management, and resource planning built for agencies"
              },
              {
                icon: Building2,
                title: "Client-Based Teams",
                pain: "Keeping clients informed without constant meetings drains productivity",
                solution: "Secure client portals, milestone tracking, and transparent progress sharing"
              }
            ].map((item, idx) => (
              <motion.div key={idx} variants={fadeInUp}>
                <Card className="h-full bg-white hover:shadow-xl transition-all duration-300 border-slate-200">
                  <CardContent className="p-8">
                    <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-6">
                      <item.icon className="h-7 w-7 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-4">{item.title}</h3>
                    <p className="text-slate-600 mb-4">
                      <span className="font-semibold text-red-600">Pain:</span> {item.pain}
                    </p>
                    <p className="text-slate-600">
                      <span className="font-semibold text-green-600">Solution:</span> {item.solution}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Core USPs */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div className="text-center mb-16" {...fadeInUp}>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Why Teams Choose Groona
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Not just another project tool. Real features that solve real problems.
            </p>
          </motion.div>

          <div className="space-y-24">
            {/* USP 1 */}
            <motion.div 
              className="grid md:grid-cols-2 gap-12 items-center"
              {...fadeInUp}
            >
              <div>
                <Badge className="mb-4 bg-purple-50 text-purple-700 border-purple-200">
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI-Powered
                </Badge>
                <h3 className="text-3xl font-bold text-slate-900 mb-4">
                  AI-Assisted Project Planning & Insights
                </h3>
                <p className="text-lg text-slate-600 mb-6">
                  Let AI break down complex projects, suggest timelines, and provide deep retrospective insights. Make better decisions faster with intelligent recommendations.
                </p>
                <ul className="space-y-3">
                  {[
                    "AI task breakdown and estimation",
                    "Intelligent timeline predictions",
                    "Automated retrospective analysis"
                  ].map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-3 text-slate-700">
                      <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-2xl blur-2xl" />
                <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-xl">
                  <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/groonabackend-prod/public/6910343c60b8b79479bc50a6/cd900b5a8_AI-AssistedProjectPlanningInsights.png" alt="AI Insights" className="w-full" />
                </div>
              </div>
            </motion.div>

            {/* USP 2 */}
            <motion.div 
              className="grid md:grid-cols-2 gap-12 items-center"
              {...fadeInUp}
            >
              <div className="order-2 md:order-1 relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/10 to-green-500/10 rounded-2xl blur-2xl" />
                <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-xl">
                  <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/groonabackend-prod/public/6910343c60b8b79479bc50a6/57fcc6136_TaskSprintTimesheetLinkage.png" alt="Timesheet Integration" className="w-full" />
                </div>
              </div>
              <div className="order-1 md:order-2">
                <Badge className="mb-4 bg-blue-50 text-blue-700 border-blue-200">
                  <Clock className="h-3 w-3 mr-1" />
                  Deep Integration
                </Badge>
                <h3 className="text-3xl font-bold text-slate-900 mb-4">
                  Task → Sprint → Timesheet Linkage
                </h3>
                <p className="text-lg text-slate-600 mb-6">
                  Every minute tracked is directly linked to tasks and sprints. No more disconnected time entries. Generate accurate reports with complete context.
                </p>
                <ul className="space-y-3">
                  {[
                    "Time entries auto-populate from tasks",
                    "Sprint-aware timesheet tracking",
                    "Real-time billable hours calculation"
                  ].map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-3 text-slate-700">
                      <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>

            {/* USP 3 */}
            <motion.div 
              className="grid md:grid-cols-2 gap-12 items-center"
              {...fadeInUp}
            >
              <div>
                <Badge className="mb-4 bg-green-50 text-green-700 border-green-200">
                  <FileCheck className="h-3 w-3 mr-1" />
                  Workflow Control
                </Badge>
                <h3 className="text-3xl font-bold text-slate-900 mb-4">
                  Built-in Approval Management
                </h3>
                <p className="text-lg text-slate-600 mb-6">
                  Project Managers and Admins can approve tasks, timesheets, and client access—all within the platform. No more scattered approval chains.
                </p>
                <ul className="space-y-3">
                  {[
                    "Multi-level approval workflows",
                    "Timesheet approval dashboard",
                    "Client access approvals"
                  ].map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-3 text-slate-700">
                      <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-2xl blur-2xl" />
                <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-xl">
                  <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/groonabackend-prod/public/6910343c60b8b79479bc50a6/056d6347d_Built-inApprovalManagement.png" alt="Approval Dashboard" className="w-full" />
                </div>
              </div>
            </motion.div>

            {/* USP 4 */}
            <motion.div 
              className="grid md:grid-cols-2 gap-12 items-center"
              {...fadeInUp}
            >
              <div className="order-2 md:order-1 relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl blur-2xl" />
                <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-xl">
                  <img src="/api/placeholder/600/400" alt="Client Dashboard" className="w-full" />
                </div>
              </div>
              <div className="order-1 md:order-2">
                <Badge className="mb-4 bg-blue-50 text-blue-700 border-blue-200">
                  <UserCheck className="h-3 w-3 mr-1" />
                  Client-Ready
                </Badge>
                <h3 className="text-3xl font-bold text-slate-900 mb-4">
                  Secure Client Dashboard
                </h3>
                <p className="text-lg text-slate-600 mb-6">
                  Give clients read-only access to project progress, milestones, and timelines. Keep them informed without endless meetings.
                </p>
                <ul className="space-y-3">
                  {[
                    "Secure, permission-controlled access",
                    "Real-time progress visibility",
                    "Milestone and timeline tracking"
                  ].map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-3 text-slate-700">
                      <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 bg-gradient-to-br from-slate-50 to-blue-50/30">
        <div className="max-w-7xl mx-auto">
          <motion.div className="text-center mb-16" {...fadeInUp}>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Get Started in Minutes
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              No complex setup. No steep learning curve. Just smart project management.
            </p>
          </motion.div>

          <motion.div 
            className="grid md:grid-cols-4 gap-8"
            variants={staggerContainer}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
          >
            {[
              { icon: Users, title: "Sign Up & Configure", desc: "Create your workspace and set up company preferences" },
              { icon: Briefcase, title: "Create Projects", desc: "Build projects, assign teams, and set up workflows" },
              { icon: TrendingUp, title: "Track Progress", desc: "Monitor tasks, time, and approvals in real-time" },
              { icon: Globe, title: "Share with Clients", desc: "Give clients secure access to project dashboards" }
            ].map((step, idx) => (
              <motion.div key={idx} variants={fadeInUp} className="relative">
                <Card className="h-full bg-white border-slate-200 hover:shadow-xl transition-all duration-300">
                  <CardContent className="p-6 text-center">
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                      {idx + 1}
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-600/10 flex items-center justify-center mx-auto mb-4 mt-2">
                      <step.icon className="h-6 w-6 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">{step.title}</h3>
                    <p className="text-sm text-slate-600">{step.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Detailed Benefits */}
      <section className="py-20 px-6 bg-gradient-to-br from-blue-50 to-purple-50/30">
        <div className="max-w-7xl mx-auto">
          <motion.div className="text-center mb-16" {...fadeInUp}>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Everything You Need, Nothing You Don't
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Unlike bloated enterprise tools or oversimplified task managers, Groona strikes the perfect balance.
            </p>
          </motion.div>

          <motion.div 
            className="grid md:grid-cols-2 gap-8 mb-16"
            variants={staggerContainer}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
          >
            {[
              {
                icon: Target,
                title: "For Software Teams",
                points: [
                  "Sprint planning with velocity tracking",
                  "Task-linked time tracking for accurate billing",
                  "Code review integration and Git sync",
                  "Developer-friendly task breakdowns",
                  "Technical debt tracking"
                ]
              },
              {
                icon: Megaphone,
                title: "For Marketing Agencies",
                points: [
                  "Campaign-based workflow management",
                  "Client approval workflows built-in",
                  "Resource allocation and bandwidth planning",
                  "Campaign performance tracking",
                  "Multi-client portfolio management"
                ]
              },
              {
                icon: Shield,
                title: "For Project Managers",
                points: [
                  "Real-time project health monitoring",
                  "Automatic risk detection and alerts",
                  "Budget vs actual tracking",
                  "Team workload balancing",
                  "One-click status reports"
                ]
              },
              {
                icon: Users,
                title: "For Team Leads",
                points: [
                  "Transparent task dependencies",
                  "Burndown charts and velocity metrics",
                  "Daily standup automation",
                  "Retrospective tools with AI insights",
                  "Performance analytics per team member"
                ]
              }
            ].map((item, idx) => (
              <motion.div key={idx} variants={fadeInUp}>
                <Card className="h-full bg-white hover:shadow-2xl transition-all duration-300 border-slate-200">
                  <CardContent className="p-8">
                    <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-6">
                      <item.icon className="h-7 w-7 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-4">{item.title}</h3>
                    <ul className="space-y-3">
                      {item.points.map((point, pidx) => (
                        <li key={pidx} className="flex items-start gap-3 text-slate-600">
                          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Use Case Stories */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div className="text-center mb-16" {...fadeInUp}>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Real Teams, Real Results
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              See how teams like yours use Groona to deliver projects faster and keep clients happier.
            </p>
          </motion.div>

          <motion.div 
            className="grid md:grid-cols-3 gap-8"
            variants={staggerContainer}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
          >
            {[
              {
                company: "TechStart Solutions",
                industry: "Software Development",
                result: "40% faster sprint completion",
                quote: "The task-to-timesheet linking alone saved us 10 hours per week on admin work. Now we actually know what our team is working on.",
                metric: "10hrs/week saved",
                icon: Code
              },
              {
                company: "Creative Pulse Agency",
                industry: "Marketing Agency",
                result: "3x more campaigns delivered",
                quote: "Client dashboards changed everything. No more weekly status meetings—clients can see progress in real-time.",
                metric: "3x output increase",
                icon: Megaphone
              },
              {
                company: "BuildRight Consulting",
                industry: "Project Management",
                result: "Zero missed deadlines",
                quote: "AI risk detection caught issues before they became blockers. We haven't missed a deadline in 6 months.",
                metric: "100% on-time delivery",
                icon: Building2
              }
            ].map((story, idx) => (
              <motion.div key={idx} variants={fadeInUp}>
                <Card className="h-full bg-gradient-to-br from-slate-50 to-white border-slate-200 hover:shadow-2xl transition-all duration-300">
                  <CardContent className="p-8">
                    <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-4">
                      <story.icon className="h-6 w-6 text-white" />
                    </div>
                    <Badge className="mb-4 bg-green-50 text-green-700 border-green-200">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      {story.result}
                    </Badge>
                    <h3 className="text-xl font-bold text-slate-900 mb-1">{story.company}</h3>
                    <p className="text-sm text-slate-500 mb-4">{story.industry}</p>
                    <p className="text-slate-600 italic mb-4">"{story.quote}"</p>
                    <div className="pt-4 border-t border-slate-200">
                      <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        {story.metric}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Problem vs Solution */}
      <section className="py-20 px-6 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <motion.div className="text-center mb-16" {...fadeInUp}>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Stop Using 5 Tools When 1 Will Do
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Most teams juggle multiple disconnected tools. Groona brings everything together.
            </p>
          </motion.div>

          <motion.div {...fadeInUp}>
            <div className="grid md:grid-cols-2 gap-8">
              <Card className="bg-red-50 border-red-200">
                <CardContent className="p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-12 w-12 rounded-lg bg-red-100 flex items-center justify-center">
                      <span className="text-2xl">❌</span>
                    </div>
                    <h3 className="text-2xl font-bold text-red-900">The Old Way</h3>
                  </div>
                  <ul className="space-y-4">
                    {[
                      "Jira for tasks, Harvest for time, Excel for reports",
                      "Context switching kills productivity",
                      "Manual data entry between tools",
                      "Clients constantly asking for updates",
                      "Timesheets disconnected from actual work",
                      "Approval workflows in email chains",
                      "Budget tracking in spreadsheets",
                      "No visibility into team capacity"
                    ].map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-red-900">
                        <div className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5">✗</div>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
                      <span className="text-2xl">✅</span>
                    </div>
                    <h3 className="text-2xl font-bold text-green-900">The Groona Way</h3>
                  </div>
                  <ul className="space-y-4">
                    {[
                      "One platform for everything project-related",
                      "Work in one place, no tab switching",
                      "Time tracking linked directly to tasks",
                      "Clients see progress automatically",
                      "Every minute tracked has full context",
                      "Built-in approval workflows",
                      "Real-time budget vs actual tracking",
                      "AI-powered capacity planning"
                    ].map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-green-900">
                        <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="font-medium">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="py-20 px-6 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="grid md:grid-cols-4 gap-8 text-center"
            variants={staggerContainer}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
          >
            {[
              { number: "10hrs", label: "Saved per week per team" },
              { number: "40%", label: "Faster project delivery" },
              { number: "95%", label: "Client satisfaction rate" },
              { number: "Zero", label: "Tool switching needed" }
            ].map((stat, idx) => (
              <motion.div key={idx} variants={fadeInUp}>
                <div className="text-5xl md:text-6xl font-bold text-white mb-2">{stat.number}</div>
                <div className="text-blue-100 text-lg">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div className="text-center mb-16" {...fadeInUp}>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-xl text-slate-600">
              Everything you need to know about Groona
            </p>
          </motion.div>

          <motion.div className="space-y-4" {...fadeInUp}>
            {[
              {
                q: "How is Groona different from Jira or Asana?",
                a: "Groona is built specifically for delivery teams that need deep time tracking and client transparency. Unlike generic task managers, we link tasks → sprints → timesheets → billing in one seamless flow. Plus, AI-powered insights help you catch issues before they derail projects."
              },
              {
                q: "Do I need to be technical to use Groona?",
                a: "Not at all. While we support technical workflows like sprint planning and code review, the interface is designed for everyone—from developers to designers to project managers. Most teams are up and running in under 30 minutes."
              },
              {
                q: "Can clients access Groona?",
                a: "Yes! One of our key features is secure client dashboards. Give clients read-only access to project progress, milestones, and timelines. They stay informed without needing constant meetings or status emails."
              },
              {
                q: "How does the AI assistant work?",
                a: "Our AI analyzes your project data to break down complex tasks, predict timelines, identify risks, and generate retrospective insights. It learns from your team's velocity and historical data to provide increasingly accurate recommendations."
              },
              {
                q: "Is my data secure?",
                a: "Absolutely. We use enterprise-grade encryption, role-based access controls, and full audit logging. Your data is stored in secure cloud infrastructure with automatic backups. We're SOC 2 compliant and GDPR ready."
              },
              {
                q: "What's included in the free trial?",
                a: "Full access to all features for 14 days. No credit card required. You can invite your team, create projects, track time, and explore AI insights. If you love it, upgrade to a paid plan when ready."
              }
            ].map((faq, idx) => (
              <Card key={idx} className="border-slate-200">
                <CardContent className="p-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{faq.q}</h3>
                  <p className="text-slate-600">{faq.a}</p>
                </CardContent>
              </Card>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20 px-6 bg-slate-50">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div {...fadeInUp}>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
              Trusted by Modern Delivery Teams
            </h2>
            <p className="text-lg text-slate-600 mb-12 max-w-2xl mx-auto">
              Built for teams that value clarity, efficiency, and results. Designed to scale from startups to agencies.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-12 opacity-40">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 w-32 bg-slate-200 rounded" />
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-6 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div {...fadeInUp}>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Ready to Deliver Better Projects?
            </h2>
            <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
              Join teams that ship faster, track smarter, and keep clients happy.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to={createPageUrl("Register")}>
                <Button size="lg" className="bg-white text-blue-600 hover:bg-slate-100 text-lg px-8 py-6">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to={createPageUrl("Features")}>
                <Button size="lg" className="bg-white text-blue-600 hover:bg-slate-100 text-lg px-8 py-6">
                  Explore Features
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-slate-900 text-slate-400">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">Groona</span>
          </div>
          <p className="text-sm">© 2025 Groona. Built for teams that deliver.</p>
        </div>
      </footer>
    </div>
  );
}

