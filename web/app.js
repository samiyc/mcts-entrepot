import { MODELS, simOf } from "./models.js";
import { compare, compareWithSearch, finish, play, restart, step, stop } from "./game.js";
import { readPlan } from "./panels.js";
import { comparaisonsPanel, comparaisonsView } from "./tabs/comparaisons.js";
import { entrepotPanel, entrepotView } from "./tabs/entrepot.js";
import { lignePanel, ligneView } from "./tabs/ligne.js";
import { replaysClick, replaysPanel, replaysView } from "./tabs/replays.js";
import { statsPanel, statsView } from "./tabs/stats.js";

/**
 * The page, in tabs (Sami, 26/10/2026, the layout of lopin and mcts-urgences): a tab per simulation (the warehouse, the
 * assembly line), the comparisons, the replays, the stats; the settings of the tab open in the panel on the left, which
 * folds. Each simulation keeps its own state (`state.sims`, models.js); the tabs are in tabs/, the playing in game.js,
 * the drawing in board.js, line-board.js and their views. This module only keeps the page's state and listens (event
 * delegation on the layout).
 */
const TAB_NAMES = ["entrepot", "ligne", "comparaisons", "replays", "stats"];
const STORE = "entrepot-onglet";
const FOLDED = "entrepot-replie";
const read = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage refused: the choice is only not remembered.
  }
};
const firstTab = () => [location.hash.slice(1), read(STORE)].find((name) => TAB_NAMES.includes(name)) ?? "entrepot";

const state = { tab: firstTab(), sims: { entrepot: simOf("entrepot", "sami"), ligne: simOf("ligne", "sami") }, compareKind: "entrepot", gains: null, serverReplays: undefined };
const layout = document.getElementById("layout");
const sidebar = document.getElementById("sidebar");
const app = document.getElementById("app");
const ctx = { state, render: () => render(), openReplay: (replay) => openReplay(replay) };
const TABS = { entrepot: [entrepotPanel, entrepotView], ligne: [lignePanel, ligneView], comparaisons: [comparaisonsPanel, comparaisonsView], replays: [replaysPanel, replaysView], stats: [statsPanel, statsView] };
/** The game of simulation `kind`: its own state, and the page's render. */
const gameOf = (kind) => ({ sim: state.sims[kind], render });

function render() {
  for (const button of document.querySelectorAll(".tabs [role=tab]")) button.setAttribute("aria-selected", String(/** @type {HTMLElement} */ (button).dataset.tab === state.tab));
  const [panel, view] = TABS[state.tab];
  sidebar.replaceChildren(...[panel(ctx)].flat());
  app.replaceChildren(...view(ctx));
}

function openTab(name) {
  state.tab = name;
  history.replaceState(null, "", `#${name}`);
  write(STORE, name);
  render();
}

/** A kept day (or hour of the line), opened again in its tab: its plan, its day, its rule, its own choices. */
function openReplay(replay) {
  const kind = replay.kind ?? "entrepot";
  Object.assign(state.sims[kind], { replay, planId: replay.planId, setup: replay.setup, seed: replay.seed, rule: replay.rule, compared: null, error: "" });
  restart(gameOf(kind));
  openTab(kind);
}

/** The warehouse's plan, edited in its panel. */
function applyPlan(form) {
  const sim = state.sims.entrepot;
  const setup = readPlan(form, sim.setup);
  try {
    MODELS.entrepot.start(setup, 1);
    Object.assign(sim, { setup, error: "", compared: null, replay: null });
    restart(gameOf("entrepot"));
  } catch (error) {
    sim.error = `Plan refusé : ${error.message}`;
  }
}

const ACTIONS = {
  play: (game) => play(game),
  pause: (game) => stop(game),
  step: (game) => step(game),
  finish: (game) => finish(game),
  restart: (game) => restart(game),
  next: (game) => {
    Object.assign(game.sim, { seed: game.sim.seed + 1, replay: null, setup: live(game.sim.setup) });
    restart(game);
  },
  leaveReplay: (game) => {
    Object.assign(game.sim, { replay: null, setup: live(game.sim.setup) });
    restart(game);
  },
  compare: (game) => compare(game),
  compareSearch: (game) => compareWithSearch(game),
};

