import { advance as advanceLine, choose as chooseLine, startLine } from "./line.js";
import { advance, choose, createDay, drawDay } from "./simulate.js";

/**
 * Replays (Sami, 26/10/2026: the commit of 23/10 kept nothing, only the folder's line in .gitignore). A day is its
 * setup, its seed and the choices made, in order: the order (or the bin) each robot took, null when none. Played
 * again from there, choice by choice, it is the same day, move for move, whatever chose: a rule, the search or a
 * person. The warehouse and the assembly line alike (`kind`).
 */

/** The format of a replay, by kind: its first word names the file the page server writes ("ligne_…json"). */
export const formatOf = (kind) => `${kind}/1`;

/** What a replay plays, by kind: the day drawn and made, and its choices. */
const MODELS = {
  entrepot: { start: (setup, seed) => createDay(setup, drawDay(seed, setup)), advance, choose },
  ligne: { start: startLine, advance: advanceLine, choose: chooseLine },
};

/** `rule`, whose every answer is written down in `choices` (the id, null when none). */
export const recording = (rule, choices) => (robot, open, context) => {
  const order = rule(robot, open, context);
  choices.push(order?.id ?? null);
  return order;
};

/** The day of `setup` and `seed`, played to after `choices`: the day, and the next choice (null once the day is over). */
export function replayDay(setup, seed, choices, kind = "entrepot") {
  const model = MODELS[kind];
  const day = model.start(setup, seed);
  let choice = model.advance(day);
  for (const id of choices) {
    if (!choice) break;
    model.choose(day, choice, id);
    choice = model.advance(day);
  }
  return { day, choice };
}

/** A replay to keep: what the day was, what chose, the choices, the driver's actions (written into its setup), its measures, when. */
export function replayOf({ kind = "entrepot", planId, setup, seed, rule, choices, measures, humanActions = null }) {
  const kept = humanActions ? { ...setup, humanScript: [...humanActions] } : setup;
  return { format: formatOf(kind), kind, planId, setup: kept, seed, rule, choices: [...choices], measures, savedAt: new Date().toISOString() };
}
