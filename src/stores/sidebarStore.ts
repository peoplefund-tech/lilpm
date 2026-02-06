import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SidebarStore {
    isCollapsed: boolean;
    width: number;
    isResizing: boolean;
    isLilyMode: boolean;

    toggleSidebar: () => void;
    setWidth: (width: number) => void;
    startResizing: () => void;
    stopResizing: () => void;
    setIsLilyMode: (isLily: boolean) => void;
}

export const useSidebarStore = create<SidebarStore>()(
    persist(
        (set) => ({
            isCollapsed: false,
            width: 260,
            isResizing: false,
            isLilyMode: false,

            toggleSidebar: () => set((state) => ({ isCollapsed: !state.isCollapsed })),

            setWidth: (width: number) => set({ width }),

            startResizing: () => {
                set({ isResizing: true });

                const handleMouseMove = (e: MouseEvent) => {
                    set((state) => {
                        const newWidth = Math.max(200, Math.min(480, e.clientX));
                        return { width: newWidth, isCollapsed: newWidth < 100 };
                    });
                };

                const handleMouseUp = () => {
                    set({ isResizing: false });
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                    document.body.style.cursor = 'default';
                };

                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
                document.body.style.cursor = 'col-resize';
            },

            stopResizing: () => set({ isResizing: false }),

            setIsLilyMode: (isLily: boolean) => set({ isLilyMode: isLily }),
        }),
        {
            name: 'sidebar-storage',
            partialize: (state) => ({
                isCollapsed: state.isCollapsed,
                width: state.width,
                isLilyMode: state.isLilyMode
            }),
        }
    )
);
