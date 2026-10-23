import { searchRule } from "../src/search.js";
import { advance, choose, createDay, drawDay, runDay } from "../src/simulate.js";

/**
 * The search, off the page's thread (Sami, 23/10: the page froze while it thought, 2 to 8 s a turn at the start
 * of a day). A day's state holds functions and cannot be posted, so the worker rebuilds it: the day from its
 * setup and seed, then the choices already made (the same sequence as `stepDay`), and searches the next one.
 * `{ job, kind: "choice", setup, seed, choices }` → `{ job, id }`; `{ job, kind: "day", setup, seed }` → the
 * measures of a whole day under the search, `{ job, measures }`.
 */
self.onmessage = ({ data }) => {
  const { job, kind, setup, seed } = data;
  if (kind === "day") {
    self.postMessage({ job, measures: runDay(setup, seed, searchRule()).measures });
    return;
  }
  const day = createDay(setup, drawDay(seed, setup));
  let choice = advance(day);
  for (const id of data.choices) {
    choose(day, choice, id);
    choice = advance(day);
  }
  const found = choice ? searchRule()({ id: choice.robot.id, x: choice.robot.x, y: choice.robot.y }, choice.open, { t: day.t, reach: choice.reach, state: day }) : null;
  self.postMessage({ job, id: found?.id ?? null });
};
