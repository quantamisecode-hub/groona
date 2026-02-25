import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Sparkles,
  CheckCircle,
  FolderKanban,
  Calendar,
  Brain,
  Clock,
  FileCheck,
  LifeBuoy,
  Eye,
  Shield,
  Zap,
  Users,
  Target,
  TrendingUp,
  Settings,
  Globe,
  Lock,
  BarChart3,
  Workflow
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";

export default function FeaturesPage() {
  const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.6 }
  };

  const features = [
    {
      icon: FolderKanban,
      badge: "Core Platform",
      title: "Project & Task Management",
      description: "Comprehensive project planning with tasks, milestones, dependencies, and multiple workflow support. Perfect for both Agile sprints and marketing campaigns.",
      benefits: [
        "Multiple workflow options (Agile, Kanban, Campaign-based)",
        "Task dependencies and blocking management",
        "Milestone tracking and deadlines",
        "Custom fields and labels",
        "File attachments and documentation",
        "Subtask breakdown and checklists"
      ],
      screenshot: "https://placehold.co/800x500"
    },
    {
      icon: Calendar,
      badge: "Planning",
      title: "Sprint & Campaign Management",
      description: "Specialized boards for development sprints and marketing campaigns. Track velocity, capacity, and burndown with real-time insights.",
      benefits: [
        "Sprint planning with story points",
        "Campaign timeline management",
        "Capacity and workload planning",
        "Burndown charts and velocity tracking",
        "Retrospective tools",
        "Backlog prioritization"
      ],
      screenshot: "https://placehold.co/800x500"
    },
    {
      icon: Brain,
      badge: "AI-Powered",
      title: "Intelligent Project Insights",
      description: "AI analyzes your projects to break down complex tasks, predict timelines, identify risks, and provide actionable retrospective insights.",
      benefits: [
        "AI-powered task breakdown and estimation",
        "Intelligent timeline predictions",
        "Risk assessment and early warnings",
        "Automated retrospective analysis",
        "Smart suggestions for resource allocation",
        "Project health scoring"
      ],
      screenshot: "https://placehold.co/800x500"
    },
    {
      icon: Clock,
      badge: "Time Tracking",
      title: "Task-Linked Timesheets",
      description: "Track time directly from tasks with automatic sprint and project context. Every minute logged is connected to what you're actually working on.",
      benefits: [
        "Log time directly from task cards",
        "Sprint-aware timesheet entries",
        "Auto-populate project and task details",
        "Billable vs non-billable tracking",
        "Location tracking (configurable)",
        "Weekly/daily submission workflows"
      ],
      screenshot: "https://placehold.co/800x500"
    },
    {
      icon: FileCheck,
      badge: "Workflow Control",
      title: "Multi-Level Approvals",
      description: "Structured approval workflows for timesheets, tasks, and client access. Project Managers and Admins maintain control without micromanaging.",
      benefits: [
        "Timesheet approval by PM and Admin",
        "Task completion approvals",
        "Client access request approvals",
        "Rejection with feedback mechanism",
        "Approval history and audit trail",
        "Configurable approval policies"
      ],
      screenshot: "https://placehold.co/800x500"
    },
    {
      icon: LifeBuoy,
      badge: "Support",
      title: "Built-in Ticketing with SLA",
      description: "Lightweight support ticketing system with SLA tracking. Users can report bugs and issues directly from their workspace.",
      benefits: [
        "Bug and issue reporting inside the platform",
        "SLA-based priority tracking",
        "Support team role and assignments",
        "Ticket status workflow",
        "Internal notes and comments",
        "Email notifications and updates"
      ],
      screenshot: "https://placehold.co/800x500"
    },
    {
      icon: Eye,
      badge: "Client Access",
      title: "Secure Client Dashboard",
      description: "Give clients transparent, read-only access to project progress, milestones, and timelines. Keep them informed without constant meetings.",
      benefits: [
        "Permission-controlled client access",
        "Real-time project progress visibility",
        "Milestone and timeline tracking",
        "Comment and feedback capability",
        "Document sharing and viewing",
        "No admin burden for clients"
      ],
      screenshot: "https://placehold.co/800x500"
    },
    {
      icon: Shield,
      badge: "Administration",
      title: "Super Admin Control Panel",
      description: "Platform-wide governance for multi-tenant setups. Manage tenants, configure features, set policies, and monitor system health.",
      benefits: [
        "Multi-tenant management and isolation",
        "Feature flag controls per tenant",
        "Subscription and plan management",
        "System-wide audit logs",
        "User and workspace oversight",
        "Platform analytics and insights"
      ],
      screenshot: "https://placehold.co/800x500"
    },
    {
      icon: Zap,
      badge: "Flexibility",
      title: "Multi-Industry Ready",
      description: "Configure the platform for software development, marketing agencies, or any client-based business—without code changes.",
      benefits: [
        "Industry-specific terminology (sprints vs campaigns)",
        "Workflow presets for different industries",
        "Customizable company types",
        "Configurable approval flows",
        "Flexible billing models",
        "No-code industry switching"
      ],
      screenshot: "https://placehold.co/800x500"
    }
  ];

  const additionalFeatures = [
    { icon: Users, title: "Team & Resource Management", desc: "Role-based permissions, workload balancing, availability tracking" },
    { icon: BarChart3, title: "Advanced Reports & Analytics", desc: "Custom reports, financial tracking, productivity insights" },
    { icon: Workflow, title: "Automation & Integrations", desc: "Recurring tasks, auto-assignments, webhook support" },
    { icon: Lock, title: "Enterprise Security", desc: "2FA, audit logs, data encryption, compliance ready" },
    { icon: Globe, title: "Multi-Workspace Support", desc: "Separate workspaces for departments, projects, or clients" },
    { icon: Settings, title: "Highly Configurable", desc: "Custom fields, workflows, notifications, and branding" }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to={createPageUrl("LandingPage")} className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900">Groona</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link to={createPageUrl("Features")} className="text-slate-900 font-semibold">
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

      {/* Hero */}
      <section className="pt-32 pb-16 px-6 bg-gradient-to-br from-slate-50 to-blue-50/30">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <Badge className="mb-6 bg-blue-50 text-blue-700 border-blue-200 px-4 py-2">
              Complete Feature Set
            </Badge>
            <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6 leading-tight">
              Everything You Need to
              <span className="block bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Deliver Projects
              </span>
            </h1>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto mb-10">
              From AI-powered planning to client dashboards—explore the complete platform built for teams that deliver results.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main Features */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto space-y-32">
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              className={`grid lg:grid-cols-2 gap-12 items-center ${idx % 2 === 1 ? 'lg:grid-flow-dense' : ''}`}
              {...fadeInUp}
            >
              <div className={idx % 2 === 1 ? 'lg:col-start-2' : ''}>
                <Badge className="mb-4 bg-blue-50 text-blue-700 border-blue-200">
                  <feature.icon className="h-3 w-3 mr-1" />
                  {feature.badge}
                </Badge>
                <h2 className="text-4xl font-bold text-slate-900 mb-4">
                  {feature.title}
                </h2>
                <p className="text-lg text-slate-600 mb-6">
                  {feature.description}
                </p>
                <div className="space-y-3 mb-8">
                  {feature.benefits.map((benefit, bidx) => (
                    <div key={bidx} className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-700">{benefit}</span>
                    </div>
                  ))}
                </div>
                <Link to={createPageUrl("Register")}>
                  <Button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
                    Try This Feature
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>

              <div className={`relative ${idx % 2 === 1 ? 'lg:col-start-1 lg:row-start-1' : ''}`}>
                <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl blur-2xl" />
                <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-2xl bg-white">
                  <img
                    src={feature.screenshot}
                    alt={feature.title}
                    className="w-full"
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Additional Features Grid */}
      <section className="py-20 px-6 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <motion.div className="text-center mb-16" {...fadeInUp}>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              And Much More
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Everything you'd expect from a modern project management platform—and features you didn't know you needed.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {additionalFeatures.map((feature, idx) => (
              <motion.div
                key={idx}
                {...fadeInUp}
                transition={{ delay: idx * 0.1 }}
              >
                <Card className="h-full bg-white hover:shadow-xl transition-all duration-300 border-slate-200">
                  <CardContent className="p-6">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-600/10 flex items-center justify-center mb-4">
                      <feature.icon className="h-6 w-6 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-slate-600 text-sm">
                      {feature.desc}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-6 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div {...fadeInUp}>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              See It in Action
            </h2>
            <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
              The best way to understand Groona is to use it. Start your free trial today.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to={createPageUrl("Register")}>
                <Button size="lg" className="bg-white text-blue-600 hover:bg-slate-100 text-lg px-8 py-6">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to={createPageUrl("Pricing")}>
                <Button size="lg" className="bg-white text-blue-600 hover:bg-slate-100 text-lg px-8 py-6">
                  View Pricing
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