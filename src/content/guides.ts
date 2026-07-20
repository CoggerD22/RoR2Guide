import { z } from "zod";
import { marked } from "marked";
import { CONTENT_VERSION } from "@/data/gameVersion";

/**
 * The OPINION layer (CLAUDE.md rule #7 / PLAN §4.2).
 *
 * Guides are the one place subjective content is allowed — build advice, item
 * priorities, tier takes. They are always badged "Opinion", always stamped with
 * author + date + game patch, and never leak into the JSON datasets. When the
 * dataset's content version moves past a guide's stamp, the guide visibly ages.
 *
 * Files live in /content/guides/*.md. Anything prefixed with "_" is treated as a
 * template/draft and is NOT published.
 */
export const guideFrontmatterSchema = z
  .object({
    title: z.string().min(1),
    /** Who is responsible for this opinion. Required — opinions are never anonymous. */
    author: z.string().min(1),
    /** ISO date the opinion was written. */
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
    /** Game content version it was written for, e.g. "Alloyed Collective". */
    patch: z.string().min(1),
    /** One-line summary for the index. */
    summary: z.string().min(1),
  })
  .strict();
export type GuideFrontmatter = z.infer<typeof guideFrontmatterSchema>;

export interface Guide extends GuideFrontmatter {
  slug: string;
  /** Rendered HTML body (content is repo-authored and trusted). */
  html: string;
  /** True when the guide's patch stamp no longer matches the current dataset. */
  stale: boolean;
}

/** Minimal YAML-subset frontmatter parser — key: value pairs only, no nesting. */
export function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!m) return { data: {}, body: raw };
  const data: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z][A-Za-z0-9_]*):\s*(.*)$/.exec(line.trim());
    if (!kv) continue;
    data[kv[1]] = kv[2].replace(/^["'](.*)["']$/, "$1").trim();
  }
  return { data, body: m[2] };
}

const files = import.meta.glob("/content/guides/*.md", { query: "?raw", import: "default", eager: true }) as Record<
  string,
  string
>;

/**
 * Turn raw file contents into published Guides. Exported (and pure) so the
 * parsing / filtering / staleness rules are unit-testable without the glob.
 */
export function buildGuides(
  entries: Record<string, string>,
  currentVersion: string = CONTENT_VERSION,
  onError?: (slug: string, issues: unknown) => void,
): Guide[] {
  const out: Guide[] = [];
  for (const [path, raw] of Object.entries(entries)) {
    const slug = path.split("/").pop()!.replace(/\.md$/, "");
    if (slug.startsWith("_")) continue; // templates/drafts are not published
    const { data, body } = parseFrontmatter(raw);
    const parsed = guideFrontmatterSchema.safeParse(data);
    if (!parsed.success) {
      onError?.(slug, parsed.error.issues);
      continue;
    }
    out.push({
      ...parsed.data,
      slug,
      html: marked.parse(body, { async: false }) as string,
      stale: parsed.data.patch !== currentVersion,
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

export const guides: Guide[] = buildGuides(files, CONTENT_VERSION, (slug, issues) => {
  // A malformed guide is a content bug — surface it loudly in dev, skip in prod.
  if (import.meta.env.DEV) console.error(`Guide "${slug}" has invalid frontmatter:`, issues);
});
export const guideBySlug = new Map<string, Guide>(guides.map((g) => [g.slug, g]));
