import { recording, replayOf } from "../src/replay.js";
import { MODELS, driving } from "./models.js";
import { keepReplay } from "./replay-store.js";
import { ask, stopWorkers } from "./workers.js";

/**
 * A simulation's shown day, played (app.js, split on 26/10/2026 for the tabs; the warehouse and the assembly line
 * alike, models.js): under a rule at once, under the search choice by choice, each choice asked of a worker
 * (search-worker.js) and the board drawn between two; and the rules compared on the same days. Every choice is written
 * down (`sim.choices`): a day over is kept as a replay, and a replay opened (`sim.replay`) plays its own choices again.
 * Functions of `{ sim, render }`, `sim` the simulation's own state (models.js `simOf`).
 */
const modelOf = (sim) => MODELS[sim.kind];

export function stop({ sim }) {
  clearInterval(sim.timer);
  sim.timer = null;
}

export function restart(game) {
  const { sim } = game;
  stop(game);
  stopWorkers();
  Object.assign(sim, { run: sim.run + 1, busy: "", choices: [], known: [], thinking: false, kept: Boolean(sim.replay) });
  sim.day = modelOf(sim).start(sim.setup, sim.seed);
}

/** The day over, kept once (a replay played again is not kept a second time). */
function keepIfOver({ sim }) {
  const model = modelOf(sim);
  if (sim.kept || model.noReplay || !model.isOver(sim.day)) return;
  sim.kept = true;
  keepReplay(replayOf({ kind: sim.kind, planId: sim.planId, setup: sim.setup, seed: sim.seed, rule: sim.rule, choices: sim.choices, measures: model.measuresOf(sim.day), humanActions: sim.day.human?.actions ?? null }));
}

/** Each choice of this turn from `pick(choice)` (a replay's, or the worker's answer), then the turn played; false when a newer run started meanwhile. */
async function turnOf(game, run, pick) {
  const { sim } = game;
  const model = modelOf(sim);
  const day = sim.day;
  if (day.cursor === null) model.beginTurn(day);
  for (let choice = model.nextChoice(day); choice; choice = model.nextChoice(day)) {
    const id = await pick(choice);
    if (run !== sim.run) return false;
    model.choose(day, choice, id);
    sim.choices.push(id);
  }
  model.endTurn(day);
  sim.busy = "";
  return true;
}

/** The worker's answer for `choice`, while the page says where the search is. */
async function searched(game, choice) {
  const { sim, render } = game;
  sim.busy = `La recherche réfléchit (tour ${sim.day.t}, robot ${choice.robot.id})…`;
  render();
  // The driver's actions so far go with the day, for the worker to make it again (line-human.js).
  const setup = sim.day.human ? { ...sim.setup, humanScript: sim.day.human.actions } : sim.setup;
  const { id } = await ask(0, { kind: "choice", sim: sim.kind, setup, seed: sim.seed, choices: sim.choices });
  return id;
}

/** One turn of the shown day: a replay's own choices, a rule at once, or the search choice by choice. False when a newer run started meanwhile. */
async function playTurn(game, run) {
  const { sim } = game;
  const model = modelOf(sim);
  let played = true;
  if (sim.replay) played = await turnOf(game, run, () => sim.replay.choices[sim.choices.length] ?? null);
  else if (sim.rule !== "search") model.stepDay(sim.day, recording(model.rules[sim.rule], sim.choices));
  // The search's choices already made, before the day was taken back (`seek`): played again, not searched again.
  else if (sim.choices.length < sim.known.length) played = await turnOf(game, run, () => sim.known[sim.choices.length]);
  else {
    sim.thinking = true;
    try {
      played = await turnOf(game, run, (choice) => searched(game, choice));
    } finally {
      sim.thinking = false;
    }
  }
  if (played) keepIfOver(game);
  return played;
}

export async function finish(game) {
  const { sim, render } = game;
  const model = modelOf(sim);
  stop(game);
  const run = ++sim.run;
  const quick = sim.replay || sim.rule !== "search";
  while (!model.isOver(sim.day)) {
    if (!(await playTurn(game, run))) return;
    if (!quick) render();
  }
  sim.busy = "";
  render();
}

