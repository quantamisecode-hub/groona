import Layout from "./Layout.jsx";
import Dashboard from "./Dashboard";
import Projects from "./Projects";
import ProjectDetail from "./ProjectDetail";
import AIAssistant from "./AIAssistant";
import GroonaAssistant from "./GroonaAssistant";
import Team from "./Team";
import UserManagement from "./UserManagement";
import ProjectInsights from "./ProjectInsights";
import Timesheets from "./Timesheets";
import Automation from "./Automation";
import CodeReview from "./CodeReview";
import ResourcePlanning from "./ResourcePlanning";
import ProjectTemplates from "./ProjectTemplates";
import Timeline from "./Timeline";
import SprintBoard from "./SprintBoard";
import UserProfile from "./UserProfile";
import Collaboration from "./Collaboration";
import SuperAdminDashboard from "./SuperAdminDashboard";
import TenantOnboarding from "./TenantOnboarding";
import SuperAdminSetup from "./SuperAdminSetup";
import AISubscriptionManagement from "./AISubscriptionManagement";
import AIAnalyticsDashboard from "./AIAnalyticsDashboard";
import FixTenantOwnership from "./FixTenantOwnership";
import UpdateUserRole from "./UpdateUserRole";
import AuditLog from "./AuditLog";
import Workspaces from "./Workspaces";
import SuperAdminWorkspaces from "./SuperAdminWorkspaces";
import DiagnosticWorkspaces from "./DiagnosticWorkspaces";
import TestAIAccess from "./TestAIAccess";
import TestAIChat from "./TestAIChat";
import AdminBIDashboard from "./AdminBIDashboard";
import SupportDashboard from "./SupportDashboard";
import SubscriptionManagement from "./SubscriptionManagement";
import PaymentGateways from "./PaymentGateways"; // New Page
import SystemNotificationManager from "./SystemNotificationManager";
import ProjectFinancials from "./ProjectFinancials";
import Chat from "./Chat";
import PlannedLeaves from "./PlannedLeaves";
import SprintPlanningPage from "./SprintPlanningPage";
import ProposalEditor from "./ProposalEditor";
import SalesKnowledgeBase from "./SalesKnowledgeBase";
import SignIn from "./SignIn";
import Register from "./Register";
import SubscriptionExpired from "./SubscriptionExpired";
import ProjectManagerDashboard from "./ProjectManagerDashboard";
import MyTickets from "./MyTickets";
import UserOnboarding from "./UserOnboarding";
import ClientDashboard from "./ClientDashboard";
import ClientManagement from "./ClientManagement";
import Reports from "./Reports";
import LandingPage from "./LandingPage";
import Features from "./Features";
import Pricing from "./Pricing";
import AboutUs from "./AboutUs";
import VerifyOTP from "./VerifyOTP";
import ForgotPassword from "./ForgotPassword";
import ResetPassword from "./ResetPassword";
import AcceptInvitation from "./AcceptInvitation";
// IMPORT THE NEW PAGE
import ClientChangePassword from "./ClientChangePassword";
import PaymentsHistory from "./PaymentsHistory";

import ProjectProfitabilityDetail from "./ProjectProfitabilityDetail"; // New Page

import { Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    Dashboard: Dashboard,
    Projects: Projects,
    ProjectDetail: ProjectDetail,
    ProjectProfitabilityDetail: ProjectProfitabilityDetail, // Register new page
    AIAssistant: AIAssistant,
    GroonaAssistant: GroonaAssistant,
    Team: Team,
    UserManagement: UserManagement,
    ProjectInsights: ProjectInsights,
    Timesheets: Timesheets,
    Automation: Automation,
    CodeReview: CodeReview,
    ResourcePlanning: ResourcePlanning,
    ProjectTemplates: ProjectTemplates,
    Timeline: Timeline,
    SprintBoard: SprintBoard,
    UserProfile: UserProfile,
    Collaboration: Collaboration,
    SuperAdminDashboard: SuperAdminDashboard,
    TenantOnboarding: TenantOnboarding,
    SuperAdminSetup: SuperAdminSetup,
    AISubscriptionManagement: AISubscriptionManagement,
    AIAnalyticsDashboard: AIAnalyticsDashboard,
    FixTenantOwnership: FixTenantOwnership,
    UpdateUserRole: UpdateUserRole,
    AuditLog: AuditLog,
    Workspaces: Workspaces,
    SuperAdminWorkspaces: SuperAdminWorkspaces,
    DiagnosticWorkspaces: DiagnosticWorkspaces,
    TestAIAccess: TestAIAccess,
    TestAIChat: TestAIChat,
    AdminBIDashboard: AdminBIDashboard,
    SupportDashboard: SupportDashboard,
    SubscriptionManagement: SubscriptionManagement,
    PaymentGateways: PaymentGateways, // Added here
    SystemNotificationManager: SystemNotificationManager,
    ProjectFinancials: ProjectFinancials,
    Chat: Chat,
    PlannedLeaves: PlannedLeaves,
    SprintPlanningPage: SprintPlanningPage,
    ProposalEditor: ProposalEditor,
    SalesKnowledgeBase: SalesKnowledgeBase,
    SignIn: SignIn,
    Register: Register,
    SubscriptionExpired: SubscriptionExpired,
    ProjectManagerDashboard: ProjectManagerDashboard,
    MyTickets: MyTickets,
    UserOnboarding: UserOnboarding,
    ClientDashboard: ClientDashboard,
    ClientManagement: ClientManagement,
    Reports: Reports,
    LandingPage: LandingPage,
    Features: Features,
    Pricing: Pricing,
    AboutUs: AboutUs,
    VerifyOTP: VerifyOTP,
    ForgotPassword: ForgotPassword,
    ResetPassword: ResetPassword,
    AcceptInvitation: AcceptInvitation,
    ClientChangePassword: ClientChangePassword, // Added here
    PaymentsHistory: PaymentsHistory,
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    // FIX 1: Normalize URL part by removing hyphens to match component names
    // e.g., 'reset-password' becomes 'resetpassword', which matches 'ResetPassword' key (case-insensitive)
    const normalizedUrlPart = urlLastPart.replace(/-/g, '').toLowerCase();

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === normalizedUrlPart);
    return pageName || Object.keys(PAGES)[0];
}

