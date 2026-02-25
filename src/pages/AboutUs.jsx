import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  ArrowRight,
  Target,
  Heart,
  Lightbulb,
  Users,
  Shield,
  Zap,
  TrendingUp,
  Globe
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";

export default function AboutUs() {
  const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.6 }
  };

  const values = [
    {
      icon: Heart,
      title: "User-Centric Design",
      description: "Every feature is built with the end user in mind. We obsess over making complex workflows simple and intuitive."
    },
    {
      icon: Lightbulb,
      title: "Innovation First",
      description: "We leverage cutting-edge AI and modern technology to solve real problems, not just follow trends."
    },
    {
      icon: Shield,
      title: "Trust & Transparency",
      description: "Your data is secure, your privacy is protected, and our pricing is straightforward—no hidden fees."
    },
    {
      icon: Zap,
      title: "Speed & Efficiency",
      description: "We believe in moving fast without breaking things. Ship better, faster, with less overhead."
    }
  ];

  const stats = [
    { number: "10K+", label: "Projects Delivered" },
    { number: "500+", label: "Active Teams" },
    { number: "99.9%", label: "Uptime" },
    { number: "24/7", label: "Support" }
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
            <Link to={createPageUrl("Features")} className="text-slate-600 hover:text-slate-900 font-medium transition-colors">
              Features
            </Link>
            <Link to={createPageUrl("Pricing")} className="text-slate-600 hover:text-slate-900 font-medium transition-colors">
              Pricing
            </Link>
            <Link to={createPageUrl("AboutUs")} className="text-slate-900 font-medium">
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
              <Globe className="h-3 w-3 mr-2" />
              About Groona
            </Badge>
            <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6">
              Building the Future of
              <span className="block bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Project Management
              </span>
            </h1>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              We're on a mission to help teams deliver better projects faster—with AI-powered insights,
              deep timesheet integration, and client-ready transparency.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-20 px-6 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div {...fadeInUp}>
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-6">
                <Target className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-4xl font-bold text-slate-900 mb-6">
                Our Mission
              </h2>
              <p className="text-lg text-slate-600 mb-4">
                Traditional project management tools are either too simple or overwhelmingly complex.
                We built Groona to bridge that gap.
              </p>
              <p className="text-lg text-slate-600 mb-4">
                We believe in empowering teams with the right data at the right time—without drowning
                them in features they'll never use. Every decision we make is guided by one question:
                <span className="font-semibold text-slate-900"> "Does this help teams deliver better work?"</span>
              </p>
              <p className="text-lg text-slate-600">
                From software developers to marketing agencies, we're building for teams that value
                clarity, efficiency, and results.
              </p>
            </motion.div>
            <motion.div
              {...fadeInUp}
              transition={{ delay: 0.2 }}
              className="relative"
            >
              <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-3xl blur-3xl" />
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-2xl">
                <img
                  src="https://placehold.co/600x400"
                  alt="Team collaboration"
                  className="w-full"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div className="text-center mb-16" {...fadeInUp}>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              What We Stand For
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              The principles that guide every decision we make
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, idx) => (
              <motion.div
                key={idx}
                {...fadeInUp}
                transition={{ delay: idx * 0.1 }}
              >
                <Card className="h-full bg-white border-slate-200 hover:shadow-xl transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-4">
                      <value.icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-3">
                      {value.title}
                    </h3>
                    <p className="text-slate-600">
                      {value.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-6 bg-gradient-to-br from-slate-50 to-blue-50/30">
        <div className="max-w-7xl mx-auto">
          <motion.div className="text-center mb-12" {...fadeInUp}>
            <h2 className="text-4xl font-bold text-slate-900 mb-4">
              Trusted by Teams Worldwide
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-4 gap-8">
            {stats.map((stat, idx) => (
              <motion.div
                key={idx}
                {...fadeInUp}
                transition={{ delay: idx * 0.1 }}
                className="text-center"
              >
                <div className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                  {stat.number}
                </div>
                <div className="text-lg text-slate-600">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div {...fadeInUp} className="text-center">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-6">
              <TrendingUp className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-4xl font-bold text-slate-900 mb-6">
              The Story Behind Groona
            </h2>
            <div className="text-lg text-slate-600 space-y-4 text-left">
              <p>
                Groona was born from frustration. Our founders spent years managing software development
                teams and client projects, constantly switching between task boards, time trackers, and
                spreadsheets just to answer simple questions like "How much time did we spend on this feature?"
              </p>
              <p>
                We realized the problem wasn't a lack of tools—it was too many disconnected tools. Projects
                lived in one app, time tracking in another, and client reporting required manual exports and
                reconciliation.
              </p>
              <p>
                So we built Groona: a single platform where tasks, sprints, timesheets, and client dashboards
                work together seamlessly. Add AI-powered insights into the mix, and you get a system that
                doesn't just track work—it helps you plan and deliver better.
              </p>
              <p className="font-semibold text-slate-900">
                Today, we're proud to serve teams across software development, marketing, and consulting—helping
                them deliver projects on time, within budget, and with full transparency.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div {...fadeInUp}>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Join Our Mission
            </h2>
            <p className="text-xl text-blue-100 mb-10">
              Be part of the team changing how projects get delivered.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to={createPageUrl("Register")}>
                <Button size="lg" className="bg-white text-blue-600 hover:bg-slate-100 text-lg px-8 py-6">
                  Get Started Free
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