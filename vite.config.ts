import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: mode === "development",
    chunkSizeWarningLimit: 1000, // Increase limit since we're intentionally creating large vendor chunks
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React ecosystem
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Supabase client
          'supabase': ['@supabase/supabase-js'],
          // Rich text editor
          'editor': ['@tiptap/react', '@tiptap/starter-kit', '@tiptap/extension-placeholder', '@tiptap/extension-link'],
          // UI components
          'ui-radix': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select', '@radix-ui/react-tabs', '@radix-ui/react-tooltip', '@radix-ui/react-popover'],
          // Icons
          'icons': ['lucide-react'],
          // Form and validation
          'form': ['react-hook-form', '@hookform/resolvers', 'zod'],
          // State management
          'state': ['zustand'],
          // Date utilities
          'date': ['date-fns'],
          // i18n
          'i18n': ['i18next', 'react-i18next'],
        },
      },
    },
  },
}));
