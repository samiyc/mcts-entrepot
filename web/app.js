import { PLANS } from "../src/plans.js";
import { createDay } from "../src/simulate.js";
import { compare, compareWithSearch, finish, play, restart, step, stop } from "./game.js";
import { readPlan } from "./panels.js";
import { comparaisonsPanel, comparaisonsView } from "./tabs/comparaisons.js";
import { entrepotPanel, entrepotView } from "./tabs/entrepot.js";

/**
 * The page, in tabs (Sami, 26/10/2026, the layout of lopin and mcts-urgences): a tab per simulation, and the
 * comparisons; the settings of the tab open in the panel on the left, which folds. The settings shared by the tabs live
 * in `state`; the tabs are in tabs/, the playing in game.js, the drawing in board.js and view.js. This module only
 * keeps the page's state and listens (event delegation on the layout).
 */
const TAB_NAMES = ["entrepot", "comparaisons"];
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

const state = { tab: firstTab(), planId: "sami", setup: { ...PLANS.sami }, rule: "search", seed: 1, speed: 4, day: null, choices: [], thinking: false, timer: null, compared: null, error: "", busy: "", run: 0 };
const layout = document.getElementById("layout");
const sidebar = document.getElementById("sidebar");
const app = document.getElementById("app");
const ctx = { state, render: () => render() };
const TABS = { entrepot: [entrepotPanel, entrepotView], comparaisons: [comparaisonsPanel, comparaisonsView] };

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

function applyPlan(form) {
  const setup = readPlan(form, state.setup);
  try {
    createDay(setup, { blockages: [] });
    Object.assign(state, { setup, error: "", compared: null });
    restart(ctx);
  } catch (error) {
    state.error = `Plan refusé : ${error.message}`;
  }
}

const ACTIONS = {
  play: () => play(ctx),
  pause: () => stop(ctx),
  step: () => step(ctx),
  finish: () => finish(ctx),
  restart: () => restart(ctx),
  next: () => {
    state.seed += 1;
    restart(ctx);
  },
  compare: () => compare(ctx),
  compareSearch: () => compareWithSearch(ctx),
};

/** A setting changed: a plan, a day, a speed, a rule. */
function setKnob(name, value) {
  if (name === "plan") Object.assign(state, { planId: value, setup: { ...PLANS[value] }, compared: null, error: "" });
  else if (name === "seed") state.seed = Math.max(1, Number(value) || 1);
  else if (name === "speed") state.speed = Number(value);
  else state[name] = value;
}

layout.addEventListener("change", (event) => {
  const knob = /** @type {HTMLInputElement} */ (event.target);
  const name = knob.dataset?.knob;
  if (!name) return;
  setKnob(name, knob.value);
  if (name === "speed" && state.timer) play(ctx);
  else restart(ctx);
  render();
});
layout.addEventListener("click", (event) => {
  const action = /** @type {HTMLElement} */ (event.target).closest?.("[data-action]")?.getAttribute("data-action");
  if (!ACTIONS[action]) return;
  ACTIONS[action]();
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
restart(ctx);
render();
