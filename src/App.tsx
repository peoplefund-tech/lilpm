import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useTeamStore } from "@/stores/teamStore";
import { useMCPStore } from "@/stores/mcpStore";
import { useThemeStore } from "@/stores/themeStore";
import React, { useEffect, Suspense } from "react";
import { useUserTeamsRealtime, useTeamMemberRealtime } from "@/hooks/useTeamRealtime";
import { useCollaborationStore } from "@/stores/collaborationStore";

// Auth pages - loaded immediately
import { LoginPage, SignupPage, AcceptInvitePage, CancelledInvitePage, EmailVerificationPage, ForgotPasswordPage, ResetPasswordPage, ExpiredLinkPage } from "./pages/auth";
import { LandingPage } from "./pages/LandingPage";

// Onboarding pages - loaded immediately
import { CreateTeamPage, CreateProjectPage, AISetupPage } from "./pages/onboarding";

// Settings pages - lazy loaded
const AISettingsPage = React.lazy(() => import("./pages/settings/AISettingsPage").then(m => ({ default: m.AISettingsPage })));
const GeneralSettingsPage = React.lazy(() => import("./pages/settings/GeneralSettingsPage").then(m => ({ default: m.GeneralSettingsPage })));
const NotificationSettingsPage = React.lazy(() => import("./pages/settings/NotificationSettingsPage").then(m => ({ default: m.NotificationSettingsPage })));
const SecuritySettingsPage = React.lazy(() => import("./pages/settings/SecuritySettingsPage").then(m => ({ default: m.SecuritySettingsPage })));
const ProfilePage = React.lazy(() => import("./pages/settings/ProfilePage").then(m => ({ default: m.ProfilePage })));
const MCPSettingsPage = React.lazy(() => import("./pages/settings/MCPSettingsPage").then(m => ({ default: m.MCPSettingsPage })));
const LLMSettingsPage = React.lazy(() => import("./pages/settings/LLMSettingsPage").then(m => ({ default: m.LLMSettingsPage })));
const GitHubSettingsPage = React.lazy(() => import("./pages/settings/GitHubSettingsPage").then(m => ({ default: m.GitHubSettingsPage })));
const SlackSettingsPage = React.lazy(() => import("./pages/settings/SlackSettingsPage").then(m => ({ default: m.SlackSettingsPage })));

// Core pages - lazy loaded for performance
const DashboardPage = React.lazy(() => import("./pages/DashboardPage").then(m => ({ default: m.DashboardPage })));
const IssuesPage = React.lazy(() => import("./features/issues/pages/IssuesPage").then(m => ({ default: m.IssuesPage })));
const LilyPage = React.lazy(() => import("./features/lily/pages/LilyPage").then(m => ({ default: m.LilyPage })));
const TeamMembersPage = React.lazy(() => import("./features/team/pages/TeamMembersPage").then(m => ({ default: m.TeamMembersPage })));
const TeamSettingsPage = React.lazy(() => import("./features/team/pages/TeamSettingsPage").then(m => ({ default: m.TeamSettingsPage })));
const ProjectsPage = React.lazy(() => import("./features/projects/pages/ProjectsPage").then(m => ({ default: m.ProjectsPage })));
const ProjectDetailPage = React.lazy(() => import("./features/projects/pages/ProjectDetailPage").then(m => ({ default: m.ProjectDetailPage })));
const IssueDetailPage = React.lazy(() => import("./features/issues/pages/IssueDetailPage").then(m => ({ default: m.IssueDetailPage })));
const CyclesPage = React.lazy(() => import("./pages/CyclesPage").then(m => ({ default: m.CyclesPage })));
const NotificationsPage = React.lazy(() => import("./pages/NotificationsPage").then(m => ({ default: m.NotificationsPage })));
const PRDPage = React.lazy(() => import("./features/prd/pages/PRDPage").then(m => ({ default: m.PRDPage })));
const PRDDetailPage = React.lazy(() => import("./features/prd/pages/PRDDetailPage").then(m => ({ default: m.PRDDetailPage })));
const InboxPage = React.lazy(() => import("./pages/InboxPage").then(m => ({ default: m.InboxPage })));
const MyIssuesPage = React.lazy(() => import("./features/issues/pages/MyIssuesPage").then(m => ({ default: m.MyIssuesPage })));
const SharedConversationPage = React.lazy(() => import("./pages/SharedConversationPage").then(m => ({ default: m.SharedConversationPage })));
const DatabasePage = React.lazy(() => import("./pages/DatabasePage").then(m => ({ default: m.DatabasePage })));
const HelpPage = React.lazy(() => import("./pages/HelpPage").then(m => ({ default: m.HelpPage })));
const ArchivePage = React.lazy(() => import("./features/issues/pages/ArchivePage").then(m => ({ default: m.ArchivePage })));
const SettingsMainPage = React.lazy(() => import("./pages/SettingsPage").then(m => ({ default: m.SettingsPage })));
import NotFound from "./pages/NotFound";

