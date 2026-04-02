const NAVIGATION_EVENT = 'app:navigation';

export function navigateTo(path: string) {
  if (window.location.pathname === path) {
    return;
  }

  window.history.pushState({}, '', path);
  window.dispatchEvent(new Event(NAVIGATION_EVENT));
}

export function replaceTo(path: string) {
  if (window.location.pathname === path) {
    return;
  }

  window.history.replaceState({}, '', path);
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