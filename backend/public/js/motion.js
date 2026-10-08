// Motion helpers. Everything animated checks reducedMotion() first.
export const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Smooth swap of the visible screen when the browser supports View Transitions.
export function transition(update) {
  if (!document.startViewTransition || reducedMotion() || document.hidden) {
    update();
    return Promise.resolve();
  }
  try {
    return document.startViewTransition(update).finished.catch(() => {});
  } catch {
    update();
    return Promise.resolve();
  }
}
