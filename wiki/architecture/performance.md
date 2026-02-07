# Performance Optimization Guide

## Overview
LilPM uses Vite 5.x with advanced build optimization for fast loading and efficient caching.

## Bundle Architecture

### Vendor Chunks (manualChunks)
| Chunk | Contents | Size (gzip) |
|-------|----------|-------------|
| react-vendor | react, react-dom, react-router-dom | ~53KB |
| supabase | @supabase/supabase-js | ~45KB |
| editor | TipTap rich text editor | ~123KB |
| ui-radix | Radix UI primitives | ~36KB |
| icons | lucide-react | ~12KB |
| form | react-hook-form, zod | ~22KB |
| date | date-fns | ~8KB |
| i18n | i18next | ~16KB |

### Route-based Code Splitting
All major pages use `React.lazy()` for on-demand loading:

```typescript
const DashboardPage = React.lazy(() => 
  import("./pages/DashboardPage").then(m => ({ default: m.DashboardPage }))
);
```

## Loading Strategy

### Immediate Load (Critical Path)
- Auth pages (Login, Signup)
- LandingPage
- Onboarding pages

### Lazy Load (On Navigation)
- DashboardPage
- IssuesPage, IssueDetailPage
- PRDPage, PRDDetailPage
- LilyPage
- Settings pages
- All other feature pages

## Suspense Fallback
```tsx
<Suspense fallback={<PageLoader />}>
  <Routes>
    {/* All routes */}
  </Routes>
</Suspense>
```

## Caching Strategy

### Browser Caching
- Vendor chunks have content hashes for long-term caching
- When vendor libraries don't change, browsers use cached versions

### In-Memory Caching
- Team member data cached with 5-minute TTL
- Stale-While-Revalidate pattern for frequently accessed data

## Performance Metrics
| Metric | Target | Current |
|--------|--------|---------|
| Initial Bundle | <200KB | ~156KB (index.js) |
| First Contentful Paint | <1.5s | ~1.2s |
| Time to Interactive | <3s | ~2.5s |

## Configuration

### vite.config.ts
```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        'supabase': ['@supabase/supabase-js'],
        // ... more chunks
      }
    }
  }
}
```

## Best Practices

1. **Dynamic Imports for Heavy Components**
   - Use `React.lazy()` for pages over 20KB
   
2. **Avoid Barrel Files**
   - Direct imports prevent tree-shaking issues
   
3. **Monitor Bundle Size**
   - Run `npm run build` to check chunk sizes
   - Keep index.js under 200KB
