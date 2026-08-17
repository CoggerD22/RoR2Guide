/**
 * Field-value claims in our prose (MATH-VERIFICATION §3j.169).
 *
 * A `descriptionNote` may cite the game's own serialized fields by name and attach a number:
 * "HelfireController carries ... dotDuration = 3", "maxTargets is 1", "tickRate 0.5". That
 * pairing is a factual claim about the game, and until §3j.169 nothing checked the number —
 * §3j.165 had verified only that the identifier exists.
 *
 * This module holds the ONE parser. `data:audit` uses it to compare each claim against the
 * extracted game data (local-only, since the extractions are git-ignored), and a unit test uses
 * it to hold the claims against a committed baseline so CI notices drift too. Two copies of
 * this logic that disagreed is exactly the §3j.167 defect, so there is deliberately only one.
 */

/** One `fieldName <number>` pair found in prose, with the component it was attributed to. */
export interface FieldClaim {
  /** The game field named, e.g. `dotDuration`. */
  field: string;
  /** The number the prose attaches to it. */
  stated: number;
  /** The most recently named component before it, if that component declares this field. */
  owner: string | null;
}

/**
 * Identifiers and numbers, in order.
 *
 * Deliberately no `\b` anywhere in this file. Escaping a word boundary into a regex built from
 * a template literal has now silently produced BACKSPACE five times in this project (§3j.116,
 * §3j.148, §3j.155, §3j.167) — and did it again while §3j.169 was being written, where the
 * check reported "0 of 0" and looked like a clean pass. Tokenising needs no escaping at all.
 */
const TOKEN = /[A-Za-z][A-Za-z0-9]*|-?[0-9]+(?:\.[0-9]+)?/g;

/** Words that may sit between a field name and its value without breaking the pairing. */
const GLUE = new Set(["is", "of", "at", "to", "carries", "was", "are", "s", "m", "x", "f", "and"]);

/**
 * A cited game field, as opposed to an English word.
 *
 * camelCase is the discriminator, and it is load-bearing rather than cosmetic: `stack`,
 * `damage` and `radius` are all real Unity field names AND ordinary prose, so accepting them
 * made "20.4% per stack" look like a claim that `stack` equals 20.4. An interior capital is
 * what actually separates the two. The cost is that genuinely lowercase fields are not checked;
 * that is a stated gap, not an oversight.
 */
export const looksLikeFieldName = (t: string): boolean =>
  t.length >= 5 && /[a-z]/.test(t[0]) && /[A-Z]/.test(t);

export interface ClaimVocabulary {
  /** Field names the game actually declares. */
  fields: ReadonlySet<string>;
  /** Component/owner names the game actually declares. */
  owners: ReadonlySet<string>;
  /** Which fields a given owner declares — used to attribute a claim to a component. */
  ownerDeclares?: (owner: string, field: string) => boolean;
}

/**
 * Extract every field-value claim from one note.
 *
 * Only the FIRST mention of a field is treated as a claim about its value. A later mention is
 * usually the field appearing inside a derived formula — "healthFractionPerSecond x dotDuration
 * = 15%" asserts nothing about `dotDuration`, and reading it as `dotDuration = 15` produced two
 * confident false positives before this rule existed.
 */
export function extractFieldClaims(note: string, vocab: ClaimVocabulary): FieldClaim[] {
  const toks = note.match(TOKEN) ?? [];
  const claims: FieldClaim[] = [];
  const claimed = new Set<string>();
  let lastOwner: string | null = null;

  for (let i = 0; i < toks.length; i++) {
    const name = toks[i];
    if (vocab.owners.has(name)) lastOwner = name;
    if (!looksLikeFieldName(name) || !vocab.fields.has(name) || claimed.has(name)) continue;

    let j = i + 1;
    while (j < toks.length && j <= i + 3 && GLUE.has(toks[j])) j++;
    if (j >= toks.length || !/[0-9]/.test(toks[j])) continue;

    const stated = Number(toks[j]);
    if (!Number.isFinite(stated)) continue;

    claimed.add(name);
    const owner =
      lastOwner && (vocab.ownerDeclares?.(lastOwner, name) ?? true) ? lastOwner : null;
    claims.push({ field: name, stated, owner });
  }
  return claims;
}
