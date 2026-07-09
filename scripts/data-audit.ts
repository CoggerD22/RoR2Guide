/**
 * pnpm data:audit — schema + integrity checks over /src/data.
 *
 * M0 STUB. There is no dataset yet (schema-first work begins in M1, PLAN §5).
 * When src/data/items.json lands, this grows into the real audit:
 *   - Zod schema validation of every item/survivor
 *   - report of items with "verified": false
 *   - missing icon files (/public/icons/<id>.png)
 *   - dangling / non-bidirectional void corruption pairs (CLAUDE.md rule #4)
 *
 * Exit non-zero on any failure so CI blocks bad data. For now it is a no-op
 * that reports the dataset is absent and succeeds.
 */
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, "../src/data");
const itemsPath = resolve(dataDir, "items.json");

function main(): number {
  if (!existsSync(itemsPath)) {
    console.log(
      "data:audit — no dataset yet (src/data/items.json absent). " +
        "Schema + integrity checks are implemented in M1. Nothing to validate; passing.",
    );
    return 0;
  }

  console.log(
    "data:audit — dataset detected but audit logic is not implemented yet (M1). " +
      "Add Zod validation, verified-flag reporting, icon checks, and corruption-pair " +
      "validation here before relying on this in CI.",
  );
  return 0;
}

process.exit(main());
