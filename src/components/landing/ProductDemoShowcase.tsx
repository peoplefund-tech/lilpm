import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bot,
    CheckCircle2,
    GripVertical,
    FileText,
    Ticket,
    Users,
    Calendar,
    Clock,
    Tag,
    Sparkles,
    Search,
    Filter,
    Plus,
    MoreHorizontal,
    ChevronDown,
    Circle,
    CheckCircle,
    AlertCircle,
    ArrowRight,
    Play,
    Link2,
    MessageSquare,
    Paperclip,
    Settings,
    Bell,
    Home,
    Folder,
    BarChart3,
    Target,
    GitBranch,
    Layers,
} from 'lucide-react';

// Typing animation hook
function useTypingAnimation(text: string, speed: number = 50, start: boolean = true) {
    const [displayedText, setDisplayedText] = useState('');
    const [isComplete, setIsComplete] = useState(false);

    useEffect(() => {
        if (!start) {
            setDisplayedText('');
            setIsComplete(false);
            return;
        }

        let index = 0;
        setDisplayedText('');
        setIsComplete(false);

        const timer = setInterval(() => {
            if (index < text.length) {
                setDisplayedText(text.slice(0, index + 1));
                index++;
            } else {
                setIsComplete(true);
                clearInterval(timer);
            }
        }, speed);

        return () => clearInterval(timer);
    }, [text, speed, start]);

    return { displayedText, isComplete };
}

// Animated cursor component
function AnimatedCursor({
    path,
    duration = 2,
    color = '#8b5cf6',
    name = 'User',
}: {
    path: { x: number; y: number }[];
    duration?: number;
    color?: string;
    name?: string;
}) {
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (path.length <= 1) return;

        const interval = setInterval(() => {
            setCurrentIndex(prev => (prev + 1) % path.length);
        }, (duration * 1000) / path.length);

        return () => clearInterval(interval);
    }, [path, duration]);

    const position = path[currentIndex] || path[0];

    return (
        <motion.div
            animate={{ x: position.x, y: position.y }}
            transition={{ type: 'spring', damping: 20, stiffness: 200 }}
            className="absolute z-50 pointer-events-none"
        >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                    d="M3 2L17 10L10 11L7 18L3 2Z"
                    fill={color}
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                />
            </svg>
            <div
                className="absolute left-5 top-5 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap shadow-lg"
                style={{ backgroundColor: color }}
            >
                {name}
            </div>
        </motion.div>
    );
}

// Status badge component
function StatusBadge({ status, size = 'sm' }: { status: string; size?: 'sm' | 'md' }) {
    const colors: Record<string, string> = {
        'Backlog': 'bg-slate-500/20 text-slate-400',
        'Todo': 'bg-violet-500/20 text-violet-400',
        'In Progress': 'bg-violet-500/30 text-violet-300',
        'In Review': 'bg-violet-500/20 text-violet-400',
        'Done': 'bg-emerald-500/20 text-emerald-400',
    };
    const sizeClass = size === 'md' ? 'text-xs px-2 py-1' : 'text-[10px] px-2 py-0.5';
    return (
        <span className={`${sizeClass} rounded font-medium ${colors[status] || 'bg-muted text-muted-foreground'}`}>
            {status}
        </span>
    );
}

// Priority dot
function PriorityDot({ priority, size = 'sm' }: { priority: 'urgent' | 'high' | 'medium' | 'low'; size?: 'sm' | 'md' }) {
    const colors = {
        urgent: 'bg-red-500',
        high: 'bg-orange-500',
        medium: 'bg-violet-500',
        low: 'bg-slate-500',
    };
    const sizeClass = size === 'md' ? 'h-2 w-2' : 'h-1.5 w-1.5';
    return <div className={`${sizeClass} rounded-full ${colors[priority]}`} />;
}