function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);

    // Define pages that should NOT have the Sidebar/Layout
    const standalonePages = [
        'LandingPage',
        'SignIn',
        'Register',
        'VerifyOTP',
        'ForgotPassword',
        'ResetPassword',
        'AcceptInvitation',
        'ClientChangePassword',
        'Features',
        'Pricing',
        'AboutUs',
        'UserOnboarding',
        'TenantOnboarding',
        'SubscriptionManagement'
    ];

    const isStandalone = standalonePages.includes(currentPage) || location.pathname === '/' || location.pathname === '/accept-invitation';

    // RENDER 1: Standalone Pages (No Sidebar)
    if (isStandalone) {
        return (
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/LandingPage" element={<LandingPage />} />
                <Route path="/SignIn" element={<SignIn />} />
                <Route path="/Register" element={<Register />} />

                <Route path="/VerifyOTP" element={<VerifyOTP />} />
                <Route path="/verify-otp" element={<VerifyOTP />} />

                <Route path="/ForgotPassword" element={<ForgotPassword />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />

                <Route path="/ResetPassword" element={<ResetPassword />} />
                {/* FIX 2: Explicitly add the kebab-case route that comes from the email */}
                <Route path="/reset-password" element={<ResetPassword />} />

                <Route path="/accept-invitation" element={<AcceptInvitation />} />
                <Route path="/ClientChangePassword" element={<ClientChangePassword />} />
                <Route path="/client-change-password" element={<ClientChangePassword />} />

                <Route path="/Features" element={<Features />} />
                <Route path="/Pricing" element={<Pricing />} />
                <Route path="/AboutUs" element={<AboutUs />} />
                <Route path="/UserOnboarding" element={<UserOnboarding />} />
                <Route path="/TenantOnboarding" element={<TenantOnboarding />} />
                <Route path="/SubscriptionManagement" element={<SubscriptionManagement />} />
                <Route path="/subscription-management" element={<SubscriptionManagement />} />
            </Routes>
        );
    }

    // RENDER 2: Dashboard Pages (With Layout)
    return (
        <Layout currentPageName={currentPage}>
            <Routes>
                <Route path="/Dashboard" element={<Dashboard />} />
                <Route path="/Projects" element={<Projects />} />
                <Route path="/ProjectDetail" element={<ProjectDetail />} />
                <Route path="/AIAssistant" element={<AIAssistant />} />
                <Route path="/groonaassistant" element={<GroonaAssistant />} />
                <Route path="/GroonaAssistant" element={<GroonaAssistant />} />
                <Route path="/groona-assistant" element={<GroonaAssistant />} />
                <Route path="/Team" element={<Team />} />
                <Route path="/UserManagement" element={<UserManagement />} />
                <Route path="/ProjectInsights" element={<ProjectInsights />} />
                <Route path="/Timesheets" element={<Timesheets />} />
                <Route path="/Automation" element={<Automation />} />
                <Route path="/CodeReview" element={<CodeReview />} />
                <Route path="/ResourcePlanning" element={<ResourcePlanning />} />
                <Route path="/ProjectTemplates" element={<ProjectTemplates />} />
                <Route path="/Timeline" element={<Timeline />} />
                <Route path="/SprintBoard" element={<SprintBoard />} />
                <Route path="/UserProfile" element={<UserProfile />} />
                <Route path="/Collaboration" element={<Collaboration />} />
                <Route path="/SuperAdminDashboard" element={<SuperAdminDashboard />} />
                <Route path="/SuperAdminSetup" element={<SuperAdminSetup />} />
                <Route path="/AISubscriptionManagement" element={<AISubscriptionManagement />} />
                <Route path="/AIAnalyticsDashboard" element={<AIAnalyticsDashboard />} />
                <Route path="/FixTenantOwnership" element={<FixTenantOwnership />} />
                <Route path="/UpdateUserRole" element={<UpdateUserRole />} />
                <Route path="/AuditLog" element={<AuditLog />} />
                <Route path="/Workspaces" element={<Workspaces />} />
                <Route path="/SuperAdminWorkspaces" element={<SuperAdminWorkspaces />} />
                <Route path="/DiagnosticWorkspaces" element={<DiagnosticWorkspaces />} />
                <Route path="/TestAIAccess" element={<TestAIAccess />} />
                <Route path="/TestAIChat" element={<TestAIChat />} />
                <Route path="/AdminBIDashboard" element={<AdminBIDashboard />} />
                <Route path="/SupportDashboard" element={<SupportDashboard />} />
                <Route path="/SystemNotificationManager" element={<SystemNotificationManager />} />
                <Route path="/ProjectFinancials" element={<ProjectFinancials />} />
                <Route path="/ProjectProfitabilityDetail" element={<ProjectProfitabilityDetail />} />
                <Route path="/PaymentGateways" element={<PaymentGateways />} />
                <Route path="/Chat" element={<Chat />} />
                <Route path="/PlannedLeaves" element={<PlannedLeaves />} />
                <Route path="/SprintPlanningPage" element={<SprintPlanningPage />} />
                <Route path="/ProposalEditor" element={<ProposalEditor />} />
                <Route path="/SalesKnowledgeBase" element={<SalesKnowledgeBase />} />
                <Route path="/SubscriptionExpired" element={<SubscriptionExpired />} />
                <Route path="/ProjectManagerDashboard" element={<ProjectManagerDashboard />} />
                <Route path="/MyTickets" element={<MyTickets />} />
                <Route path="/ClientDashboard" element={<ClientDashboard />} />
                <Route path="/ClientManagement" element={<ClientManagement />} />
                <Route path="/Reports" element={<Reports />} />
                <Route path="/PaymentsHistory" element={<PaymentsHistory />} />
            </Routes>
        </Layout>
    );
}

// Router is provided by App.jsx
export default function Pages() {
    return (
        <PagesContent />
    );
}