/** A setup without a replay's driver script: the driver plays from the keys again. */
const live = ({ humanScript: _script, ...setup }) => setup;

/** A setting of simulation `sim` changed: a plan, a day, a speed, a rule, the driver at the keys. */
function setKnob(sim, name, value) {
  if (name !== "speed") Object.assign(sim, { replay: null, setup: live(sim.setup) });
  if (name === "human") return Object.assign(sim, { setup: { ...sim.setup, human: value } });
  if (name === "plan") Object.assign(sim, { planId: value, setup: { ...MODELS[sim.kind].plans[value] }, compared: null, error: "" });
  else if (name === "seed") sim.seed = Math.max(1, Number(value) || 1);
  else if (name === "speed") sim.speed = Number(value);
  else sim[name] = value;
}

layout.addEventListener("change", (event) => {
  const knob = /** @type {HTMLInputElement} */ (event.target);
  const name = knob.dataset?.knob;
  if (name === "compareKind") state.compareKind = knob.value;
  else if (name) {
    const game = gameOf(knob.dataset.sim);
    setKnob(game.sim, name, knob.type === "checkbox" ? knob.checked : knob.value);
    if (name === "speed" && game.sim.timer) play(game);
    else restart(game);
  }
  render();
});
layout.addEventListener("click", (event) => {
  if (replaysClick(ctx, /** @type {HTMLElement} */ (event.target))) return;
  const button = /** @type {HTMLElement} */ (event.target).closest?.("[data-action]");
  const action = button?.getAttribute("data-action");
  if (!ACTIONS[action]) return;
  ACTIONS[action](gameOf(button.getAttribute("data-sim") ?? "entrepot"));
  render();
});
layout.addEventListener("submit", (event) => {
  event.preventDefault();
  applyPlan(/** @type {HTMLFormElement} */ (event.target));
  render();
});
document.querySelector(".tabs").addEventListener("click", (event) => {
  const name = /** @type {HTMLElement} */ (event.target).closest?.("[data-tab]")?.getAttribute("data-tab");
  if (name) openTab(name);
});
// A tab named in the address (a link, the back button) opens.
window.addEventListener("hashchange", () => TAB_NAMES.includes(location.hash.slice(1)) && location.hash.slice(1) !== state.tab && openTab(location.hash.slice(1)));
const fold = document.getElementById("fold");
const setFolded = (folded) => {
  layout.classList.toggle("folded", folded);
  fold.setAttribute("aria-expanded", String(!folded));
  fold.textContent = folded ? "»" : "«";
  write(FOLDED, folded ? "1" : "0");
};
fold.addEventListener("click", () => setFolded(!layout.classList.contains("folded")));
setFolded(read(FOLDED) === "1");
// The night measures, for the stats tab (served with the page).
fetch("../docs/changelog.json")
  .then((response) => (response.ok ? response.json() : null))
  .then((gains) => {
    state.gains = gains;
    if (state.tab === "stats") render();
  })
  .catch(() => {});
// The driver's keys, in the line's tab (step 3); a key in a form field is the field's. Out of play, a key plays a turn.
const KEYS = { z: "up", s: "down", q: "left", d: "right", arrowup: "up", arrowdown: "down", arrowleft: "left", arrowright: "right", e: "act" };
/** The driver's action of a key, or null: not in the line's tab, no driver at the keys, a replay, a form field's key. */
function driverAction(event) {
  const sim = state.sims.ligne;
  const field = /** @type {HTMLElement} */ (event.target).closest?.("input, textarea, select");
  const playing = state.tab === "ligne" && sim.day?.human && !sim.replay && !field;
  return playing ? (KEYS[event.key.toLowerCase()] ?? null) : null;
}
document.addEventListener("keydown", (event) => {
  const sim = state.sims.ligne;
  const action = driverAction(event);
  if (!action) return;
  event.preventDefault();
  sim.day.human.next = action;
  if (sim.timer === null) step(gameOf("ligne"));
});
for (const kind of Object.keys(state.sims)) restart(gameOf(kind));
render();
