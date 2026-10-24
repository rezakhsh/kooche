import { noteNavigation, startBrowserMonitoring } from './lib/monitoring/browser';

// Runs on every page before it becomes interactive (Next.js convention). Browser error monitoring
// only; it does nothing unless the root layout rendered its settings (src/lib/monitoring/browser.ts).
startBrowserMonitoring();

export function onRouterTransitionStart(url: string) {
  noteNavigation(url);
}
