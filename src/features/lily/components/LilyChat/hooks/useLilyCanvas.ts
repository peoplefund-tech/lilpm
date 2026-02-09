// Canvas mode handling for Lily Chat
import { useState, useRef, useEffect, useCallback } from 'react';

export interface UseLilyCanvasReturn {
    canvasMode: boolean;
    canvasViewMode: 'code' | 'preview';
    canvasCode: string;
    canvasError: string | null;
    showCanvasPanel: boolean;

    setCanvasMode: (enabled: boolean) => void;
    setCanvasViewMode: (mode: 'code' | 'preview') => void;
    setCanvasCode: (code: string) => void;
    setCanvasError: (error: string | null) => void;
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

export function useLilyCanvas(
    messages: Message[],
    isLoading: boolean
): UseLilyCanvasReturn {
    const [canvasMode, setCanvasMode] = useState(false);
    const [canvasViewMode, setCanvasViewMode] = useState<'code' | 'preview'>('code');
    const [canvasCode, setCanvasCode] = useState('');
    const [canvasError, setCanvasError] = useState<string | null>(null);
    const [showCanvasPanel, setShowCanvasPanel] = useState(false);

    const prevIsLoading = useRef(isLoading);

    // Extract canvas code from latest assistant message when in canvas mode
    useEffect(() => {
        if (!canvasMode || messages.length === 0) return;

        const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
        if (!lastAssistantMessage) return;

        const content = lastAssistantMessage.content;

        // Try to extract code blocks from the message
        const codeBlockMatch = content.match(/```(?:jsx?|tsx?|javascript|typescript|html|css|react)?\n([\s\S]*?)(?:```|$)/);

        if (codeBlockMatch) {
            const extractedCode = codeBlockMatch[1].trim();
            if (extractedCode) {
                setCanvasCode(extractedCode);
                setCanvasError(null);
                if (!showCanvasPanel) {
                    setShowCanvasPanel(true);
                    setCanvasViewMode('code');
                }
            }
        }

        // Auto-switch to preview when generation completes
        if (prevIsLoading.current && !isLoading && canvasCode) {
            setTimeout(() => {
                setCanvasViewMode('preview');
            }, 500);
        }
        prevIsLoading.current = isLoading;
    }, [messages, canvasMode, showCanvasPanel, isLoading, canvasCode]);

    // Reset canvas panel when canvas mode is turned off
    useEffect(() => {
        if (!canvasMode) {
            setShowCanvasPanel(false);
            setCanvasCode('');
        }
    }, [canvasMode]);

    const handleSetCanvasMode = useCallback((enabled: boolean) => {
        setCanvasMode(enabled);
        if (!enabled) {
            setShowCanvasPanel(false);
            setCanvasCode('');
        }
    }, []);

    return {
        canvasMode,
        canvasViewMode,
        canvasCode,
        canvasError,
        showCanvasPanel,
        setCanvasMode: handleSetCanvasMode,
        setCanvasViewMode,
        setCanvasCode,
        setCanvasError,
    };
}
