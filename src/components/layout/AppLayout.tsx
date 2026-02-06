import React, { useRef, useState, useCallback } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { TeamSwitchingOverlay } from './TeamSwitchingOverlay';
import { CursorPresence, CollaborationToast } from '@/components/collaboration';
import { useRealtimeCollaboration } from '@/hooks/useRealtimeCollaboration';
import { useTeamStore } from '@/stores/teamStore';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
  enableCollaboration?: boolean;
}

const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 400;
const DEFAULT_SIDEBAR_WIDTH = 224; // 14rem = 224px

export function AppLayout({
  children,
  showSidebar = true,
  enableCollaboration = true,
}: AppLayoutProps) {
  const mainRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isSwitchingTeam, switchingToTeamName } = useTeamStore();

  // Sidebar resize state
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = useState(false);

  // Initialize real-time collaboration
  const { isConnected, onlineCount } = useRealtimeCollaboration({
    enabled: enableCollaboration,
  });

  // Handle sidebar resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const newWidth = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, startWidth + deltaX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [sidebarWidth]);

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      {/* Team Switching Overlay */}
      <TeamSwitchingOverlay
        isVisible={isSwitchingTeam}
        teamName={switchingToTeamName || ''}
      />

      {/* Desktop Sidebar with Resize Handle */}
      {showSidebar && !isMobile && (
        <div
          className="relative flex-shrink-0 bg-sidebar flex"
          style={{ width: sidebarWidth }}
        >
          <Sidebar style={{ width: '100%' }} />

          {/* Resize Handle */}
          <div
            className={cn(
              "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize z-20",
              "hover:bg-primary/50 transition-colors",
              isResizing && "bg-primary/50"
            )}
            onMouseDown={handleMouseDown}
          />
        </div>
      )}

      {/* Mobile Sidebar Sheet */}
      {showSidebar && isMobile && (
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="p-0 w-[280px]">
            <Sidebar onNavigate={() => setMobileMenuOpen(false)} />
          </SheetContent>
        </Sheet>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          isCollaborating={isConnected}
          onlineCount={onlineCount}
          onMenuClick={() => setMobileMenuOpen(true)}
          showMenuButton={isMobile && showSidebar}
        />
        <main ref={mainRef} className="flex-1 overflow-auto relative">
          {children}
        </main>
      </div>

      {/* CursorPresence disabled - use CollaborationCursor in BlockEditor instead */}
      {/* {enableCollaboration && <CursorPresence />} */}

      {/* Collaboration toast notifications */}
      {enableCollaboration && <CollaborationToast />}
    </div>
  );
}