// App Sidebar Component (mimics actual app) - Larger version
function AppSidebar({ compact = false }: { compact?: boolean }) {
    return (
        <div className={`${compact ? 'w-14' : 'w-56'} h-full bg-[#1a1a1f] border-r border-white/5 flex flex-col`}>
            {/* Logo */}
            <div className={`${compact ? 'p-2.5' : 'p-4'} border-b border-white/5`}>
                <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-violet-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-white">L</span>
                    </div>
                    {!compact && <span className="text-base font-semibold text-white">Lil PM</span>}
                </div>
            </div>

            {/* Navigation */}
            <div className={`flex-1 ${compact ? 'p-1.5' : 'p-3'} space-y-1`}>
                {[
                    { icon: Home, label: 'Home', active: false },
                    { icon: Sparkles, label: 'Lily AI', active: false },
                    { icon: Folder, label: 'Projects', active: true },
                    { icon: Layers, label: 'Issues', active: false },
                    { icon: Target, label: 'Sprints', active: false },
                    { icon: BarChart3, label: 'Reports', active: false },
                    { icon: GitBranch, label: 'Roadmap', active: false },
                ].map((item) => (
                    <div
                        key={item.label}
                        className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm cursor-pointer transition-colors ${item.active ? 'bg-violet-500/20 text-violet-400' : 'text-slate-400 hover:bg-white/5'
                            }`}
                    >
                        <item.icon className="h-4 w-4 flex-shrink-0" />
                        {!compact && <span>{item.label}</span>}
                    </div>
                ))}
            </div>

            {/* Projects Section */}
            {!compact && (
                <div className="px-3 pb-3">
                    <div className="text-[10px] text-slate-500 uppercase px-2.5 mb-2">Projects</div>
                    {[
                        { name: 'Authentication', color: 'bg-violet-500' },
                        { name: 'Dashboard', color: 'bg-blue-500' },
                        { name: 'Mobile App', color: 'bg-emerald-500' },
                    ].map((proj) => (
                        <div key={proj.name} className="flex items-center gap-2 px-2.5 py-1.5 text-sm text-slate-400 hover:bg-white/5 rounded-lg cursor-pointer">
                            <div className={`h-2.5 w-2.5 rounded ${proj.color}`} />
                            <span className="truncate">{proj.name}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* User */}
            {!compact && (
                <div className="p-3 border-t border-white/5">
                    <div className="flex items-center gap-2.5 px-2.5 py-2">
                        <div className="h-8 w-8 rounded-full bg-violet-500 flex items-center justify-center text-xs text-white font-medium">JD</div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm text-white truncate">John Doe</div>
                            <div className="text-xs text-slate-500 truncate">john@company.com</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Demo Scene Components
const scenes = [
    // Scene 1: Lily AI Chat - Full app view
    {
        id: 'lily-chat',
        title: 'Chat with Lily AI',
        component: function LilyChatScene() {
            const userMessage = "Create a comprehensive user authentication system with OAuth2 support, email verification, password reset flow, and session management.";
            const aiResponse = `I'll create a comprehensive PRD for the authentication system. Here's what I'll include:

✓ Email/password authentication with bcrypt hashing
✓ OAuth2 integration (Google, GitHub, Apple)
✓ Email verification with magic links
✓ Password reset with secure tokens (24h expiry)
✓ Session management with JWT + refresh tokens
✓ Rate limiting and brute-force protection

Generating 12 development tickets for Sprint 2024-Q1...

📋 PRD-2024-0142 created successfully!`;

            const [showAI, setShowAI] = useState(false);
            const { displayedText: userText, isComplete: userComplete } = useTypingAnimation(userMessage, 20, true);
            const { displayedText: aiText } = useTypingAnimation(aiResponse, 12, showAI);

            useEffect(() => {
                if (userComplete) {
                    const timer = setTimeout(() => setShowAI(true), 400);
                    return () => clearTimeout(timer);
                }
            }, [userComplete]);

            return (
                <div className="flex h-full">
                    <AppSidebar />
                    <div className="flex-1 flex flex-col bg-[#121215]">
                        {/* Header */}
                        <div className="h-14 border-b border-white/5 px-5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-xl bg-violet-500 flex items-center justify-center">
                                    <Sparkles className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <span className="text-base font-medium text-white">Lily AI Assistant</span>
                                    <p className="text-xs text-slate-500">Your AI-powered project manager</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                                    Online
                                </div>
                                <button className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/5"><Bell className="h-5 w-5" /></button>
                                <button className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/5"><Settings className="h-5 w-5" /></button>
                            </div>
                        </div>

                        {/* Chat Area */}
                        <div className="flex-1 p-6 overflow-hidden">
                            <div className="max-w-3xl mx-auto space-y-6">
                                {/* User Message */}
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex justify-end"
                                >
                                    <div className="flex items-end gap-3 max-w-[80%]">
                                        <div className="bg-violet-500 text-white rounded-2xl rounded-br-sm px-5 py-3.5 shadow-lg">
                                            <p className="text-base leading-relaxed">{userText}<span className="animate-pulse opacity-60">|</span></p>
                                        </div>
                                        <div className="h-10 w-10 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                                            <span className="text-sm text-white font-medium">JD</span>
                                        </div>
                                    </div>
                                </motion.div>

                                {/* AI Response */}
                                <AnimatePresence>
                                    {showAI && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="flex gap-3 max-w-[85%]"
                                        >
                                            <div className="h-10 w-10 rounded-full bg-violet-500 flex items-center justify-center flex-shrink-0">
                                                <Sparkles className="h-5 w-5 text-white" />
                                            </div>
                                            <div className="bg-[#1e1e24] border border-white/10 rounded-2xl rounded-bl-sm px-5 py-3.5">
                                                <p className="text-base leading-relaxed text-slate-200 whitespace-pre-line">{aiText}<span className="animate-pulse text-violet-500">|</span></p>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        {/* Input */}
                        <div className="p-5 border-t border-white/5">
                            <div className="max-w-3xl mx-auto">
                                <div className="bg-[#1e1e24] border border-white/10 rounded-xl px-5 py-3.5 flex items-center gap-3">
                                    <input type="text" placeholder="Ask Lily anything..." className="flex-1 bg-transparent text-base text-white placeholder:text-slate-500 outline-none" />
                                    <button className="p-2 rounded-lg bg-violet-500 text-white hover:bg-violet-400 transition-colors"><ArrowRight className="h-5 w-5" /></button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        },
    },
    // Scene 2: Issue Board / Kanban
    {
        id: 'kanban',
        title: 'Kanban Board',
        component: function KanbanScene() {
            const [dragAnim, setDragAnim] = useState(false);

            useEffect(() => {
                const timer = setTimeout(() => setDragAnim(true), 1000);
                return () => clearTimeout(timer);
            }, []);

            const columns = [
                {
                    id: 'backlog', title: 'Backlog', count: 5, issues: [
                        { id: 'AUTH-005', title: 'Rate limiting middleware', priority: 'medium' as const, points: 3 },
                        { id: 'AUTH-006', title: 'Audit logging system', priority: 'low' as const, points: 5 },
                        { id: 'AUTH-007', title: 'CAPTCHA integration', priority: 'low' as const, points: 2 },
                    ]
                },
                {
                    id: 'todo', title: 'Todo', count: 4, issues: [
                        { id: 'AUTH-003', title: 'Password reset flow', priority: 'high' as const, points: 5 },
                        { id: 'AUTH-004', title: 'Email verification service', priority: 'medium' as const, points: 3 },
                    ]
                },
                {
                    id: 'progress', title: 'In Progress', count: 2, issues: [
                        { id: 'AUTH-001', title: 'Email login API endpoint', priority: 'high' as const, points: 8 },
                    ]
                },
                {
                    id: 'review', title: 'In Review', count: 1, issues: [
                        { id: 'AUTH-002', title: 'OAuth2 Google integration', priority: 'high' as const, points: 8 },
                    ]
                },
                { id: 'done', title: 'Done', count: 3, issues: [] },
            ];

            return (
                <div className="flex h-full">
                    <AppSidebar compact />
                    <div className="flex-1 flex flex-col bg-[#121215]">
                        {/* Header */}
                        <div className="h-14 border-b border-white/5 px-5 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded bg-violet-500" />
                                    <span className="text-base font-medium text-white">Authentication System</span>
                                </div>
                                <span className="text-xs px-2.5 py-1 rounded-full bg-violet-500/20 text-violet-400">Sprint 2024-Q1</span>
                                <span className="text-xs text-slate-500">12 issues</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 text-slate-400 text-sm">
                                    <Search className="h-4 w-4" />
                                    <span>Search issues...</span>
                                </div>
                                <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 text-slate-400 text-sm hover:text-white">
                                    <Filter className="h-4 w-4" />
                                    Filter
                                </button>
                                <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-500 text-white text-sm">
                                    <Plus className="h-4 w-4" />
                                    New Issue
                                </button>
                            </div>
                        </div>

                        {/* Board */}
                        <div className="flex-1 p-4 overflow-x-auto">
                            <div className="flex gap-4 h-full min-w-max">
                                {columns.map((col) => (
                                    <div key={col.id} className="w-72 flex-shrink-0 flex flex-col bg-[#1a1a1f] rounded-xl">
                                        <div className="px-4 py-3 flex items-center justify-between border-b border-white/5">
                                            <div className="flex items-center gap-2.5">
                                                <span className="text-sm font-medium text-white">{col.title}</span>
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-400">{col.count}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button className="p-1 rounded text-slate-500 hover:text-white hover:bg-white/5"><Plus className="h-4 w-4" /></button>
                                                <button className="p-1 rounded text-slate-500 hover:text-white hover:bg-white/5"><MoreHorizontal className="h-4 w-4" /></button>
                                            </div>
                                        </div>
                                        <div className="flex-1 p-2.5 space-y-2.5 overflow-y-auto">
                                            {col.issues.map((issue) => (
                                                <motion.div
                                                    key={issue.id}
                                                    layout
                                                    className="bg-[#121215] border border-white/5 rounded-xl p-3.5 cursor-pointer hover:border-violet-500/30 transition-colors group"
                                                >
                                                    <div className="flex items-center gap-2 mb-2.5">
                                                        <PriorityDot priority={issue.priority} size="md" />
                                                        <span className="text-xs text-slate-500 font-mono">{issue.id}</span>
                                                    </div>
                                                    <p className="text-sm text-slate-200 leading-relaxed group-hover:text-white mb-3">{issue.title}</p>
                                                    <div className="flex items-center justify-between pt-2.5 border-t border-white/5">
                                                        <div className="h-6 w-6 rounded-full bg-violet-500 flex items-center justify-center text-[10px] text-white font-medium">JD</div>
                                                        <span className="text-xs text-slate-500">{issue.points} pts</span>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {dragAnim && (
                        <AnimatedCursor
                            path={[
                                { x: 240, y: 200 },
                                { x: 320, y: 180 },
                                { x: 450, y: 190 },
                                { x: 550, y: 200 },
                            ]}
                            duration={2}
                            name="You"
                            color="#8b5cf6"
                        />
                    )}
                </div>
            );
        },
    },
    // Scene 3: PRD Editor
    {
        id: 'prd-editor',
        title: 'PRD Editor',
        component: function PRDEditorScene() {
            const content = `## Overview
This PRD outlines the implementation of a secure user authentication system for our web application.

## Problem Statement
Users need a secure and convenient way to access their accounts while protecting their personal data.

## User Stories

**As a user**, I want to sign in with my email and password so that I can access my account securely.

**As a user**, I want to sign in with Google/GitHub so that I can onboard faster without creating a new password.

**As a user**, I want to reset my password if I forget it, so I can regain access to my account.

## Acceptance Criteria

- [x] Email format validation (RFC 5322)
- [x] Password minimum 8 characters with complexity requirements
- [ ] OAuth2 flow with PKCE for security
- [ ] Rate limiting: 5 login attempts per minute
- [ ] Session expiry after 24 hours of inactivity`;
            const { displayedText } = useTypingAnimation(content, 12, true);

            return (
                <div className="flex h-full">
                    <AppSidebar compact />
                    <div className="flex-1 flex flex-col bg-[#121215]">
                        {/* Header */}
                        <div className="h-14 border-b border-white/5 px-5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <FileText className="h-5 w-5 text-violet-500" />
                                <span className="text-base font-medium text-white">User Authentication PRD</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">Draft</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex -space-x-2">
                                    <div className="h-8 w-8 rounded-full bg-violet-500 border-2 border-[#121215] flex items-center justify-center text-xs text-white">JD</div>
                                    <div className="h-8 w-8 rounded-full bg-blue-500 border-2 border-[#121215] flex items-center justify-center text-xs text-white">SK</div>
                                    <div className="h-8 w-8 rounded-full bg-emerald-500 border-2 border-[#121215] flex items-center justify-center text-xs text-white">MK</div>
                                </div>
                                <span className="text-xs text-emerald-400 flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                                    Saving...
                                </span>
                            </div>
                        </div>

                        {/* Toolbar */}
                        <div className="h-12 border-b border-white/5 px-5 flex items-center gap-2">
                            {['H1', 'H2', 'H3', 'B', 'I', 'U', '|', 'List', 'Checklist', 'Link', 'Code', 'Table'].map((item, i) => (
                                item === '|' ? (
                                    <div key={i} className="h-5 w-px bg-white/10 mx-1" />
                                ) : (
                                    <button key={item} className="px-2.5 py-1.5 text-sm text-slate-400 hover:text-white hover:bg-white/5 rounded-lg">
                                        {item}
                                    </button>
                                )
                            ))}
                        </div>

                        {/* Editor */}
                        <div className="flex-1 p-8 overflow-auto">
                            <div className="max-w-4xl mx-auto">
                                <pre className="font-sans text-base text-slate-200 whitespace-pre-wrap leading-loose">
                                    {displayedText}<span className="animate-pulse text-violet-500 font-bold">|</span>
                                </pre>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel - Comments */}
                    <div className="w-72 bg-[#1a1a1f] border-l border-white/5 flex flex-col">
                        <div className="p-4 border-b border-white/5 flex items-center justify-between">
                            <span className="text-sm font-medium text-white">Comments</span>
                            <span className="text-xs text-slate-500">3</span>
                        </div>
                        <div className="flex-1 p-4 space-y-4 overflow-auto">
                            {[
                                { user: 'SK', name: 'Sarah K.', text: 'Should we add 2FA support in v1 or delay to v2?', time: '2h ago' },
                                { user: 'MK', name: 'Mike K.', text: 'I think we should include it in v1 for security.', time: '1h ago' },
                            ].map((comment, i) => (
                                <div key={i} className="bg-[#121215] rounded-xl p-3.5">
                                    <div className="flex items-center gap-2.5 mb-2">
                                        <div className="h-7 w-7 rounded-full bg-blue-500 flex items-center justify-center text-[10px] text-white">{comment.user}</div>
                                        <span className="text-sm text-white">{comment.name}</span>
                                        <span className="text-xs text-slate-500 ml-auto">{comment.time}</span>
                                    </div>
                                    <p className="text-sm text-slate-300 leading-relaxed">{comment.text}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            );
        },
    },
    // Scene 4: Gantt Chart / Timeline
    {
        id: 'gantt',
        title: 'Timeline View',
        component: function GanttScene() {
            const [progress, setProgress] = useState(0);

            useEffect(() => {
                const timer = setInterval(() => {
                    setProgress(prev => Math.min(prev + 2, 100));
                }, 80);
                return () => clearInterval(timer);
            }, []);

            const tasks = [
                { id: 'AUTH-001', name: 'Email Login API', assignee: 'JD', start: 0, width: 28, status: 'In Progress' },
                { id: 'AUTH-002', name: 'OAuth2 Integration', assignee: 'SK', start: 18, width: 32, status: 'Todo' },
                { id: 'AUTH-003', name: 'Password Reset Flow', assignee: 'MK', start: 12, width: 22, status: 'In Progress' },
                { id: 'AUTH-004', name: 'Email Verification', assignee: 'JD', start: 38, width: 28, status: 'Todo' },
                { id: 'AUTH-005', name: 'Session Management', assignee: 'SK', start: 52, width: 24, status: 'Backlog' },
                { id: 'AUTH-006', name: 'Rate Limiting', assignee: 'MK', start: 60, width: 18, status: 'Backlog' },
                { id: 'AUTH-007', name: 'QA Testing', assignee: 'HL', start: 72, width: 22, status: 'Backlog' },
            ];

            const weeks = ['Jan 6', 'Jan 13', 'Jan 20', 'Jan 27', 'Feb 3', 'Feb 10', 'Feb 17'];

            return (
                <div className="flex h-full">
                    <AppSidebar compact />
                    <div className="flex-1 flex flex-col bg-[#121215]">
                        {/* Header */}
                        <div className="h-14 border-b border-white/5 px-5 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <Calendar className="h-5 w-5 text-violet-500" />
                                <span className="text-base font-medium text-white">Timeline</span>
                                <span className="text-xs px-2.5 py-1 rounded-full bg-violet-500/20 text-violet-400">Sprint 2024-Q1</span>
                            </div>
                            <div className="flex items-center gap-4 text-xs">
                                <span className="flex items-center gap-2 text-slate-400"><span className="h-2 w-2 rounded-full bg-violet-500" /> In Progress</span>
                                <span className="flex items-center gap-2 text-slate-400"><span className="h-2 w-2 rounded-full bg-slate-500" /> Backlog</span>
                                <span className="flex items-center gap-2 text-slate-400"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Complete</span>
                            </div>
                        </div>

                        {/* Gantt */}
                        <div className="flex-1 flex overflow-hidden">
                            {/* Task list */}
                            <div className="w-64 flex-shrink-0 border-r border-white/5">
                                <div className="h-10 border-b border-white/5 px-4 flex items-center">
                                    <span className="text-xs text-slate-500 font-medium uppercase">Task</span>
                                </div>
                                {tasks.map((task) => (
                                    <div key={task.id} className="h-12 border-b border-white/5 px-4 flex items-center gap-3 hover:bg-white/5 cursor-pointer">
                                        <div className="h-7 w-7 rounded-full bg-violet-500 flex items-center justify-center text-[10px] text-white">{task.assignee}</div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[10px] text-slate-500 font-mono">{task.id}</div>
                                            <div className="text-sm text-slate-200 truncate">{task.name}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Timeline */}
                            <div className="flex-1 overflow-x-auto">
                                {/* Header */}
                                <div className="h-10 border-b border-white/5 flex">
                                    {weeks.map((week) => (
                                        <div key={week} className="flex-1 min-w-24 px-3 flex items-center border-r border-white/5 last:border-r-0">
                                            <span className="text-xs text-slate-400">{week}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Bars */}
                                <div className="relative">
                                    {tasks.map((task) => (
                                        <div key={task.id} className="h-12 border-b border-white/5 relative flex items-center">
                                            {/* Grid lines */}
                                            {weeks.map((_, j) => (
                                                <div key={j} className="flex-1 min-w-24 h-full border-r border-white/5 last:border-r-0" />
                                            ))}
                                            {/* Bar */}
                                            <motion.div
                                                initial={{ width: 0, opacity: 0 }}
                                                animate={{
                                                    width: `${Math.min(Math.max((progress - task.start) * (task.width / 30), 0), task.width)}%`,
                                                    opacity: progress >= task.start ? 1 : 0,
                                                }}
                                                className="absolute h-7 rounded-lg bg-violet-500 shadow-lg flex items-center justify-center"
                                                style={{ left: `${task.start}%` }}
                                            >
                                                <span className="text-[10px] text-white font-medium px-2 truncate">{task.name}</span>
                                            </motion.div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        },
    },
    // Scene 5: Issue Detail
    {
        id: 'issue-detail',
        title: 'Issue Detail',
        component: function IssueDetailScene() {
            return (
                <div className="flex h-full">
                    <AppSidebar compact />
                    <div className="flex-1 flex bg-[#121215]">
                        {/* Main Content */}
                        <div className="flex-1 flex flex-col">
                            {/* Header */}
                            <div className="h-14 border-b border-white/5 px-5 flex items-center gap-4">
                                <span className="text-sm text-slate-500 font-mono">AUTH-001</span>
                                <StatusBadge status="In Progress" size="md" />
                                <div className="ml-auto flex items-center gap-2">
                                    <button className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/5"><Link2 className="h-5 w-5" /></button>
                                    <button className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/5"><MoreHorizontal className="h-5 w-5" /></button>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 p-6 overflow-auto">
                                <h1 className="text-2xl font-semibold text-white mb-4">Implement Email Login API Endpoint</h1>

                                <div className="prose prose-invert prose-base max-w-none">
                                    <p className="text-base text-slate-300 leading-relaxed mb-6">
                                        Build a secure authentication endpoint that accepts email and password credentials, validates them against the database using bcrypt hashing, and returns a JWT token for session management with refresh token rotation.
                                    </p>

                                    <h3 className="text-lg font-medium text-white mb-3">Acceptance Criteria</h3>
                                    <div className="space-y-2.5 mb-6">
                                        {[
                                            { done: true, text: 'Email format validation using RFC 5322 standard' },
                                            { done: true, text: 'Password hashing with bcrypt (cost factor 12)' },
                                            { done: true, text: 'Input sanitization to prevent SQL injection' },
                                            { done: false, text: 'JWT token generation with 24h expiration' },
                                            { done: false, text: 'Refresh token rotation on each use' },
                                            { done: false, text: 'Rate limiting: 5 attempts per minute' },
                                        ].map((item, i) => (
                                            <div key={i} className="flex items-center gap-3 text-base">
                                                {item.done ? (
                                                    <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                                                ) : (
                                                    <Circle className="h-5 w-5 text-slate-500 flex-shrink-0" />
                                                )}
                                                <span className={item.done ? 'text-slate-500 line-through' : 'text-slate-300'}>{item.text}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <h3 className="text-lg font-medium text-white mb-3">Activity</h3>
                                    <div className="space-y-4">
                                        {[
                                            { user: 'JD', action: 'moved to In Progress', time: '2 hours ago' },
                                            { user: 'SK', action: 'added a comment', time: '4 hours ago' },
                                            { user: 'JD', action: 'created this issue', time: '1 day ago' },
                                        ].map((activity, i) => (
                                            <div key={i} className="flex items-start gap-3">
                                                <div className="h-8 w-8 rounded-full bg-violet-500 flex items-center justify-center text-xs text-white mt-0.5">{activity.user}</div>
                                                <div>
                                                    <p className="text-sm text-slate-400"><span className="text-white">{activity.user === 'JD' ? 'John D.' : 'Sarah K.'}</span> {activity.action}</p>
                                                    <p className="text-xs text-slate-500">{activity.time}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Sidebar */}
                        <div className="w-72 border-l border-white/5 p-5 space-y-6">
                            <div>
                                <label className="text-xs text-slate-500 uppercase mb-2 block">Status</label>
                                <StatusBadge status="In Progress" size="md" />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 uppercase mb-2 block">Priority</label>
                                <div className="flex items-center gap-2.5">
                                    <PriorityDot priority="high" size="md" />
                                    <span className="text-sm text-slate-300">High</span>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 uppercase mb-2 block">Assignee</label>
                                <div className="flex items-center gap-2.5">
                                    <div className="h-8 w-8 rounded-full bg-violet-500 flex items-center justify-center text-xs text-white">JD</div>
                                    <span className="text-sm text-slate-300">John Doe</span>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 uppercase mb-2 block">Story Points</label>
                                <span className="text-sm text-slate-300">8 points</span>
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 uppercase mb-2 block">Sprint</label>
                                <span className="text-sm text-slate-300">2024-Q1</span>
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 uppercase mb-2 block">Due Date</label>
                                <span className="text-sm text-slate-300">Jan 20, 2024</span>
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 uppercase mb-2 block">Labels</label>
                                <div className="flex flex-wrap gap-1.5">
                                    <span className="text-xs px-2 py-1 rounded-full bg-violet-500/20 text-violet-400">backend</span>
                                    <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-400">auth</span>
                                    <span className="text-xs px-2 py-1 rounded-full bg-amber-500/20 text-amber-400">security</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <AnimatedCursor
                        path={[
                            { x: 300, y: 250 },
                            { x: 400, y: 300 },
                            { x: 500, y: 280 },
                            { x: 550, y: 320 },
                        ]}
                        duration={3}
                        name="Sarah K."
                        color="#8b5cf6"
                    />
                </div>
            );
        },
    },
    // Scene 6: Real-time Collaboration
    {
        id: 'collaboration',
        title: 'Real-time Collaboration',
        component: function CollaborationScene() {
            return (
                <div className="flex h-full">
                    <AppSidebar compact />
                    <div className="flex-1 flex flex-col bg-[#121215] relative">
                        {/* Header */}
                        <div className="h-14 border-b border-white/5 px-5 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <Users className="h-5 w-5 text-violet-500" />
                                <span className="text-base font-medium text-white">Team Dashboard</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex -space-x-2">
                                    <div className="h-8 w-8 rounded-full bg-violet-500 border-2 border-[#121215] flex items-center justify-center text-xs text-white">JD</div>
                                    <div className="h-8 w-8 rounded-full bg-blue-500 border-2 border-[#121215] flex items-center justify-center text-xs text-white">SK</div>
                                    <div className="h-8 w-8 rounded-full bg-emerald-500 border-2 border-[#121215] flex items-center justify-center text-xs text-white">MK</div>
                                    <div className="h-8 w-8 rounded-full bg-amber-500 border-2 border-[#121215] flex items-center justify-center text-xs text-white">HL</div>
                                </div>
                                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                                    4 online
                                </span>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 p-5 grid grid-cols-2 gap-5">
                            {/* Recent Issues */}
                            <div className="bg-[#1a1a1f] rounded-xl p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-medium text-white">Active Issues</h3>
                                    <span className="text-xs text-slate-500">5 active</span>
                                </div>
                                <div className="space-y-3">
                                    {[
                                        { id: 'AUTH-001', title: 'Email Login API', status: 'In Progress', user: 'JD', points: 8 },
                                        { id: 'AUTH-002', title: 'OAuth2 Integration', status: 'In Review', user: 'SK', points: 8 },
                                        { id: 'AUTH-003', title: 'Password Reset Flow', status: 'In Progress', user: 'MK', points: 5 },
                                        { id: 'AUTH-004', title: 'Email Verification', status: 'Todo', user: 'JD', points: 3 },
                                    ].map((issue) => (
                                        <div key={issue.id} className="bg-[#121215] rounded-xl p-3.5 flex items-center gap-3 hover:border-violet-500/30 border border-transparent transition-colors cursor-pointer">
                                            <div className="h-8 w-8 rounded-full bg-violet-500 flex items-center justify-center text-xs text-white">{issue.user}</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs text-slate-500 font-mono">{issue.id}</div>
                                                <div className="text-sm text-slate-200 truncate">{issue.title}</div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <StatusBadge status={issue.status} />
                                                <span className="text-xs text-slate-500">{issue.points} pts</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Sprint Progress */}
                            <div className="bg-[#1a1a1f] rounded-xl p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-medium text-white">Sprint Progress</h3>
                                    <span className="text-xs text-slate-500">Sprint 2024-Q1</span>
                                </div>
                                <div className="mb-5">
                                    <div className="flex justify-between text-sm text-slate-400 mb-2">
                                        <span>Overall Progress</span>
                                        <span className="text-violet-400 font-medium">68%</span>
                                    </div>
                                    <div className="h-3 bg-[#121215] rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: '68%' }}
                                            transition={{ duration: 1.5, ease: 'easeOut' }}
                                            className="h-full bg-violet-500 rounded-full"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-4 gap-3">
                                    {[
                                        { value: 3, label: 'Backlog', color: 'text-slate-400' },
                                        { value: 4, label: 'Todo', color: 'text-violet-400' },
                                        { value: 5, label: 'In Progress', color: 'text-violet-400' },
                                        { value: 8, label: 'Completed', color: 'text-emerald-400' },
                                    ].map((stat, i) => (
                                        <div key={i} className="bg-[#121215] rounded-xl p-3 text-center">
                                            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                                            <div className="text-[10px] text-slate-500 mt-0.5">{stat.label}</div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-5 pt-4 border-t border-white/5">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-400">Story Points</span>
                                        <span className="text-white">34 / 50 completed</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm mt-2">
                                        <span className="text-slate-400">Days Remaining</span>
                                        <span className="text-white">8 days</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Multiple Cursors */}
                    <AnimatedCursor
                        path={[
                            { x: 180, y: 180 },
                            { x: 280, y: 220 },
                            { x: 350, y: 200 },
                            { x: 420, y: 250 },
                        ]}
                        duration={3}
                        name="John D."
                        color="#8b5cf6"
                    />
                    <AnimatedCursor
                        path={[
                            { x: 550, y: 200 },
                            { x: 620, y: 250 },
                            { x: 580, y: 300 },
                            { x: 650, y: 280 },
                        ]}
                        duration={3.5}
                        name="Sarah K."
                        color="#3b82f6"
                    />
                </div>
            );
        },
    },
];

export function ProductDemoShowcase() {
    const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
    const [key, setKey] = useState(0);

    // Auto-advance scenes every 6 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentSceneIndex(prev => (prev + 1) % scenes.length);
            setKey(prev => prev + 1);
        }, 6000);
        return () => clearInterval(interval);
    }, []);

    const currentScene = scenes[currentSceneIndex];
    const SceneComponent = currentScene.component;

    return (
        <div className="relative rounded-xl border border-white/10 bg-[#0d0d0f] overflow-hidden shadow-2xl">
            {/* Mac-style window chrome */}
            <div className="h-10 border-b border-white/10 px-4 flex items-center gap-3 bg-[#1a1a1f]">
                <div className="flex gap-2">
                    <div className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                    <div className="h-3 w-3 rounded-full bg-[#febc2e]" />
                    <div className="h-3 w-3 rounded-full bg-[#28c840]" />
                </div>
                <div className="flex-1 flex justify-center">
                    <div className="px-4 py-1.5 rounded-lg bg-white/5 text-xs text-slate-400 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        app.lilpm.ai
                    </div>
                </div>
                <div className="w-14" />
            </div>

            {/* Scene Content - Fixed height 700px */}
            <div className="h-[700px] relative">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={`${currentSceneIndex}-${key}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="h-full"
                    >
                        <SceneComponent />
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Scene Progress */}
            <div className="h-12 border-t border-white/10 px-5 flex items-center justify-between bg-[#1a1a1f]">
                <div className="flex items-center gap-2.5">
                    <Sparkles className="h-4 w-4 text-violet-500" />
                    <span className="text-sm font-medium text-white">{currentScene.title}</span>
                </div>
                <div className="flex gap-2">
                    {scenes.map((scene, index) => (
                        <button
                            key={scene.id}
                            onClick={() => {
                                setCurrentSceneIndex(index);
                                setKey(prev => prev + 1);
                            }}
                            className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${index === currentSceneIndex
                                    ? 'w-8 bg-violet-500'
                                    : 'w-2 bg-white/20 hover:bg-white/40'
                                }`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
