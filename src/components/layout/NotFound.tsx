import { Link } from "@tanstack/react-router";

/**
 * §3j.146 — the app had no 404.
 *
 * `/nonsense` rendered the two unstyled words "Not Found": TanStack Router's built-in default,
 * which is what you get when nobody writes one. No heading, no styling, no way back. Meanwhile
 * `/survivors/nobody` already said "No survivor called 'nobody'" with a link home, so the
 * pattern existed — it had just never been applied to the case that catches every mistyped,
 * stale or truncated URL.
 *
 * The `<h1>` matters beyond looks: every route is required to have exactly one (§3j.142), and
 * the 404 was exempt only because no test ever visited a URL that did not exist.
 */
export function NotFound({
  title = "Page not found",
  detail,
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <div className="py-16 text-center">
      <h1 className="font-display text-2xl font-semibold text-foreground">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {detail ?? "That page doesn’t exist — the link may be out of date."}
      </p>
      <Link to="/items" className="mt-4 inline-block text-sm text-primary hover:underline">
        Back to the item codex
      </Link>
    </div>
  );
}
