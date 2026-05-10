const NAVIGATION_EVENT = 'app:navigation';

export function getCurrentNavigationPath(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function normalizeNavigationPath(path: string): string {
  const url = new URL(path, window.location.origin);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function navigateTo(path: string) {
  const nextPath = normalizeNavigationPath(path);

  if (getCurrentNavigationPath() === nextPath) {
    return;
  }

  window.history.pushState({}, '', nextPath);
  window.dispatchEvent(new Event(NAVIGATION_EVENT));
}

export function replaceTo(path: string) {
  const nextPath = normalizeNavigationPath(path);

  if (getCurrentNavigationPath() === nextPath) {
    return;
  }

  window.history.replaceState({}, '', nextPath);
  window.dispatchEvent(new Event(NAVIGATION_EVENT));
}

export function subscribeToNavigation(callback: () => void) {
  const handler = () => callback();

  window.addEventListener('popstate', handler);
  window.addEventListener(NAVIGATION_EVENT, handler);

  return () => {
    window.removeEventListener('popstate', handler);
    window.removeEventListener(NAVIGATION_EVENT, handler);
  };
}
