import rawSurvivors from "./survivors.json";
import type { Survivor } from "./schema";

/** Survivor stat dataset (PLAN §2.3). Regen values are Rainstorm-standard. */
export const survivors = rawSurvivors as unknown as Survivor[];

export const survivorById = new Map<string, Survivor>(survivors.map((s) => [s.id, s]));
