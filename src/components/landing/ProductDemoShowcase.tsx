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
    ChevronRight,
    Sparkles,
    ArrowRight,
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
                className="absolute left-4 top-4 px-2 py-0.5 rounded text-xs text-white whitespace-nowrap shadow-lg"
                style={{ backgroundColor: color }}
            >
                {name}
            </div>
        </motion.div>
    );
}

// Status badge component
function StatusBadge({ status, className = '' }: { status: string; className?: string }) {
    const colors: Record<string, string> = {
        'Backlog': 'bg-slate-500/20 text-slate-400',
        'Todo': 'bg-blue-500/20 text-blue-400',
        'In Progress': 'bg-amber-500/20 text-amber-400',
        'In Review': 'bg-purple-500/20 text-purple-400',
        'Done': 'bg-emerald-500/20 text-emerald-400',
    };
    return (
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${colors[status] || 'bg-muted text-muted-foreground'} ${className}`}>
            {status}
        </span>
    );
}

// Priority indicator
function PriorityIndicator({ priority }: { priority: 'urgent' | 'high' | 'medium' | 'low' }) {
    const colors = {
        urgent: 'bg-red-500',
        high: 'bg-orange-500',
        medium: 'bg-yellow-500',
        low: 'bg-blue-500',
    };
    return (
        <div className={`h-1.5 w-1.5 rounded-full ${colors[priority]}`} />
    );
}

// Demo Scene Components
const scenes = [
    // Scene 1: Lily AI Chat
    {
        id: 'lily-chat',
        title: 'Chat with Lily AI',
        component: function LilyChatScene() {
            const userMessage = "Build a user authentication system with OAuth2 and email verification";
            const aiMessage = "I'll create a comprehensive PRD for user authentication. The system will include:\n\n✓ Email/password login with verification\n✓ OAuth2 integration (Google, GitHub)\n✓ Password reset flow\n✓ Session management\n\nGenerating 8 development tickets...";

            const [showAI, setShowAI] = useState(false);
            const { displayedText: userText, isComplete: userComplete } = useTypingAnimation(userMessage, 30, true);
            const { displayedText: aiText } = useTypingAnimation(aiMessage, 20, showAI);

            useEffect(() => {
                if (userComplete) {
                    const timer = setTimeout(() => setShowAI(true), 600);
                    return () => clearTimeout(timer);
                }
            }, [userComplete]);

            return (
                <div className="w-full max-w-xl mx-auto space-y-4">
                    {/* User Message */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-end"
                    >
                        <div className="flex items-end gap-2 max-w-[85%]">
                            <div className="bg-gradient-to-br from-violet-600 to-purple-600 text-white rounded-2xl rounded-br-sm px-4 py-3 shadow-lg shadow-violet-500/20">
                                <p className="text-sm leading-relaxed">{userText}<span className="animate-pulse opacity-60">|</span></p>
                            </div>
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center flex-shrink-0 shadow-md">
                                <span className="text-xs text-white font-medium">JD</span>
                            </div>
                        </div>
                    </motion.div>

                    {/* AI Response */}
                    <AnimatePresence>
                        {showAI && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex gap-2 max-w-[90%]"
                            >
                                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-500/30">
                                    <Sparkles className="h-4 w-4 text-white" />
                                </div>
                                <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl rounded-bl-sm px-4 py-3 shadow-xl">
                                    <p className="text-sm leading-relaxed whitespace-pre-line">{aiText}<span className="animate-pulse text-violet-500">|</span></p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            );
        },
    },
    // Scene 2: PRD & Ticket Auto-Generation
    {
        id: 'auto-generation',
        title: 'Auto-Generate PRD & Tickets',
        component: function AutoGenerationScene() {
            const [step, setStep] = useState(0);

            useEffect(() => {
                const timers = [
                    setTimeout(() => setStep(1), 600),
                    setTimeout(() => setStep(2), 1200),
                    setTimeout(() => setStep(3), 1800),
                    setTimeout(() => setStep(4), 2400),
                    setTimeout(() => setStep(5), 3000),
                ];
                return () => timers.forEach(clearTimeout);
            }, []);

            const tickets = [
                { id: 'AUTH-001', title: 'Implement Email Login API', priority: 'high' as const, points: 5 },
                { id: 'AUTH-002', title: 'OAuth2 Google Integration', priority: 'high' as const, points: 8 },
                { id: 'AUTH-003', title: 'Password Reset Flow', priority: 'medium' as const, points: 3 },
                { id: 'AUTH-004', title: 'Email Verification Service', priority: 'medium' as const, points: 5 },
            ];

            return (
                <div className="w-full max-w-xl mx-auto">
                    {/* PRD Card */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-4 mb-4 shadow-xl"
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
                                <FileText className="h-5 w-5 text-violet-500" />
                            </div>
                            <div className="flex-1">
                                <div className="font-semibold text-sm">User Authentication System</div>
                                <div className="text-xs text-muted-foreground">PRD-2024-0142</div>
                            </div>
                            {step >= 1 && (
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="flex items-center gap-1 text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full"
                                >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    <span className="text-xs font-medium">Generated</span>
                                </motion.div>
                            )}
                        </div>
                        {step >= 1 && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex items-center gap-4 text-xs text-muted-foreground border-t border-border/50 pt-3"
                            >
                                <span className="flex items-center gap-1"><Ticket className="h-3 w-3" /> 8 tickets</span>
                                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> ~34 story points</span>
                                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> 2 sprints</span>
                            </motion.div>
                        )}
                    </motion.div>

                    {/* Generated Tickets */}
                    <div className="space-y-2">
                        {tickets.map((ticket, i) => (
                            step >= i + 2 && (
                                <motion.div
                                    key={ticket.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.05 * i }}
                                    className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-lg p-3 flex items-center gap-3 shadow-lg hover:border-violet-500/30 transition-colors cursor-pointer group"
                                >
                                    <PriorityIndicator priority={ticket.priority} />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[10px] text-muted-foreground font-mono">{ticket.id}</div>
                                        <div className="text-sm font-medium truncate group-hover:text-violet-400 transition-colors">{ticket.title}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{ticket.points} pts</span>
                                        <StatusBadge status="Todo" />
                                    </div>
                                </motion.div>
                            )
                        ))}
                    </div>
                </div>
            );
        },
    },
    // Scene 3: Real-time PRD Editing
    {
        id: 'prd-editing',
        title: 'Real-time PRD Editor',
        component: function PRDEditingScene() {
            const content = `## User Stories

As a user, I want to sign in with my email and password so that I can access my account securely.

## Acceptance Criteria

- [ ] Email format validation (RFC 5322)
- [ ] Password minimum 8 characters
- [ ] Rate limiting: 5 attempts per minute
- [ ] Session expires after 24 hours`;
            const { displayedText } = useTypingAnimation(content, 25, true);

            return (
                <div className="w-full max-w-xl mx-auto">
                    <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl overflow-hidden shadow-xl">
                        {/* Editor Toolbar */}
                        <div className="border-b border-border/50 px-4 py-2 flex items-center gap-2 bg-muted/30">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                {['B', 'I', 'U'].map(item => (
                                    <button key={item} className="h-7 w-7 rounded hover:bg-muted flex items-center justify-center text-xs font-medium">
                                        {item}
                                    </button>
                                ))}
                                <div className="h-4 w-px bg-border mx-1" />
                                <button className="h-7 w-7 rounded hover:bg-muted flex items-center justify-center">
                                    <Tag className="h-3.5 w-3.5" />
                                </button>
                            </div>
                            <div className="flex-1" />
                            <span className="text-xs text-emerald-500 flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                Saving...
                            </span>
                        </div>

                        {/* Editor Content */}
                        <div className="p-5 min-h-[180px] font-mono text-sm whitespace-pre-wrap leading-relaxed">
                            {displayedText}<span className="animate-pulse text-violet-500 font-bold">|</span>
                        </div>
                    </div>

                    {/* Collaborator indicator */}
                    <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="flex -space-x-2">
                                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 border-2 border-background shadow-md" />
                                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 border-2 border-background shadow-md" />
                                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-emerald-500 to-green-500 border-2 border-background shadow-md" />
                            </div>
                            <span className="text-xs text-muted-foreground">3 people editing</span>
                        </div>
                        <span className="text-xs text-muted-foreground">Last edited 2s ago</span>
                    </div>
                </div>
            );
        },
    },
    // Scene 4: Kanban Board
    {
        id: 'kanban',
        title: 'Kanban Board',
        component: function KanbanScene() {
            const [draggedItem, setDraggedItem] = useState<number | null>(null);
            const [columns, setColumns] = useState([
                { id: 'todo', title: 'Todo', count: 3, items: ['Email Login API', 'OAuth Setup'] },
                { id: 'progress', title: 'In Progress', count: 2, items: ['UI Components'] },
                { id: 'review', title: 'In Review', count: 1, items: ['Database Schema'] },
                { id: 'done', title: 'Done', count: 4, items: [] },
            ]);

            useEffect(() => {
                const timer1 = setTimeout(() => setDraggedItem(0), 1000);
                const timer2 = setTimeout(() => {
                    setColumns(prev => {
                        const newCols = prev.map(col => ({ ...col, items: [...col.items] }));
                        if (newCols[0].items.length > 0) {
                            const item = newCols[0].items.shift()!;
                            newCols[1].items.unshift(item);
                        }
                        return newCols;
                    });
                    setDraggedItem(null);
                }, 2500);

                return () => {
                    clearTimeout(timer1);
                    clearTimeout(timer2);
                };
            }, []);

            return (
                <div className="w-full max-w-xl mx-auto relative">
                    <div className="flex gap-2">
                        {columns.map(col => (
                            <div key={col.id} className="flex-1 bg-muted/30 backdrop-blur-sm rounded-lg p-2 min-h-[200px]">
                                <div className="flex items-center justify-between mb-2 px-1">
                                    <span className="text-xs font-medium">{col.title}</span>
                                    <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-1.5">{col.count}</span>
                                </div>
                                <div className="space-y-2">
                                    {col.items.map((item) => (
                                        <motion.div
                                            key={item}
                                            layout
                                            className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-lg p-2.5 text-xs shadow-md hover:border-violet-500/30 transition-colors cursor-pointer"
                                        >
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <GripVertical className="h-3 w-3 text-muted-foreground" />
                                                <span className="font-medium">{item}</span>
                                            </div>
                                            <div className="flex items-center gap-2 pl-5">
                                                <PriorityIndicator priority="high" />
                                                <span className="text-[10px] text-muted-foreground">AUTH-001</span>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {draggedItem !== null && (
                        <AnimatedCursor
                            path={[
                                { x: 60, y: 70 },
                                { x: 100, y: 60 },
                                { x: 160, y: 55 },
                                { x: 200, y: 65 },
                            ]}
                            duration={1.5}
                            name="You"
                            color="#8b5cf6"
                        />
                    )}
                </div>
            );
        },
    },
    // Scene 5: Gantt Chart
    {
        id: 'gantt',
        title: 'Gantt Chart & Timeline',
        component: function GanttScene() {
            const [progress, setProgress] = useState(0);

            useEffect(() => {
                const timer = setInterval(() => {
                    setProgress(prev => Math.min(prev + 4, 100));
                }, 150);
                return () => clearInterval(timer);
            }, []);

            const tasks = [
                { name: 'Backend API', assignee: 'JD', start: 0, width: 35, color: 'from-violet-500 to-purple-600' },
                { name: 'OAuth Integration', assignee: 'SK', start: 25, width: 30, color: 'from-blue-500 to-cyan-500' },
                { name: 'Frontend UI', assignee: 'MK', start: 40, width: 35, color: 'from-amber-500 to-orange-500' },
                { name: 'QA Testing', assignee: 'HL', start: 65, width: 25, color: 'from-emerald-500 to-green-500' },
            ];

            const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];

            return (
                <div className="w-full max-w-xl mx-auto">
                    <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl overflow-hidden shadow-xl">
                        {/* Timeline Header */}
                        <div className="border-b border-border/50 px-4 py-2.5 flex bg-muted/30">
                            <div className="w-32 text-xs font-medium flex items-center gap-2">
                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                Sprint 2024-Q1
                            </div>
                            <div className="flex-1 flex text-[10px] text-muted-foreground">
                                {weeks.map(w => (
                                    <div key={w} className="flex-1 text-center">{w}</div>
                                ))}
                            </div>
                        </div>

                        {/* Tasks */}
                        <div className="p-3 space-y-2.5">
                            {tasks.map(task => (
                                <div key={task.name} className="flex items-center group">
                                    <div className="w-32 pr-2 flex items-center gap-2">
                                        <div className="h-5 w-5 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-[8px] text-white font-medium">
                                            {task.assignee}
                                        </div>
                                        <span className="text-xs truncate">{task.name}</span>
                                    </div>
                                    <div className="flex-1 h-7 bg-muted/30 rounded relative overflow-hidden">
                                        {/* Grid lines */}
                                        <div className="absolute inset-0 flex">
                                            {weeks.map((_, i) => (
                                                <div key={i} className="flex-1 border-l border-border/20 first:border-l-0" />
                                            ))}
                                        </div>
                                        {/* Progress bar */}
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{
                                                width: `${Math.min(Math.max((progress - task.start) * (task.width / 40), 0), task.width)}%`,
                                                opacity: progress >= task.start ? 1 : 0,
                                            }}
                                            className={`absolute h-full rounded bg-gradient-to-r ${task.color} shadow-lg`}
                                            style={{ left: `${task.start}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Legend */}
                        <div className="border-t border-border/50 px-4 py-2 flex items-center justify-between text-[10px] text-muted-foreground bg-muted/20">
                            <span>4 tasks • 21 story points</span>
                            <span className="flex items-center gap-1">
                                <span className="h-2 w-2 rounded-full bg-violet-500" />
                                On track
                            </span>
                        </div>
                    </div>
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
                <div className="w-full max-w-xl mx-auto relative min-h-[220px]">
                    {/* Issue Card */}
                    <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-5 shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground font-mono">AUTH-001</span>
                                <StatusBadge status="In Progress" />
                            </div>
                            <div className="flex -space-x-2">
                                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 border-2 border-background flex items-center justify-center text-[10px] text-white font-medium shadow-md">JD</div>
                                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 border-2 border-background flex items-center justify-center text-[10px] text-white font-medium shadow-md">SK</div>
                                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-emerald-500 to-green-500 border-2 border-background flex items-center justify-center text-[10px] text-white font-medium shadow-md">MK</div>
                            </div>
                        </div>
                        <h3 className="text-lg font-semibold mb-2">Implement Email Login API</h3>
                        <p className="text-sm text-muted-foreground mb-4">Build secure authentication endpoint with JWT tokens and refresh token rotation.</p>

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                                <PriorityIndicator priority="high" />
                                High Priority
                            </span>
                            <span className="flex items-center gap-1.5">
                                <Clock className="h-3 w-3" />
                                5 story points
                            </span>
                            <span className="flex items-center gap-1.5">
                                <Users className="h-3 w-3" />
                                3 viewing
                            </span>
                        </div>
                    </div>

                    {/* Live indicator */}
                    <div className="absolute -top-2 -right-2 flex items-center gap-1.5 bg-emerald-500 text-white text-[10px] px-2 py-1 rounded-full shadow-lg">
                        <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                        Live
                    </div>

                    {/* Multiple Cursors */}
                    <AnimatedCursor
                        path={[
                            { x: 80, y: 50 },
                            { x: 140, y: 70 },
                            { x: 200, y: 55 },
                            { x: 260, y: 80 },
                        ]}
                        duration={3}
                        name="John D."
                        color="#8b5cf6"
                    />
                    <AnimatedCursor
                        path={[
                            { x: 300, y: 100 },
                            { x: 250, y: 120 },
                            { x: 220, y: 105 },
                            { x: 280, y: 130 },
                        ]}
                        duration={4}
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

    // Auto-advance scenes every 5 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentSceneIndex(prev => (prev + 1) % scenes.length);
            setKey(prev => prev + 1);
        }, 5500);
        return () => clearInterval(interval);
    }, []);

    const currentScene = scenes[currentSceneIndex];
    const SceneComponent = currentScene.component;

    return (
        <div className="relative rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl overflow-hidden shadow-2xl shadow-violet-500/10">
            {/* Gradient border effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 via-transparent to-blue-500/10 pointer-events-none" />
            <div className="absolute inset-[1px] rounded-2xl bg-background/80 backdrop-blur-xl -z-10" />

            {/* Mac-style window chrome */}
            <div className="border-b border-border/50 px-4 py-3 flex items-center gap-3 bg-muted/30 backdrop-blur-sm">
                <div className="flex gap-2">
                    <div className="h-3 w-3 rounded-full bg-[#ff5f57] shadow-inner" />
                    <div className="h-3 w-3 rounded-full bg-[#febc2e] shadow-inner" />
                    <div className="h-3 w-3 rounded-full bg-[#28c840] shadow-inner" />
                </div>
                <div className="flex-1 flex justify-center">
                    <div className="px-4 py-1.5 rounded-lg bg-muted/50 text-xs text-muted-foreground flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        app.lilpm.ai
                    </div>
                </div>
                <div className="w-16" />
            </div>

            {/* Scene Content */}
            <div className="relative min-h-[320px] p-6">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={`${currentSceneIndex}-${key}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.4 }}
                        className="h-full"
                    >
                        <SceneComponent />
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Scene Progress */}
            <div className="border-t border-border/50 px-6 py-4 flex items-center justify-between bg-muted/20 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-violet-500" />
                    <span className="text-sm font-medium">{currentScene.title}</span>
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
                                    ? 'w-8 bg-gradient-to-r from-violet-500 to-purple-600'
                                    : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                                }`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
