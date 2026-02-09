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
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path
                    d="M3 2L17 10L10 11L7 18L3 2Z"
                    fill={color}
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                />
            </svg>
            <div
                className="absolute left-4 top-4 px-2 py-0.5 rounded text-[10px] text-white whitespace-nowrap shadow-lg"
                style={{ backgroundColor: color }}
            >
                {name}
            </div>
        </motion.div>
    );
}

// Status badge component
function StatusBadge({ status }: { status: string }) {
    const colors: Record<string, string> = {
        'Backlog': 'bg-slate-500/20 text-slate-400',
        'Todo': 'bg-violet-500/20 text-violet-400',
        'In Progress': 'bg-violet-500/30 text-violet-300',
        'In Review': 'bg-violet-500/20 text-violet-400',
        'Done': 'bg-emerald-500/20 text-emerald-400',
    };
    return (
        <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${colors[status] || 'bg-muted text-muted-foreground'}`}>
            {status}
        </span>
    );
}

// Priority dot
function PriorityDot({ priority }: { priority: 'urgent' | 'high' | 'medium' | 'low' }) {
    const colors = {
        urgent: 'bg-red-500',
        high: 'bg-orange-500',
        medium: 'bg-violet-500',
        low: 'bg-slate-500',
    };
    return <div className={`h-1.5 w-1.5 rounded-full ${colors[priority]}`} />;
}

// App Sidebar Component (mimics actual app)
function AppSidebar({ compact = false }: { compact?: boolean }) {
    return (
        <div className={`${compact ? 'w-12' : 'w-48'} h-full bg-[#1a1a1f] border-r border-white/5 flex flex-col`}>
            {/* Logo */}
            <div className={`${compact ? 'p-2' : 'p-3'} border-b border-white/5`}>
                <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-violet-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-white">L</span>
                    </div>
                    {!compact && <span className="text-sm font-semibold text-white">Lil PM</span>}
                </div>
            </div>

            {/* Navigation */}
            <div className={`flex-1 ${compact ? 'p-1' : 'p-2'} space-y-0.5`}>
                {[
                    { icon: Home, label: 'Home', active: false },
                    { icon: Sparkles, label: 'Lily AI', active: false },
                    { icon: Folder, label: 'Projects', active: true },
                    { icon: Target, label: 'Sprints', active: false },
                    { icon: BarChart3, label: 'Reports', active: false },
                ].map((item) => (
                    <div
                        key={item.label}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs cursor-pointer transition-colors ${item.active ? 'bg-violet-500/20 text-violet-400' : 'text-slate-400 hover:bg-white/5'
                            }`}
                    >
                        <item.icon className="h-3.5 w-3.5 flex-shrink-0" />
                        {!compact && <span>{item.label}</span>}
                    </div>
                ))}
            </div>

            {/* User */}
            {!compact && (
                <div className="p-2 border-t border-white/5">
                    <div className="flex items-center gap-2 px-2 py-1.5">
                        <div className="h-6 w-6 rounded-full bg-violet-500 flex items-center justify-center text-[10px] text-white font-medium">JD</div>
                        <span className="text-xs text-slate-400 truncate">john@company.com</span>
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
            const userMessage = "Create a user authentication system with OAuth2, email verification, and password reset flow";
            const aiResponse = "I'll create a comprehensive PRD for the authentication system. Here's what I'll include:\n\n✓ Email/password authentication with bcrypt\n✓ OAuth2 integration (Google, GitHub, Apple)\n✓ Email verification with magic links\n✓ Password reset with secure tokens\n✓ Session management with JWT\n\nGenerating 12 development tickets for Sprint 2024-Q1...";

            const [showAI, setShowAI] = useState(false);
            const { displayedText: userText, isComplete: userComplete } = useTypingAnimation(userMessage, 25, true);
            const { displayedText: aiText } = useTypingAnimation(aiResponse, 15, showAI);

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
                        <div className="h-11 border-b border-white/5 px-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-violet-500" />
                                <span className="text-sm font-medium text-white">Lily AI Assistant</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button className="text-slate-500 hover:text-white"><Bell className="h-4 w-4" /></button>
                                <button className="text-slate-500 hover:text-white"><Settings className="h-4 w-4" /></button>
                            </div>
                        </div>

                        {/* Chat Area */}
                        <div className="flex-1 p-4 overflow-hidden">
                            <div className="max-w-2xl mx-auto space-y-4">
                                {/* User Message */}
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex justify-end"
                                >
                                    <div className="flex items-end gap-2 max-w-[80%]">
                                        <div className="bg-violet-500 text-white rounded-2xl rounded-br-sm px-4 py-2.5 shadow-lg">
                                            <p className="text-sm leading-relaxed">{userText}<span className="animate-pulse opacity-60">|</span></p>
                                        </div>
                                        <div className="h-7 w-7 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                                            <span className="text-[10px] text-white font-medium">JD</span>
                                        </div>
                                    </div>
                                </motion.div>

                                {/* AI Response */}
                                <AnimatePresence>
                                    {showAI && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="flex gap-2 max-w-[85%]"
                                        >
                                            <div className="h-7 w-7 rounded-full bg-violet-500 flex items-center justify-center flex-shrink-0">
                                                <Sparkles className="h-3.5 w-3.5 text-white" />
                                            </div>
                                            <div className="bg-[#1e1e24] border border-white/10 rounded-2xl rounded-bl-sm px-4 py-2.5">
                                                <p className="text-sm leading-relaxed text-slate-200 whitespace-pre-line">{aiText}<span className="animate-pulse text-violet-500">|</span></p>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        {/* Input */}
                        <div className="p-4 border-t border-white/5">
                            <div className="max-w-2xl mx-auto">
                                <div className="bg-[#1e1e24] border border-white/10 rounded-xl px-4 py-2.5 flex items-center gap-2">
                                    <input type="text" placeholder="Ask Lily anything..." className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 outline-none" />
                                    <button className="p-1.5 rounded-lg bg-violet-500 text-white"><ArrowRight className="h-4 w-4" /></button>
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
                        { id: 'AUTH-005', title: 'Rate limiting middleware', priority: 'medium' as const },
                        { id: 'AUTH-006', title: 'Audit logging', priority: 'low' as const },
                    ]
                },
                {
                    id: 'todo', title: 'Todo', count: 4, issues: [
                        { id: 'AUTH-003', title: 'Password reset flow', priority: 'high' as const },
                        { id: 'AUTH-004', title: 'Email verification service', priority: 'medium' as const },
                    ]
                },
                {
                    id: 'progress', title: 'In Progress', count: 2, issues: [
                        { id: 'AUTH-001', title: 'Email login API endpoint', priority: 'high' as const },
                    ]
                },
                {
                    id: 'review', title: 'In Review', count: 1, issues: [
                        { id: 'AUTH-002', title: 'OAuth2 Google integration', priority: 'high' as const },
                    ]
                },
                { id: 'done', title: 'Done', count: 3, issues: [] },
            ];

            return (
                <div className="flex h-full">
                    <AppSidebar compact />
                    <div className="flex-1 flex flex-col bg-[#121215]">
                        {/* Header */}
                        <div className="h-11 border-b border-white/5 px-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-medium text-white">Authentication System</span>
                                <span className="text-[10px] px-2 py-0.5 rounded bg-violet-500/20 text-violet-400">Sprint 2024-Q1</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1 px-2 py-1 rounded bg-white/5 text-slate-400 text-xs">
                                    <Search className="h-3 w-3" />
                                    <span>Search</span>
                                </div>
                                <button className="text-slate-400 hover:text-white text-xs flex items-center gap-1 px-2 py-1 rounded bg-white/5">
                                    <Filter className="h-3 w-3" />
                                    Filter
                                </button>
                            </div>
                        </div>

                        {/* Board */}
                        <div className="flex-1 p-3 overflow-x-auto">
                            <div className="flex gap-2.5 h-full min-w-max">
                                {columns.map((col) => (
                                    <div key={col.id} className="w-56 flex-shrink-0 flex flex-col bg-[#1a1a1f] rounded-lg">
                                        <div className="px-3 py-2 flex items-center justify-between border-b border-white/5">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-medium text-white">{col.title}</span>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-slate-400">{col.count}</span>
                                            </div>
                                            <button className="text-slate-500 hover:text-white"><Plus className="h-3.5 w-3.5" /></button>
                                        </div>
                                        <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                                            {col.issues.map((issue) => (
                                                <motion.div
                                                    key={issue.id}
                                                    layout
                                                    className="bg-[#121215] border border-white/5 rounded-lg p-2.5 cursor-pointer hover:border-violet-500/30 transition-colors group"
                                                >
                                                    <div className="flex items-start gap-2 mb-2">
                                                        <PriorityDot priority={issue.priority} />
                                                        <span className="text-[10px] text-slate-500 font-mono">{issue.id}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-200 leading-relaxed group-hover:text-white">{issue.title}</p>
                                                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                                                        <div className="h-5 w-5 rounded-full bg-violet-500 flex items-center justify-center text-[8px] text-white font-medium">JD</div>
                                                        <span className="text-[9px] text-slate-500">5 pts</span>
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
                                { x: 180, y: 120 },
                                { x: 220, y: 100 },
                                { x: 320, y: 110 },
                                { x: 380, y: 120 },
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
This PRD outlines the implementation of a secure user authentication system.

## User Stories
**As a user**, I want to sign in with my email and password so that I can access my account securely.

**As a user**, I want to sign in with Google/GitHub so that I can onboard faster.

## Acceptance Criteria
- [ ] Email format validation (RFC 5322)
- [ ] Password minimum 8 characters with complexity
- [x] OAuth2 flow with PKCE
- [ ] Rate limiting: 5 attempts per minute`;
            const { displayedText } = useTypingAnimation(content, 18, true);

            return (
                <div className="flex h-full">
                    <AppSidebar compact />
                    <div className="flex-1 flex flex-col bg-[#121215]">
                        {/* Header */}
                        <div className="h-11 border-b border-white/5 px-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-violet-500" />
                                <span className="text-sm font-medium text-white">User Authentication PRD</span>
                                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">Draft</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex -space-x-1.5">
                                    <div className="h-6 w-6 rounded-full bg-violet-500 border-2 border-[#121215] flex items-center justify-center text-[9px] text-white">JD</div>
                                    <div className="h-6 w-6 rounded-full bg-blue-500 border-2 border-[#121215] flex items-center justify-center text-[9px] text-white">SK</div>
                                </div>
                                <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    Saving
                                </span>
                            </div>
                        </div>

                        {/* Toolbar */}
                        <div className="h-9 border-b border-white/5 px-4 flex items-center gap-1">
                            {['H1', 'H2', 'B', 'I', 'List', 'Link', 'Code'].map((item) => (
                                <button key={item} className="px-2 py-1 text-[10px] text-slate-400 hover:text-white hover:bg-white/5 rounded">
                                    {item}
                                </button>
                            ))}
                        </div>

                        {/* Editor */}
                        <div className="flex-1 p-6 overflow-auto">
                            <div className="max-w-3xl mx-auto prose prose-invert prose-sm">
                                <pre className="font-mono text-sm text-slate-200 whitespace-pre-wrap leading-relaxed bg-transparent p-0">
                                    {displayedText}<span className="animate-pulse text-violet-500 font-bold">|</span>
                                </pre>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel - Comments */}
                    <div className="w-56 bg-[#1a1a1f] border-l border-white/5 flex flex-col">
                        <div className="p-3 border-b border-white/5">
                            <span className="text-xs font-medium text-white">Comments</span>
                        </div>
                        <div className="flex-1 p-3 space-y-3">
                            <div className="bg-[#121215] rounded-lg p-2.5">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center text-[8px] text-white">SK</div>
                                    <span className="text-[10px] text-slate-400">Sarah K.</span>
                                </div>
                                <p className="text-[11px] text-slate-300">Should we add 2FA support in v1?</p>
                            </div>
                        </div>
                    </div>
                </div>
            );
        },
    },
    // Scene 4: Gantt Chart
    {
        id: 'gantt',
        title: 'Timeline View',
        component: function GanttScene() {
            const [progress, setProgress] = useState(0);

            useEffect(() => {
                const timer = setInterval(() => {
                    setProgress(prev => Math.min(prev + 3, 100));
                }, 100);
                return () => clearInterval(timer);
            }, []);

            const tasks = [
                { id: 'AUTH-001', name: 'Email Login API', assignee: 'JD', start: 0, width: 30, deps: [] },
                { id: 'AUTH-002', name: 'OAuth2 Integration', assignee: 'SK', start: 20, width: 35, deps: ['AUTH-001'] },
                { id: 'AUTH-003', name: 'Password Reset', assignee: 'MK', start: 15, width: 25, deps: [] },
                { id: 'AUTH-004', name: 'Email Verification', assignee: 'JD', start: 40, width: 30, deps: ['AUTH-002'] },
                { id: 'AUTH-005', name: 'Session Management', assignee: 'SK', start: 55, width: 25, deps: ['AUTH-004'] },
                { id: 'AUTH-006', name: 'QA Testing', assignee: 'HL', start: 70, width: 25, deps: ['AUTH-005'] },
            ];

            const weeks = ['Jan 6', 'Jan 13', 'Jan 20', 'Jan 27', 'Feb 3', 'Feb 10'];

            return (
                <div className="flex h-full">
                    <AppSidebar compact />
                    <div className="flex-1 flex flex-col bg-[#121215]">
                        {/* Header */}
                        <div className="h-11 border-b border-white/5 px-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Calendar className="h-4 w-4 text-violet-500" />
                                <span className="text-sm font-medium text-white">Timeline</span>
                                <span className="text-[10px] px-2 py-0.5 rounded bg-violet-500/20 text-violet-400">Sprint 2024-Q1</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-violet-500" /> In Progress</span>
                                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Complete</span>
                            </div>
                        </div>

                        {/* Gantt */}
                        <div className="flex-1 flex overflow-hidden">
                            {/* Task list */}
                            <div className="w-48 flex-shrink-0 border-r border-white/5">
                                <div className="h-8 border-b border-white/5 px-3 flex items-center">
                                    <span className="text-[10px] text-slate-400 font-medium">TASK</span>
                                </div>
                                {tasks.map((task) => (
                                    <div key={task.id} className="h-9 border-b border-white/5 px-3 flex items-center gap-2">
                                        <div className="h-5 w-5 rounded-full bg-violet-500 flex items-center justify-center text-[8px] text-white">{task.assignee}</div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[9px] text-slate-500 font-mono">{task.id}</div>
                                            <div className="text-[10px] text-slate-200 truncate">{task.name}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Timeline */}
                            <div className="flex-1 overflow-x-auto">
                                {/* Header */}
                                <div className="h-8 border-b border-white/5 flex">
                                    {weeks.map((week) => (
                                        <div key={week} className="flex-1 min-w-20 px-2 flex items-center border-r border-white/5 last:border-r-0">
                                            <span className="text-[10px] text-slate-400">{week}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Bars */}
                                <div className="relative">
                                    {tasks.map((task, i) => (
                                        <div key={task.id} className="h-9 border-b border-white/5 relative flex items-center">
                                            {/* Grid lines */}
                                            {weeks.map((_, j) => (
                                                <div key={j} className="flex-1 min-w-20 h-full border-r border-white/5 last:border-r-0" />
                                            ))}
                                            {/* Bar */}
                                            <motion.div
                                                initial={{ width: 0, opacity: 0 }}
                                                animate={{
                                                    width: `${Math.min(Math.max((progress - task.start) * (task.width / 35), 0), task.width)}%`,
                                                    opacity: progress >= task.start ? 1 : 0,
                                                }}
                                                className="absolute h-5 rounded-md bg-violet-500 shadow-lg"
                                                style={{ left: `${task.start}%` }}
                                            />
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
                            <div className="h-11 border-b border-white/5 px-4 flex items-center gap-3">
                                <span className="text-[10px] text-slate-500 font-mono">AUTH-001</span>
                                <StatusBadge status="In Progress" />
                            </div>

                            {/* Content */}
                            <div className="flex-1 p-5 overflow-auto">
                                <h1 className="text-lg font-semibold text-white mb-3">Implement Email Login API Endpoint</h1>

                                <div className="prose prose-invert prose-sm max-w-none">
                                    <p className="text-sm text-slate-300 leading-relaxed mb-4">
                                        Build a secure authentication endpoint that accepts email and password credentials, validates them against the database, and returns a JWT token for session management.
                                    </p>

                                    <h3 className="text-sm font-medium text-white mb-2">Acceptance Criteria</h3>
                                    <div className="space-y-1.5 mb-4">
                                        {[
                                            { done: true, text: 'Email format validation using RFC 5322' },
                                            { done: true, text: 'Password hashing with bcrypt (cost factor 12)' },
                                            { done: false, text: 'JWT token with 24h expiration' },
                                            { done: false, text: 'Refresh token rotation' },
                                        ].map((item, i) => (
                                            <div key={i} className="flex items-center gap-2 text-sm">
                                                {item.done ? (
                                                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                                                ) : (
                                                    <Circle className="h-4 w-4 text-slate-500" />
                                                )}
                                                <span className={item.done ? 'text-slate-500 line-through' : 'text-slate-300'}>{item.text}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <h3 className="text-sm font-medium text-white mb-2">Activity</h3>
                                    <div className="space-y-2">
                                        <div className="flex items-start gap-2">
                                            <div className="h-5 w-5 rounded-full bg-violet-500 flex items-center justify-center text-[8px] text-white mt-0.5">JD</div>
                                            <div>
                                                <p className="text-[11px] text-slate-400"><span className="text-white">John D.</span> moved to In Progress</p>
                                                <p className="text-[10px] text-slate-500">2 hours ago</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Sidebar */}
                        <div className="w-56 border-l border-white/5 p-4 space-y-4">
                            <div>
                                <label className="text-[10px] text-slate-500 uppercase mb-1.5 block">Status</label>
                                <StatusBadge status="In Progress" />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 uppercase mb-1.5 block">Priority</label>
                                <div className="flex items-center gap-2">
                                    <PriorityDot priority="high" />
                                    <span className="text-xs text-slate-300">High</span>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 uppercase mb-1.5 block">Assignee</label>
                                <div className="flex items-center gap-2">
                                    <div className="h-6 w-6 rounded-full bg-violet-500 flex items-center justify-center text-[9px] text-white">JD</div>
                                    <span className="text-xs text-slate-300">John Doe</span>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 uppercase mb-1.5 block">Story Points</label>
                                <span className="text-xs text-slate-300">5 points</span>
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 uppercase mb-1.5 block">Sprint</label>
                                <span className="text-xs text-slate-300">2024-Q1</span>
                            </div>
                        </div>
                    </div>

                    <AnimatedCursor
                        path={[
                            { x: 200, y: 150 },
                            { x: 280, y: 180 },
                            { x: 350, y: 160 },
                            { x: 400, y: 200 },
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
                        <div className="h-11 border-b border-white/5 px-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Users className="h-4 w-4 text-violet-500" />
                                <span className="text-sm font-medium text-white">Team Workspace</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex -space-x-2">
                                    <div className="h-6 w-6 rounded-full bg-violet-500 border-2 border-[#121215] flex items-center justify-center text-[9px] text-white">JD</div>
                                    <div className="h-6 w-6 rounded-full bg-blue-500 border-2 border-[#121215] flex items-center justify-center text-[9px] text-white">SK</div>
                                    <div className="h-6 w-6 rounded-full bg-emerald-500 border-2 border-[#121215] flex items-center justify-center text-[9px] text-white">MK</div>
                                </div>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center gap-1">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    3 online
                                </span>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 p-4 grid grid-cols-2 gap-4">
                            {/* Recent Issues */}
                            <div className="bg-[#1a1a1f] rounded-xl p-4">
                                <h3 className="text-xs font-medium text-white mb-3">Active Issues</h3>
                                <div className="space-y-2">
                                    {[
                                        { id: 'AUTH-001', title: 'Email Login API', status: 'In Progress', user: 'JD' },
                                        { id: 'AUTH-002', title: 'OAuth2 Integration', status: 'In Review', user: 'SK' },
                                        { id: 'AUTH-003', title: 'Password Reset', status: 'Todo', user: 'MK' },
                                    ].map((issue) => (
                                        <div key={issue.id} className="bg-[#121215] rounded-lg p-2.5 flex items-center gap-2">
                                            <div className="h-5 w-5 rounded-full bg-violet-500 flex items-center justify-center text-[8px] text-white">{issue.user}</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[10px] text-slate-500 font-mono">{issue.id}</div>
                                                <div className="text-xs text-slate-200 truncate">{issue.title}</div>
                                            </div>
                                            <StatusBadge status={issue.status} />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Sprint Progress */}
                            <div className="bg-[#1a1a1f] rounded-xl p-4">
                                <h3 className="text-xs font-medium text-white mb-3">Sprint Progress</h3>
                                <div className="mb-4">
                                    <div className="flex justify-between text-[10px] text-slate-400 mb-1.5">
                                        <span>Progress</span>
                                        <span>68%</span>
                                    </div>
                                    <div className="h-2 bg-[#121215] rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: '68%' }}
                                            transition={{ duration: 1.5, ease: 'easeOut' }}
                                            className="h-full bg-violet-500 rounded-full"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="bg-[#121215] rounded-lg p-2">
                                        <div className="text-lg font-bold text-violet-400">5</div>
                                        <div className="text-[9px] text-slate-500">In Progress</div>
                                    </div>
                                    <div className="bg-[#121215] rounded-lg p-2">
                                        <div className="text-lg font-bold text-violet-400">8</div>
                                        <div className="text-[9px] text-slate-500">Completed</div>
                                    </div>
                                    <div className="bg-[#121215] rounded-lg p-2">
                                        <div className="text-lg font-bold text-slate-400">3</div>
                                        <div className="text-[9px] text-slate-500">Remaining</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Multiple Cursors */}
                    <AnimatedCursor
                        path={[
                            { x: 120, y: 100 },
                            { x: 180, y: 130 },
                            { x: 220, y: 110 },
                            { x: 280, y: 140 },
                        ]}
                        duration={3}
                        name="John D."
                        color="#8b5cf6"
                    />
                    <AnimatedCursor
                        path={[
                            { x: 400, y: 120 },
                            { x: 450, y: 150 },
                            { x: 420, y: 180 },
                            { x: 480, y: 160 },
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
            <div className="h-9 border-b border-white/10 px-3 flex items-center gap-2 bg-[#1a1a1f]">
                <div className="flex gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                    <div className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                    <div className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                </div>
                <div className="flex-1 flex justify-center">
                    <div className="px-3 py-1 rounded-md bg-white/5 text-[10px] text-slate-400 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        app.lilpm.ai
                    </div>
                </div>
                <div className="w-12" />
            </div>

            {/* Scene Content - Fixed height */}
            <div className="h-[420px] relative">
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
            <div className="h-11 border-t border-white/10 px-4 flex items-center justify-between bg-[#1a1a1f]">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                    <span className="text-xs font-medium text-white">{currentScene.title}</span>
                </div>
                <div className="flex gap-1.5">
                    {scenes.map((scene, index) => (
                        <button
                            key={scene.id}
                            onClick={() => {
                                setCurrentSceneIndex(index);
                                setKey(prev => prev + 1);
                            }}
                            className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${index === currentSceneIndex
                                    ? 'w-6 bg-violet-500'
                                    : 'w-1.5 bg-white/20 hover:bg-white/40'
                                }`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
