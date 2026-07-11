/**
 * Resolve a public asset path (e.g. "/icons/crowbar.png") against the app's
 * base URL. On GitHub Pages the app is served from a subpath (/RoR2Guide/),
 * so absolute "/icons/..." paths must be prefixed with import.meta.env.BASE_URL.
 * In dev / at a root domain, BASE_URL is "/" and this is a no-op.
 */
export function asset(path: string): string {
  return import.meta.env.BASE_URL + path.replace(/^\//, "");
}
