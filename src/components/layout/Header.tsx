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
    <header className="h-12 flex items-center justify-between px-4 border-b border-border bg-background">
      {/* Left: Menu Button (Mobile) & Page Title */}
      <div className="flex items-center gap-2">
        {showMenuButton && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onMenuClick}>
            <Menu className="h-4 w-4" />
          </Button>
        )}
        <h1 className="text-sm font-medium">{getPageTitle()}</h1>
      </div>

      {/* Center: Search & Quick Actions */}
      <div className="flex items-center gap-3">
        <GlobalSearch />
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 gap-1"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t('issues.newIssue')}</span>
          <span className="kbd ml-1 hidden sm:inline">C</span>
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
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Wifi className="h-3 w-3 text-green-500" />
                  <span>{onlineCount}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{onlineCount} online</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {!isCollaborating && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <WifiOff className="h-3 w-3" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
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
                      showCursors && "bg-violet-500 hover:bg-violet-600 text-white"
                    )}
                  >
                    <MousePointer2 className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>{showCursors ? t('collaboration.hideCursors', 'Hide cursors') : t('collaboration.showCursors', 'Show cursors')}</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  {t('collaboration.cursorVisibility', 'Cursor Visibility')}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={toggleShowCursors}
                >
                  {showCursors ? t('collaboration.hideCursors', 'Hide cursors') : t('collaboration.showCursors', 'Show cursors')}
                </Button>
              </div>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  {t('collaboration.showCursorTo', 'Share my cursor with:')}
                </p>
                <div className="space-y-1">
                  {users.filter(u => u.odId !== user?.id).length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      {t('collaboration.noOtherUsers', 'No other users online')}
                    </p>
                  ) : (
                    users.filter(u => u.odId !== user?.id).map((member) => (
                      <label
                        key={member.odId}
                        className="flex items-center gap-2 px-2 py-1 rounded hover:bg-accent cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          className="rounded border-border"
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
                        <span className="text-sm truncate">{member.name}</span>
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
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
              <Avatar className="h-7 w-7">
                <AvatarImage src={user?.avatarUrl} alt={user?.name} />
                <AvatarFallback className="text-xs">
                  {user?.name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/profile">
                <User className="h-4 w-4 mr-2" />
                {t('settings.profile')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/settings">
                <Settings className="h-4 w-4 mr-2" />
                {t('common.settings')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              {t('common.logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
