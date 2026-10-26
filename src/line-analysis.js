import { LINE_RULES } from "./line-rules.js";
import { measuresOfLine, runLine } from "./line.js";
import { replayDay } from "./replay.js";

/**
 * The analysis of an hour played with the driver (Sami, 26/10/2026; docs/recherche/feuille-de-route.md, step 3, as the
 * replay of a whole shift in mcts-urgences): the hour as it was, played again from its replay, against the same hour
 * without the driver, the robots under the same rule (the shortest cover when the search chose: an hour of the search
 * is too long for the page). The stops minute by minute, in slices, and what the driver did.
 */
const SLICE = 60;

/** The turns of `stoppedAt` counted by slices of `SLICE` turns, up to `horizon`. */
export function slicesOf(stoppedAt, horizon) {
  const slices = Array.from({ length: Math.ceil(horizon / SLICE) }, () => 0);
  for (const t of stoppedAt) slices[Math.min(slices.length - 1, Math.floor((t - 1) / SLICE))] += 1;
  return slices;
}

/** The analysis of `replay` (an hour of the line kept with its driver's actions), or null for another kind. */
export function analyse(replay) {
  if (replay.kind !== "ligne" || !replay.setup.humanScript) return null;
  const { day } = replayDay(replay.setup, replay.seed, replay.choices, "ligne");
  const alone = { ...replay.setup, human: false, humanScript: null };
  const ruleName = LINE_RULES[replay.rule] ? replay.rule : "cover";
  const { state: without } = runLine(alone, replay.seed, LINE_RULES[ruleName]);
  const horizon = replay.setup.horizon;
  const withSlices = slicesOf(day.stoppedAt, horizon);
  const withoutSlices = slicesOf(without.stoppedAt, horizon);
  return {
    seed: replay.seed,
    rule: ruleName,
    sliceMinutes: (SLICE * replay.setup.turnSeconds) / 60,
    slices: withSlices.map((stops, i) => ({ from: i * SLICE, with: stops, without: withoutSlices[i] })),
    with: measuresOfLine(day),
    without: measuresOfLine(without),
    actions: countActions(day.human.actions),
  };
}

/** The driver's actions, counted: the steps, the takes and drops tried, the turns waited. */
function countActions(actions) {
  const counts = { steps: 0, act: 0, wait: 0 };
  for (const action of actions) counts[action === "act" || action === "wait" ? action : "steps"] += 1;
  return counts;
}
