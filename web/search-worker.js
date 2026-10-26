import { lineSearchRule } from "../src/line-search.js";
import { runLine } from "../src/line.js";
import { replayDay } from "../src/replay.js";
import { searchRule } from "../src/search.js";
import { runDay } from "../src/simulate.js";

/**
 * The search, off the page's thread (Sami, 23/10: the page froze while it thought, 2 to 8 s a turn at the start
 * of a day). A day's state holds functions and cannot be posted, so the worker rebuilds it: the day from its
 * setup and seed, then the choices already made (`replayDay`, the same sequence as `stepDay`), and searches the next one.
 * `{ job, kind: "choice", sim, setup, seed, choices }` → `{ job, id }`; `{ job, kind: "day", sim, setup, seed }` → the
 * measures of a whole day under the search, `{ job, measures }`. `sim`: "entrepot" (the default) or "ligne" (26/10/2026).
 */
const SIMS = {
  entrepot: { rule: searchRule, run: runDay },
  ligne: { rule: lineSearchRule, run: runLine },
};

self.onmessage = ({ data }) => {
  const { job, kind, setup, seed } = data;
  const name = data.sim ?? "entrepot";
  const sim = SIMS[name];
  if (kind === "day") {
    self.postMessage({ job, measures: sim.run(setup, seed, sim.rule()).measures });
    return;
  }
  const { day, choice } = replayDay(setup, seed, data.choices, name);
  const found = choice ? sim.rule()({ id: choice.robot.id, x: choice.robot.x, y: choice.robot.y }, choice.open, { t: day.t, reach: choice.reach, state: day }) : null;
  self.postMessage({ job, id: found?.id ?? null });
};
