/**
 * Remembers whether the user has already moved between pages inside the app in this tab, so a
 * "Back" control can use the browser history without ever leaving the app.
 */
let lastPathname: string | null = null;
let navigated = false;

export function recordPathname(pathname: string): void {
  if (lastPathname !== null && lastPathname !== pathname) navigated = true;
  lastPathname = pathname;
}

export function hasInAppHistory(): boolean {
  return navigated;
}