export function play(game) {
  const { sim, render } = game;
  stop(game);
  const run = sim.run;
  sim.timer = setInterval(async () => {
    if (sim.thinking) return;
    if (modelOf(sim).isOver(sim.day)) {
      stop(game);
      render();
      return;
    }
    if (await playTurn(game, run)) render();
  }, 1000 / sim.speed);
}

/** The shown day from its start again, the search's choices kept to play again. */
function takeBack(sim) {
  stopWorkers();
  if (sim.choices.length > sim.known.length) sim.known = [...sim.choices];
  Object.assign(sim, { choices: [], thinking: false, busy: "", day: modelOf(sim).start(sim.setup, sim.seed) });
}

/** The shown day played to turn `target` (or its end); false when a newer run started meanwhile. */
async function playTo(game, run, target) {
  const { sim } = game;
  while (run === sim.run && sim.day.t < target && !modelOf(sim).isOver(sim.day)) if (!(await playTurn(game, run))) return false;
  return run === sim.run;
}

/**
 * Turn `target` of the shown day (the players' keys, replay-keys.js). Back, the day is made again from its seed and
 * played to there: a rule plays the same again, the search and a replay their choices already made. On, the turns are
 * played as by « Un tour », the search asked only past the choices known. The play goes on if it was on. Not in an
 * hour with the driver at the keys: its moves are the keys'.
 */
export async function seek(game, target) {
  const { sim, render } = game;
  if (driving(sim)) return;
  const playing = sim.timer !== null;
  stop(game);
  const run = ++sim.run;
  if (target < sim.day.t) takeBack(sim);
  if (!(await playTo(game, run, target))) return;
  sim.busy = "";
  render();
  if (playing) play(game);
}

/** One turn, by the button. */
export function step(game) {
  const { sim, render } = game;
  stop(game);
  if (!modelOf(sim).isOver(sim.day) && !sim.thinking) playTurn(game, sim.run).then((played) => played && render());
}

/** Each rule's measures on `days` days from the shown one. */
function rulesOn(sim, days) {
  const model = modelOf(sim);
  const runs = Object.fromEntries(Object.keys(model.rules).map((name) => [name, []]));
  for (let i = 0; i < days; i += 1) for (const [name, rule] of Object.entries(model.rules)) runs[name].push(model.runDay(sim.setup, sim.seed + i, rule).measures);
  return runs;
}

/** The rules on the same days (each day kept, for the stats). */
export function compare({ sim }) {
  sim.run += 1;
  const days = modelOf(sim).compared.rules;
  const runs = rulesOn(sim, days);
  Object.assign(sim, { compared: { days, rows: modelOf(sim).summaryOf(runs), runs, seed: sim.seed, planId: sim.planId }, busy: "" });
}

/** The rules and the search on the same few days, the search's days in several workers at once. */
export async function compareWithSearch(game) {
  const { sim, render } = game;
  stop(game);
  const run = ++sim.run;
  const days = modelOf(sim).compared.search;
  const runs = { ...rulesOn(sim, days), search: [] };
  const pool = Math.max(1, Math.min(days, (navigator.hardwareConcurrency || 4) - 2));
  const found = [];
  let next = 0;
  let done = 0;
  sim.busy = `Comparaison : la recherche joue ${days} journées, ${pool} à la fois…`;
  render();
  // Worker 0 answers the shown day's choices; the days go to workers 1 to pool.
  const worker = async (w) => {
    while (next < days) {
      const i = next++;
      const { measures } = await ask(w + 1, { kind: "day", sim: sim.kind, setup: sim.setup, seed: sim.seed + i });
      if (run !== sim.run) return;
      found[i] = measures;
      done += 1;
      sim.busy = `Comparaison : ${done} journées de recherche sur ${days}`;
      render();
    }
  };
  await Promise.all(Array.from({ length: pool }, (_, w) => worker(w)));
  if (run !== sim.run) return;
  runs.search = found;
  Object.assign(sim, { compared: { days: days, rows: modelOf(sim).summaryOf(runs), runs, seed: sim.seed, planId: sim.planId }, busy: "" });
  render();
}
