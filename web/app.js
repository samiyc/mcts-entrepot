import { PLANS } from "../src/plans.js";
import { RULES, compareRules, summaryOf } from "../src/rules.js";
import { beginTurn, choose, createDay, drawDay, endTurn, isOver, measuresOf, nextChoice, runDay, stepDay } from "../src/simulate.js";
import { board } from "./board.js";
import { el } from "./dom.js";
import { COMPARED, COMPARED_WITH_SEARCH, comparison, controls, editor, orders, readPlan } from "./panels.js";
import { statusLine } from "./view.js";
import { ask, stopWorkers } from "./workers.js";

/**
 * The page: a day in the chosen warehouse under the chosen rule, played turn by turn (or all at once), then
 * the rules on the same 100 days. The plan can be edited (text, robots, orders, blockage): a new warehouse is
 * a new text. The search (src/search.js) thinks for a while at each choice (seconds at a day's start): it runs in
 * workers (search-worker.js), the page asking for each choice and drawing between two, and is compared on fewer
 * days, several at once. What it shows is computed in view.js, and drawn by board.js and panels.js; this module
 * keeps the page's state and listens.
 */
const app = document.getElementById("app");
const state = { planId: "sami", setup: { ...PLANS.sami }, rule: "search", seed: 1, speed: 4, day: null, choices: [], thinking: false, timer: null, compared: null, error: "", busy: "", run: 0 };

/**
 * One turn of the shown day: under a rule at once; under the search, each robot's choice asked of the worker,
 * then the turn played. False when a newer run started meanwhile.
 */
async function playTurn(run) {
  const day = state.day;
  if (state.rule !== "search") {
    stepDay(day, RULES[state.rule]);
    return true;
  }
  state.thinking = true;
  try {
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
  } finally {
    state.thinking = false;
  }
}

function restart() {
  stop();
  stopWorkers();
  Object.assign(state, { run: state.run + 1, busy: "", choices: [], thinking: false });
  state.day = createDay(state.setup, drawDay(state.seed, state.setup));
}

async function finish() {
  stop();
  const run = ++state.run;
  if (state.rule !== "search") {
    while (!isOver(state.day)) stepDay(state.day, RULES[state.rule]);
  } else {
    while (!isOver(state.day)) {
      if (!(await playTurn(run))) return;
      render();
    }
  }
  state.busy = "";
  render();
}

/** The rules and the search on the same few days, the search's days in several workers at once. */
async function compareWithSearch() {
  stop();
  const run = ++state.run;
  const runs = { ...Object.fromEntries(Object.keys(RULES).map((name) => [name, []])), search: [] };
  for (let i = 0; i < COMPARED_WITH_SEARCH; i += 1) for (const [name, rule] of Object.entries(RULES)) runs[name].push(runDay(state.setup, state.seed + i, rule).measures);
  const pool = Math.max(1, Math.min(COMPARED_WITH_SEARCH, (navigator.hardwareConcurrency || 4) - 2));
  let next = 0;
  let done = 0;
  const found = [];
  state.busy = `Comparaison : la recherche joue ${COMPARED_WITH_SEARCH} journées, ${pool} à la fois…`;
  render();
  // Worker 0 answers the shown day's choices; the days go to workers 1 to pool.
  await Promise.all(
    Array.from({ length: pool }, async (_, w) => {
      while (next < COMPARED_WITH_SEARCH) {
        const i = next++;
        const { measures } = await ask(w + 1, { kind: "day", setup: state.setup, seed: state.seed + i });
        if (run !== state.run) return;
        found[i] = measures;
        done += 1;
        state.busy = `Comparaison : ${done} journées de recherche sur ${COMPARED_WITH_SEARCH}`;
        render();
      }
    }),
  );
  if (run !== state.run) return;
  runs.search = found;
  Object.assign(state, { compared: { days: COMPARED_WITH_SEARCH, rows: summaryOf(runs) }, busy: "" });
  render();
}
function stop() {
  clearInterval(state.timer);
  state.timer = null;
}
function play() {
  stop();
  const run = state.run;
  state.timer = setInterval(async () => {
    if (state.thinking) return;
    if (isOver(state.day)) {
      stop();
      render();
      return;
    }
    if (await playTurn(run)) render();
  }, 1000 / state.speed);
}

function render() {
  const over = isOver(state.day);
  const summary = el("p", { class: "summary", "aria-live": "polite" }, state.busy || statusLine(state.day, over ? measuresOf(state.day) : null));
  const layout = el("div", { class: "layout" }, el("div", { class: "board-wrap" }, board(state.day)), el("aside", {}, el("h2", {}, "Les commandes"), orders(state.day)));
  app.replaceChildren(controls(state), summary, layout, ...comparison(state), editor(state));
}

function applyPlan(form) {
  const setup = readPlan(form, state.setup);
  try {
    createDay(setup, { blockages: [] });
    Object.assign(state, { setup, error: "", compared: null });
    restart();
  } catch (error) {
    state.error = `Plan refusé : ${error.message}`;
  }
}

const ACTIONS = {
  play,
  pause: stop,
  step: () => {
    stop();
    if (!isOver(state.day) && !state.thinking) playTurn(state.run).then((played) => played && render());
  },
  finish,
  restart,
  next: () => {
    state.seed += 1;
    restart();
  },
  compare: () => {
    state.run += 1;
    Object.assign(state, { compared: { days: COMPARED, rows: compareRules(state.setup, { days: COMPARED }) }, busy: "" });
  },
  compareSearch: compareWithSearch,
};

/** A setting changed: a plan, a day, a speed, a rule. */
function setKnob(name, value) {
  if (name === "plan") Object.assign(state, { planId: value, setup: { ...PLANS[value] }, compared: null, error: "" });
  else if (name === "seed") state.seed = Math.max(1, Number(value) || 1);
  else if (name === "speed") state.speed = Number(value);
  else state[name] = value;
}

app.addEventListener("change", (event) => {
  const knob = /** @type {HTMLInputElement} */ (event.target);
  const name = knob.dataset?.knob;
  if (!name) return;
  setKnob(name, knob.value);
  if (name === "speed" && state.timer) play();
  else restart();
  render();
});
app.addEventListener("click", (event) => {
  const action = /** @type {HTMLElement} */ (event.target).closest?.("[data-action]")?.getAttribute("data-action");
  if (!ACTIONS[action]) return;
  ACTIONS[action]();
  render();
});
app.addEventListener("submit", (event) => {
  event.preventDefault();
  applyPlan(/** @type {HTMLFormElement} */ (event.target));
  render();
});
restart();
render();
