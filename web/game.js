import { RULES, compareRules, summaryOf } from "../src/rules.js";
import { beginTurn, choose, createDay, drawDay, endTurn, isOver, nextChoice, runDay, stepDay } from "../src/simulate.js";
import { ask, stopWorkers } from "./workers.js";

/**
 * The shown day of the warehouse, played (app.js, split on 26/10/2026 for the tabs): under a rule at once, under the
 * search choice by choice, each choice asked of a worker (search-worker.js) and the board drawn between two; and the
 * rules compared on the same days. Functions of the page's context `{ state, render }`.
 */
export const COMPARED = 100;
export const COMPARED_WITH_SEARCH = 12;

export function stop({ state }) {
  clearInterval(state.timer);
  state.timer = null;
}

export function restart(ctx) {
  const { state } = ctx;
  stop(ctx);
  stopWorkers();
  Object.assign(state, { run: state.run + 1, busy: "", choices: [], thinking: false });
  state.day = createDay(state.setup, drawDay(state.seed, state.setup));
}

/** Each robot's choice of this turn asked of the worker, then the turn played; false when a newer run started meanwhile. */
async function searchTurn({ state, render }, run) {
  const day = state.day;
  if (day.cursor === null) beginTurn(day);
  for (let choice = nextChoice(day); choice; choice = nextChoice(day)) {
    state.busy = `La recherche réfléchit (tour ${day.t}, robot ${choice.robot.id})…`;
    render();
    const { id } = await ask(0, { kind: "choice", setup: state.setup, seed: state.seed, choices: state.choices });
    if (run !== state.run) return false;
    choose(day, choice, id);
    state.choices.push(id);
  }
  endTurn(day);
  state.busy = "";
  return true;
}

/** One turn of the shown day: under a rule at once; under the search, choice by choice. False when a newer run started meanwhile. */
async function playTurn(ctx, run) {
  const { state } = ctx;
  if (state.rule !== "search") {
    stepDay(state.day, RULES[state.rule]);
    return true;
  }
  state.thinking = true;
  try {
    return await searchTurn(ctx, run);
  } finally {
    state.thinking = false;
  }
}

export async function finish(ctx) {
  const { state, render } = ctx;
  stop(ctx);
  const run = ++state.run;
  if (state.rule !== "search") {
    while (!isOver(state.day)) stepDay(state.day, RULES[state.rule]);
  } else {
    while (!isOver(state.day)) {
      if (!(await playTurn(ctx, run))) return;
      render();
    }
  }
  state.busy = "";
  render();
}

export function play(ctx) {
  const { state, render } = ctx;
  stop(ctx);
  const run = state.run;
  state.timer = setInterval(async () => {
    if (state.thinking) return;
    if (isOver(state.day)) {
      stop(ctx);
      render();
      return;
    }
    if (await playTurn(ctx, run)) render();
  }, 1000 / state.speed);
}

/** One turn, by the button. */
export function step(ctx) {
  const { state, render } = ctx;
  stop(ctx);
  if (!isOver(state.day) && !state.thinking) playTurn(ctx, state.run).then((played) => played && render());
}

/** The rules on the same `COMPARED` days. */
export function compare({ state }) {
  state.run += 1;
  Object.assign(state, { compared: { days: COMPARED, rows: compareRules(state.setup, { days: COMPARED }) }, busy: "" });
}

/** The rules and the search on the same few days, the search's days in several workers at once. */
export async function compareWithSearch(ctx) {
  const { state, render } = ctx;
  stop(ctx);
  const run = ++state.run;
  const runs = { ...Object.fromEntries(Object.keys(RULES).map((name) => [name, []])), search: [] };
  for (let i = 0; i < COMPARED_WITH_SEARCH; i += 1) for (const [name, rule] of Object.entries(RULES)) runs[name].push(runDay(state.setup, state.seed + i, rule).measures);
  const pool = Math.max(1, Math.min(COMPARED_WITH_SEARCH, (navigator.hardwareConcurrency || 4) - 2));
  const found = [];
  let next = 0;
  let done = 0;
  state.busy = `Comparaison : la recherche joue ${COMPARED_WITH_SEARCH} journées, ${pool} à la fois…`;
  render();
  // Worker 0 answers the shown day's choices; the days go to workers 1 to pool.
  const worker = async (w) => {
    while (next < COMPARED_WITH_SEARCH) {
      const i = next++;
      const { measures } = await ask(w + 1, { kind: "day", setup: state.setup, seed: state.seed + i });
      if (run !== state.run) return;
      found[i] = measures;
      done += 1;
      state.busy = `Comparaison : ${done} journées de recherche sur ${COMPARED_WITH_SEARCH}`;
      render();
    }
  };
  await Promise.all(Array.from({ length: pool }, (_, w) => worker(w)));
  if (run !== state.run) return;
  runs.search = found;
  Object.assign(state, { compared: { days: COMPARED_WITH_SEARCH, rows: summaryOf(runs) }, busy: "" });
  render();
}
