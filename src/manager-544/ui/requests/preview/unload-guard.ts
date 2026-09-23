/** The browser's "leave page?" prompt, held while the send queue runs (only a reload can kill it). */
let unloadGuard: ((e: BeforeUnloadEvent) => void) | null = null;

export function holdUnloadGuard(on: boolean): void {
  if (typeof window === 'undefined') return;
  if (on && !unloadGuard) {
    unloadGuard = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', unloadGuard);
  } else if (!on && unloadGuard) {
    window.removeEventListener('beforeunload', unloadGuard);
    unloadGuard = null;
  }
}
