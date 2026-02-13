import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/collab": {
        target: "ws://localhost:3001",
        ws: true,
        changeOrigin: true,
      },
    },
  },
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Optimize dependency pre-bundling
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "@supabase/supabase-js",
      "zustand",
      "@tanstack/react-query",
      "clsx",
      "tailwind-merge",
      "date-fns",
      "i18next",
      "react-i18next",
      "lucide-react",
      "framer-motion",
      "zod",
      "react-hook-form",
    ],
    // Exclude heavy optional dependencies from pre-bundling
    exclude: ["@liveblocks/client", "@liveblocks/yjs"],
  },
  build: {
    outDir: "dist",
    sourcemap: mode === "development",
    // Target modern browsers for smaller output
    target: "es2022",
    // CSS code splitting for better caching
    cssCodeSplit: true,
    // CSS minification (using default esbuild minifier)
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Use content hash for long-term caching
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
        manualChunks: {
          // Core React ecosystem (rarely changes)
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          // Supabase client
          supabase: ["@supabase/supabase-js"],
          // Rich text editor (largest chunk - loaded lazily)
          "editor-core": [
            "@tiptap/react",
            "@tiptap/starter-kit",
          ],
          "editor-extensions": [
            "@tiptap/extension-placeholder",
            "@tiptap/extension-link",
            "@tiptap/extension-image",
            "@tiptap/extension-table",
            "@tiptap/extension-table-row",
            "@tiptap/extension-table-cell",
            "@tiptap/extension-table-header",
            "@tiptap/extension-task-item",
            "@tiptap/extension-task-list",
            "@tiptap/extension-code-block-lowlight",
            "@tiptap/extension-highlight",
            "@tiptap/extension-color",
            "@tiptap/extension-text-style",
            "@tiptap/extension-mention",
            "@tiptap/extension-typography",
          ],
          // Collaboration (heavy, loaded on demand)
          collaboration: ["yjs", "y-prosemirror", "y-indexeddb"],
          // UI components (Radix primitives)
          "ui-radix": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-popover",
            "@radix-ui/react-scroll-area",
            "@radix-ui/react-accordion",
            "@radix-ui/react-alert-dialog",
            "@radix-ui/react-context-menu",
          ],
          // Icons
          icons: ["lucide-react"],
          // Form and validation
          form: ["react-hook-form", "@hookform/resolvers", "zod"],
          // State management
          state: ["zustand", "@tanstack/react-query"],
          // Date utilities
          date: ["date-fns"],
          // i18n
          i18n: ["i18next", "react-i18next", "i18next-browser-languagedetector"],
          // Animation
          animation: ["framer-motion"],
          // Markdown rendering
          markdown: ["react-markdown", "remark-gfm", "marked", "dompurify"],
          // Charts
          charts: ["recharts"],
        },
      },
    },
  },
}));
