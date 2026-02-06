import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Home,
  Layers,
  Settings,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Plus,
  MessageSquare,
  Sparkles,
  Command,
  Search,
  Inbox,
  BarChart3,
  ListTodo,
  FileText,
  PanelLeft,
  Bell,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  Pencil,
  Trash2,
  ArrowLeft,
  Layout,
  Target,
  GanttChartSquare,
  Folder,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useTeamStore } from '@/stores/teamStore';
import { useLilyStore } from '@/stores/lilyStore';
import { useSidebarStore } from '@/stores/sidebarStore';
import { useCollaborationStore } from '@/stores/collaborationStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { projectService } from '@/lib/services/projectService';
import { formatDistanceToNow } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
// Use Badge from UI library, ensuring we handle the icon prop if necessary or wrapping it
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NotificationDropdown } from '../notifications/NotificationDropdown';

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  href: string;
  badge?: React.ReactNode;
  active?: boolean;
  shortcut?: string;
  onClick?: () => void;
}

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'ko' ? ko : enUS;

  const { user, signOut } = useAuthStore();
  const { currentTeam, teams, selectTeam } = useTeamStore();
  const { users: collaborationUsers } = useCollaborationStore();
  const { unreadCount } = useNotificationStore();

  const {
    conversations,
    currentConversationId,
    loadConversations,
    createConversation,
    loadConversation,
    updateConversationTitle,
    pinConversation,
    deleteConversation,
    toggleLilyMode,
  } = useLilyStore();

  const {
    isCollapsed,
    toggleSidebar,
    width,
    isResizing,
    startResizing,
    isLilyMode,
    setIsLilyMode
  } = useSidebarStore();

  const [projects, setProjects] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLilySidebar, setShowLilySidebar] = useState(false);
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [pinnedConversations, setPinnedConversations] = useState<string[]>([]); // This should ideally come from backend

  // Load projects
  useEffect(() => {
    if (currentTeam) {
      projectService.getProjects(currentTeam.id).then(setProjects);
    }
  }, [currentTeam]);

  // Load conversations when entering Lily mode
  useEffect(() => {
    if (currentTeam && isLilyMode) {
      loadConversations(currentTeam.id);
    }
  }, [currentTeam, isLilyMode, loadConversations]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Global shortcuts
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // Toggle command palette (to be implemented)
      }

      // Navigation shortcuts (G then Key)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'g') {
        // We need a way to detect the next key press for 'g then x' pattern
        // This is a simple implementation
        const handleNext = (e2: KeyboardEvent) => {
          if (e2.key === 'i') navigate('/issues');
          if (e2.key === 'm') navigate('/my-issues');
          if (e2.key === 'd') navigate('/dashboard');

          window.removeEventListener('keydown', handleNext);
        };
        window.addEventListener('keydown', handleNext, { once: true });
        // Timeout to clear listener if no key pressed
        setTimeout(() => window.removeEventListener('keydown', handleNext), 1000);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const style = {
    width: isCollapsed ? '64px' : `${width}px`,
    transition: isResizing ? 'none' : 'width 0.3s ease',
  };

  // Helper to get users on a specific path
  const getUsersOnPath = (path: string) => {
    return collaborationUsers.filter(u => u.currentPath === path && u.odId !== user?.id);
  };

  const NavItem = ({ icon: Icon, label, href, shortcut, badge, active = false, onClick }: NavItemProps) => {
    const isActive = active || location.pathname === href || (href !== '/dashboard' && location.pathname.startsWith(href));
    const usersOnPath = getUsersOnPath(href);

    // Don't show tooltip if collapsed (sidebar handles it)
    const content = (
      <Button
        variant="ghost"
        className={cn(
          "w-full justify-start h-9 px-2 mb-1 group relative",
          isCollapsed ? "justify-center px-0" : "justify-between",
          isActive ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
        )}
        onClick={() => {
          if (onClick) onClick();
          else navigate(href);
        }}
      >
        <div className={cn("flex items-center gap-2 overflow-hidden", isCollapsed && "gap-0")}>
          <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
          {!isCollapsed && <span className="truncate text-sm">{label}</span>}
        </div>

        {!isCollapsed && (
          <div className="flex items-center gap-2 ml-auto">
            {/* Presence Avatars */}
            {usersOnPath.length > 0 && (
              <div className="flex -space-x-1 mr-1">
                {usersOnPath.slice(0, 3).map(u => (
                  <div
                    key={u.odId}
                    className="w-4 h-4 rounded-full border border-background flex items-center justify-center text-[8px] text-white"
                    style={{ backgroundColor: u.color }}
                    title={`${u.name} is here`}
                  >
                    {u.avatarUrl ? (
                      <img src={u.avatarUrl} alt={u.name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      u.name.charAt(0).toUpperCase()
                    )}
                  </div>
                ))}
                {usersOnPath.length > 3 && (
                  <div className="w-4 h-4 rounded-full bg-muted border border-background flex items-center justify-center text-[8px]">
                    +{usersOnPath.length - 3}
                  </div>
                )}
              </div>
            )}

            {badge && (
              <div className="flex items-center">
                {badge}
              </div>
            )}

            {shortcut && !badge && (
              <span className="hidden group-hover:block text-[10px] text-muted-foreground bg-background/50 px-1 rounded border border-border/50">
                {shortcut}
              </span>
            )}
          </div>
        )}

        {/* Floating badge for collapsed state */}
        {isCollapsed && badge && (
          <div className="absolute top-0 right-0 transform translate-x-1/4 -translate-y-1/4">
            {badge}
          </div>
        )}
      </Button>
    );

    if (isCollapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right">
            <div className="flex items-center gap-2">
              {label}
              {shortcut && <span className="text-muted-foreground text-xs">({shortcut})</span>}
            </div>
          </TooltipContent>
        </Tooltip>
      );
    }

    return content;
  };

  const handleNewConversation = async () => {
    if (currentTeam) {
      await createConversation(currentTeam.id);
    }
  };

  const handleSelectConversation = async (conversationId: string) => {
    await loadConversation(conversationId);
  };

  const handleEditTitle = (convId: string, currentTitle: string) => {
    setEditingConvId(convId);
    setEditingTitle(currentTitle);
  };

  const handleSaveEditTitle = (convId: string) => {
    if (editingTitle.trim()) {
      updateConversationTitle(convId, editingTitle.trim());
    }
    setEditingConvId(null);
  };

  const handleKeyDownTitle = (e: React.KeyboardEvent, convId: string) => {
    if (e.key === 'Enter') handleSaveEditTitle(convId);
    if (e.key === 'Escape') setEditingConvId(null);
  };

  const handlePinConversation = (convId: string, pin: boolean) => {
    // This would typically update backend too. For now we just update local state if store doesn't handle it fully
    pinConversation(convId, pin);
    // Store likely handles state update, but we might need local toggle if store updates are async only
  };

  if (isLilyMode && showLilySidebar) {
    // Lily Mode Sidebar (Conversation history)
    // Omitted for brevity, using normal sidebar for now or implement if needed
  }

  return (
    <aside
      className={cn(
        "relative flex flex-col h-screen bg-sidebar border-r border-border shrink-0 z-30",
        isResizing && "select-none"
      )}
      style={style}
    >
      {/* Team Selector / Header */}
      <div className="h-14 flex items-center px-3 border-b border-border">
        {!isCollapsed ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-between px-2 h-9 overflow-hidden">
                <div className="flex items-center gap-2 truncate">
                  <div className="h-5 w-5 bg-primary/20 rounded flex items-center justify-center text-primary font-bold text-xs shrink-0">
                    {currentTeam?.name.substring(0, 1).toUpperCase()}
                  </div>
                  <span className="truncate font-semibold">{currentTeam?.name}</span>
                </div>
                <MoreVertical className="h-4 w-4 text-muted-foreground shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="start">
              <DropdownMenuLabel>{t('team.switch', 'Switch Team')}</DropdownMenuLabel>
              {teams.map(team => (
                <DropdownMenuItem key={team.id} onClick={() => selectTeam(team.id)}>
                  <div className="flex items-center gap-2 w-full">
                    <div className="h-4 w-4 bg-primary/10 rounded flex items-center justify-center text-[10px]">
                      {team.name.substring(0, 1).toUpperCase()}
                    </div>
                    <span className="truncate flex-1">{team.name}</span>
                    {currentTeam?.id === team.id && <CheckCircle2 className="h-3 w-3 text-primary" />}
                  </div>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/onboarding/create-team')}>
                <Plus className="h-4 w-4 mr-2" />
                {t('team.create', 'Create Team')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/team/settings')}>
                <Settings className="h-4 w-4 mr-2" />
                {t('team.settings', 'Team Settings')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="w-full flex justify-center">
            <div className="h-8 w-8 bg-primary/20 rounded flex items-center justify-center text-primary font-bold">
              {currentTeam?.name.substring(0, 1).toUpperCase()}
            </div>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1 py-3">
        <div className="px-3 space-y-6">
          {/* Section 1: Main */}
          <div>
            <NavItem
              icon={Home}
              label={t('nav.dashboard', 'Dashboard')}
              href="/dashboard"
              shortcut="G D"
            />
            <NavItem
              icon={Inbox}
              label={t('nav.inbox', 'Inbox')}
              href="/inbox"
              shortcut="I"
              badge={unreadCount > 0 ? (
                <Badge variant="destructive" className="h-5 px-1.5 min-w-[1.25rem] flex items-center justify-center text-[10px] font-normal">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Badge>
              ) : undefined}
            />
            <NavItem
              icon={Layers}
              label={t('nav.myIssues', 'My Issues')}
              href="/my-issues"
              shortcut="G M"
            />
          </div>

          {/* Section 2: Workspace */}
          <div>
            {!isCollapsed && <h3 className="mb-2 px-2 text-xs font-semibold text-muted-foreground tracking-wider">{t('nav.workspace', 'Workspace')}</h3>}
            <NavItem
              icon={ListTodo}
              label={t('nav.allIssues', 'Issues')}
              href="/issues"
              shortcut="G I"
            />
            <NavItem
              icon={GanttChartSquare}
              label={t('nav.gantt', 'Gantt')}
              href="/issues?view=gantt"
            />
            <NavItem
              icon={Target}
              label={t('nav.cycles', 'Cycles')}
              href="/cycles"
            />
            <NavItem
              icon={FileText}
              label={t('nav.prd', 'PRD')}
              href="/prd"
            />
            <NavItem
              icon={Folder}
              label={t('nav.projects', 'Projects')}
              href="/projects"
            />
            <NavItem
              icon={Sparkles}
              label="LILY AI"
              href="/lily"
              active={isLilyMode}
              onClick={toggleLilyMode}
            />
          </div>
        </div>
      </ScrollArea>

      {/* Footer / User Profile */}
      <div className="p-3 border-t border-border mt-auto">
        <div className="flex items-center gap-2">
          {!isCollapsed ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start px-2 h-10">
                  <Avatar className="h-6 w-6 mr-2">
                    <AvatarImage src={user?.user_metadata?.avatar_url} />
                    <AvatarFallback>{user?.email?.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start overflow-hidden">
                    <span className="text-sm font-medium truncate w-full text-left">{user?.user_metadata?.full_name || user?.email?.split('@')[0]}</span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <Users className="h-4 w-4 mr-2" />
                  {t('nav.profile', 'Profile')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <Settings className="h-4 w-4 mr-2" />
                  {t('nav.settings', 'Settings')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />
                  {t('auth.signOut', 'Sign Out')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 mx-auto">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={user?.user_metadata?.avatar_url} />
                    <AvatarFallback>{user?.email?.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="right">
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <Users className="h-4 w-4 mr-2" />
                  {t('nav.profile', 'Profile')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  {t('auth.signOut', 'Sign Out')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Collapse Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border border-border bg-background shadow-md hidden group-hover:flex z-40",
            isCollapsed && "flex -right-3"
          )}
          onClick={toggleSidebar}
        >
          {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </Button>

        {/* Resizer */}
        <div
          className="absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-primary/20 active:bg-primary/40 transition-colors z-50"
          onMouseDown={startResizing}
        />
      </div>
    </aside>
  );
}
