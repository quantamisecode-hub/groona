import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Check, 
  Sparkles, 
  ArrowRight,
  Zap,
  Users,
  Building2,
  Crown
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";

export default function Pricing() {
  const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.6 }
  };

  const plans = [
    {
      name: "Free",
      icon: Sparkles,
      price: "$0",
      period: "forever",
      description: "Perfect for trying out Groona",
      features: [
        "1 user",
        "1 workspace",
        "5 projects",
        "Basic task management",
        "1GB storage",
        "Community support"
      ],
      cta: "Get Started Free",
      popular: false
    },
    {
      name: "Starter",
      icon: Users,
      price: "$29",
      period: "per month",
      description: "Perfect for small teams getting started",
      features: [
        "Up to 5 users",
        "3 workspaces",
        "20 projects",
        "Basic task management",
        "Timesheet tracking",
        "Email support",
        "5GB storage"
      ],
      cta: "Start Free Trial",
      popular: false
    },
    {
      name: "Professional",
      icon: Building2,
      price: "$79",
      period: "per month",
      description: "For growing teams with advanced needs",
      features: [
        "Up to 50 users",
        "Unlimited workspaces",
        "Unlimited projects",
        "AI-powered insights",
        "Advanced analytics",
        "Advanced timesheets",
        "Client dashboards",
        "Priority support",
        "50GB storage",
        "Custom workflows"
      ],
      cta: "Start Free Trial",
      popular: true
    },
    {
      name: "Enterprise",
      icon: Crown,
      price: "Custom",
      period: "contact us",
      description: "For large organizations with custom requirements",
      features: [
        "Unlimited users",
        "Unlimited workspaces",
        "Unlimited projects",
        "All Professional features",
        "AI code review",
        "Custom integrations",
        "Dedicated success manager",
        "SLA guarantee",
        "Unlimited storage",
        "Advanced security & compliance",
        "Custom training & onboarding",
        "API access"
      ],
      cta: "Contact Sales",
      popular: false
    }
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
            <Link to={createPageUrl("Pricing")} className="text-slate-900 font-medium">
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
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <Badge className="mb-6 bg-blue-50 text-blue-700 border-blue-200 px-4 py-2">
              <Zap className="h-3 w-3 mr-2" />
              Simple, Transparent Pricing
            </Badge>
            <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6">
              Choose the Right Plan
              <span className="block bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                For Your Team
              </span>
            </h1>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-8">
              Start with a 14-day free trial. No credit card required. Cancel anytime.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {plans.map((plan, idx) => (
              <motion.div
                key={idx}
                {...fadeInUp}
                transition={{ delay: idx * 0.1 }}
              >
                <Card className={`h-full relative ${
                  plan.popular 
                    ? 'border-2 border-blue-500 shadow-xl' 
                    : 'border-slate-200'
                }`}>
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <Badge className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-1">
                        Most Popular
                      </Badge>
                    </div>
                  )}
                  <CardHeader className="text-center pb-8 pt-8">
                    <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
                      <plan.icon className="h-7 w-7 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">
                      {plan.name}
                    </h3>
                    <p className="text-slate-600 text-sm mb-4">
                      {plan.description}
                    </p>
                    <div className="mb-2">
                      <span className="text-5xl font-bold text-slate-900">
                        {plan.price}
                      </span>
                      {plan.price !== "Custom" && (
                        <span className="text-slate-600 ml-2">/ month</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500">{plan.period}</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-3 mb-8">
                      {plan.features.map((feature, featureIdx) => (
                        <li key={featureIdx} className="flex items-start gap-3">
                          <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="text-slate-700">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Link to={createPageUrl("Register")} className="block">
                      <Button 
                        className={`w-full ${
                          plan.popular
                            ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
                            : 'bg-slate-900 hover:bg-slate-800'
                        }`}
                      >
                        {plan.cta}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-6 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <motion.div className="text-center mb-16" {...fadeInUp}>
            <h2 className="text-4xl font-bold text-slate-900 mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-xl text-slate-600">
              Everything you need to know about our pricing
            </p>
          </motion.div>

          <div className="space-y-6">
            {[
              {
                q: "Can I change plans later?",
                a: "Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately and we'll prorate the difference."
              },
              {
                q: "What happens after the free trial?",
                a: "After your 14-day trial, you'll be asked to choose a plan. Your data is never deleted, and you can continue with a paid plan seamlessly."
              },
              {
                q: "Do you offer refunds?",
                a: "Yes, we offer a 30-day money-back guarantee. If you're not satisfied, we'll refund your payment, no questions asked."
              },
              {
                q: "Can I add more users?",
                a: "Absolutely! You can add users at any time. Additional users are prorated based on your billing cycle."
              }
            ].map((faq, idx) => (
              <motion.div
                key={idx}
                {...fadeInUp}
                transition={{ delay: idx * 0.1 }}
              >
                <Card className="bg-white border-slate-200">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-bold text-slate-900 mb-2">
                      {faq.q}
                    </h3>
                    <p className="text-slate-600">{faq.a}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div {...fadeInUp}>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Ready to Get Started?
            </h2>
            <p className="text-xl text-blue-100 mb-10">
              Join thousands of teams already using Groona to deliver better projects.
            </p>
            <Link to={createPageUrl("Register")}>
              <Button size="lg" className="bg-white text-blue-600 hover:bg-slate-100 text-lg px-8 py-6">
                Start Your Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
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
