import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  LayoutDashboard,
  FolderKanban,
  Bot,
  MessageSquare,
  LogOut,
  Users,
  Shield,
  Sparkles,
  Zap,
  Clock,
  Code,
  FileText,
  Calendar,
  Settings,
  MessageSquareText,
  Building2,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Eye,
  BarChart3,
  ClipboardList,
  Folder,
  AlertCircle,
  CreditCard,
  Bell,
  Briefcase,
  LifeBuoy,
  Sprout,
  ChevronDown,
  Search,
  X,
  Crown,
  Sun
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { groonabackend } from "@/api/groonabackend";
import NotificationCenter from "@/components/shared/NotificationCenter";
import NotificationProvider from "@/components/shared/NotificationProvider";
import PresenceManager from "@/components/shared/PresenceManager";
import PresenceIndicator from "@/components/shared/PresenceIndicator";
import ReportBugDialog from "@/components/support/ReportBugDialog";
import { Toaster, toast } from "sonner";
import { useHasPermission } from "@/components/shared/usePermissions";
import { Button } from "@/components/ui/button";
import { UserProvider } from "@/components/shared/UserContext";
import { useQuery } from "@tanstack/react-query";
import MandatoryTimesheetModal from "@/components/timesheets/MandatoryTimesheetModal";
import AccountLockedOverlay from "@/components/timesheets/AccountLockedOverlay";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