// Loading component for Suspense fallback
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );
}

const queryClient = new QueryClient();

// Protected Route wrapper with onboarding check
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const { teams } = useTeamStore();
  const { onboardingCompleted } = useMCPStore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check if user needs onboarding (no teams and hasn't completed onboarding)
  // We only redirect after teams have been loaded
  if (teams.length === 0 && !onboardingCompleted) {
    // Allow navigation to onboarding pages
    return <>{children}</>;
  }

  return <>{children}</>;
}

// Onboarding check wrapper - redirects to onboarding if needed
function OnboardingCheck({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: authLoading, isEmailVerified } = useAuthStore();
  const { teams, isLoading: teamsLoading, loadTeams } = useTeamStore();
  const { onboardingCompleted } = useMCPStore();
  const location = useLocation();

  // CRITICAL: Skip onboarding redirects for invite-related paths
  // This ensures users can accept invites even without existing teams
  const isInvitePath = location.pathname.startsWith('/invite/') ||
    location.pathname.includes('/accept-invite') ||
    location.search.includes('returnUrl=') && location.search.includes('/invite/');

  useEffect(() => {
    if (isAuthenticated) {
      loadTeams();
    }
  }, [isAuthenticated, loadTeams]);

  // First check auth loading - show spinner only for auth
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Then check if authenticated - redirect before checking teams
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // SKIP all onboarding redirects for invite paths - let the invite flow handle navigation
  if (isInvitePath) {
    return <>{children}</>;
  }

  // Now check teams loading (only for authenticated users)
  if (teamsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Check if email is verified (for new signups)
  // Skip this check if user already has teams (existing user)
  if (!isEmailVerified && teams.length === 0) {
    return <Navigate to="/auth/verify-email" replace />;
  }

  // Redirect to onboarding if no teams (self-signup users need to create a team)
  if (teams.length === 0 && !onboardingCompleted) {
    return <Navigate to="/onboarding/create-team" replace />;
  }

  return <>{children}</>;
}

// Auth Route wrapper (redirect if already authenticated)
function AuthRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();

  // Check for returnUrl in search params - preserve invite flow
  const searchParams = new URLSearchParams(location.search);
  const returnUrl = searchParams.get('returnUrl');
  const isInviteReturn = returnUrl?.includes('/invite/');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // If authenticated with a returnUrl (especially invite), redirect there instead of /
  if (isAuthenticated) {
    if (returnUrl) {
      // Redirect to the returnUrl to complete the invite flow
      return <Navigate to={decodeURIComponent(returnUrl)} replace />;
    }
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// Root route - redirects unauthenticated users to landing
function RootRedirect() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/welcome" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}

function AppRoutes() {
  const { loadUser } = useAuthStore();

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Subscribe to realtime team changes (only for user being removed from teams)
  useUserTeamsRealtime();
  // NOTE: useTeamMemberRealtime is NOT used globally because each page
  // (like TeamMembersPage) handles its own member subscriptions with proper
  // dialog state awareness. Using it globally causes conflicts.

  return (
    <>
      <RouteTracker />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Root redirect - unauthenticated users go to landing */}
          <Route path="/" element={<RootRedirect />} />

          {/* Public Routes */}
          <Route path="/welcome" element={<LandingPage />} />
          <Route path="/login" element={<AuthRoute><LoginPage /></AuthRoute>} />
          <Route path="/signup" element={<AuthRoute><SignupPage /></AuthRoute>} />
          <Route path="/invite/accept" element={<AcceptInvitePage />} />
          <Route path="/invite/cancelled" element={<CancelledInvitePage />} />
          <Route path="/auth/verify-email" element={<ProtectedRoute><EmailVerificationPage /></ProtectedRoute>} />
          <Route path="/forgot-password" element={<AuthRoute><ForgotPasswordPage /></AuthRoute>} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/reset-password/expired" element={<ExpiredLinkPage />} />
          <Route path="/lily/shared/:token" element={<SharedConversationPage />} />

          {/* Onboarding Routes */}
          <Route path="/onboarding/create-team" element={<ProtectedRoute><CreateTeamPage /></ProtectedRoute>} />
          <Route path="/onboarding/create-project" element={<ProtectedRoute><CreateProjectPage /></ProtectedRoute>} />
          <Route path="/onboarding/ai-setup" element={<ProtectedRoute><AISetupPage /></ProtectedRoute>} />


          {/* Protected Routes with Onboarding Check */}
          <Route path="/dashboard" element={<OnboardingCheck><DashboardPage /></OnboardingCheck>} />
          <Route path="/inbox" element={<OnboardingCheck><InboxPage /></OnboardingCheck>} />
          <Route path="/my-issues" element={<OnboardingCheck><MyIssuesPage /></OnboardingCheck>} />
          <Route path="/issues" element={<OnboardingCheck><IssuesPage /></OnboardingCheck>} />
          <Route path="/lily" element={<OnboardingCheck><LilyPage /></OnboardingCheck>} />
          <Route path="/team/members" element={<OnboardingCheck><TeamMembersPage /></OnboardingCheck>} />
          <Route path="/team/settings" element={<OnboardingCheck><TeamSettingsPage /></OnboardingCheck>} />
          <Route path="/projects" element={<OnboardingCheck><ProjectsPage /></OnboardingCheck>} />
          <Route path="/cycles" element={<OnboardingCheck><CyclesPage /></OnboardingCheck>} />
          <Route path="/prd" element={<OnboardingCheck><PRDPage /></OnboardingCheck>} />
          <Route path="/prd/:prdId" element={<OnboardingCheck><PRDDetailPage /></OnboardingCheck>} />
          <Route path="/cycle/active" element={<OnboardingCheck><CyclesPage /></OnboardingCheck>} />
          <Route path="/cycle/:cycleId" element={<OnboardingCheck><IssuesPage /></OnboardingCheck>} />
          <Route path="/insights" element={<OnboardingCheck><DashboardPage /></OnboardingCheck>} />
          <Route path="/database" element={<OnboardingCheck><DatabasePage /></OnboardingCheck>} />
          <Route path="/help" element={<OnboardingCheck><HelpPage /></OnboardingCheck>} />
          <Route path="/archive" element={<OnboardingCheck><ArchivePage /></OnboardingCheck>} />
          <Route path="/settings/main" element={<OnboardingCheck><SettingsMainPage /></OnboardingCheck>} />
          <Route path="/project/:projectId" element={<OnboardingCheck><ProjectDetailPage /></OnboardingCheck>} />
          <Route path="/issue/:issueId" element={<OnboardingCheck><IssueDetailPage /></OnboardingCheck>} />
          <Route path="/settings" element={<OnboardingCheck><GeneralSettingsPage /></OnboardingCheck>} />
          <Route path="/settings/ai" element={<OnboardingCheck><AISettingsPage /></OnboardingCheck>} />
          <Route path="/settings/mcp" element={<OnboardingCheck><MCPSettingsPage /></OnboardingCheck>} />
          <Route path="/settings/llm" element={<OnboardingCheck><LLMSettingsPage /></OnboardingCheck>} />
          <Route path="/settings/github" element={<OnboardingCheck><GitHubSettingsPage /></OnboardingCheck>} />
          <Route path="/settings/slack" element={<OnboardingCheck><SlackSettingsPage /></OnboardingCheck>} />
          <Route path="/settings/notifications" element={<OnboardingCheck><NotificationSettingsPage /></OnboardingCheck>} />
          <Route path="/settings/security" element={<OnboardingCheck><SecuritySettingsPage /></OnboardingCheck>} />
          <Route path="/notifications" element={<OnboardingCheck><NotificationsPage /></OnboardingCheck>} />
          <Route path="/profile" element={<OnboardingCheck><ProfilePage /></OnboardingCheck>} />

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
}

// RouteTracker component to update currentPath in collaboration presence
function RouteTracker() {
  const location = useLocation();
  const { setCurrentPath, isConnected } = useCollaborationStore();

  useEffect(() => {
    if (isConnected) {
      setCurrentPath(location.pathname);
    }
  }, [location.pathname, isConnected, setCurrentPath]);

  return null;
}

// Theme wrapper component that applies the theme class
function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const { theme } = useThemeStore();

  // Apply theme to document on mount and when theme changes
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeWrapper>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ThemeWrapper>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
