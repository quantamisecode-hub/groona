import { useState, useMemo } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  AlertTriangle,
  Clock,
  Sparkles,
  Search,
  CheckCircle2,
  Target,
  Activity,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Filter,
  AlertCircle,
  LayoutGrid,
  PieChart,
  ArrowUpRight,
  BarChart3,
  Layers,
  Zap
} from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useUser } from "../components/shared/UserContext"; // Import UserContext
import RiskAssessment from "../components/insights/RiskAssessment";
import TimelinePrediction from "../components/insights/TimelinePrediction";
import ProjectReport from "../components/insights/ProjectReport";
import AskAIInsights from "../components/insights/AskAIInsights";
import ProjectDataTable from "../components/insights/ProjectDataTable";
import TaskDetailDialog from "../components/tasks/TaskDetailDialog";
import { cn } from "@/lib/utils";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { notificationService } from "@/components/shared/notificationService";

export default function ProjectInsights() {
  const { user: currentUser, effectiveTenantId } = useUser();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || "overview"; // Changed from "project_list" to "overview" to match existing tab
  const initialProjectId = searchParams.get('projectId') || null;

  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId);
  const [activeTab, setActiveTab] = useState(initialTab);

  // State for Overview Modal
  const [isOverviewModalOpen, setIsOverviewModalOpen] = useState(false);
  const [overviewModalType, setOverviewModalType] = useState(null); // 'projects', 'critical', 'high', 'medium', 'pending', 'done'
  const [overviewModalPage, setOverviewModalPage] = useState(1);
  const overviewModalItemsPerPage = 5;

  // State for Inline Task Detail Modal
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  const isAdmin = currentUser?.is_super_admin || currentUser?.role === 'admin';

  // 1. Fetch Project Roles (Matches Dashboard Logic & StaleTime)
  const { data: projectRoles = [] } = useQuery({
    queryKey: ['project-user-roles', currentUser?.id],
    queryFn: () => groonabackend.entities.ProjectUserRole.filter({
      user_id: currentUser.id,
      role: 'project_manager'
    }),
    enabled: !!currentUser?.id && !isAdmin,
    staleTime: 5 * 60 * 1000, // Added to match Dashboard
  });

  // 2. Fetch Projects scoped to Tenant (Matches Dashboard Logic & StaleTime)
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return groonabackend.entities.Project.list('-updated_date');
      return groonabackend.entities.Project.filter({ tenant_id: effectiveTenantId }, '-updated_date');
    },
    enabled: !!currentUser,
    staleTime: 2 * 60 * 1000, // Added to match Dashboard
  });

  // 3. Fetch Tasks scoped to Tenant (Matches Dashboard Logic & StaleTime)
  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return groonabackend.entities.Task.list('-updated_date');
      return groonabackend.entities.Task.filter({ tenant_id: effectiveTenantId }, '-updated_date');
    },
    enabled: !!currentUser,
    staleTime: 2 * 60 * 1000, // Added to match Dashboard
  });

  // 4. Fetch Stories scoped to Tenant (for accurate progress calculation)
  const { data: stories = [] } = useQuery({
    queryKey: ['stories', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return groonabackend.entities.Story.list();
      return groonabackend.entities.Story.filter({ tenant_id: effectiveTenantId });
    },
    enabled: !!currentUser,
    staleTime: 5 * 60 * 1000,
  });

  // 4a. Fetch Sprints scoped to Tenant (for accurate velocity calculation)
  const { data: sprints = [] } = useQuery({
    queryKey: ['sprints', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return groonabackend.entities.Sprint.list();
      return groonabackend.entities.Sprint.filter({ tenant_id: effectiveTenantId });
    },
    enabled: !!currentUser,
    staleTime: 5 * 60 * 1000,
  });

  // 5. Fetch Activities scoped to Tenant
  const { data: activities = [] } = useQuery({
    queryKey: ['all-activities', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return groonabackend.entities.Activity.list('-created_date', 100);
      return groonabackend.entities.Activity.filter({ tenant_id: effectiveTenantId }, '-created_date', 100);
    },
    enabled: !!currentUser,
    staleTime: 1 * 60 * 1000,
  });

  // 6. Fetch Impediments scoped to Tenant
  const { data: impedimentsData = [], isLoading: impedimentsLoading } = useQuery({
    queryKey: ['impediments', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return groonabackend.entities.Impediment.list('-created_date');
      return groonabackend.entities.Impediment.filter({ tenant_id: effectiveTenantId }, '-created_date');
    },
    enabled: !!currentUser,
    staleTime: 2 * 60 * 1000,
  });

  // 5. Calculate Accessible Projects & Tasks with Role-Based Restrictions
  const isRestrictedViewer = currentUser && !currentUser.is_super_admin && currentUser.role === 'member' && currentUser.custom_role === 'viewer';

  const { accessibleProjects, accessibleTasks, accessibleStories, accessibleActivities, accessibleImpediments } = useMemo(() => {
    if (!currentUser) return { accessibleProjects: [], accessibleTasks: [], accessibleStories: [], accessibleActivities: [], accessibleImpediments: [] };

    const userEmail = currentUser.email?.toLowerCase();
    const userId = (currentUser.id || currentUser._id || '').toString();
    const userName = (currentUser.full_name || currentUser.name || '').toLowerCase();

    // A. Base Task Filtering
    let filteredTasks = tasks;
    if (isRestrictedViewer) {
      filteredTasks = tasks.filter(t => {
        const taskAssignees = Array.isArray(t.assigned_to) ? t.assigned_to : (t.assigned_to ? [t.assigned_to] : []);
        return taskAssignees.some(assignee => {
          const email = typeof assignee === 'string' ? assignee : assignee?.email;
          return email?.toLowerCase() === userEmail;
        });
      });
    }

    // B. Base Project Filtering
    const projectIdsWithAssignedTasks = new Set(filteredTasks.map(t => t.project_id));

    // Find projects where user is involved in any impediment (Broadened)
    const projectIdsWithUserImpediments = new Set(
      (impedimentsData || []).filter(imp => {
        const fields = [
          imp.reported_by,
          imp.reported_by_name,
          imp.assigned_to,
          imp.assigned_to_name,
          imp.project_manager_id,
          imp.project_manager_name
        ];
        return fields.some(f => {
          if (!f) return false;
          const val = f.toString().toLowerCase();
          // Similarity check: email/ID can be part of the field (e.g. name + email)
          return (userEmail && val.includes(userEmail)) ||
            (userId && (val.includes(userId.toLowerCase()) || userId.toLowerCase().includes(val))) ||
            (userName && val.includes(userName));
        });
      }).map(imp => imp.project_id)
    );

    const filteredProjects = projects.filter(p => {
      if (isAdmin) return true;

      // If restricted viewer, show projects where they have assignments OR are involved in impediments
      if (isRestrictedViewer) {
        return projectIdsWithAssignedTasks.has(p.id) || projectIdsWithUserImpediments.has(p.id);
      }

      const isOwner = p.owner === currentUser.email;
      const isTeamMember = p.team_members?.some(m => m.email === currentUser.email);
      const isProjectManager = projectRoles?.some(r => r.project_id === p.id);
      const isInvolvedInImpediment = projectIdsWithUserImpediments.has(p.id);

      return isOwner || isTeamMember || isProjectManager || isInvolvedInImpediment;
    });

    const finalProjectIds = new Set(filteredProjects.map(p => p.id));

    // C. Final Task Filtering
    const finalTasks = filteredTasks.filter(t => finalProjectIds.has(t.project_id));

    // D. Final Entities
    const finalStories = stories.filter(s => finalProjectIds.has(s.project_id));
    const finalActivities = activities.filter(a => finalProjectIds.has(a.project_id));

    // F. Final Impediments (RBAC: Reported by him, Assigned to him, or Manager)
    const finalImpediments = (impedimentsData || []).filter(imp => {
      // If Admin, show everything scoped to the tenant (already fetched with tenant_id filter)
      // Do NOT limit to finalProjectIds — archived/deleted projects would drop impediments
      if (isAdmin) return true;

      const fields = [
        imp.reported_by,
        imp.reported_by_name,
        imp.assigned_to,
        imp.assigned_to_name,
        imp.project_manager_id,
        imp.project_manager_name
      ];

      // Check if user is the reporter, resolver, or manager
      const isDirectlyInvolved = fields.some(f => {
        if (!f) return false;
        const val = f.toString().toLowerCase();
        // Similarity check: email/ID can be part of the field
        return (userEmail && val.includes(userEmail)) ||
          (userId && (val.includes(userId.toLowerCase()) || userId.toLowerCase().includes(val))) ||
          (userName && val.includes(userName));
      });

      if (isDirectlyInvolved) return true;

      // Check if user is the assignee of the related task (Member who got reported/affected)
      if (imp.task_id) {
        const relatedTask = tasks.find(t => String(t.id || t._id) === String(imp.task_id));
        if (relatedTask) {
          const taskAssignees = Array.isArray(relatedTask.assigned_to) ? relatedTask.assigned_to : (relatedTask.assigned_to ? [relatedTask.assigned_to] : []);
          return taskAssignees.some(assignee => {
            const email = (typeof assignee === 'string' ? assignee : assignee?.email)?.toLowerCase();
            const id = (typeof assignee === 'string' ? assignee : (assignee?.id || assignee?._id))?.toString()?.toLowerCase();

            return (userEmail && email && (email.includes(userEmail) || userEmail.includes(email))) ||
              (userId && id && (id.includes(userId.toLowerCase()) || userId.toLowerCase().includes(id)));
          });
        }
      }

      return false;
    });

    return {
      accessibleProjects: filteredProjects,
      accessibleTasks: finalTasks,
      accessibleStories: finalStories,
      accessibleActivities: finalActivities,
      accessibleImpediments: finalImpediments
    };
  }, [projects, tasks, stories, activities, impedimentsData, currentUser, isAdmin, isRestrictedViewer, projectRoles]);

  // 8. Calculate live progress for each project (Story Point Based)
  const projectProgressMap = useMemo(() => {
    const map = {};
    accessibleProjects.forEach(project => {
      const projectStories = accessibleStories.filter(s => s.project_id === project.id);
      const projectTasks = accessibleTasks.filter(t => t.project_id === project.id);

      if (projectStories.length === 0) {
        map[project.id] = project.progress || 0;
        return;
      }

      const completedStoryPoints = projectStories
        .filter(s => {
          const status = (s.status || '').toLowerCase();
          return status === 'done' || status === 'completed';
        })
        .reduce((sum, story) => sum + (Number(story.story_points) || 0), 0);

      const totalStoryPoints = projectStories.reduce((sum, story) => sum + (Number(story.story_points) || 0), 0);
      map[project.id] = totalStoryPoints === 0 ? 0 : Math.round((completedStoryPoints / totalStoryPoints) * 100);
    });
    return map;
  }, [accessibleProjects, accessibleStories, accessibleTasks]);

  // 9. Calculate Velocity for each project (Sprint Story Point logic from VelocityTracker)
  const projectVelocityMap = useMemo(() => {
    const map = {};
    accessibleProjects.forEach(project => {
      // Get sprints for this project
      const projectSprints = sprints.filter(s => String(s.project_id) === String(project.id));

      // Include ALL sprints (active, planned, completed, etc.) as requested to sum up velocity
      const validSprints = projectSprints;

      if (validSprints.length === 0) {
        map[project.id] = "0.00";
        return;
      }

      // Calculate velocity for each valid sprint
      const sprintVelocities = validSprints.map(sprint => {
        const sprintStories = stories.filter(s => {
          const storySprintId = s.sprint_id?.id || s.sprint_id?._id || s.sprint_id;
          return String(storySprintId) === String(sprint.id);
        });

        // Calculate completed points using partial completion
        return sprintStories.reduce((sum, story) => {
          const storyId = story.id || story._id;
          const storyStatus = (story.status || '').toLowerCase();
          const storyPoints = Number(story.story_points) || 0;

          if (storyStatus === 'done' || storyStatus === 'completed') {
            return sum + storyPoints;
          }

          const storyTasks = tasks.filter(t => {
            const taskStoryId = t.story_id?.id || t.story_id?._id || t.story_id;
            return String(taskStoryId) === String(storyId);
          });

          if (storyTasks.length === 0) {
            return sum;
          }

          const completedTasksCount = storyTasks.filter(t => t.status === 'completed').length;
          const totalTasksCount = storyTasks.length;
          const taskCompletionPercentage = totalTasksCount > 0 ? (completedTasksCount / totalTasksCount) : 0;

          return sum + (storyPoints * taskCompletionPercentage);
        }, 0);
      });

      // We calculate average velocity from valid (active locked or completed) sprints
      // Or we can just sum up the last sprint if we want "Live Velocity", but let's just 
      // take the average across applicable sprints or the latest sprint.
      // E.g., recent sprint velocity as Live Velocity:
      const totalVelocity = sprintVelocities.reduce((sum, v) => sum + v, 0);
      map[project.id] = Number(totalVelocity).toFixed(2);
    });
    return map;
  }, [accessibleProjects, sprints, stories, tasks]);


  // 10. Calculate Blockers for each project (Aligned with Dashboard Bottleneck logic: Review + Blocked)
  const projectBlockersData = useMemo(() => {
    const map = {};
    accessibleProjects.forEach(project => {
      const projectImpediments = accessibleImpediments.filter(imp => imp.project_id === project.id);
      const openImpediments = projectImpediments.filter(imp => imp.status === 'open').length;
      const inProgressImpediments = projectImpediments.filter(imp => imp.status === 'in_progress').length;

      map[project.id] = {
        total: openImpediments + inProgressImpediments,
        blocked: openImpediments,
        review: inProgressImpediments
      };
    });
    return map;
  }, [accessibleProjects, accessibleImpediments]);

  const selectedProject = accessibleProjects.find(p => p.id === selectedProjectId);
  const selectedProjectTasks = accessibleTasks.filter(t => t.project_id === selectedProjectId);
  const selectedProjectStories = useMemo(() => accessibleStories.filter(s => s.project_id === selectedProjectId), [accessibleStories, selectedProjectId]);


  const analyticsSummary = useMemo(() => {
    // Top-level velocity: sum of all accessible projects' velocities to match the list tabs
    let totalVelocity = 0;

    accessibleProjects.forEach(project => {
      const v = parseFloat(projectVelocityMap[project.id]);
      if (!isNaN(v)) {
        totalVelocity += v;
      }
    });

    const overallVelocity = totalVelocity.toFixed(2);

    return {
      activeProjects: accessibleProjects.filter(p => p.status === 'active').length,
      critical: accessibleTasks.filter(t => t.status !== 'completed' && (t.priority === 'urgent' || t.priority === 'critical')).length,
      high: accessibleTasks.filter(t => t.status !== 'completed' && t.priority === 'high').length,
      medium: accessibleTasks.filter(t => t.status !== 'completed' && t.priority === 'medium').length,
      pendingTasks: accessibleTasks.filter(t => t.status === 'todo').length,
      doneTasks: accessibleTasks.filter(t => t.status === 'completed').length,
      velocity: overallVelocity,
      bottlenecks: accessibleImpediments.filter(imp => imp.status !== 'resolved').length
    };
  }, [accessibleProjects, accessibleTasks, accessibleImpediments, projectVelocityMap]);

  const handleOpenOverviewModal = (type) => {
    setOverviewModalType(type);
    setOverviewModalPage(1);
    setIsOverviewModalOpen(true);
  };

  const getOverviewModalData = () => {
    if (overviewModalType === 'projects') {
      return accessibleProjects.filter(p => p.status === 'active').map(p => {
        const pTasks = accessibleTasks.filter(t => t.project_id === p.id);
        const pendingCount = pTasks.filter(t => t.status !== 'completed').length;
        const criticalCount = pTasks.filter(t => t.status !== 'completed' && (t.priority === 'urgent' || t.priority === 'critical')).length;
        return { ...p, pendingCount, criticalCount };
      });
    }

    let filtered = [];
    if (overviewModalType === 'critical') filtered = accessibleTasks.filter(t => t.status !== 'completed' && (t.priority === 'urgent' || t.priority === 'critical'));
    else if (overviewModalType === 'high') filtered = accessibleTasks.filter(t => t.status !== 'completed' && t.priority === 'high');
    else if (overviewModalType === 'medium') filtered = accessibleTasks.filter(t => t.status !== 'completed' && t.priority === 'medium');
    else if (overviewModalType === 'pending') filtered = accessibleTasks.filter(t => t.status === 'todo');
    else if (overviewModalType === 'done') filtered = accessibleTasks.filter(t => t.status === 'completed');

    return filtered.map(task => {
      const p = accessibleProjects.find(pr => pr.id === task.project_id);
      return { ...task, projectName: p ? p.name : 'Unknown' };
    });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const overviewModalData = useMemo(() => getOverviewModalData(), [overviewModalType, accessibleTasks, accessibleProjects]);
  const overviewModalTotalPages = Math.ceil(overviewModalData.length / overviewModalItemsPerPage);
  const overviewModalStartIndex = (overviewModalPage - 1) * overviewModalItemsPerPage;
  const paginatedOverviewData = overviewModalData.slice(overviewModalStartIndex, overviewModalStartIndex + overviewModalItemsPerPage);

  const isDataLoading = projectsLoading || tasksLoading;

  if (isDataLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f8f9fa] w-full">
        <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mb-5" />
        <h3 className="text-lg font-bold text-slate-900 tracking-tight">Gathering Insights</h3>
        <p className="text-sm text-slate-500 font-medium animate-pulse mt-1">Analyzing cross-project metrics...</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
      >
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <Sparkles className="h-7 w-7 text-purple-600 relative z-10" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-normal leading-none mb-1">Project Insights</h1>
            <p className="text-slate-500 text-sm font-medium">AI-powered predictive analytics & team performance metrics</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Metric Card 1: Active Projects */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          onClick={() => analyticsSummary.activeProjects > 0 && handleOpenOverviewModal('projects')}
          className={cn(
            "group relative overflow-hidden p-6 bg-white border border-slate-200 rounded-[32px] shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 hover:border-indigo-400 transition-all duration-500",
            analyticsSummary.activeProjects > 0 && "cursor-pointer active:scale-[0.98]"
          )}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-bl-[4rem] -z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <div className="h-12 w-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform duration-500">
                <LayoutGrid className="h-6 w-6" strokeWidth={2.5} />
              </div>
              <TrendingUp className="h-5 w-5 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 group-hover:text-indigo-600 transition-colors">Active Projects</h3>
            <p className="text-5xl font-black text-slate-900 tracking-normal">{analyticsSummary.activeProjects}</p>
          </div>
        </motion.div>

        {/* Metric Card 2: Velocity */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="group relative overflow-hidden p-6 bg-white border border-slate-200 rounded-[32px] shadow-sm hover:shadow-xl hover:shadow-emerald-500/5 hover:border-emerald-400 transition-all duration-500"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50/50 rounded-bl-[4rem] -z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform duration-500">
                <Activity className="h-6 w-6" strokeWidth={2.5} />
              </div>
              <TrendingUp className="h-5 w-5 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 group-hover:text-emerald-600 transition-colors">Velocity</h3>
            <div className="flex items-baseline gap-2">
              <p className="text-5xl font-black text-slate-900 tracking-normal">{analyticsSummary.velocity}</p>
              <span className="text-sm font-bold text-slate-400 uppercase tracking-wider group-hover:text-emerald-500">pts</span>
            </div>
          </div>
        </motion.div>

        {/* Metric Card 3: Bottlenecks */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="group relative overflow-hidden p-6 bg-white border border-slate-200 rounded-[32px] shadow-sm hover:shadow-xl hover:shadow-amber-500/5 hover:border-amber-400 transition-all duration-500"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50/50 rounded-bl-[4rem] -z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <div className="h-12 w-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform duration-500">
                <AlertCircle className="h-6 w-6" strokeWidth={2.5} />
              </div>
              <div className="px-2 py-0.5 rounded-full bg-amber-100 text-[10px] font-black text-amber-600 uppercase tracking-normal">Needs Attention</div>
            </div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 group-hover:text-amber-600 transition-colors">Blockers & Bottlenecks</h3>
            <div className="flex items-baseline gap-2">
              <p className="text-5xl font-black text-slate-900 tracking-normal">{analyticsSummary.bottlenecks}</p>
              <span className="text-sm font-bold text-slate-400 uppercase tracking-wider group-hover:text-amber-500">waiting</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Unified Task Overview Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="p-8 bg-white border border-slate-200 rounded-[40px] shadow-sm relative overflow-hidden group">
          {/* Subtle decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50/50 rounded-full blur-3xl -z-10 -mr-20 -mt-20 group-hover:bg-indigo-50/50 transition-colors duration-1000" />

          <div className="relative">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:border-indigo-200 transition-colors">
                  <Filter className="h-5 w-5 text-slate-500 group-hover:text-indigo-500" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 tracking-normal">Task Details Overall</h3>
              </div>
              <div className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Full Lifecycle Overview</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { label: 'Critical', value: analyticsSummary.critical, icon: AlertTriangle, color: 'text-rose-500', bg: 'bg-rose-50', border: 'hover:border-rose-200', handler: 'critical' },
                { label: 'High', value: analyticsSummary.high, icon: AlertCircle, color: 'text-orange-500', bg: 'bg-orange-50', border: 'hover:border-orange-200', handler: 'high' },
                { label: 'Medium', value: analyticsSummary.medium, icon: Activity, color: 'text-amber-500', bg: 'bg-amber-50', border: 'hover:border-amber-200', handler: 'medium' },
                { label: 'Pending', value: analyticsSummary.pendingTasks, icon: Clock, color: 'text-blue-500', bg: 'bg-blue-50', border: 'hover:border-blue-200', handler: 'pending' },
                { label: 'Done', value: analyticsSummary.doneTasks, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'hover:border-emerald-200', handler: 'done' },
              ].map((item, idx) => (
                <div
                  key={item.label}
                  onClick={() => item.value > 0 && handleOpenOverviewModal(item.handler)}
                  className={cn(
                    "flex flex-col p-5 rounded-3xl border border-slate-200/60 bg-white shadow-sm transition-all duration-300 group/card",
                    item.value > 0 ? "cursor-pointer hover:shadow-xl hover:shadow-slate-200/40 " + item.border : "opacity-60"
                  )}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center group-hover/card:scale-110 transition-transform", item.bg)}>
                      <item.icon className={cn("h-5 w-5", item.color)} strokeWidth={2.5} />
                    </div>
                    <div className="h-6 min-w-[24px] px-2 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-xs font-black text-slate-700">
                      {item.value}
                    </div>
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{item.label}</span>
                  <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (item.value / Math.max(1, accessibleTasks.length)) * 100)}%` }}
                      transition={{ duration: 1, delay: 0.5 + (idx * 0.1) }}
                      className={cn("h-full rounded-full transition-colors", item.color.replace('text-', 'bg-'))}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </motion.div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <div className="flex justify-center sm:justify-start">
          <TabsList className="bg-slate-50 p-1.5 rounded-full border border-slate-200 h-auto gap-1 overflow-x-auto hide-scrollbar sm:overflow-visible flex-wrap sm:flex-nowrap">
            {[
              { value: "project_list", label: "Project List" },
              { value: "overview", label: "Overview" },
              { value: "risk", label: "Risk Assessment" },
              { value: "velocity", label: "Velocity" },
              { value: "blockers", label: "Blockers" },
              { value: "timeline", label: "Timeline Prediction" },
              { value: "reports", label: "Reports" },
              { value: "ai", label: "Ask AI" },
            ].map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="rounded-full px-5 py-2 text-[11px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-800 data-[state=active]:bg-white data-[state=active]:text-slate-900 border-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:shadow-sm transition-all duration-300 whitespace-nowrap"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <motion.div
          key={activeTab}
          initial={{ opacity: 0, scale: 0.99, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full"
        >
          <TabsContent value="project_list" className="mt-0 outline-none">
            <ProjectDataTable
              projects={accessibleProjects}
              tasks={accessibleTasks}
              onTaskClick={(taskId) => setSelectedTaskId(taskId)}
            />
          </TabsContent>
        </motion.div>

        <TabsContent value="overview" className="mt-0 outline-none">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
          >
            <Card className="p-10 bg-white border border-slate-200 rounded-[40px] shadow-sm">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <ProjectAnalyticsOverview tasks={accessibleTasks} projects={accessibleProjects} />
                <TasksByStatus tasks={accessibleTasks} />
              </div>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="velocity" className="mt-0 outline-none">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <VelocityAnalytics projects={accessibleProjects} velocityMap={projectVelocityMap} />
          </motion.div>
        </TabsContent>

        <TabsContent value="blockers" className="mt-0 outline-none">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <BlockerInsights
              projects={accessibleProjects}
              tasks={accessibleTasks}
              blockersData={projectBlockersData}
              impediments={accessibleImpediments}
            />
          </motion.div>
        </TabsContent>

        <TabsContent value="risk" className="mt-0 outline-none">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
          >
            <Card className="py-3 pr-3 pl-6 bg-white border border-slate-200 rounded-full shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-[17px] font-bold text-slate-900 tracking-tight mb-0.5">Risk Assessment</h2>
                  <p className="text-xs text-slate-500 font-medium whitespace-nowrap">Analyze potential bottlenecks and high-risk tasks.</p>
                </div>
                <div className="w-full sm:w-[320px]">
                  <Select value={selectedProjectId || ""} onValueChange={setSelectedProjectId}>
                    <SelectTrigger className="w-full h-auto min-h-[48px] py-1 bg-white border border-slate-200/60 hover:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all rounded-full shadow-none px-4">
                      <SelectValue placeholder="Choose a project..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-slate-200 shadow-xl p-2 max-h-[400px]">
                      {accessibleProjects.map((project) => (
                        <SelectItem key={project.id} value={project.id} className="rounded-xl py-3 px-4 focus:bg-slate-50 transition-colors cursor-pointer mb-1 last:mb-0">
                          <div className="flex items-center gap-4">
                            <Avatar className="h-10 w-10 border border-slate-100 shadow-sm rounded-xl bg-white">
                              <AvatarImage src={project.logo_url} className="object-cover" />
                              <AvatarFallback className="bg-gradient-to-br from-indigo-50 to-purple-50 text-indigo-700 font-bold tracking-wider text-xs rounded-xl">
                                {project.name.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col gap-0.5 text-left">
                              <span className="font-bold text-slate-900 text-[15px] tracking-tight">{project.name}</span>
                              <div className="flex items-center gap-2 text-[13px] font-medium text-slate-500 mt-1">
                                <Badge variant="outline" className={cn(
                                  "text-[10px] uppercase font-bold tracking-wider px-2 py-0 border-0 rounded-md",
                                  project.status === 'active' ? "bg-emerald-50 text-emerald-700" :
                                    project.status === 'completed' ? "bg-blue-50 text-blue-700" :
                                      "bg-slate-100 text-slate-600"
                                )}>
                                  {project.status || 'PLANNING'}
                                </Badge>
                                <span>•</span>
                                <span>{projectProgressMap[project.id] || 0}% Progress</span>
                              </div>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            {selectedProject && (
              <RiskAssessment
                project={selectedProject}
                tasks={selectedProjectTasks}
              />
            )}
          </motion.div>
        </TabsContent>

        <TabsContent value="timeline" className="mt-0 outline-none">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
          >
            <Card className="py-3 pr-3 pl-6 bg-white border border-slate-200 rounded-full shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-[17px] font-bold text-slate-900 tracking-tight mb-0.5">Timeline Prediction</h2>
                  <p className="text-xs text-slate-500 font-medium whitespace-nowrap">Forecast estimated completion dates using AI models.</p>
                </div>
                <div className="w-full sm:w-[320px]">
                  <Select value={selectedProjectId || ""} onValueChange={setSelectedProjectId}>
                    <SelectTrigger className="w-full h-auto min-h-[48px] py-1 bg-white border border-slate-200/60 hover:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all rounded-full shadow-none px-4">
                      <SelectValue placeholder="Choose a project..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-slate-200 shadow-xl p-2 max-h-[400px]">
                      {accessibleProjects.map((project) => (
                        <SelectItem key={project.id} value={project.id} className="rounded-xl py-3 px-4 focus:bg-slate-50 transition-colors cursor-pointer mb-1 last:mb-0">
                          <div className="flex items-center gap-4">
                            <Avatar className="h-10 w-10 border border-slate-100 shadow-sm rounded-xl bg-white">
                              <AvatarImage src={project.logo_url} className="object-cover" />
                              <AvatarFallback className="bg-gradient-to-br from-indigo-50 to-purple-50 text-indigo-700 font-bold tracking-wider text-xs rounded-xl">
                                {project.name.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col gap-0.5 text-left">
                              <span className="font-bold text-slate-900 text-[15px] tracking-tight">{project.name}</span>
                              <div className="flex items-center gap-2 text-[13px] font-medium text-slate-500 mt-1">
                                <Badge variant="outline" className={cn(
                                  "text-[10px] uppercase font-bold tracking-wider px-2 py-0 border-0 rounded-md",
                                  project.status === 'active' ? "bg-emerald-50 text-emerald-700" :
                                    project.status === 'completed' ? "bg-blue-50 text-blue-700" :
                                      "bg-slate-100 text-slate-600"
                                )}>
                                  {project.status || 'PLANNING'}
                                </Badge>
                                <span>•</span>
                                <span>{projectProgressMap[project.id] || 0}% Progress</span>
                              </div>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            {selectedProject && (
              <TimelinePrediction
                project={selectedProject}
                tasks={selectedProjectTasks}
                activities={accessibleActivities.filter(a => a.project_id === selectedProjectId)}
              />
            )}
          </motion.div>
        </TabsContent>

        <TabsContent value="reports" className="mt-0 outline-none">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
          >
            <Card className="py-3 pr-3 pl-6 bg-white border border-slate-200 rounded-full shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-[17px] font-bold text-slate-900 tracking-tight mb-0.5">Project Reports</h2>
                  <p className="text-xs text-slate-500 font-medium whitespace-nowrap">Generate comprehensive analytics reports for your projects.</p>
                </div>
                <div className="w-full sm:w-[320px]">
                  <Select value={selectedProjectId || ""} onValueChange={setSelectedProjectId}>
                    <SelectTrigger className="w-full h-auto min-h-[48px] py-1 bg-white border border-slate-200/60 hover:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all rounded-full shadow-none px-4">
                      <SelectValue placeholder="Choose a project..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-slate-200 shadow-xl p-2 max-h-[400px]">
                      {accessibleProjects.map((project) => (
                        <SelectItem key={project.id} value={project.id} className="rounded-xl py-3 px-4 focus:bg-slate-50 transition-colors cursor-pointer mb-1 last:mb-0">
                          <div className="flex items-center gap-4">
                            <Avatar className="h-10 w-10 border border-slate-100 shadow-sm rounded-xl bg-white">
                              <AvatarImage src={project.logo_url} className="object-cover" />
                              <AvatarFallback className="bg-gradient-to-br from-indigo-50 to-purple-50 text-indigo-700 font-bold tracking-wider text-xs rounded-xl">
                                {project.name.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col gap-0.5 text-left">
                              <span className="font-bold text-slate-900 text-[15px] tracking-tight">{project.name}</span>
                              <div className="flex items-center gap-2 text-[13px] font-medium text-slate-500 mt-1">
                                <Badge variant="outline" className={cn(
                                  "text-[10px] uppercase font-bold tracking-wider px-2 py-0 border-0 rounded-md",
                                  project.status === 'active' ? "bg-emerald-50 text-emerald-700" :
                                    project.status === 'completed' ? "bg-blue-50 text-blue-700" :
                                      "bg-slate-100 text-slate-600"
                                )}>
                                  {project.status || 'PLANNING'}
                                </Badge>
                                <span>•</span>
                                <span>{projectProgressMap[project.id] || 0}% Progress</span>
                              </div>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            {selectedProject && (
              <ProjectReport
                project={selectedProject}
                tasks={selectedProjectTasks}
                stories={selectedProjectStories}
                activities={accessibleActivities.filter(a => a.project_id === selectedProjectId)}
              />
            )}
          </motion.div>
        </TabsContent>

        <TabsContent value="ai" className="mt-0 outline-none">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <AskAIInsights
              projects={accessibleProjects}
              tasks={accessibleTasks}
              activities={accessibleActivities}
            />
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Overview Modal Dialog */}
      <Dialog open={isOverviewModalOpen} onOpenChange={setIsOverviewModalOpen}>
        <DialogContent className="sm:max-w-[750px] max-h-[90vh] flex flex-col p-0 border border-slate-200 shadow-2xl rounded-[32px] overflow-hidden">
          <DialogHeader className="p-4 pb-3 border-b border-slate-200 bg-slate-50/50">
            <DialogTitle className="flex items-center gap-2 text-xl">
              {overviewModalType === 'projects' ? (
                <span className="capitalize text-slate-800">Active Projects Overall</span>
              ) : (
                <>
                  <span className="capitalize text-slate-800">{overviewModalType} Tasks</span>
                  <span className="text-slate-400 font-normal text-sm">Overall</span>
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 p-4 overflow-y-auto">
            {paginatedOverviewData.length === 0 ? (
              <div className="py-12 text-center text-slate-500 flex flex-col items-center">
                <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                  <Search className="h-5 w-5 text-slate-400" />
                </div>
                <p>No data found in this category.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {overviewModalType === 'projects' ? (
                  paginatedOverviewData.map((project) => (
                    <div key={project.id} className="group p-4 rounded-xl border border-slate-200 bg-white hover:border-indigo-200 hover:shadow-lg transition-all cursor-pointer flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12 border-2 border-slate-100 shadow-sm group-hover:border-indigo-100 transition-colors">
                          <AvatarImage src={project.logo_url} className="object-cover" />
                          <AvatarFallback className="bg-gradient-to-br from-indigo-50 to-purple-50 text-indigo-700 font-bold tracking-wider">
                            {project.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors text-base flex items-center gap-2">
                            {project.name}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className={cn(
                              "text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 border-0",
                              project.status === 'active' ? "bg-emerald-50 text-emerald-700" :
                                project.status === 'completed' ? "bg-blue-50 text-blue-700" :
                                  "bg-slate-50 text-slate-700"
                            )}>
                              {project.status === 'active' ? <Activity className="h-3 w-3 mr-1" /> : null}
                              {project.status}
                            </Badge>
                            <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                              <Target className="h-3 w-3" />
                              {projectProgressMap[project.id] || 0}% Done
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center justify-center bg-slate-50 rounded-lg px-3 py-1.5 min-w-[70px] border border-slate-100/50">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Pending</span>
                          <span className="font-black text-slate-700 text-sm">{project.pendingCount || 0}</span>
                        </div>
                        <div className="flex flex-col items-center justify-center bg-red-50/50 rounded-lg px-3 py-1.5 min-w-[70px] border border-red-100/50">
                          <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-0.5">Critical</span>
                          <span className="font-black text-red-600 text-sm">{project.criticalCount || 0}</span>
                        </div>
                        <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-indigo-400 transition-colors ml-1" />
                      </div>
                    </div>
                  ))
                ) : (
                  paginatedOverviewData.map((task) => (
                    <div
                      key={task.id}
                      className="group relative p-4 rounded-xl border border-slate-200 bg-white hover:border-indigo-200 hover:shadow-lg transition-all cursor-pointer overflow-hidden"
                      onClick={() => setSelectedTaskId(task.id)}
                    >
                      <div className="absolute top-0 left-0 w-1 h-full bg-slate-200 group-hover:bg-indigo-400 transition-colors" />

                      <div className="flex items-start justify-between gap-4 pl-2">
                        <div className="space-y-2.5 w-full pr-6">

                          {/* Top Row: Project Tag & Priority */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-indigo-50/50 text-indigo-700 border-indigo-100 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5">
                                {task.projectName || "Unknown Project"}
                              </Badge>
                            </div>

                            {task.priority && (
                              <div className={cn(
                                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold tracking-wide uppercase",
                                task.priority === 'urgent' ? "bg-red-50 text-red-700" :
                                  task.priority === 'high' ? "bg-orange-50 text-orange-700" :
                                    task.priority === 'medium' ? "bg-amber-50 text-amber-700" :
                                      "bg-slate-50 text-slate-600"
                              )}>
                                {task.priority === 'urgent' && <AlertTriangle className="h-3.5 w-3.5" />}
                                {task.priority === 'high' && <AlertCircle className="h-3.5 w-3.5" />}
                                {task.priority === 'medium' && <Activity className="h-3.5 w-3.5" />}
                                {task.priority === 'low' && <Target className="h-3.5 w-3.5" />}
                                {task.priority}
                              </div>
                            )}
                          </div>

                          {/* Title */}
                          <h4 className="font-bold text-slate-900 text-base leading-snug group-hover:text-indigo-600 transition-colors">
                            {task.title}
                          </h4>

                          {/* Bottom Row: Status & Date */}
                          <div className="flex items-center gap-3 pt-1">
                            <Badge
                              variant="secondary"
                              className={cn(
                                "capitalize font-semibold text-xs border-0 px-2.5 py-0.5",
                                task.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                  task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                    task.status === 'review' ? 'bg-purple-100 text-purple-700' :
                                      'bg-slate-100 text-slate-700'
                              )}
                            >
                              <div className={cn(
                                "h-1.5 w-1.5 rounded-full mr-1.5 inline-block",
                                task.status === 'completed' ? 'bg-emerald-500' :
                                  task.status === 'in_progress' ? 'bg-blue-500' :
                                    task.status === 'review' ? 'bg-purple-500' :
                                      'bg-slate-400'
                              )} />
                              {task.status.replace('_', ' ')}
                            </Badge>

                            {task.due_date && (
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">
                                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                {format(new Date(task.due_date), 'MMM d, yyyy')}
                              </div>
                            )}
                          </div>

                        </div>

                        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                          <div className="h-8 w-8 rounded-full bg-indigo-50 flex items-center justify-center">
                            <ChevronRight className="h-4 w-4 text-indigo-600" />
                          </div>
                        </div>

                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </ScrollArea>

          {/* Modal Pagination */}
          {overviewModalTotalPages > 1 && (
            <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <p className="text-xs text-slate-500 font-medium">
                Showing {overviewModalStartIndex + 1} to {Math.min(overviewModalStartIndex + overviewModalItemsPerPage, overviewModalData.length)} of {overviewModalData.length} items
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-8 border-slate-200 text-slate-600" onClick={() => setOverviewModalPage(p => Math.max(1, p - 1))} disabled={overviewModalPage === 1}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                </Button>
                <div className="text-xs font-semibold text-slate-700 px-2 border border-slate-200 bg-white h-8 flex items-center justify-center rounded-md min-w-[32px]">
                  {overviewModalPage}
                </div>
                <Button variant="outline" size="sm" className="h-8 border-slate-200 text-slate-600" onClick={() => setOverviewModalPage(p => Math.min(overviewModalTotalPages, p + 1))} disabled={overviewModalPage === overviewModalTotalPages}>
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Inline Task Detail Modal */}
      {selectedTaskId && (
        <TaskDetailDialog
          open={!!selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          taskId={selectedTaskId}
        />
      )}
    </div>
  );
}

// --- Sub-components to fix the ReferenceError and provide Apple-style analytics ---

function ProjectAnalyticsOverview({ tasks = [], projects = [] }) {
  const activeCount = projects.filter(p => p.status === 'active').length;
  const completedCount = projects.filter(p => p.status === 'completed').length;

  return (
    <div className="space-y-10 group/overview">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Platform Summary</h4>
          <h3 className="text-3xl font-black text-slate-900 tracking-normal">Insights Hub</h3>
        </div>
        <div className="h-12 w-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
          <PieChart className="h-6 w-6" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-indigo-500" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Ongoing</span>
          </div>
          <p className="text-4xl font-black text-slate-900">{activeCount}</p>
          <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 w-fit px-2 py-0.5 rounded-full">
            <Activity className="h-3 w-3" />
            <span>Active Live</span>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Settled</span>
          </div>
          <p className="text-4xl font-black text-slate-900">{completedCount}</p>
          <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 w-fit px-2 py-0.5 rounded-full">
            <CheckCircle2 className="h-3 w-3" />
            <span>Archived</span>
          </div>
        </div>
      </div>

      <div className="p-6 bg-slate-50/50 rounded-3xl border border-slate-200 group-hover/overview:border-indigo-200 transition-colors">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Overall Resource Load</span>
          <ArrowUpRight className="h-4 w-4 text-slate-300" />
        </div>
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
            <Layers className="h-5 w-5 text-indigo-500" />
          </div>
          <div>
            <p className="text-xl font-black text-slate-900 leading-none">{tasks.length}</p>
            <p className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-wider text-xs">Lifecycle Managed Tasks</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TasksByStatus({ tasks = [] }) {
  const statuses = [
    { key: 'completed', label: 'Completed', color: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
    { key: 'in_progress', label: 'In Progress', color: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700' },
    { key: 'review', label: 'In Review', color: 'bg-purple-500', bg: 'bg-purple-50', text: 'text-purple-700' },
    { key: 'todo', label: 'Pending', color: 'bg-slate-400', bg: 'bg-slate-50', text: 'text-slate-700' },
    { key: 'blocked', label: 'Blocked', color: 'bg-rose-500', bg: 'bg-rose-50', text: 'text-rose-700' },
  ];

  const counts = statuses.reduce((acc, status) => {
    acc[status.key] = tasks.filter(t => t.status === status.key).length;
    return acc;
  }, {});

  const maxVal = Math.max(...Object.values(counts), 1);

  return (
    <div className="space-y-8">
      <div>
        <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Load Distribution</h4>
        <h3 className="text-3xl font-black text-slate-900 tracking-normal">Task Statuses</h3>
      </div>

      <div className="space-y-5">
        {statuses.map((status) => (
          <div key={status.key} className="space-y-2 group/status">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest">{status.label}</span>
              <span className={cn("text-xs font-black px-2 py-0.5 rounded-lg", status.bg, status.text)}>{counts[status.key]}</span>
            </div>
            <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100/50">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(counts[status.key] / tasks.length) * 100 || 0}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={cn("h-full rounded-full group-hover/status:brightness-110 transition-all", status.color)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VelocityAnalytics({ projects = [], velocityMap = {} }) {
  return (
    <Card className="p-10 bg-white border border-slate-200 rounded-[40px] shadow-sm relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-50/30 rounded-full blur-3xl -z-10 -mr-40 -mt-40 transition-colors duration-1000 group-hover:bg-emerald-50/50" />

      <div className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 border border-emerald-200 shadow-sm">
            <BarChart3 className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-normal">Velocity Performance</h2>
            <p className="text-slate-500 font-medium">Live story point throughput per project</p>
          </div>
        </div>
        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 uppercase tracking-widest font-black text-[10px] px-3 py-1">
          <Zap className="h-3 w-3 mr-1" /> Real-time
        </Badge>
      </div>

      <div className="grid gap-6">
        {projects.length === 0 ? (
          <div className="py-20 text-center text-slate-400">No telemetry data available.</div>
        ) : (
          projects.map(project => {
            const velocity = velocityMap[project.id] || "0.00";
            return (
              <div key={project.id} className="group/item flex items-center justify-between p-6 rounded-3xl bg-slate-50/50 border border-slate-100 hover:border-emerald-200 hover:bg-white hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-300">
                <div className="flex items-center gap-5">
                  <Avatar className="h-14 w-14 rounded-2xl border-2 border-white shadow-md">
                    <AvatarImage src={project.logo_url} />
                    <AvatarFallback className="bg-gradient-to-br from-emerald-50 to-teal-100 text-emerald-700 font-bold uppercase">
                      {project.name.substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="font-bold text-slate-900 text-lg group-hover/item:text-emerald-700 transition-colors">{project.name}</h4>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none block mt-1">Status: {project.status}</span>
                  </div>
                </div>

                <div className="flex items-baseline gap-2 bg-white px-5 py-3 rounded-2xl border border-slate-200/60 shadow-sm group-hover/item:border-emerald-200 group-hover/item:scale-105 transition-all">
                  <span className="text-3xl font-black text-slate-900 tracking-normal">{velocity}</span>
                  <span className="text-xs font-black text-emerald-600 uppercase tracking-widest">PTS</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

function BlockerInsights({ projects = [], tasks = [], blockersData = {}, impediments = [] }) {
  const { user: currentUser, effectiveTenantId } = useUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showTimesheetPrompt, setShowTimesheetPrompt] = useState(false);
  const [pendingTimesheetId, setPendingTimesheetId] = useState(null);
  const unresolvedImpediments = impediments.filter(imp => imp.status !== 'resolved');
  const resolvedImpediments = impediments.filter(imp => imp.status === 'resolved');

  const updateImpedimentMutation = useMutation({
    mutationFn: async ({ id, data, impediment }) => {
      const updateData = { ...data };
      if (data.status === 'resolved') {
        updateData.resolved_date = new Date().toISOString();
      }

      // Check for active timer if starting work
      if (data.status === 'in_progress' && impediment) {
        const entries = await groonabackend.entities.ClockEntry.filter({
          user_email: currentUser?.email,
          is_clocked_in: true
        });
        if (entries && entries.length > 0) {
          throw new Error('You already have an active timer running! Please stop it before starting work on this impediment.');
        }

        // Create the timer entry for this impediment
        await groonabackend.entities.ClockEntry.create({
          tenant_id: effectiveTenantId,
          user_email: currentUser?.email,
          user_name: currentUser?.full_name,
          clock_in_time: new Date().toISOString(),
          is_clocked_in: true,
          project_id: impediment.project_id,
          sprint_id: impediment.sprint_id || null,
          task_id: (impediment.task_id && impediment.task_id !== 'none') ? impediment.task_id : null,
          work_type: 'impediment',
          description: `Working on Impediment: ${impediment.title}`,
        });
      }

      // Stop timer logic on marking resolved
      let promptSubmit = false;
      if (data.status === 'resolved' && impediment) {
        const entries = await groonabackend.entities.ClockEntry.filter({
          user_email: currentUser?.email,
          is_clocked_in: true,
          work_type: 'impediment'
        });
        const thisTimer = entries.find(e => e.description === `Working on Impediment: ${impediment.title}` && e.project_id === impediment.project_id);

        if (thisTimer) {
          const endTime = new Date();
          const startTime = new Date(thisTimer.clock_in_time);
          const diffInMs = endTime.getTime() - startTime.getTime();
          const rawMinutes = Math.floor(diffInMs / 60000);
          const totalMinutes = Math.max(0, rawMinutes - (thisTimer.total_paused_seconds ? Math.floor(thisTimer.total_paused_seconds / 60) : 0));

          const timesheet = await groonabackend.entities.Timesheet.create({
            tenant_id: effectiveTenantId,
            user_email: currentUser?.email,
            user_name: currentUser?.full_name,
            date: format(startTime, 'yyyy-MM-dd'),
            project_id: thisTimer.project_id,
            project_name: impediment.project_name || '',
            sprint_id: thisTimer.sprint_id || null,
            task_id: (thisTimer.task_id && thisTimer.task_id !== 'none') ? thisTimer.task_id : null,
            task_title: impediment.title,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            hours: Math.floor(totalMinutes / 60),
            minutes: totalMinutes % 60,
            total_minutes: totalMinutes,
            description: thisTimer.description,
            work_type: 'impediment',
            entry_type: 'clock_in_out',
            status: 'draft',
            is_billable: true,
            is_locked: false,
            snapshot_hourly_rate: currentUser?.hourly_rate || 0,
            snapshot_total_cost: (totalMinutes / 60) * (currentUser?.hourly_rate || 0),
          });

          await groonabackend.entities.ClockEntry.update(thisTimer.id || thisTimer._id, {
            is_clocked_in: false,
            clock_out_time: endTime.toISOString(),
            total_minutes: totalMinutes,
            timesheet_id: timesheet.id || timesheet._id
          });

          promptSubmit = true;
          return { ...await groonabackend.entities.Impediment.update(id, updateData), promptSubmit, timesheetId: timesheet.id || timesheet._id };
        }
      }

      const returnedImp = await groonabackend.entities.Impediment.update(id, updateData);
      return { ...returnedImp, promptSubmit };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['impediments'] });
      // Invalidate dashboard impediments query too to sync counts across tabs implicitly 
      queryClient.invalidateQueries({ queryKey: ['dashboard-insights-impediments'] });

      // Trigger Resolution Notification
      if (variables.data.status === 'resolved') {
        notificationService.notifyImpedimentResolved({
          impediment: { ...variables.impediment, id: variables.id },
          resolvedBy: currentUser?.email,
          tenantId: effectiveTenantId
        }).catch(err => console.error('Notification failed:', err));
      }

      if (variables.data.status === 'in_progress') {
        queryClient.invalidateQueries({ queryKey: ['active-clock-entry'] });
        toast.success(`Timer started! Marked '${variables.impediment?.title || "Impediment"}' as In Progress.`);
      } else {
        toast.success('Blocker status updated successfully!');
      }

      if (data && data.promptSubmit) {
        queryClient.invalidateQueries({ queryKey: ['active-clock-entry'] });
        queryClient.invalidateQueries({ queryKey: ['my-timesheets'] });
        setPendingTimesheetId(data.timesheetId);
        setShowTimesheetPrompt(true);
      }
    },
    onError: (error) => {
      toast.error(`${error.message || 'Failed to update blocker! Please try again.'}`);
    },
  });

  const handleUpdate = (imp, data) => {
    updateImpedimentMutation.mutate({ id: imp.id || imp._id, data, impediment: imp });
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
        {/* Active Impediments Section */}
        <Card className="p-10 bg-white border border-slate-200 rounded-[40px] shadow-sm">
          <div className="flex items-center gap-4 mb-10">
            <div className="h-12 w-12 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
              <LayoutGrid className="h-6 w-6 text-slate-600" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900">Bottlenecks (Pending)</h3>
              <p className="text-sm text-slate-500 font-medium">Tracking reported blockers and their resolution status</p>
            </div>
          </div>

          <div className="space-y-4">
            {unresolvedImpediments.length === 0 ? (
              <div className="py-20 text-center text-slate-400 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                <CheckCircle2 className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                <p className="font-bold">Clear Skies!</p>
                <p className="text-xs">No active impediments reported or assigned to you.</p>
              </div>
            ) : (
              unresolvedImpediments.map(imp => {
                const isOwner = currentUser?.role === 'admin' && currentUser?.custom_role === 'owner';
                const isAssigned = Array.isArray(imp.assigned_to)
                  ? imp.assigned_to.includes(currentUser?.id || currentUser?._id)
                  : imp.assigned_to === (currentUser?.id || currentUser?._id) || imp.assigned_to === currentUser?.email;

                // Only resolvers (explicitly assigned to this impediment) can see the action buttons.
                const canAction = !isOwner && isAssigned;

                return (
                  <div key={imp.id || imp._id} className="p-6 rounded-3xl border border-slate-100 bg-slate-50/30 hover:bg-white hover:border-rose-200 hover:shadow-xl transition-all duration-300 group/detail">
                    <div className="flex flex-col gap-6">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                          <Badge className={cn(
                            "uppercase text-[10px] font-black px-2 py-0.5 rounded-lg border-0",
                            imp.severity === 'critical' ? 'bg-red-100 text-red-700' :
                              imp.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                                imp.severity === 'medium' ? 'bg-amber-100 text-amber-700' :
                                  'bg-blue-100 text-blue-700'
                          )}>
                            {imp.severity}
                          </Badge>
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{imp.project_name}</span>
                        </div>

                        <h4 className="text-lg font-bold text-slate-900 group-hover/detail:text-rose-600 transition-colors">
                          {imp.title}
                        </h4>

                        <p className="text-sm text-slate-600 line-clamp-2">{imp.description}</p>

                        <div className="flex flex-wrap gap-4 pt-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reporter:</span>
                            <span className="text-xs font-bold text-slate-700">{imp.reported_by_name || imp.reported_by}</span>
                          </div>
                          {imp.assigned_to_name && (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-blue-500">Resolver:</span>
                              <span className="text-xs font-bold text-slate-700">{Array.isArray(imp.assigned_to_name) ? imp.assigned_to_name.join(', ') : imp.assigned_to_name}</span>
                            </div>
                          )}
                          {imp.project_manager_name && (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-purple-500">Manager:</span>
                              <span className="text-xs font-bold text-slate-700">{imp.project_manager_name}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className={cn(
                            "capitalize font-bold text-[10px] px-2 py-0.5 rounded-lg border",
                            imp.status === 'open' ? 'border-rose-100 bg-rose-50 text-rose-700' :
                              imp.status === 'in_progress' ? 'border-blue-100 bg-blue-50 text-blue-700' :
                                'border-emerald-100 bg-emerald-50 text-emerald-700'
                          )}>
                            {imp.status.replace('_', ' ')}
                          </Badge>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                            {format(new Date(imp.created_date || imp.createdAt || new Date()), 'MMM d, h:mm a')}
                          </span>
                        </div>

                        <div className="flex gap-2">
                          {imp.status === 'open' && canAction && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-[11px] font-bold px-3 rounded-xl"
                              onClick={() => handleUpdate(imp, { status: 'in_progress' })}
                              disabled={updateImpedimentMutation.isPending}
                            >
                              Start Working
                            </Button>
                          )}
                          {imp.status === 'in_progress' && canAction && (
                            <Button
                              size="sm"
                              className="h-8 text-[11px] font-bold px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
                              onClick={() => handleUpdate(imp, { status: 'resolved' })}
                              disabled={updateImpedimentMutation.isPending}
                            >
                              Mark Resolved
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Completed Impediments Section */}
        <Card className="p-10 bg-white border border-slate-200 rounded-[40px] shadow-sm">
          <div className="flex items-center gap-4 mb-10">
            <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900">Completed Impediments</h3>
              <p className="text-sm text-slate-500 font-medium">History of resolved blockers and bottlenecks</p>
            </div>
          </div>

          <div className="space-y-4">
            {resolvedImpediments.length === 0 ? (
              <div className="py-20 text-center text-slate-400 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                <Clock className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                <p className="font-bold">History is Clean</p>
                <p className="text-xs">No impediments have been resolved yet.</p>
              </div>
            ) : (
              resolvedImpediments.map(imp => (
                <div key={imp.id || imp._id} className="p-6 rounded-3xl border border-emerald-50 bg-emerald-50/10 hover:bg-white hover:border-emerald-200 hover:shadow-xl transition-all duration-300 group/detail">
                  <div className="flex flex-col gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{imp.project_name}</span>
                        <Badge className="bg-emerald-100 text-emerald-700 border-0 uppercase text-[9px] font-black px-2 py-0.5 rounded-lg">
                          Resolved
                        </Badge>
                      </div>
                      <h4 className="text-base font-bold text-slate-900 group-hover/detail:text-emerald-600 transition-colors">
                        {imp.title}
                      </h4>
                      <p className="text-xs text-slate-500 line-clamp-1 italic">
                        Resolved on {imp.resolved_date ? format(new Date(imp.resolved_date), 'MMM d, yyyy') : 'Recently'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-emerald-50">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Reporter:</span>
                        <span className="text-[11px] font-bold text-slate-600">{imp.reported_by_name || imp.reported_by}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Timesheet Submission Prompt */}
      <AlertDialog open={showTimesheetPrompt} onOpenChange={setShowTimesheetPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Timer Stopped Automatically</AlertDialogTitle>
            <AlertDialogDescription>
              We've stopped your timer since you've marked the blocker as resolved. A draft timesheet has been created.
              Do you want to submit your timesheet now or submit it later?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowTimesheetPrompt(false)}>Ignore Now</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowTimesheetPrompt(false);
                const url = pendingTimesheetId ? `/timesheets?editId=${pendingTimesheetId}` : '/timesheets';
                navigate(url);
              }}
            >
              Submit Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