function LayoutContent({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = React.useState(null);
  const [loadingUser, setLoadingUser] = React.useState(true);
  const [viewingTenant, setViewingTenant] = React.useState(null);
  const [exitingView, setExitingView] = React.useState(false);
  const [navigationReady, setNavigationReady] = React.useState(false);
  const [showReportBug, setShowReportBug] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);

  const isInAdminSection = location?.pathname?.toLowerCase().includes('admin');

  // --- CHECK FOR MISSING TIMESHEET ALERT (Moved to top level) ---
  const { data: missingTimesheetAlert } = useQuery({
    queryKey: ['missing-timesheet-alert', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      // Fetch OPEN alerts of type 'timesheet_missing_alert'
      const alerts = await groonabackend.entities.Notification.filter({
        recipient_email: user.email,
        type: 'timesheet_missing_alert',
        status: 'OPEN'
      });
      return alerts.length > 0 ? alerts[0] : null;
    },
    // STRICTLY ONLY FOR 'viewer' CUSTOM ROLE
    enabled: !!user?.id && user?.custom_role === 'viewer',
    refetchInterval: 5000 // Poll every 5s to check if resolved
  });

  // --- ACCOUNT LOCKOUT DETECTION ---
  const { data: timesheetNotifications = [], refetch: refetchNotifications } = useQuery({
    queryKey: ['account-lockout-check', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      const data = await groonabackend.entities.Notification.filter({
        recipient_email: user.email,
        status: { $in: ['OPEN', 'APPEALED'] }
      });
      return data;
    },
    enabled: !!user?.email && (
      (user.role === 'member' && user.custom_role === 'viewer') ||
      (user.role === 'admin' && user.custom_role === 'project_manager')
    ),
    refetchInterval: 30000,
  });

  const lockoutAlerts = timesheetNotifications.filter(n => n.type === 'timesheet_lockout_alarm');
  const isAccountLocked = lockoutAlerts.some(n => n.status === 'OPEN' || n.status === 'APPEALED');

  // --- 1. SEARCH LOGIC ---ROUTES FIRST ---
  const publicRoutes = [
    '/',
    '/LandingPage',
    '/Features',
    '/Pricing',
    '/Checkout',
    '/SignIn',
    '/Register',
    '/AboutUs',
    '/ContactUs',
    '/VerifyOTP',
    '/ForgotPassword',
    '/ResetPassword',
    '/accept-invitation'
  ];

  const isPublicRoute = publicRoutes.some(route => {
    const currentPath = (location.pathname.startsWith('/') ? location.pathname : '/' + location.pathname).toLowerCase();
    const publicPath = (route.startsWith('/') ? route : '/' + route).toLowerCase();

    return currentPath === publicPath || currentPath.startsWith(publicPath + '/');
  });

  const { data: currentTenant } = useQuery({
    queryKey: ['current-tenant-status', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return null;
      const tenants = await groonabackend.entities.Tenant.filter({ _id: user.tenant_id });
      return tenants[0];
    },
    enabled: !!user?.tenant_id && !user.is_super_admin,
    staleTime: 0, // Always fetch fresh data to avoid stale onboarding status
    refetchOnMount: true, // Refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });

  // Check onboarding status and redirect BEFORE rendering Dashboard
  React.useEffect(() => {
    if (currentTenant && user && !user.is_super_admin && !isPublicRoute) {
      const shouldRedirectToOnboarding =
        currentTenant.onboarding_completed === false &&
        user.status === 'active' &&
        currentTenant.owner_email === user.email &&
        !location.pathname.includes('TenantOnboarding');

      if (shouldRedirectToOnboarding) {
        console.log('[Layout] Redirecting to TenantOnboarding. Tenant onboarding_completed:', currentTenant.onboarding_completed);
        navigate(createPageUrl("TenantOnboarding"));
      }
    }
  }, [currentTenant, user, navigate, location.pathname, isPublicRoute]);



  // --- PERMISSIONS (Must be called at top level) ---
  const canViewProjects = useHasPermission('can_view_all_projects');
  const canViewTemplates = useHasPermission('can_view_templates');
  const canViewTeam = useHasPermission('can_view_team');
  const canViewInsights = useHasPermission('can_view_insights');
  const canViewAutomation = useHasPermission('can_view_automation');
  const canUseAI = useHasPermission('can_use_ai_assistant');
  const canUseCodeReview = useHasPermission('can_use_ai_code_review');
  const canUseCollaboration = useHasPermission('can_use_collaboration');

  // Specific Permission Hooks for Sensitive Areas
  const canViewResourcesExplicit = useHasPermission('can_view_resources');
  const canViewReportsExplicit = useHasPermission('can_view_reports');

  const loadUserData = async (skipDelay = false) => {
    try {
      console.log('[Layout] Loading user data...');
      if (!skipDelay) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      const userData = await groonabackend.auth.me();
      console.log('[Layout] Fresh user data loaded:', userData);
      setUser(userData);

      if (userData.is_super_admin && userData.active_tenant_id) {
        try {
          const tenants = await groonabackend.entities.Tenant.filter({ _id: userData.active_tenant_id });
          if (tenants[0]) {
            setViewingTenant(tenants[0]);
            console.log('[Layout] Super Admin viewing tenant:', tenants[0].name);
          }
        } catch (error) {
          console.error('[Layout] Failed to load viewing tenant:', error);
        }
      } else {
        setViewingTenant(null);
      }

      return userData;
    } catch (error) {
      console.error('[Layout] Failed to load user:', error);
      throw error;
    }
  };

  React.useEffect(() => {
    let mounted = true;

    if (isPublicRoute) {
      if (mounted) {
        setLoadingUser(false);
        setNavigationReady(true);
      }
      return;
    }

    const initializeUser = async () => {
      setLoadingUser(true);
      setNavigationReady(false);

      try {
        const userData = await loadUserData(true);

        if (!mounted) return;

        await new Promise(resolve => setTimeout(resolve, 100));

        if (mounted) {
          setNavigationReady(true);
          setLoadingUser(false);
        }
      } catch (error) {
        console.error('[Layout] Failed to initialize user:', error);
        if (mounted) {
          setLoadingUser(false);
          setNavigationReady(true);

          if (!isPublicRoute) {
            navigate(createPageUrl("SignIn"));
          }
        }
      }
    };

    initializeUser();

    const handleProfileUpdate = async (e) => {
      try {
        const freshUser = await loadUserData(false);
        window.dispatchEvent(new CustomEvent('user-data-refreshed', {
          detail: { user: freshUser }
        }));
      } catch (error) { console.error(error); }
    };

    const handlePageShow = (event) => {
      if (event.persisted || (window.performance && window.performance.navigation.type === 2)) {
        console.log('[Layout] Page restored from BFCache, reloading user data...');
        initializeUser();
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('profile-updated', handleProfileUpdate);
    return () => {
      mounted = false;
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('profile-updated', handleProfileUpdate);
    };
  }, [isPublicRoute]);

  const handleExitTenantView = async () => {
    setExitingView(true);
    try {
      await groonabackend.auth.updateMe({ active_tenant_id: null });
      toast.success('Returned to Super Admin view');
      setTimeout(() => window.location.href = createPageUrl("SuperAdminDashboard"), 500);
    } catch (error) {
      toast.error('Failed to exit tenant view');
      setExitingView(false);
    }
  };

  const { data: projectManagerRoles = [] } = useQuery({
    queryKey: ['is-project-manager', user?.id],
    queryFn: () => groonabackend.entities.ProjectUserRole.filter({
      user_id: user?.id,
      role: 'project_manager'
    }),
    enabled: !!user?.id && !user?.is_super_admin && user?.role !== 'admin',
    staleTime: 5 * 60 * 1000,
  });

  const isProjectManager = projectManagerRoles.length > 0;
  const isSuperAdminPage = location.pathname.startsWith('/SuperAdmin') ||
    location.pathname === '/AuditLog' ||
    location.pathname === '/SubscriptionManagement';

  const isInPlatformMode = user?.is_super_admin && (!user?.active_tenant_id || isSuperAdminPage);
  const isViewingAsTenant = user?.is_super_admin && user?.active_tenant_id && !isInPlatformMode;

  const isAdmin = user?.role === 'admin' || user?.is_super_admin;
  const isClient = user?.custom_role === 'client';

  // --- VIEWER ROLE CHECK ---
  const isViewer = user?.custom_role === 'viewer' || user?.role === 'viewer';

  // Get effective tenant ID for search
  const effectiveTenantId = user?.is_super_admin && user?.active_tenant_id
    ? user.active_tenant_id
    : user?.tenant_id;

  // Fetch data for comprehensive search
  const { data: searchProjects = [] } = useQuery({
    queryKey: ['search-projects', effectiveTenantId],
    queryFn: async () => {
      if (!user) return [];
      if (user.is_super_admin && !user.active_tenant_id) {
        return groonabackend.entities.Project.list('-updated_date', 100);
      }
      if (!effectiveTenantId) return [];
      return groonabackend.entities.Project.filter({ tenant_id: effectiveTenantId }, '-updated_date', 100);
    },
    enabled: !!user && !isPublicRoute && (!!effectiveTenantId || (user.is_super_admin && !user.active_tenant_id)),
    staleTime: 2 * 60 * 1000,
  });

  const { data: searchTasks = [] } = useQuery({
    queryKey: ['search-tasks', effectiveTenantId],
    queryFn: async () => {
      if (!user) return [];
      if (user.is_super_admin && !user.active_tenant_id) {
        return groonabackend.entities.Task.list('-updated_date', 100);
      }
      if (!effectiveTenantId) return [];
      return groonabackend.entities.Task.filter({ tenant_id: effectiveTenantId }, '-updated_date', 100);
    },
    enabled: !!user && !isPublicRoute && (!!effectiveTenantId || (user.is_super_admin && !user.active_tenant_id)),
    staleTime: 2 * 60 * 1000,
  });

  const { data: searchUsers = [] } = useQuery({
    queryKey: ['search-users', effectiveTenantId],
    queryFn: async () => {
      if (!user) return [];
      const allUsers = await groonabackend.entities.User.list();
      if (user.is_super_admin && !user.active_tenant_id) {
        return allUsers.slice(0, 100);
      }
      if (!effectiveTenantId) return [];
      return allUsers.filter(u => u.tenant_id === effectiveTenantId).slice(0, 100);
    },
    enabled: !!user && !isPublicRoute && (!!effectiveTenantId || (user.is_super_admin && !user.active_tenant_id)),
    staleTime: 5 * 60 * 1000,
  });

  const { data: searchWorkspaces = [] } = useQuery({
    queryKey: ['search-workspaces', effectiveTenantId],
    queryFn: async () => {
      if (!user) return [];
      if (user.is_super_admin && !user.active_tenant_id) {
        return groonabackend.entities.Workspace.list('-created_date', 50);
      }
      if (!effectiveTenantId) return [];
      return groonabackend.entities.Workspace.filter({ tenant_id: effectiveTenantId }, '-created_date', 50);
    },
    enabled: !!user && !isPublicRoute && (!!effectiveTenantId || (user.is_super_admin && !user.active_tenant_id)),
    staleTime: 5 * 60 * 1000,
  });

  const { data: searchSprints = [] } = useQuery({
    queryKey: ['search-sprints', effectiveTenantId],
    queryFn: async () => {
      if (!user || !effectiveTenantId) return [];
      const allSprints = await groonabackend.entities.Sprint.list();
      if (user.is_super_admin && !user.active_tenant_id) {
        return allSprints.slice(0, 50);
      }
      // Filter sprints by projects in tenant
      const tenantProjects = await groonabackend.entities.Project.filter({ tenant_id: effectiveTenantId });
      const projectIds = new Set(tenantProjects.map(p => p.id));
      return allSprints.filter(s => projectIds.has(s.project_id)).slice(0, 50);
    },
    enabled: !!user && !isPublicRoute && !!effectiveTenantId,
    staleTime: 2 * 60 * 1000,
  });

  // Filter search results based on query - comprehensive search
  const filteredResults = React.useMemo(() => {
    if (!searchQuery.trim()) return { projects: [], tasks: [], users: [], workspaces: [], sprints: [] };

    const query = searchQuery.toLowerCase().trim();

    // Search projects - name, description, status, priority
    const projects = (searchProjects || []).filter(p =>
      p.name?.toLowerCase().includes(query) ||
      p.description?.toLowerCase().includes(query) ||
      p.status?.toLowerCase().includes(query) ||
      p.priority?.toLowerCase().includes(query) ||
      p.owner?.toLowerCase().includes(query)
    ).slice(0, 8);

    // Search tasks - title, description, status, priority, task_type
    const tasks = (searchTasks || []).filter(t =>
      t.title?.toLowerCase().includes(query) ||
      t.description?.toLowerCase().includes(query) ||
      t.status?.toLowerCase().includes(query) ||
      t.priority?.toLowerCase().includes(query) ||
      t.task_type?.toLowerCase().includes(query) ||
      (Array.isArray(t.assigned_to) ? t.assigned_to.some(a => a?.toLowerCase().includes(query)) : t.assigned_to?.toLowerCase().includes(query))
    ).slice(0, 8);

    // Search users - full_name, email, role, custom_role, department
    const users = (searchUsers || []).filter(u =>
      u.full_name?.toLowerCase().includes(query) ||
      u.email?.toLowerCase().includes(query) ||
      u.role?.toLowerCase().includes(query) ||
      u.custom_role?.toLowerCase().includes(query) ||
      u.department?.toLowerCase().includes(query)
    ).slice(0, 8);

    // Search workspaces - name, description
    const workspaces = (searchWorkspaces || []).filter(w =>
      w.name?.toLowerCase().includes(query) ||
      w.description?.toLowerCase().includes(query)
    ).slice(0, 5);

    // Search sprints - name, description, status
    const sprints = (searchSprints || []).filter(s =>
      s.name?.toLowerCase().includes(query) ||
      s.description?.toLowerCase().includes(query) ||
      s.status?.toLowerCase().includes(query)
    ).slice(0, 5);

    return { projects, tasks, users, workspaces, sprints };
  }, [searchQuery, searchProjects, searchTasks, searchUsers, searchWorkspaces, searchSprints]);

  // Debug: Log search state
  React.useEffect(() => {
    if (searchQuery.trim()) {
      console.log('[Search] Query:', searchQuery);
      console.log('[Search] Projects available:', searchProjects.length);
      console.log('[Search] Tasks available:', searchTasks.length);
      console.log('[Search] Users available:', searchUsers.length);
      console.log('[Search] Workspaces available:', searchWorkspaces.length);
      console.log('[Search] Sprints available:', searchSprints.length);
      console.log('[Search] Filtered Projects:', filteredResults.projects.length);
      console.log('[Search] Filtered Tasks:', filteredResults.tasks.length);
      console.log('[Search] Filtered Users:', filteredResults.users.length);
      console.log('[Search] Filtered Workspaces:', filteredResults.workspaces.length);
      console.log('[Search] Filtered Sprints:', filteredResults.sprints.length);
      console.log('[Search] Popover Open:', searchOpen);
    }
  }, [searchQuery, searchProjects, searchTasks, searchUsers, searchWorkspaces, searchSprints, filteredResults, searchOpen]);

  const platformNavigationItems = [
    { title: "Tenant Management", url: createPageUrl("SuperAdminDashboard"), icon: Building2, show: true },
    { title: "User Management", url: createPageUrl("UserManagement"), icon: Users, show: true },
    { title: "Workspace Management", url: createPageUrl("SuperAdminWorkspaces"), icon: Folder, show: true },
    { title: "Audit Log", url: createPageUrl("AuditLog"), icon: ClipboardList, show: true },
    { title: "AI Subscription Manager", url: createPageUrl("AISubscriptionManagement"), icon: Sparkles, show: true },
    { title: "Deep Analytics", url: createPageUrl("AIAnalyticsDashboard"), icon: BarChart3, show: true },
    { title: "Subscription Plans", url: createPageUrl("SubscriptionManagement"), icon: CreditCard, show: true },
    { title: "Payment Gateways", url: createPageUrl("PaymentGateways"), icon: CreditCard, show: true },
    { title: "System Notifications", url: createPageUrl("SystemNotificationManager"), icon: Bell, show: true },
  ];

  const clientNavigationItems = [
    { title: "My Projects", url: createPageUrl("ClientDashboard"), icon: FolderKanban, show: true },
  ];

  const isMarketingCompany = currentTenant?.company_type === 'MARKETING' || viewingTenant?.company_type === 'MARKETING';

  const tenantNavigationItems = [
    {
      title: isProjectManager ? "PM Dashboard" : "Dashboard",
      url: isProjectManager ? createPageUrl("ProjectManagerDashboard") : createPageUrl("Dashboard"),
      icon: LayoutDashboard,
      show: true,
    },
    {
      title: "Workspaces",
      url: createPageUrl("Workspaces"),
      icon: Folder,
      show: true,
    },
    {
      title: isMarketingCompany ? "Campaigns" : "Projects",
      url: createPageUrl("Projects"),
      icon: FolderKanban,
      show: canViewProjects || isProjectManager,
      subItems: [
        {
          title: "Tasks",
          url: createPageUrl("Tasks"),
          icon: ClipboardList,
          show: true,
        },
        {
          title: isMarketingCompany ? "Campaign Board" : "Sprint Board",
          url: createPageUrl("SprintBoard"),
          icon: Calendar,
          show: canViewProjects || isProjectManager,
        },
        {
          title: "Team",
          url: createPageUrl("Team"),
          icon: Users,
          show: isViewer ? true : canViewTeam,
        },
      ].filter(item => item.show),
    },
    {
      title: "Collaboration",
      url: createPageUrl("Collaboration"),
      icon: MessageSquareText,
      // Show by default for all team members (not clients)
      show: !isClient,
    },
    {
      title: isMarketingCompany ? "Resources" : "Resources",
      url: createPageUrl("ResourcePlanning"),
      icon: Users,
      // Viewer: Hide unless explicitly permitted
      show: isViewer ? canViewResourcesExplicit : canViewTeam,
    },
    {
      title: "Timesheets",
      url: createPageUrl("Timesheets"),
      icon: Clock,
      show: true,
    },
    {
      title: "Planned Leaves",
      url: createPageUrl("PlannedLeaves"),
      icon: Calendar,
      show: true,
    },
    {
      title: "Reports",
      url: createPageUrl("Reports"),
      icon: BarChart3,
      // STRICT CHECK: NEVER SHOW to Viewers by default, even if backend permission implies it.
      // Must be Admin OR (Not Viewer AND Have Permission)
      show: !isViewer && canViewReportsExplicit,
    },
    // {
    // title: "Automation",
    //  url: createPageUrl("Automation"),
    // icon: Zap,
    // STRICT CHECK: NEVER SHOW to Viewers by default.
    //  show: !isViewer && canViewAutomation,
    //},
    //  {
    //   title: "AI Assistant",
    //   url: createPageUrl("AIAssistant"),
    //  icon: Bot,
    // Viewer: Hide unless explicitly permitted
    //   show: isViewer ? canUseAI : canUseAI,
    //  },
    {
      title: "Groona Assistant",
      url: createPageUrl("GroonaAssistant"),
      icon: Sparkles,
      // Viewer: Hide unless explicitly permitted
      show: isViewer ? canUseAI : canUseAI,
    },
  ].filter(item => item.show);

  const adminNavigationItems = isAdmin ? [
    { title: "Productivity Dashboard", url: createPageUrl("AdminBIDashboard"), icon: BarChart3, show: true },
    { title: "Client Management", url: createPageUrl("ClientManagement"), icon: Briefcase, show: true },
    { title: "User Management", url: createPageUrl("UserManagement"), icon: Users, show: true },
    { title: "Payments", url: createPageUrl("PaymentsHistory"), icon: CreditCard, show: true },
  ].filter(item => item.show) : [];

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  };

  // Check onboarding before showing loading or content
  const shouldShowOnboarding = currentTenant &&
    user &&
    !user.is_super_admin &&
    currentTenant.onboarding_completed === false &&
    currentTenant.owner_email === user.email &&
    !location.pathname.includes('TenantOnboarding') &&
    navigationReady;

  if (shouldShowOnboarding) {
    // Redirect to onboarding immediately
    navigate(createPageUrl("TenantOnboarding"));
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Redirecting to onboarding...</p>
        </div>
      </div>
    );
  }

  if (isPublicRoute) {
    return (
      <NotificationProvider>
        <Toaster position="top-right" richColors closeButton />
        <div className="min-h-screen bg-white">
          {children}
        </div>
      </NotificationProvider>
    );
  }

  if (loadingUser || !navigationReady || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Loading Groona...</p>
        </div>
      </div>
    );
  }

  const mainNavigationItems = isClient ? clientNavigationItems :
    isInPlatformMode ? platformNavigationItems :
      tenantNavigationItems;

  // Define NavigationItemWrapper - it will only be rendered inside SidebarProvider
  // So useSidebar hook is safe to use
  const NavigationItemWrapper = ({ item, isActive, className }) => {
    const { setOpenMobile, isMobile } = useSidebar();
    const hasSubItems = item.subItems && item.subItems.length > 0;
    const isSubItemActive = hasSubItems && item.subItems.some(subItem => location.pathname === subItem.url);

    // Auto-open dropdown if a sub-item is active - use useEffect to sync with location changes
    const [isOpen, setIsOpen] = React.useState(isSubItemActive);
    const userToggledRef = React.useRef(false); // Track if user manually toggled
    const isInitialMount = React.useRef(true);

    // Only auto-open on initial mount if sub-item is active
    // After that, respect user's manual toggle and don't interfere
    React.useEffect(() => {
      if (isInitialMount.current) {
        isInitialMount.current = false;
        if (isSubItemActive) {
          setIsOpen(true);
        }
      }
      // Don't auto-open after initial mount - let user control it
      // This prevents flickering when clicking submenu items
    }, []); // Empty dependency array - only run on mount

    // Check if any sub-item is active
    const shouldHighlight = isActive || isSubItemActive;

    // Memoize sub-items to prevent unnecessary re-renders
    const subItemsList = React.useMemo(() => {
      if (!hasSubItems) return null;
      return item.subItems.map((subItem) => {
        const isSubActive = location.pathname === subItem.url;
        return { ...subItem, isSubActive };
      });
    }, [hasSubItems, item.subItems, location.pathname]);

    if (hasSubItems) {
      return (
        <SidebarMenuItem key={item.title}>
          <div className="relative">
            <SidebarMenuButton
              asChild
              className={className}
            >
              <Link
                to={item.url}
                className="flex items-center gap-3 px-4 py-3"
                onClick={() => isMobile && setOpenMobile(false)}
              >
                <item.icon className={`h-5 w-5 ${shouldHighlight ? 'text-white' : 'text-slate-700'}`} />
                <span className="font-medium flex-1">{item.title}</span>
              </Link>
            </SidebarMenuButton>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                userToggledRef.current = true; // Mark as user-toggled
                // Use a small delay to ensure state update happens after any pending updates
                requestAnimationFrame(() => {
                  setIsOpen(prev => !prev);
                });
              }}
              className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-black/10 transition-colors ${shouldHighlight ? 'text-white hover:bg-white/20' : 'text-slate-600'}`}
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-300 ease-in-out ${isOpen ? 'rotate-180' : ''}`}
              />
            </button>
          </div>
          {isOpen && subItemsList && (
            <div className="overflow-hidden">
              <div className="ml-2 mt-1 mb-2 space-y-1 bg-slate-100/90 p-2 border-l-2 border-slate-400 shadow-sm rounded-bl-lg rounded-br-lg">
                {subItemsList.map((subItem, index) => {
                  // Check if this is an Administration sub-item (has Shield icon or is in admin section)
                  const isAdminSubItem = item.icon === Shield || item.title === "Administration";

                  return (
                    <div key={subItem.title}>
                      <SidebarMenuButton
                        asChild
                        className={`transition-all duration-200 ${subItem.isSubActive
                          ? isInPlatformMode
                            ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/25'
                            : 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md shadow-blue-500/25'
                          : 'text-slate-700 hover:bg-slate-200/80 hover:shadow-sm'
                          }`}
                      >
                        <Link
                          to={subItem.url}
                          className="flex items-center gap-1.5 px-2 py-2.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isMobile) setOpenMobile(false);
                            // Don't close dropdown on click - keep it open for better UX
                            // Prevent any state changes that might cause flickering
                          }}
                        >
                          <subItem.icon className={`h-4 w-4 flex-shrink-0 ${subItem.isSubActive ? 'text-white' : 'text-slate-600'}`} />
                          <span className="font-medium text-sm whitespace-nowrap">{subItem.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </SidebarMenuItem>
      );
    }

    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton
          asChild
          className={className}
        >
          <Link
            to={item.url}
            className="flex items-center gap-3 px-4 py-3"
            onClick={() => isMobile && setOpenMobile(false)}
          >
            <item.icon className={`h-5 w-5 ${isActive ? 'text-white' : ''}`} />
            <span className="font-medium">{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  if (loadingUser && !isPublicRoute) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <NotificationProvider>
      <PresenceManager user={user} />
      <SidebarProvider defaultOpen={true}>
        <LayoutContentInner
          user={user}
          currentUser={user}
          isClient={isClient}
          isInPlatformMode={isInPlatformMode}
          isViewingAsTenant={isViewingAsTenant}
          viewingTenant={viewingTenant}
          currentTenant={currentTenant}
          handleExitTenantView={handleExitTenantView}
          exitingView={exitingView}
          location={location}
          navigate={navigate}
          showReportBug={showReportBug}
          setShowReportBug={setShowReportBug}
          children={children}
          mainNavigationItems={mainNavigationItems}
          adminNavigationItems={adminNavigationItems}
          getInitials={getInitials}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchOpen={searchOpen}
          setSearchOpen={setSearchOpen}
          filteredResults={filteredResults}
          searchProjects={searchProjects}
          effectiveTenantId={effectiveTenantId}
          isPublicRoute={isPublicRoute}
          isAccountLocked={isAccountLocked}
          lockoutAlerts={lockoutAlerts}
          refetchNotifications={refetchNotifications}
          isProjectManager={isProjectManager}
        />
      </SidebarProvider>
      {/* Modal containers removed from here to be moved inside main content area */}
    </NotificationProvider>
  );
}

const NavigationItemWrapper = ({ item, isActive }) => {
  const location = useLocation();
  const { setOpenMobile, isMobile } = useSidebar();
  const hasSubItems = item.subItems && item.subItems.length > 0;
  const isSubItemActive = hasSubItems && item.subItems.some(subItem => location.pathname === subItem.url);

  const [isOpen, setIsOpen] = React.useState(isSubItemActive);
  const isInitialMount = React.useRef(true);

  React.useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (isSubItemActive) {
        setIsOpen(true);
      }
    }
  }, [isSubItemActive]);

  const shouldHighlight = isActive || isSubItemActive;

  const subItemsList = React.useMemo(() => {
    if (!hasSubItems) return null;
    return item.subItems.map((subItem) => {
      const isSubActive = location.pathname === subItem.url;
      return { ...subItem, isSubActive };
    });
  }, [hasSubItems, item.subItems, location.pathname]);

  return (
    <SidebarMenuItem key={item.title}>
      <div className="relative">
        <SidebarMenuButton
          asChild
          isActive={shouldHighlight}
          className={cn(
            "p-2.5 transition-colors",
            shouldHighlight && "text-blue-700 bg-blue-50/80 font-bold"
          )}
        >
          <Link
            to={item.url}
            className="flex items-center gap-3 w-full"
            onClick={() => isMobile && setOpenMobile(false)}
          >
            <item.icon className={cn("h-5 w-5 transition-colors", shouldHighlight ? "text-blue-600" : "text-slate-400 group-hover:text-slate-900")} />
            <span className={cn("flex-1 truncate", shouldHighlight && "font-semibold")}>{item.title}</span>
            {item.badge && (
              <span className="px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-600 text-[10px] font-bold">
                {item.badge}
              </span>
            )}
          </Link>
        </SidebarMenuButton>
        {hasSubItems && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setIsOpen(!isOpen);
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform duration-300", isOpen && "rotate-180")} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && subItemsList && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden relative ml-6"
          >
            {/* Vertical Connection Line */}
            <div className="absolute left-[2px] top-0 bottom-4 w-px bg-slate-100" />

            <div className="pt-1 pb-2 space-y-1">
              {subItemsList.map((subItem) => (
                <div key={subItem.title} className="relative">
                  {/* Horizontal Line Segment */}
                  <div className="absolute left-[2px] top-1/2 -translate-y-1/2 w-3 h-px bg-slate-100" />

                  <SidebarMenuButton
                    asChild
                    isActive={subItem.isSubActive}
                    className={cn(
                      "ml-4 h-9 p-0 bg-transparent hover:bg-slate-50 border-l-0",
                      subItem.isSubActive ? "text-blue-600 font-bold" : "text-slate-500 hover:text-slate-900"
                    )}
                  >
                    <Link
                      to={subItem.url}
                      className="flex items-center gap-3 px-3 w-full"
                      onClick={() => {
                        if (isMobile) setOpenMobile(false);
                      }}
                    >
                      <subItem.icon className={cn("h-4 w-4 flex-shrink-0 transition-colors", subItem.isSubActive ? "text-blue-600" : "text-slate-400")} />
                      <span className="font-medium text-sm whitespace-nowrap">{subItem.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SidebarMenuItem>
  );
};

function LayoutContentInner({ user, currentUser, isClient, isInPlatformMode, isViewingAsTenant, viewingTenant, currentTenant, handleExitTenantView, exitingView, location, navigate, showReportBug, setShowReportBug, children, mainNavigationItems, adminNavigationItems, getInitials, searchQuery, setSearchQuery, searchOpen, setSearchOpen, filteredResults, searchProjects, effectiveTenantId, isPublicRoute, isAccountLocked, lockoutAlerts, refetchNotifications }) {
  const isInAdminSection = location?.pathname?.toLowerCase().includes('admin');
  const { open, isMobile } = useSidebar();



  return (
    <>
      <style>{`
        :root { 
          --primary: 250 84% 60%; 
          --primary-foreground: 0 0% 100%; 
          --header-height: 64px;
        }
        html, body {
          height: 100%;
          overflow: hidden;
          margin: 0;
          padding: 0;
        }
        #root {
          height: 100%;
        }
      `}</style>
      <div className="h-screen w-full flex overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20">
        <Sidebar className="border-r border-slate-100 bg-white">
          <SidebarHeader className="p-[14.5px] border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-9 w-9 rounded-xl flex items-center justify-center shadow-lg",
                isInPlatformMode
                  ? "bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/20"
                  : "bg-gradient-to-br from-blue-500 to-purple-600 shadow-blue-500/20"
              )}>
                {isInPlatformMode ? <Shield className="h-5 w-5 text-white" /> : <Sprout className="h-5 w-5 text-white" />}
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-base tracing-tight">Groona</h2>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Workspace</p>
                </div>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="p-3">
            {isViewingAsTenant && viewingTenant && (
              <div className="mb-4 mx-2">
                <Alert className="border-amber-200 bg-amber-50">
                  <Eye className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-900 text-xs">
                    <div className="font-semibold mb-1">Viewing as Tenant</div>
                    <div className="mb-2">{viewingTenant.name}</div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleExitTenantView}
                      disabled={exitingView}
                      className="w-full text-xs h-7 border-amber-300 hover:bg-amber-100"
                    >
                      {exitingView ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Exiting...</> : <><ArrowLeft className="h-3 w-3 mr-1" />Back to Platform</>}
                    </Button>
                  </AlertDescription>
                </Alert>
              </div>
            )}

            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {mainNavigationItems.map((item) => {
                    // Check if this item or any of its sub-items is active
                    const isActive = location.pathname === item.url;
                    const hasSubItems = item.subItems && item.subItems.length > 0;
                    const isSubItemActive = hasSubItems && item.subItems.some(subItem => location.pathname === subItem.url);
                    const shouldHighlight = isActive || isSubItemActive;

                    return (
                      <NavigationItemWrapper
                        key={item.title}
                        item={item}
                        isActive={isActive}
                      />
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {!isInPlatformMode && adminNavigationItems.length > 0 && (
              <SidebarGroup>
                <SidebarGroupLabel className="text-xs font-medium text-slate-500 uppercase tracking-wider px-2 py-2">Administration</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="space-y-1">
                    {(() => {
                      const adminItem = {
                        title: "Administration",
                        url: createPageUrl("AdminBIDashboard"), // Default to first admin page
                        icon: Shield,
                        show: true,
                        subItems: adminNavigationItems,
                      };
                      const isActive = adminNavigationItems.some(item => location.pathname === item.url);
                      const hasSubItems = adminItem.subItems && adminItem.subItems.length > 0;
                      const isSubItemActive = hasSubItems && adminItem.subItems.some(subItem => location.pathname === subItem.url);
                      const shouldHighlight = isActive || isSubItemActive;

                      return (
                        <NavigationItemWrapper
                          key={adminItem.title}
                          item={adminItem}
                          isActive={isActive}
                        />
                      );
                    })()}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>

          <SidebarFooter className="p-4 space-y-4">
            {/* Compact Premium Upgrade Card (Belt Size) */}
            <div className="mx-2 p-3 rounded-2xl bg-gradient-to-br from-[#1E40AF] via-[#1E3A8A] to-[#0F172A] relative overflow-hidden group shadow-lg border border-white/5">
              {/* Background pattern */}
              <div className="absolute inset-0 opacity-10 pointer-events-none">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white rounded-full blur-2xl -mr-12 -mt-12" />
              </div>

              <div className="relative z-10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
                      <Crown className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="flex flex-col">
                      <h3 className="text-white font-bold text-[11px] leading-tight flex items-center gap-1">
                        Professional
                      </h3>
                      <span className="text-emerald-400 font-bold text-[9px]">22 days left</span>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(createPageUrl('SubscriptionManagement'))}
                    className="text-[10px] font-bold text-blue-200 hover:text-white flex items-center transition-all group-hover:underline"
                  >
                    Upgrade <ArrowRight className="h-2.5 w-2.5 ml-0.5" />
                  </button>
                </div>

                <div className="w-full bg-white/10 rounded-full h-1 overflow-hidden">
                  <div className="bg-emerald-400 h-full rounded-full shadow-[0_0_8px_rgba(52,211,153,0.4)]" style={{ width: '30%' }} />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <SidebarMenuButton
                asChild
                className="text-slate-500"
                isActive={location.pathname === createPageUrl("MyTickets")}
              >
                <Link to={createPageUrl("MyTickets")}>
                  <LifeBuoy className="h-5 w-5" />
                  <span>Help & Support</span>
                </Link>
              </SidebarMenuButton>
            </div>

            <div className="pt-2">
              <DropdownMenu>
                <DropdownMenuTrigger className="w-full">
                  <div className="flex items-center gap-3 p-2 rounded-2xl hover:bg-slate-50 transition-colors group">
                    <Avatar className="h-9 w-9 border border-slate-100 shadow-sm">
                      <AvatarImage src={user?.profile_image_url} />
                      <AvatarFallback className="bg-blue-600 text-white font-bold text-xs">
                        {getInitials(user?.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{user?.full_name}</p>
                      <p className="text-[10px] text-slate-400 font-medium truncate">{user?.email}</p>
                    </div>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 shadow-2xl border-slate-100">
                  <DropdownMenuItem className="rounded-xl p-3 focus:bg-slate-50 cursor-pointer" onClick={() => navigate(createPageUrl("UserProfile"))}>
                    <Settings className="h-4 w-4 mr-2" />
                    <span className="font-semibold">My Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="my-1" />
                  <DropdownMenuItem className="rounded-xl p-3 focus:bg-red-50 text-red-600 cursor-pointer" onClick={() => groonabackend.auth.logout()}>
                    <LogOut className="h-4 w-4 mr-2" />
                    <span className="font-semibold">Sign Out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col relative overflow-hidden" style={{ marginLeft: (!isMobile && open) ? '240px' : '0px', transition: 'margin-left 0.3s ease-in-out', width: '100%', maxWidth: '100%' }}>
          <header className="sticky top-0 z-50 bg-white px-4 md:px-6 flex items-center shadow-sm h-16" style={{ height: 'var(--header-height, 64px)' }}>
            <div className="flex items-center justify-between gap-2 md:gap-4 w-full">
              <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                <SidebarTrigger className="hover:bg-slate-100 p-2 rounded-lg transition-colors flex-shrink-0" />
                <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                  <PopoverTrigger asChild>
                    <div className="flex-1 max-w-md relative min-w-0 group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-slate-400 pointer-events-none z-10">
                        <Search className="h-4 w-4" />
                      </div>
                      <Input
                        placeholder="Search anything..."
                        value={searchQuery}
                        onChange={(e) => {
                          const value = e.target.value;
                          setSearchQuery(value);
                          setSearchOpen(true);
                        }}
                        onFocus={() => setSearchOpen(true)}
                        onClick={() => setSearchOpen(true)}
                        className="pl-11 pr-16 bg-slate-50 border-slate-200/60 rounded-lg h-10 cursor-text focus-visible:ring-blue-500/20 transition-all hover:bg-slate-100/80"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none z-10 flex items-center gap-1.5">
                        {searchQuery ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSearchQuery("");
                              setSearchOpen(false);
                            }}
                            className="p-1 hover:bg-slate-200 rounded-md transition-colors pointer-events-auto"
                          >
                            <X className="h-3 w-3 text-slate-400" />
                          </button>
                        ) : (
                          <div className="px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[10px] font-bold text-slate-400 flex items-center gap-0.5 shadow-sm">
                            <span className="text-[12px] leading-none">⌘</span>
                            K
                          </div>
                        )}
                      </div>
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] max-h-[500px] p-0 z-50" align="start" side="bottom" sideOffset={5} onOpenAutoFocus={(e) => e.preventDefault()} onInteractOutside={(e) => {
                    // Don't close when clicking on the input
                    if (e.target.closest('input')) {
                      e.preventDefault();
                    }
                  }}>
                    <Command shouldFilter={false}>
                      <CommandList className="max-h-[500px] overflow-y-auto">
                        {!searchQuery.trim() ? (
                          <div className="p-4 text-center text-sm text-slate-500">
                            Start typing to search projects, tasks, users, workspaces, and sprints...
                          </div>
                        ) : (
                          <>
                            {filteredResults.projects.length === 0 &&
                              filteredResults.tasks.length === 0 &&
                              filteredResults.users.length === 0 &&
                              filteredResults.workspaces.length === 0 &&
                              filteredResults.sprints.length === 0 ? (
                              <div className="p-4 text-center text-sm text-slate-500">
                                <div>No results found for "{searchQuery}"</div>
                                <div className="text-xs text-slate-400 mt-1">Try a different search term</div>
                              </div>
                            ) : (
                              <>
                                {filteredResults.projects.length > 0 && (
                                  <CommandGroup heading={`Projects (${filteredResults.projects.length})`}>
                                    {filteredResults.projects.map((project) => {
                                      // Use id as primary, fallback to _id
                                      const projectId = project.id || project._id;
                                      return (
                                        <CommandItem
                                          key={projectId}
                                          onSelect={() => {
                                            if (projectId) {
                                              navigate(createPageUrl("ProjectDetail") + `?id=${projectId}`);
                                              setSearchQuery("");
                                              setSearchOpen(false);
                                            } else {
                                              console.error('[Search] Project missing ID:', project);
                                              toast.error('Project ID not found');
                                            }
                                          }}
                                          className="cursor-pointer"
                                        >
                                          <FolderKanban className="mr-2 h-4 w-4 flex-shrink-0" />
                                          <div className="flex flex-col min-w-0 flex-1">
                                            <span className="font-medium truncate">{project.name}</span>
                                            {project.description && (
                                              <span className="text-xs text-slate-500 truncate">{project.description}</span>
                                            )}
                                          </div>
                                          {project.status && (
                                            <span className="ml-2 text-xs text-slate-400 capitalize">{project.status}</span>
                                          )}
                                        </CommandItem>
                                      );
                                    })}
                                  </CommandGroup>
                                )}
                                {filteredResults.tasks.length > 0 && (
                                  <CommandGroup heading={`Tasks (${filteredResults.tasks.length})`}>
                                    {filteredResults.tasks.map((task) => {
                                      // Handle both id and _id formats
                                      const taskProjectId = task.project_id || task._project_id;
                                      const project = searchProjects?.find(p => (p._id || p.id) === taskProjectId);
                                      return (
                                        <CommandItem
                                          key={task._id || task.id}
                                          onSelect={() => {
                                            if (taskProjectId) {
                                              navigate(createPageUrl("ProjectDetail") + `?id=${taskProjectId}`);
                                            } else {
                                              navigate(createPageUrl("Projects"));
                                            }
                                            setSearchQuery("");
                                            setSearchOpen(false);
                                          }}
                                          className="cursor-pointer"
                                        >
                                          <FileText className="mr-2 h-4 w-4 flex-shrink-0" />
                                          <div className="flex flex-col min-w-0 flex-1">
                                            <span className="font-medium truncate">{task.title || 'Untitled Task'}</span>
                                            {project && (
                                              <span className="text-xs text-slate-500 truncate">in {project.name}</span>
                                            )}
                                          </div>
                                          {task.status && (
                                            <Button
                                              variant="ghost"
                                              className={`ml-2 text-xs w-fit h-fit p-1 justify-start text-white bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-md transition-all hover:shadow-lg ${isInAdminSection ? 'ring-2 ring-white/20' : ''
                                                }`}
                                              onClick={() => navigate('/admin')}
                                            >
                                              {task.status}
                                            </Button>
                                          )}
                                        </CommandItem>
                                      );
                                    })}
                                  </CommandGroup>
                                )}
                                {filteredResults.workspaces.length > 0 && (
                                  <CommandGroup heading={`Workspaces (${filteredResults.workspaces.length})`}>
                                    {filteredResults.workspaces.map((workspace) => (
                                      <CommandItem
                                        key={workspace.id}
                                        onSelect={() => {
                                          navigate(createPageUrl("Workspaces"));
                                          setSearchQuery("");
                                          setSearchOpen(false);
                                        }}
                                        className="cursor-pointer"
                                      >
                                        <Folder className="mr-2 h-4 w-4 flex-shrink-0" />
                                        <div className="flex flex-col min-w-0 flex-1">
                                          <span className="font-medium truncate">{workspace.name}</span>
                                          {workspace.description && (
                                            <span className="text-xs text-slate-500 truncate">{workspace.description}</span>
                                          )}
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                )}
                                {filteredResults.sprints.length > 0 && (
                                  <CommandGroup heading={`Sprints (${filteredResults.sprints.length})`}>
                                    {filteredResults.sprints.map((sprint) => {
                                      const project = searchProjects?.find(p => p.id === sprint.project_id);
                                      return (
                                        <CommandItem
                                          key={sprint.id}
                                          onSelect={() => {
                                            if (sprint.project_id) {
                                              navigate(createPageUrl("SprintBoard"));
                                              // Store project and sprint in sessionStorage for SprintBoard to pick up
                                              setTimeout(() => {
                                                sessionStorage.setItem('selectedProjectId', sprint.project_id);
                                                sessionStorage.setItem('selectedSprintId', sprint.id);
                                                // Trigger a custom event to notify SprintBoard
                                                window.dispatchEvent(new CustomEvent('sprint-selected', {
                                                  detail: { projectId: sprint.project_id, sprintId: sprint.id }
                                                }));
                                              }, 100);
                                            } else {
                                              navigate(createPageUrl("SprintBoard"));
                                            }
                                            setSearchQuery("");
                                            setSearchOpen(false);
                                          }}
                                          className="cursor-pointer"
                                        >
                                          <Calendar className="mr-2 h-4 w-4 flex-shrink-0" />
                                          <div className="flex flex-col min-w-0 flex-1">
                                            <span className="font-medium truncate">{sprint.name || 'Untitled Sprint'}</span>
                                            {project && (
                                              <span className="text-xs text-slate-500 truncate">in {project.name}</span>
                                            )}
                                          </div>
                                          {sprint.status && (
                                            <span className="ml-2 text-xs text-slate-400 capitalize">{sprint.status}</span>
                                          )}
                                        </CommandItem>
                                      );
                                    })}
                                  </CommandGroup>
                                )}
                                {filteredResults.users.length > 0 && (
                                  <CommandGroup heading={`Users (${filteredResults.users.length})`}>
                                    {filteredResults.users.map((userItem) => (
                                      <CommandItem
                                        key={userItem.id}
                                        onSelect={() => {
                                          navigate(createPageUrl("Team"));
                                          setSearchQuery("");
                                          setSearchOpen(false);
                                        }}
                                        className="cursor-pointer"
                                      >
                                        <Users className="mr-2 h-4 w-4 flex-shrink-0" />
                                        <div className="flex flex-col min-w-0 flex-1">
                                          <span className="font-medium truncate">{userItem.full_name || 'No Name'}</span>
                                          <span className="text-xs text-slate-500 truncate">{userItem.email}</span>
                                        </div>
                                        {userItem.role && (
                                          <span className="ml-2 text-xs text-slate-400 capitalize">{userItem.role}</span>
                                        )}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                )}
                              </>
                            )}
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {isClient && <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg"><Eye className="h-4 w-4 text-blue-600" /><span className="text-sm font-medium text-blue-900">Client Access</span></div>}
                {!isClient && isInPlatformMode && <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg"><Shield className="h-4 w-4 text-amber-600" /><span className="text-sm font-medium text-amber-900">Platform Administrator</span></div>}
                {isViewingAsTenant && viewingTenant && (
                  <div className="flex items-center gap-3 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
                    {viewingTenant.branding?.logo_url && <img src={viewingTenant.branding.logo_url} alt={viewingTenant.name} className="h-5 w-5 object-contain rounded" />}
                    <Eye className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">Viewing: {viewingTenant.name}</span>
                    <Button size="sm" variant="ghost" onClick={handleExitTenantView} disabled={exitingView} className="h-6 px-2 ml-2 text-xs text-blue-700 hover:bg-blue-100">Exit</Button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(createPageUrl("GroonaAssistant"))}
                  className="hidden sm:flex items-center gap-2 bg-gradient-to-r from-blue-600 to-slate-900 border-0 shadow-lg shadow-blue-500/20 hover:from-blue-700 hover:to-slate-950 hover:opacity-90 text-white h-10 rounded-lg px-4 font-bold transition-all active:scale-95"
                >
                  <Sparkles className="h-4 w-4 text-white/90" />
                  <span>Groona AI</span>
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => setShowReportBug(true)}
                  className="hidden rounded-lg md:flex items-center gap-2 h-10 px-4 border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm"
                >
                  <AlertCircle className="h-4 w-4" />
                  <span>Report Bug</span>
                </Button>

                <div className="relative">
                  <NotificationCenter currentUser={user} />
                </div>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto overflow-x-hidden relative" style={{ width: '100%' }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 0.3,
                  ease: "easeOut"
                }}
                style={{
                  x: 0,
                  left: 0,
                  right: 0,
                  width: '100%',
                  maxWidth: '100%',
                  position: 'relative'
                }}
                className="min-h-full w-full"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Mandatory Timesheet Alert/Alarm Overlay - Blocks main content ONLY */}
          <MandatoryTimesheetModal
            currentUser={user}
            effectiveTenantId={effectiveTenantId}
          />

          {/* Account Lockout Overlay - Blocks main content ONLY - Highest Priority */}
          {isAccountLocked && (
            <AccountLockedOverlay
              currentUser={user}
              timesheetAlerts={lockoutAlerts}
              onBackfillSuccess={() => refetchNotifications()}
            />
          )}
          <ReportBugDialog
            open={showReportBug}
            onClose={() => setShowReportBug(false)}
            tenantName={viewingTenant?.name || currentTenant?.name || viewingTenant?.organization_name || currentTenant?.organization_name || 'Individual'}
            onSuccess={() => toast.success('Bug report submitted successfully!')}
          />
        </main>
      </div>
    </>
  );
}

export default function Layout({ children, currentPageName }) {
  return (
    <UserProvider>
      <LayoutContent children={children} currentPageName={currentPageName} />
    </UserProvider>
  );
}