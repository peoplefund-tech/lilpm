import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useTeamStore } from "@/stores/teamStore";
import { useMCPStore } from "@/stores/mcpStore";
import { useThemeStore } from "@/stores/themeStore";
import { useEffect } from "react";
import { useUserTeamsRealtime, useTeamMemberRealtime } from "@/hooks/useTeamRealtime";

// Pages
import { LoginPage, SignupPage, AcceptInvitePage, CancelledInvitePage, EmailVerificationPage } from "./pages/auth";
import { LandingPage } from "./pages/LandingPage";
import { CreateTeamPage, CreateProjectPage, AISetupPage } from "./pages/onboarding";
import { AISettingsPage, GeneralSettingsPage, NotificationSettingsPage, SecuritySettingsPage, ProfilePage, MCPSettingsPage, LLMSettingsPage, GitHubSettingsPage, SlackSettingsPage } from "./pages/settings";
import { DashboardPage } from "./pages/DashboardPage";
import { IssuesPage } from "./pages/IssuesPage";
import { LilyPage } from "./pages/LilyPage";
import { TeamMembersPage } from "./pages/TeamMembersPage";
import { TeamSettingsPage } from "./pages/TeamSettingsPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import { IssueDetailPage } from "./pages/IssueDetailPage";
import { CyclesPage } from "./pages/CyclesPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { PRDPage } from "./pages/PRDPage";
import { PRDDetailPage } from "./pages/PRDDetailPage";
import { InboxPage } from "./pages/InboxPage";
import { MyIssuesPage } from "./pages/MyIssuesPage";
import NotFound from "./pages/NotFound";

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

  // Redirect to onboarding if no teams
  if (teams.length === 0 && !onboardingCompleted) {
    return <Navigate to="/onboarding/create-team" replace />;
  }

  return <>{children}</>;
}

// Auth Route wrapper (redirect if already authenticated)
function AuthRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isAuthenticated) {
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
  );
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
