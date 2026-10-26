import { advance, choose, createDay, drawDay } from "./simulate.js";

/**
 * Replays (Sami, 26/10/2026: the commit of 23/10 kept nothing, only the folder's line in .gitignore). A day is its
 * setup, its seed and the choices made, in order: the order each robot took (null when none). Played again from there,
 * choice by choice, it is the same day, move for move, whatever chose: a rule, the search or a person.
 */

export const REPLAY_FORMAT = "entrepot/1";

/** `rule`, whose every answer is written down in `choices` (the order's id, null when none). */
export const recording = (rule, choices) => (robot, open, context) => {
  const order = rule(robot, open, context);
  choices.push(order?.id ?? null);
  return order;
};

/** The day of `setup` and `seed`, played to after `choices`: the day, and the next choice (null once the day is over). */
export function replayDay(setup, seed, choices) {
  const day = createDay(setup, drawDay(seed, setup));
  let choice = advance(day);
  for (const id of choices) {
    if (!choice) break;
    choose(day, choice, id);
    choice = advance(day);
  }
  return { day, choice };
}

/** A replay to keep: what the day was, what chose, the choices, its measures, when. */
export function replayOf({ planId, setup, seed, rule, choices, measures }) {
  return { format: REPLAY_FORMAT, kind: "entrepot", planId, setup, seed, rule, choices: [...choices], measures, savedAt: new Date().toISOString() };
}
