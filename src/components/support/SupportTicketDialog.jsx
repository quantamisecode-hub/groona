import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Loader2, Send, Clock, User, MessageSquare, Plus, FileText } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { groonabackend } from "@/api/groonabackend";
import { toast } from "sonner";

export default function SupportTicketDialog({ open, onClose, ticket, currentUser, onUpdate }) {
    if (!ticket) return null;

    const getStatusColor = (status = "") => {
        switch (status.toUpperCase()) {
            case "OPEN": return "bg-blue-100 text-blue-700";
            case "IN PROGRESS":
            case "IN_PROGRESS": return "bg-purple-100 text-purple-700";
            case "ESCALATED": return "bg-amber-100 text-amber-700";
            case "RESOLVED": return "bg-green-100 text-green-700";
            case "CLOSED": return "bg-slate-100 text-slate-700";
            default: return "bg-slate-100 text-slate-700";
        }
    };

    const getPriorityColor = (priority = "") => {
        switch (priority.toUpperCase()) {
            case "HIGH":
            case "CRITICAL": return "text-red-700 bg-red-50 border-red-100";
            case "MEDIUM": return "text-amber-700 bg-amber-50 border-amber-100";
            case "LOW": return "text-blue-700 bg-blue-50 border-blue-100";
            default: return "text-slate-600 bg-slate-50";
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl h-[85vh] overflow-hidden flex flex-col p-0 rounded-3xl border-none shadow-2xl">
                <DialogHeader className="p-8 pb-6 bg-white shrink-0">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-mono font-bold px-3 py-1 bg-slate-100 rounded-lg text-slate-500 shadow-sm border border-slate-200">
                                #{ticket.ticket_number || (ticket._id ? ticket._id.toString().slice(-6).toUpperCase() : (ticket.id ? ticket.id.toString().slice(-6).toUpperCase() : 'TKT'))}
                            </span>
                            <Badge variant="outline" className={`${getPriorityColor(ticket.priority)} border font-semibold px-3 py-1 rounded-lg`}>
                                {ticket.priority} Priority
                            </Badge>
                        </div>
                        <Badge className={`${getStatusColor(ticket.status)} px-5 py-1.5 rounded-full font-bold shadow-md`}>
                            {ticket.status}
                        </Badge>
                    </div>
                    <DialogTitle className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight mb-2">{ticket.title}</DialogTitle>
                </DialogHeader>

                <Separator />

                <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30">
                    <div className="max-w-2xl mx-auto space-y-8">
                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 relative group transition-all hover:shadow-md">
                            <div className="flex items-center gap-3 mb-6 underline underline-offset-8 decoration-blue-100 decoration-4">
                                <Avatar className="h-10 w-10 border-2 border-slate-50 shadow-sm">
                                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold">
                                        {currentUser.full_name?.substring(0, 2).toUpperCase() || "CU"}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <h4 className="text-sm font-bold text-slate-900 leading-none mb-1">{currentUser.full_name || "Reporter"}</h4>
                                    <p className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {ticket.createdAt ? format(new Date(ticket.createdAt), "MMMM d, yyyy 'at' HH:mm") : "Reported recently"}
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h5 className="text-[11px] font-black tracking-widest text-slate-300 uppercase">Issue Description</h5>
                                <p className="text-base text-slate-600 leading-relaxed whitespace-pre-wrap font-medium">
                                    {ticket.description}
                                </p>
                            </div>

                            {ticket.attachments && ticket.attachments.length > 0 && (
                                <div className="mt-8 pt-8 border-t border-slate-50">
                                    <h5 className="text-[11px] font-black tracking-widest text-slate-300 uppercase mb-4 flex items-center gap-2">
                                        <Plus className="h-3 w-3 rotate-45" /> Attachments
                                    </h5>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {ticket.attachments.map((url, idx) => (
                                            <a
                                                key={idx}
                                                href={url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="group relative h-24 rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 hover:border-blue-200 hover:shadow-lg transition-all"
                                            >
                                                {url.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                                                    <img src={url} alt="attachment" className="h-full w-full object-cover transition-transform group-hover:scale-110" />
                                                ) : (
                                                    <div className="h-full w-full flex flex-col items-center justify-center gap-1 text-slate-400">
                                                        <FileText className="h-6 w-6" />
                                                        <span className="text-[10px] font-bold px-2 truncate w-full text-center">
                                                            {url.split('/').pop()}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100/50 flex items-start gap-4">
                            <div className="h-10 w-10 rounded-2xl bg-white flex items-center justify-center text-blue-500 shadow-sm shrink-0">
                                <MessageSquare className="h-5 w-5" />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-sm font-bold text-slate-900">Support Under Review</h4>
                                <p className="text-sm text-slate-500 leading-relaxed">
                                    Our support team is currently reviewing your ticket. You will receive an email notification once a resolution is provided or the status is updated to <strong>Resolved</strong>.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-white border-t border-slate-100 flex justify-center">
                    <Button
                        onClick={onClose}
                        className="rounded-2xl px-8 h-12 bg-slate-900 hover:bg-black text-white font-bold transition-all shadow-xl shadow-slate-200"
                    >
                        Close View
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
