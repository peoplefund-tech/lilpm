import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export interface ShortcutAction {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
  global?: boolean;
}

export const SHORTCUTS: Record<string, { description: string; keys: string }> = {
  createIssue: { description: 'Create new issue', keys: 'C' },
  search: { description: 'Open search', keys: '⌘K' },
  goToIssues: { description: 'Go to All Issues', keys: 'G I' },
  goToMyIssues: { description: 'Go to My Issues', keys: 'G M' },
  goToProjects: { description: 'Go to Projects', keys: 'G P' },
  goToDashboard: { description: 'Go to Dashboard', keys: 'G D' },
  goToSettings: { description: 'Go to Settings', keys: 'G S' },
  goToLily: { description: 'Go to Lily AI', keys: 'L' },
  goToCycles: { description: 'Go to Sprints', keys: 'G C' },
  help: { description: 'Show keyboard shortcuts', keys: '?' },
};

interface UseKeyboardShortcutsOptions {
  onCreateIssue?: () => void;
  onSearch?: () => void;
  onShowHelp?: () => void;
  enabled?: boolean;
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}) {
  const navigate = useNavigate();
  const { onCreateIssue, onSearch, onShowHelp, enabled = true } = options;

  // Track if waiting for second key in sequence (like G+I)
  const waitingForNextKey = useRef(false);
  const lastKeyTime = useRef(0);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    // Ignore if typing in input/textarea or if inside a dialog
    const target = e.target as HTMLElement;
    const isInputField = target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable ||
      target.closest('[role="dialog"]') !== null ||
      target.closest('[data-radix-focus-guard]') !== null;

    // Allow Cmd/Ctrl+K even in input fields
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      onSearch?.();
      return;
    }

    // Skip other shortcuts if in input field or dialog
    if (isInputField) return;

    const now = Date.now();
    const timeSinceLastKey = now - lastKeyTime.current;
    lastKeyTime.current = now;

    // Handle "G + X" shortcuts (two-key sequences)
    if (waitingForNextKey.current && timeSinceLastKey < 500) {
      waitingForNextKey.current = false;

      switch (e.key.toLowerCase()) {
        case 'i':
          e.preventDefault();
          navigate('/issues');
          return;
        case 'm':
          e.preventDefault();
          navigate('/my-issues');
          return;
        case 'p':
          e.preventDefault();
          navigate('/projects');
          return;
        case 'd':
          e.preventDefault();
          navigate('/');
          return;
        case 's':
          e.preventDefault();
          navigate('/settings');
          return;
        case 'c':
          e.preventDefault();
          navigate('/cycles');
          return;
      }
    }

    // Start of two-key sequence
    if (e.key.toLowerCase() === 'g' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      waitingForNextKey.current = true;
      return;
    }

    // Single key shortcuts
    switch (e.key.toLowerCase()) {
      case 'c':
        if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
          e.preventDefault();
          onCreateIssue?.();
        }
        break;
      case 'l':
        if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
          e.preventDefault();
          navigate('/lily');
        }
        break;
      case '/':
        e.preventDefault();
        onSearch?.();
        break;
      case '?':
        e.preventDefault();
        onShowHelp?.();
        break;
    }
  }, [enabled, navigate, onCreateIssue, onSearch, onShowHelp]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { shortcuts: SHORTCUTS };
}
