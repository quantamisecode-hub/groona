import { groonabackend } from './groonabackend';

export const Project = groonabackend.entities.Project;
export const Task = groonabackend.entities.Task;
export const Comment = groonabackend.entities.Comment;
export const Activity = groonabackend.entities.Activity;
export const Notification = groonabackend.entities.Notification;
export const Timesheet = groonabackend.entities.Timesheet;
export const RecurringTask = groonabackend.entities.RecurringTask;
export const UserGroup = groonabackend.entities.UserGroup;
export const UserGroupMembership = groonabackend.entities.UserGroupMembership;
export const Sprint = groonabackend.entities.Sprint;
export const ProjectTemplate = groonabackend.entities.ProjectTemplate;
export const ProjectFile = groonabackend.entities.ProjectFile;
export const Document = groonabackend.entities.Document;
export const ChatMessage = groonabackend.entities.ChatMessage;
export const UserPresence = groonabackend.entities.UserPresence;
export const Tenant = groonabackend.entities.Tenant;
export const AuditLog = groonabackend.entities.AuditLog;
export const Workspace = groonabackend.entities.Workspace;
export const UserProfile = groonabackend.entities.UserProfile;
export const WorkLocation = groonabackend.entities.WorkLocation;
export const ClockEntry = groonabackend.entities.ClockEntry;
export const Ticket = groonabackend.entities.Ticket;
export const TicketComment = groonabackend.entities.TicketComment;
export const OTPVerification = groonabackend.entities.OTPVerification;

// --- ADDED MISSING EXPORTS ---
export const Leave = groonabackend.entities.Leave;
export const LeaveType = groonabackend.entities.LeaveType;
export const LeaveBalance = groonabackend.entities.LeaveBalance;
export const UserPermission = groonabackend.entities.UserPermission;
export const CompOffCredit = groonabackend.entities.CompOffCredit;
export const ReportConfig = groonabackend.entities.ReportConfig;

// Auth SDK export
export const User = groonabackend.auth;

