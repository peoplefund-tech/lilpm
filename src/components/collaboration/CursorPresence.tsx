import React from 'react';
import { useCollaborationStore, type Presence } from '@/stores/collaborationStore';
import { motion, AnimatePresence } from 'framer-motion';

interface CursorPresenceProps {
  containerRef?: React.RefObject<HTMLElement>;
}

export function CursorPresence({ containerRef }: CursorPresenceProps) {
  const { users, isConnected } = useCollaborationStore();

  if (!isConnected) {
    return null;
  }

  const visibleUsers = users.filter(
    (user) => user.cursor && user.cursor.x > 0 && user.cursor.y > 0
  );

  return (
    <AnimatePresence>
      {visibleUsers.map((user) => (
        <Cursor key={user.odId} user={user} />
      ))}
    </AnimatePresence>
  );
}

function Cursor({ user }: { user: Presence }) {
  if (!user.cursor) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ 
        opacity: 1, 
        scale: 1,
        x: user.cursor.x,
        y: user.cursor.y,
      }}
      exit={{ opacity: 0, scale: 0.5 }}
      transition={{ 
        type: 'spring',
        damping: 30,
        stiffness: 500,
        mass: 0.5,
      }}
      className="pointer-events-none fixed z-[9999]"
      style={{ left: 0, top: 0 }}
    >
      {/* Cursor Arrow */}
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        className="drop-shadow-md"
        style={{ transform: 'translate(-2px, -2px)' }}
      >
        <path
          d="M3 2L17 10L10 11L7 18L3 2Z"
          fill={user.color}
          stroke="white"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      
      {/* Name tag */}
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute left-4 top-4 px-2 py-1 rounded-md text-xs font-medium text-white whitespace-nowrap shadow-lg"
        style={{ backgroundColor: user.color }}
      >
        {user.name}
      </motion.div>
    </motion.div>
  );
}

// Component to show who is viewing/editing the same issue
export function IssueFocusIndicator({ issueId }: { issueId: string }) {
  const { users } = useCollaborationStore();
  
  const focusedUsers = users.filter((u) => u.focusedIssueId === issueId);
  
  if (focusedUsers.length === 0) return null;

  return (
    <div className="flex -space-x-1">
      {focusedUsers.slice(0, 3).map((user) => (
        <div
          key={user.odId}
          className="w-5 h-5 rounded-full border-2 border-background flex items-center justify-center text-[10px] font-medium text-white"
          style={{ backgroundColor: user.color }}
          title={`${user.name}이(가) 보고 있음`}
        >
          {user.name.charAt(0)}
        </div>
      ))}
      {focusedUsers.length > 3 && (
        <div className="w-5 h-5 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-medium">
          +{focusedUsers.length - 3}
        </div>
      )}
    </div>
  );
}
