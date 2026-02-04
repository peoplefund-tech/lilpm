import React, { useState, useEffect } from 'react';
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
  BarChart3,
  Users,
  HelpCircle,
  Folder,
  Sparkles,
  Target,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTeamStore } from '@/stores/teamStore';
import { projectService } from '@/lib/services/projectService';
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
import type { Project } from '@/types/database';

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  href: string;
  badge?: number;
  isActive?: boolean;
  shortcut?: string;
  onClick?: () => void;
}

function NavItem({ icon: Icon, label, href, badge, isActive, shortcut, onClick }: NavItemProps) {
  return (
    <Link
      to={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors group",
        "hover:bg-accent",
        isActive && "bg-accent text-accent-foreground"
      )}
    >
      <Icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
      <span className="flex-1 truncate">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="text-xs bg-primary/20 text-primary px-1.5 rounded-full">{badge}</span>
      )}
      {shortcut && (
        <span className="hidden group-hover:inline-flex text-xs text-muted-foreground kbd">
          {shortcut}
        </span>
      )}
    </Link>
  );
}

const PROJECT_ICONS: Record<string, string> = {
  folder: '📁',
  rocket: '🚀',
  star: '⭐',
  lightning: '⚡',
  target: '🎯',
  gem: '💎',
  fire: '🔥',
  heart: '❤️',
};

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentTeam, teams, selectTeam } = useTeamStore();
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [teamsOpen, setTeamsOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);

  const handleNavigate = (path: string) => {
    navigate(path);
    onNavigate?.();
  };

  // Load projects when team changes
  useEffect(() => {
    if (currentTeam?.id) {
      projectService.getProjects(currentTeam.id).then(setProjects).catch(console.error);
    }
  }, [currentTeam?.id]);

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      // Quick navigation shortcuts
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key === 'g') {
          // Wait for next key
          const handleNext = (e2: KeyboardEvent) => {
            if (e2.key === 'i') navigate('/issues');
            if (e2.key === 'm') navigate('/my-issues');
            if (e2.key === 's') navigate('/settings');
            if (e2.key === 'a') navigate('/issues');
            window.removeEventListener('keydown', handleNext);
          };
          window.addEventListener('keydown', handleNext, { once: true });
          setTimeout(() => window.removeEventListener('keydown', handleNext), 500);
        }
        if (e.key === 'c' && document.activeElement?.tagName !== 'INPUT') {
          // Create issue - handled by parent
        }
        if (e.key === 'l' && document.activeElement?.tagName !== 'INPUT') {
          navigate('/lily');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  const mainNav = [
    { icon: Inbox, label: t('nav.inbox'), href: '/inbox', shortcut: 'I' },
    { icon: Home, label: t('nav.myIssues'), href: '/my-issues', shortcut: 'G M' },
  ];

  const workspaceNav = [
    { icon: Layers, label: t('nav.allIssues'), href: '/issues', shortcut: 'G I' },
    { icon: Target, label: t('nav.cycles'), href: '/cycles' },
    { icon: FileText, label: t('nav.prd', 'PRD'), href: '/prd' },
    { icon: Folder, label: t('nav.projects'), href: '/projects' },
    { icon: BarChart3, label: t('nav.insights'), href: '/insights' },
  ];

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside className="w-56 flex-shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="h-12 flex items-center px-3 border-b border-sidebar-border">
        <Link to="/" onClick={onNavigate} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <span className="text-white font-bold text-xs">LP</span>
          </div>
          <span className="font-semibold text-sm">Lil PM</span>
        </Link>
      </div>

      {/* Team Switcher */}
      <div className="px-3 py-2 border-b border-sidebar-border">
        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 px-2">
          {t('nav.team', 'Team')}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 hover:bg-sidebar-accent rounded-md px-2 py-1.5 w-full">
              <div 
                className="h-6 w-6 rounded flex items-center justify-center text-xs font-semibold"
                style={{ 
                  backgroundColor: 'hsl(var(--primary))',
                  color: 'hsl(var(--primary-foreground))'
                }}
              >
                {currentTeam?.name?.charAt(0) || 'T'}
              </div>
              <span className="flex-1 text-sm font-medium text-left truncate">
                {currentTeam?.name || t('nav.selectTeam')}
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('nav.teams')}
            </div>
            {teams.map((team) => (
              <DropdownMenuItem 
                key={team.id}
                onClick={() => selectTeam(team.id)}
                className={cn(currentTeam?.id === team.id && "bg-accent")}
              >
                <div 
                  className="h-5 w-5 rounded flex items-center justify-center text-xs font-semibold mr-2"
                  style={{ 
                    backgroundColor: 'hsl(var(--primary) / 0.8)',
                    color: 'hsl(var(--primary-foreground))'
                  }}
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
          className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">{t('common.search')}...</span>
          <span className="kbd text-xs">⌘K</span>
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
            />
          ))}
        </div>

        {/* Lily Chat - Special highlight */}
        <div className="space-y-0.5">
          <Link
            to="/lily"
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors group",
              "bg-gradient-to-r from-violet-500/10 to-purple-500/10 hover:from-violet-500/20 hover:to-purple-500/20",
              location.pathname === '/lily' && "from-violet-500/20 to-purple-500/20"
            )}
          >
            <Sparkles className="h-4 w-4 text-violet-500" />
            <span className="flex-1 truncate font-medium">{t('lily.title')}</span>
            <span className="hidden group-hover:inline-flex text-xs text-muted-foreground kbd">L</span>
          </Link>
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
            {projects.length === 0 ? (
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
                  <span className="text-sm">
                    {PROJECT_ICONS[project.icon || 'folder'] || '📁'}
                  </span>
                  <span className="truncate">{project.name}</span>
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
          <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Workspace
          </div>
          {workspaceNav.map((item) => (
            <NavItem
              key={item.href}
              {...item}
              isActive={location.pathname === item.href}
              onClick={onNavigate}
            />
          ))}
        </div>

      </nav>

      {/* Bottom Section */}
      <div className="border-t border-sidebar-border p-3 space-y-2">
        <NavItem
          icon={HelpCircle}
          label={t('common.help')}
          href="/help"
          onClick={onNavigate}
        />
        <NavItem
          icon={Settings}
          label={t('common.settings')}
          href="/settings"
          shortcut="G S"
          onClick={onNavigate}
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
