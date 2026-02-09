// History panel resize handling for Lily Chat
import { useState, useCallback } from 'react';
import {
    MIN_HISTORY_WIDTH,
    MAX_HISTORY_WIDTH,
    DEFAULT_HISTORY_WIDTH,
} from '../types';

export interface UseLilyHistoryPanelReturn {
    showHistory: boolean;
    historyWidth: number;
    isResizing: boolean;

    setShowHistory: (show: boolean) => void;
    toggleHistory: () => void;
    handleHistoryResize: (e: React.MouseEvent) => void;
}

export function useLilyHistoryPanel(): UseLilyHistoryPanelReturn {
    const [showHistory, setShowHistory] = useState(false);
    const [historyWidth, setHistoryWidth] = useState(DEFAULT_HISTORY_WIDTH);
    const [isResizing, setIsResizing] = useState(false);

    const toggleHistory = useCallback(() => {
        setShowHistory(prev => !prev);
    }, []);

    const handleHistoryResize = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);

        const startX = e.clientX;
        const startWidth = historyWidth;

        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = e.clientX - startX;
            const newWidth = Math.min(MAX_HISTORY_WIDTH, Math.max(MIN_HISTORY_WIDTH, startWidth + deltaX));
            setHistoryWidth(newWidth);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [historyWidth]);

    return {
        showHistory,
        historyWidth,
        isResizing,
        setShowHistory,
        toggleHistory,
        handleHistoryResize,
    };
}
