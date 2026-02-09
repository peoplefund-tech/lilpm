import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  User,
  Settings,
  LogOut,
  Wifi,
  WifiOff,
  Menu,
  MousePointer2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAuthStore } from '@/stores/authStore';
import { useCollaborationStore } from '@/stores/collaborationStore';
import { PresenceAvatars } from '@/components/collaboration';
import { NotificationDropdown } from '@/components/notifications';
import { GlobalSearch } from '@/components/search';
import { cn } from '@/lib/utils';

interface HeaderProps {
  isCollaborating?: boolean;
  onlineCount?: number;
  onMenuClick?: () => void;
  showMenuButton?: boolean;
}

export function Header({
  isCollaborating = false,
  onlineCount = 0,
  onMenuClick,
  showMenuButton = false,
}: HeaderProps) {
  const location = useLocation();
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();
  const { showCursors, toggleShowCursors, users, cursorVisibleTo, setCursorVisibleTo } = useCollaborationStore();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/inbox') return t('nav.inbox');
    if (path === '/my-issues') return t('nav.myIssues');
    if (path === '/issues') return t('nav.allIssues');
    if (path === '/lily') return t('lily.title');
    if (path === '/cycle/active') return t('nav.activeCycle');
    if (path === '/cycles') return t('cycles.title');
    if (path === '/insights') return t('nav.insights');
    if (path === '/projects') return t('projects.title');
    if (path.startsWith('/project/')) return t('projects.title');
    if (path.startsWith('/issue/')) return t('issues.title');
    if (path.startsWith('/team/')) return t('team.title');
    if (path.startsWith('/settings')) return t('settings.title');
    return t('dashboard.title');
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <header className="h-12 flex items-center justify-between px-4 border-b border-white/5 bg-[#121215]">
      {/* Left: Menu Button (Mobile) & Page Title */}
      <div className="flex items-center gap-2">
        {showMenuButton && (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/5" onClick={onMenuClick}>
            <Menu className="h-4 w-4" />
          </Button>
        )}
        <h1 className="text-sm font-medium text-white">{getPageTitle()}</h1>
      </div>

      {/* Center: Search & Quick Actions */}
      <div className="flex items-center gap-3">
        <GlobalSearch />
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 gap-1 bg-[#1a1a1f] border-white/10 text-slate-300 hover:bg-white/5 hover:text-white"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t('issues.newIssue')}</span>
          <span className="kbd ml-1 hidden sm:inline text-slate-500">C</span>
        </Button>
      </div>

      {/* Right: Collaboration, Notifications & User */}
      <div className="flex items-center gap-3">
        {/* Real-time Collaboration Status */}
        {isCollaborating && (
          <div className="flex items-center gap-2">
            <PresenceAvatars maxVisible={4} />
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Wifi className="h-3 w-3 text-emerald-500" />
                  <span>{onlineCount}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="bg-[#1a1a1f] border-white/10 text-white">
                <p>{onlineCount} online</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {!isCollaborating && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <WifiOff className="h-3 w-3" />
              </div>
            </TooltipTrigger>
            <TooltipContent className="bg-[#1a1a1f] border-white/10 text-white">
              <p>Offline</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Cursor Visibility Toggle with Member Selection */}
        {isCollaborating && (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={showCursors ? "default" : "ghost"}
                    size="icon"
                    className={cn(
                      "h-7 w-7",
                      showCursors
                        ? "bg-violet-500 hover:bg-violet-400 text-white"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <MousePointer2 className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent className="bg-[#1a1a1f] border-white/10 text-white">
                <p>{showCursors ? t('collaboration.hideMouseCursors', 'Hide mouse cursors') : t('collaboration.showMouseCursors', 'Show mouse cursors')}</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-56 bg-[#1a1a1f] border-white/10">
              <div className="px-2 py-1.5">
                <p className="text-xs font-medium text-slate-500 mb-2">
                  {t('collaboration.mouseCursorVisibility', 'Mouse Cursor Visibility')}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-slate-300 hover:text-white hover:bg-white/5"
                  onClick={toggleShowCursors}
                >
                  {showCursors ? t('collaboration.hideMouseCursors', 'Hide mouse cursors') : t('collaboration.showMouseCursors', 'Show mouse cursors')}
                </Button>
              </div>
              <DropdownMenuSeparator className="bg-white/10" />
              <div className="px-2 py-1.5">
                <p className="text-xs font-medium text-slate-500 mb-2">
                  {t('collaboration.shareMouseCursor', 'Share my mouse cursor with:')}
                </p>
                <div className="space-y-1">
                  {users.filter(u => u.odId !== user?.id).length === 0 ? (
                    <p className="text-xs text-slate-500 italic">
                      {t('collaboration.noOtherUsers', 'No other users online')}
                    </p>
                  ) : (
                    [...users]
                      .filter(u => u.odId !== user?.id)
                      .sort((a, b) => (b.lastActivity || 0) - (a.lastActivity || 0))
                      .map((member) => (
                        <label
                          key={member.odId}
                          className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/5 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="rounded border-white/20 bg-transparent"
                            checked={cursorVisibleTo.includes(member.odId)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setCursorVisibleTo([...cursorVisibleTo, member.odId]);
                              } else {
                                setCursorVisibleTo(cursorVisibleTo.filter(id => id !== member.odId));
                              }
                            }}
                          />
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={member.avatarUrl} />
                            <AvatarFallback
                              className="text-[10px] text-white"
                              style={{ backgroundColor: member.color }}
                            >
                              {member.name?.charAt(0) || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-slate-300 truncate">{member.name}</span>
                        </label>
                      ))
                  )}
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Notifications */}
        <NotificationDropdown />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-white/5">
              <Avatar className="h-7 w-7 border border-white/10">
                <AvatarImage src={user?.avatarUrl} alt={user?.name} />
                <AvatarFallback className="text-xs bg-violet-500 text-white">
                  {user?.name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-[#1a1a1f] border-white/10">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium text-white">{user?.name}</p>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem asChild className="text-slate-300 focus:text-white focus:bg-white/5">
              <Link to="/profile">
                <User className="h-4 w-4 mr-2" />
                {t('settings.profile')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="text-slate-300 focus:text-white focus:bg-white/5">
              <Link to="/settings">
                <Settings className="h-4 w-4 mr-2" />
                {t('common.settings')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem onClick={handleLogout} className="text-red-400 focus:text-red-400 focus:bg-red-500/10">
              <LogOut className="h-4 w-4 mr-2" />
              {t('common.logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
