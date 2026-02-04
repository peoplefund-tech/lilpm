import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n"; // Initialize i18n
import { useThemeStore } from "@/stores/themeStore";

// Apply theme on initial load
const savedTheme = localStorage.getItem('theme-storage');
if (savedTheme) {
  try {
    const { state } = JSON.parse(savedTheme);
    if (state?.theme) {
      const root = document.documentElement;
      root.classList.remove('light', 'dark');
      if (state.theme === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        root.classList.add(systemTheme);
      } else {
        root.classList.add(state.theme);
      }
    }
  } catch (e) {
    // Default to dark if parsing fails
    document.documentElement.classList.add('dark');
  }
} else {
  // Default to dark theme
  document.documentElement.classList.add('dark');
}

createRoot(document.getElementById("root")!).render(<App />);
