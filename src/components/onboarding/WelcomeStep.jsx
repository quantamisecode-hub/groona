import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Layout, Users, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

export default function WelcomeStep({ onNext, user }) {
    const firstName = user?.full_name?.split(' ')[0] || "there";

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
                delayChildren: 0.2
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.5, ease: "easeOut" }
        }
    };

    const features = [
        {
            icon: Layout,
            title: "Project Management",
            description: "AI-powered planning and tracking"
        },
        {
            icon: Sparkles,
            title: "Smart Insights",
            description: "Real-time health and risk analysis"
        },
        {
            icon: Users,
            title: "Team Collaboration",
            description: "Seamless communication and coordination"
        },
        {
            icon: CheckCircle2,
            title: "Quality Assurance",
            description: "Automated checks and rework alerts"
        }
    ];

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="w-full max-w-2xl"
        >
            {/* Top Tag */}
            <motion.div variants={itemVariants} className="mb-6">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600">
                    Your journey starts here
                </span>
            </motion.div>

            {/* Heading Section */}
            <div className="mb-10">
                <motion.h1
                    variants={itemVariants}
                    className="text-5xl md:text-6xl font-bold text-slate-900 tracking-tight leading-tight"
                >
                    Hello, {firstName}.
                </motion.h1>
                <motion.h2
                    variants={itemVariants}
                    className="text-5xl md:text-6xl font-bold text-slate-300 tracking-tight leading-tight"
                >
                    Ready to build?
                </motion.h2>
            </div>

            {/* Description */}
            <motion.p
                variants={itemVariants}
                className="text-lg text-slate-500 leading-relaxed mb-12 max-w-lg"
            >
                We've prepared a tailored workspace for your team. Let's take a moment
                to configure your environment for peak productivity.
            </motion.p>

            {/* Feature Grid */}
            <motion.div
                variants={itemVariants}
                className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10 mb-16"
            >
                {features.map((feature, index) => (
                    <div key={index} className="flex items-start gap-4 group">
                        <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center shrink-0 transition-colors group-hover:bg-blue-50 group-hover:text-blue-600 text-slate-400">
                            <feature.icon className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="font-bold text-slate-900 text-sm">{feature.title}</h3>
                            <p className="text-xs text-slate-400 font-medium leading-normal">
                                {feature.description}
                            </p>
                        </div>
                    </div>
                ))}
            </motion.div>

            {/* Action Button */}
            <motion.div variants={itemVariants}>
                <Button
                    onClick={() => onNext({})}
                    size="lg"
                    className="h-14 px-10 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-base group shadow-xl shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                    Start Interaction
                    <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
            </motion.div>
        </motion.div>
    );
}
