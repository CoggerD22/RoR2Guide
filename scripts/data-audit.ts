/**
 * pnpm data:audit — schema + integrity checks over /src/data (PLAN §5.5).
 *
 * FATAL (exit 1) — CI must block these:
 *   - items.json fails the Zod schema (CLAUDE.md rule #1/#3)
 *   - duplicate item ids
 *   - dangling or non-bidirectional void corruption pairs (rule #4)
 *
 * WARNINGS (exit 0) — reported but expected mid-milestone:
 *   - items with "verified": false (rule #1 — intermediate state)
 *   - missing icon files under /public/icons
 *
 * If items.json is absent (pre-data), the audit passes with a note.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { itemsFileSchema, type Item } from "../src/data/schema.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const itemsPath = resolve(root, "src/data/items.json");

const errors: string[] = [];
const warnings: string[] = [];

function main(): number {
  if (!existsSync(itemsPath)) {
    console.log(
      "data:audit — no dataset yet (src/data/items.json absent). Nothing to validate; passing.",
    );
    return 0;
  }

  // --- Parse + schema validation ------------------------------------------
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(itemsPath, "utf8"));
  } catch (e) {
    console.error(`data:audit — items.json is not valid JSON: ${(e as Error).message}`);
    return 1;
  }

  const parsed = itemsFileSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("data:audit — schema validation failed:\n");
    for (const issue of parsed.error.issues) {
      const path = issue.path.length ? issue.path.join(".") : "(root)";
      console.error(`  ✗ ${path}: ${issue.message}`);
    }
    return 1;
  }
  const items = parsed.data;
  const byId = new Map<string, Item>();

  // --- Duplicate ids -------------------------------------------------------
  for (const it of items) {
    if (byId.has(it.id)) {
      errors.push(`duplicate id "${it.id}"`);
    } else {
      byId.set(it.id, it);
    }
  }

  // --- Corruption pairs: bidirectional + non-dangling (rule #4) ------------
  for (const it of items) {
    if (it.corrupts) {
      for (const target of it.corrupts) {
        const other = byId.get(target);
        if (!other) {
          errors.push(`"${it.id}" corrupts "${target}", which does not exist`);
        } else if (other.corruptedBy !== it.id) {
          errors.push(
            `"${it.id}" corrupts "${target}", but "${target}".corruptedBy is ` +
              `${other.corruptedBy ? `"${other.corruptedBy}"` : "unset"} (expected "${it.id}")`,
          );
        }
      }
    }
    if (it.corruptedBy) {
      const voidItem = byId.get(it.corruptedBy);
      if (!voidItem) {
        errors.push(`"${it.id}".corruptedBy points to "${it.corruptedBy}", which does not exist`);
      } else if (!voidItem.corrupts?.includes(it.id)) {
        errors.push(
          `"${it.id}".corruptedBy is "${it.corruptedBy}", but that item does not list "${it.id}" in corrupts`,
        );
      }
    }
  }

  // --- Warnings: unverified items + missing icons -------------------------
  for (const it of items) {
    if (!it.verified) warnings.push(`unverified: "${it.id}" (${it.name})`);
    const iconPath = resolve(root, "public" + it.icon); // it.icon "/icons/x.png" → public/icons/x.png
    if (!existsSync(iconPath)) warnings.push(`missing icon: ${it.icon} for "${it.id}"`);
  }

  // --- Report --------------------------------------------------------------
  console.log(`data:audit — ${items.length} item(s) checked.`);
  if (warnings.length) {
    console.log(`\n${warnings.length} warning(s):`);
    for (const w of warnings) console.log(`  ⚠ ${w}`);
  }
  if (errors.length) {
    console.error(`\n${errors.length} error(s):`);
    for (const e of errors) console.error(`  ✗ ${e}`);
    return 1;
  }
  console.log(warnings.length ? "\nNo fatal errors." : "All checks passed.");
  return 0;
}

process.exit(main());
