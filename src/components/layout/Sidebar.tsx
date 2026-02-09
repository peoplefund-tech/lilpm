import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Home,
  Inbox,
  Search,
  Layers,
  Settings,
  Plus,
  ChevronDown,
  ChevronRight,
  Database,
  Users,
  HelpCircle,
  Folder,
  Sparkles,
  Target,
  FileText,
  Archive,
  GanttChartSquare,
  ArrowLeft,
  MessageSquare,
  Pin,
  PinOff,
  Pencil,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTeamStore } from '@/stores/teamStore';
import { useLilyStore } from '@/stores';
import { useCollaborationStore } from '@/stores/collaborationStore';
import { useNotificationStore } from '@/stores/notificationStore';

import { formatDistanceToNow } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

import { NavItem, ConversationListItem } from './SidebarComponents';
import { useSidebarKeyboardShortcuts } from './hooks';

// NavItem and ConversationListItem are now imported from ./SidebarComponents


// Project icons are intentionally removed - use Lucide icons instead
const PROJECT_ICONS: Record<string, string> = {};

interface SidebarProps {
  onNavigate?: () => void;
  style?: React.CSSProperties;
}

export function Sidebar({ onNavigate, style }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'ko' ? ko : enUS;
  const { currentTeam, teams, selectTeam, projects, isLoading: isTeamLoading } = useTeamStore();
  const { users } = useCollaborationStore();
  const { unreadCount } = useNotificationStore();
  const {
    conversations,
    currentConversationId,
    loadConversations,
    loadConversation,
    createConversation,
    deleteConversation,
    updateConversationTitle,
    pinConversation,
  } = useLilyStore();

  const [projectsOpen, setProjectsOpen] = useState(true);
  const [teamsOpen, setTeamsOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Lily mode state - manually controlled sidebar mode
  const isOnLilyPage = location.pathname === '/lily';
  const [showLilySidebar, setShowLilySidebar] = useState(false);
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [pinnedConversations, setPinnedConversations] = useState<string[]>([]);

  // Auto-switch to Lily sidebar when entering /lily page
  useEffect(() => {
    if (isOnLilyPage && !showLilySidebar) {
      setShowLilySidebar(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnLilyPage]);

  // Determine if Lily sidebar should be shown
  const isLilyMode = isOnLilyPage && showLilySidebar;

  // Load pinned conversations
  useEffect(() => {
    const pinned = JSON.parse(localStorage.getItem('pinnedConversations') || '[]');
    setPinnedConversations(pinned);
  }, [conversations]);

  // Load conversations when in Lily mode and team changes
  useEffect(() => {
    if (isLilyMode && currentTeam?.id) {
      loadConversations(currentTeam.id);
    }
  }, [isLilyMode, currentTeam?.id, loadConversations]);

  const handleNavigate = (path: string) => {
    navigate(path);
    onNavigate?.();
  };



  // Keyboard shortcuts (extracted to hook)
  useSidebarKeyboardShortcuts(setSearchOpen);

  const mainNav = [
    { icon: Home, label: t('nav.dashboard', 'Dashboard'), href: '/dashboard', shortcut: 'G D' },
    { icon: Inbox, label: t('nav.inbox'), href: '/inbox', shortcut: 'I', badge: unreadCount },
    { icon: Layers, label: t('nav.myIssues'), href: '/my-issues', shortcut: 'G M' },
  ];

  // Dashboard menu is always at the very top
  const dashboardNav = { icon: Home, label: t('nav.dashboard', 'Dashboard'), href: '/dashboard', shortcut: 'G D' };

  const workspaceNav = [
    { icon: Layers, label: t('nav.allIssues'), href: '/issues', shortcut: 'G I' },
    { icon: Target, label: t('nav.cycles'), href: '/cycles' },
    { icon: FileText, label: t('nav.prd', 'PRD'), href: '/prd' },
    { icon: Folder, label: t('nav.projects'), href: '/projects' },
    { icon: Database, label: t('nav.database'), href: '/database' },
  ];

  // Helper function to get presence users for a given path
  const getPresenceForPath = (path: string) => {
    return users
      .filter(user => user.currentPath === path)
      .map(user => ({
        odId: user.odId,
        name: user.name,
        avatarUrl: user.avatarUrl,
        color: user.color
      }));
  };

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleNewConversation = async () => {
    if (currentTeam) {
      await createConversation(currentTeam.id);
    }
  };

  const handleSelectConversation = async (conversationId: string) => {
    await loadConversation(conversationId);
  };

  const handleSaveEditTitle = (convId: string) => {
    if (editingTitle.trim()) {
      updateConversationTitle(convId, editingTitle.trim());
    }
    setEditingConvId(null);
  };

  const handlePinConversation = (convId: string, pin: boolean) => {
    pinConversation(convId, pin);
    if (pin) {
      setPinnedConversations(prev => [...prev, convId]);
    } else {
      setPinnedConversations(prev => prev.filter(id => id !== convId));
    }
  };

  // If in Lily mode, show conversation history sidebar
  if (isLilyMode) {
    return (
      <aside className="flex-1 bg-[#1a1a1f] border-r border-white/5 flex flex-col" style={style}>
        {/* Back button header */}
        <div className="h-12 flex items-center px-3 border-b border-white/5 gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/5"
            onClick={() => setShowLilySidebar(false)}
            title={t('common.back', 'Back to menu')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            <span className="font-semibold text-sm text-white">{t('lily.title')}</span>
          </div>
        </div>

        {/* New Conversation Button */}
        <div className="px-3 py-3 border-b border-white/5">
          <Button
            onClick={handleNewConversation}
            className="w-full gap-2 bg-violet-500 hover:bg-violet-400 text-white"
            size="sm"
          >
            <Plus className="h-4 w-4" />
            {t('lily.newConversation', 'New Chat')}
          </Button>
        </div>

        {/* Conversation List */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {conversations.length === 0 ? (
              <p className="text-center text-slate-500 text-sm py-4">
                {t('lily.noHistory', 'No conversations yet')}
              </p>
            ) : (
              <>
                {/* Pinned */}
                {conversations.filter(c => pinnedConversations.includes(c.id)).length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs font-medium text-slate-500 px-2 mb-1 flex items-center gap-1">
                      <Pin className="h-3 w-3" />
                      {t('lily.pinned', 'Pinned')}
                    </p>
                    {conversations.filter(c => pinnedConversations.includes(c.id)).map((conv) => (
                      <ConversationListItem
                        key={conv.id}
                        conv={conv}
                        isPinned={true}
                        isSelected={currentConversationId === conv.id}
                        isEditing={editingConvId === conv.id}
                        editingTitle={editingTitle}
                        dateLocale={dateLocale}
                        t={t}
                        onSelect={() => handleSelectConversation(conv.id)}
                        onDelete={() => deleteConversation(conv.id)}
                        onPin={() => handlePinConversation(conv.id, false)}
                        onStartEdit={() => { setEditingConvId(conv.id); setEditingTitle(conv.title || ''); }}
                        onSaveEdit={() => handleSaveEditTitle(conv.id)}
                        onCancelEdit={() => setEditingConvId(null)}
                        onEditingTitleChange={setEditingTitle}
                      />
                    ))}
                  </div>
                )}

                {/* Recent */}
                {conversations.filter(c => !pinnedConversations.includes(c.id)).length > 0 && (
                  <div>
                    {pinnedConversations.length > 0 && (
                      <p className="text-xs font-medium text-slate-500 px-2 mb-1">
                        {t('lily.recent', 'Recent')}
                      </p>
                    )}
                    {conversations.filter(c => !pinnedConversations.includes(c.id)).map((conv) => (
                      <ConversationListItem
                        key={conv.id}
                        conv={conv}
                        isPinned={false}
                        isSelected={currentConversationId === conv.id}
                        isEditing={editingConvId === conv.id}
                        editingTitle={editingTitle}
                        dateLocale={dateLocale}
                        t={t}
                        onSelect={() => handleSelectConversation(conv.id)}
                        onDelete={() => deleteConversation(conv.id)}
                        onPin={() => handlePinConversation(conv.id, true)}
                        onStartEdit={() => { setEditingConvId(conv.id); setEditingTitle(conv.title || ''); }}
                        onSaveEdit={() => handleSaveEditTitle(conv.id)}
                        onCancelEdit={() => setEditingConvId(null)}
                        onEditingTitleChange={setEditingTitle}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        {/* Settings */}
        <div className="border-t border-white/5 p-3">
          <NavItem
            icon={Settings}
            label={t('common.settings')}
            href="/settings"
            onClick={onNavigate}
          />
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex-1 bg-[#1a1a1f] border-r border-white/5 flex flex-col" style={style}>
      {/* Logo */}
      <div className="h-12 flex items-center px-3 border-b border-white/5">
        <Link to="/" onClick={onNavigate} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <span className="text-white font-bold text-xs">LP</span>
          </div>
          <span className="font-semibold text-sm text-white">Lil PM</span>
        </Link>
      </div>

      {/* Team Switcher */}
      <div className="px-3 py-2 border-b border-white/5">
        <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1.5 px-2">
          {t('nav.team', 'Team')}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 hover:bg-white/5 rounded-md px-2 py-1.5 w-full">
              <div
                className="h-6 w-6 rounded flex items-center justify-center text-xs font-semibold bg-violet-500 text-white"
              >
                {currentTeam?.name?.charAt(0) || 'T'}
              </div>
              <span className="flex-1 text-sm font-medium text-left truncate text-white">
                {currentTeam?.name || t('nav.selectTeam')}
              </span>
              <ChevronDown className="h-4 w-4 text-slate-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 bg-[#1a1a1f] border-white/10">
            <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {t('nav.teams')}
            </div>
            {teams.map((team) => (
              <DropdownMenuItem
                key={team.id}
                onClick={() => {
                  if (currentTeam?.id !== team.id) {
                    selectTeam(team.id);
                    navigate('/'); // Navigate to dashboard when team changes
                  }
                }}
                className={cn("text-slate-300 focus:text-white focus:bg-white/5", currentTeam?.id === team.id && "bg-white/5")}
              >
                <div
                  className="h-5 w-5 rounded flex items-center justify-center text-xs font-semibold mr-2 bg-violet-500/80 text-white"
                >
                  {team.name.charAt(0)}
                </div>
                {team.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            {currentTeam && (
              <>
                <DropdownMenuItem onClick={() => { navigate('/team/settings'); onNavigate?.(); }}>
                  <Settings className="h-4 w-4 mr-2" />
                  {t('nav.teamSettings')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { navigate('/team/members'); onNavigate?.(); }}>
                  <Users className="h-4 w-4 mr-2" />
                  {t('nav.teamMembers')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={() => navigate('/onboarding/create-team')}>
              <Plus className="h-4 w-4 mr-2" />
              {t('nav.createTeam')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-slate-400 hover:text-white hover:bg-white/5 rounded-md transition-colors"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">{t('common.search')}...</span>
          <span className="text-xs text-slate-600">⌘K</span>
        </button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
        <div className="space-y-0.5">
          {mainNav.map((item) => (
            <NavItem
              key={item.href}
              {...item}
              isActive={location.pathname === item.href}
              onClick={onNavigate}
              presenceUsers={getPresenceForPath(item.href)}
            />
          ))}
        </div>

        {/* Lily Chat - Special highlight */}
        <div className="space-y-0.5">
          {isOnLilyPage ? (
            <button
              onClick={() => setShowLilySidebar(true)}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors group w-full",
                "bg-gradient-to-r from-violet-500/10 to-purple-500/10 hover:from-violet-500/20 hover:to-purple-500/20",
                "from-violet-500/20 to-purple-500/20"
              )}
            >
              <Sparkles className="h-4 w-4 text-violet-500" />
              <span className="flex-1 truncate font-medium text-left">{t('lily.viewHistory', 'Lil PM AI')}</span>
              <MessageSquare className="h-3.5 w-3.5 text-violet-500" />
            </button>
          ) : (
            <Link
              to="/lily"
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors group",
                "bg-gradient-to-r from-violet-500/10 to-purple-500/10 hover:from-violet-500/20 hover:to-purple-500/20"
              )}
            >
              <Sparkles className="h-4 w-4 text-violet-500" />
              <span className="flex-1 truncate font-medium">{t('lily.title')}</span>
              <span className="hidden group-hover:inline-flex text-xs text-muted-foreground kbd">L</span>
            </Link>
          )}
        </div>

        {/* Projects Section - Moved up */}
        <Collapsible open={projectsOpen} onOpenChange={setProjectsOpen}>
          <div className="flex items-center gap-1">
            <CollapsibleTrigger className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground">
              {projectsOpen ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              {t('nav.projects')}
            </CollapsibleTrigger>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 ml-auto"
              onClick={() => { navigate('/projects'); onNavigate?.(); }}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <CollapsibleContent className="space-y-0.5 mt-1">
            {!isTeamLoading && projects.length === 0 ? (
              <p className="px-2 py-1 text-xs text-muted-foreground">
                No projects yet
              </p>
            ) : (
              projects.slice(0, 8).map((project) => (
                <Link
                  key={project.id}
                  to={`/project/${project.id}`}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                    "hover:bg-accent",
                    location.pathname === `/project/${project.id}` && "bg-accent"
                  )}
                >
                  <Folder className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{project.name}</span>
                  {/* Show presence avatars for users on this project page */}
                  {getPresenceForPath(`/project/${project.id}`).length > 0 && (
                    <div className="flex -space-x-1">
                      {getPresenceForPath(`/project/${project.id}`).slice(0, 2).map((user) => (
                        <div
                          key={user.odId}
                          className="w-4 h-4 rounded-full border border-background flex items-center justify-center text-[8px] font-medium text-white"
                          style={{ backgroundColor: user.color }}
                          title={user.name}
                        >
                          {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt={user.name} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            user.name.charAt(0).toUpperCase()
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Link>
              ))
            )}
            {projects.length > 8 && (
              <Link
                to="/projects"
                onClick={onNavigate}
                className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                +{projects.length - 8} more
              </Link>
            )}
          </CollapsibleContent>
        </Collapsible>


        {/* Workspace Section */}
        <div className="space-y-0.5">
          <div className="px-2 py-1 text-xs font-medium text-slate-500 uppercase tracking-wider">
            Workspace
          </div>
          {workspaceNav.map((item) => (
            <NavItem
              key={item.href}
              {...item}
              isActive={location.pathname === item.href}
              onClick={onNavigate}
              presenceUsers={getPresenceForPath(item.href)}
            />
          ))}
        </div>

      </nav>

      {/* Bottom Section */}
      <div className="border-t border-white/5 p-3 space-y-2">
        <NavItem
          icon={HelpCircle}
          label={t('common.help')}
          href="/help"
          onClick={onNavigate}
          presenceUsers={getPresenceForPath('/help')}
        />
        <NavItem
          icon={Archive}
          label={t('archive.title', 'Archive')}
          href="/archive"
          onClick={onNavigate}
          presenceUsers={getPresenceForPath('/archive')}
        />
        <NavItem
          icon={Settings}
          label={t('common.settings')}
          href="/settings"
          shortcut="G S"
          onClick={onNavigate}
          presenceUsers={getPresenceForPath('/settings')}
        />
      </div>

      {/* Search Dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="sm:max-w-lg p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="sr-only">{t('common.search')}</DialogTitle>
          </DialogHeader>
          <div className="p-4 pt-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`${t('common.search')}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>
            <div className="mt-4 space-y-2">
              <div className="text-xs font-medium text-muted-foreground uppercase">Quick Actions</div>
              <div className="space-y-1">
                <button
                  onClick={() => { navigate('/issues'); setSearchOpen(false); }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-accent rounded-md"
                >
                  <Layers className="h-4 w-4" />
                  {t('nav.allIssues')}
                  <span className="ml-auto kbd text-xs">G I</span>
                </button>
                <button
                  onClick={() => { navigate('/lily'); setSearchOpen(false); }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-accent rounded-md"
                >
                  <Sparkles className="h-4 w-4 text-violet-500" />
                  {t('lily.title')}
                  <span className="ml-auto kbd text-xs">L</span>
                </button>
                <button
                  onClick={() => { navigate('/projects'); setSearchOpen(false); }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-accent rounded-md"
                >
                  <Folder className="h-4 w-4" />
                  {t('nav.projects')}
                </button>
              </div>
              {filteredProjects.length > 0 && searchQuery && (
                <>
                  <div className="text-xs font-medium text-muted-foreground uppercase mt-4">{t('nav.projects')}</div>
                  <div className="space-y-1">
                    {filteredProjects.slice(0, 5).map((project) => (
                      <button
                        key={project.id}
                        onClick={() => { navigate(`/project/${project.id}`); setSearchOpen(false); }}
                        className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-accent rounded-md"
                      >
                        <span>{PROJECT_ICONS[project.icon || 'folder'] || '📁'}</span>
                        {project.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
