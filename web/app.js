import { PLANS } from "../src/plans.js";
import { RULE_LABELS, RULES, compareRules, summaryOf } from "../src/rules.js";
import { beginTurn, choose, createDay, drawDay, endTurn, isOver, measuresOf, nextChoice, runDay, stepDay } from "../src/simulate.js";
import { blockageOf, cellsOf, ordersOf, robotsOf, statusLine } from "./view.js";

const SYMBOLS = Object.freeze({ charge: "⚡", truck: "🚚" });

/**
 * The page: a day in the chosen warehouse under the chosen rule, played turn by turn (or all at once), then
 * the rules on the same 100 days. The plan can be edited (text, robots, orders, blockage): a new warehouse is
 * a new text. The search (src/search.js) thinks for a while at each choice (seconds at a day's start): it runs in
 * workers (search-worker.js), the page asking for each choice and drawing between two, and is compared on fewer
 * days, several at once. What it shows is computed in view.js; this
 * module only draws and listens.
 */
const CELL = 34;
const COMPARED = 100;
const COMPARED_WITH_SEARCH = 12;
const app = document.getElementById("app");
const state = { planId: "sami", setup: { ...PLANS.sami }, rule: "list", seed: 1, speed: 4, day: null, choices: [], thinking: false, timer: null, compared: null, error: "", busy: "", run: 0 };

/** The workers the search runs in, created on first use: one asked for each choice, others for whole days. */
const workers = [];
let jobs = 0;
const workerAt = (i) => {
  workers[i] ??= new Worker(new URL("./search-worker.js", import.meta.url), { type: "module" });
  return workers[i];
};
/** Asks worker `i` for `message`'s answer. */
function ask(i, message) {
  const worker = workerAt(i);
  const job = ++jobs;
  return new Promise((resolve, reject) => {
    const done = ({ data }) => {
      if (data.job !== job) return;
      worker.removeEventListener("message", done);
      resolve(data);
    };
    worker.addEventListener("message", done);
    worker.onerror = (error) => reject(error);
    worker.postMessage({ ...message, job });
  });
}
/** Every worker stopped (a new day, a new plan): the answers of a search under way would be for another day. */
function stopWorkers() {
  for (const worker of workers.splice(0)) worker.terminate();
}

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

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) if (value !== null && value !== false && value !== undefined) node.setAttribute(key, value === true ? "" : value);
  node.append(...children.filter((child) => child !== null && child !== undefined));
  return node;
}
function svg(tag, attrs = {}, text = null) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text !== null) node.textContent = text;
  return node;
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

function select(name, options, current) {
  return el("select", { "data-knob": name }, ...options.map(([value, label]) => el("option", { value, selected: value === current }, label)));
}

function controls() {
  const playing = state.timer !== null;
  return el(
    "div",
    { class: "controls" },
    el("label", {}, "Entrepôt", select("plan", Object.entries(PLANS).map(([id, plan]) => [id, plan.label]), state.planId)),
    el("label", {}, "Règle", select("rule", Object.entries(RULE_LABELS), state.rule)),
    el("label", {}, "Journée n°", el("input", { type: "number", min: "1", value: String(state.seed), "data-knob": "seed", inputmode: "numeric" })),
    el("label", {}, "Vitesse", select("speed", [["2", "lente"], ["4", "normale"], ["10", "rapide"]], String(state.speed))),
    el("button", { type: "button", "data-action": playing ? "pause" : "play" }, playing ? "Pause" : "Jouer"),
    el("button", { type: "button", class: "quiet", "data-action": "step" }, "Un tour"),
    el("button", { type: "button", class: "quiet", "data-action": "finish" }, "Jusqu'au bout"),
    el("button", { type: "button", class: "quiet", "data-action": "restart" }, "Recommencer"),
    el("button", { type: "button", class: "quiet", "data-action": "next" }, "Journée suivante"),
  );
}

function board() {
  const { plan } = state.day.warehouse;
  const blockage = blockageOf(state.day);
  const map = svg("svg", { viewBox: `0 0 ${plan.width * CELL} ${plan.height * CELL}`, class: "board", role: "img", "aria-label": "Le plan de l'entrepôt et les robots" });
  for (const cell of cellsOf(state.day)) {
    const kind = cell.kind === "blockable" && blockage.now ? `blockable blocked${blockage.seen ? " seen" : ""}` : cell.kind;
    const done = cell.kind === "block" && cell.pending === 0 ? " done" : "";
    map.append(svg("rect", { x: cell.x * CELL + 1, y: cell.y * CELL + 1, width: CELL - 2, height: CELL - 2, rx: 4, class: `cell ${kind}${done}` }));
    if (cell.kind === "block") map.append(svg("text", { x: cell.x * CELL + CELL / 2, y: cell.y * CELL + CELL / 2 + 5, class: "letter" }, cell.pending > 1 ? `${cell.letter}×${cell.pending}` : cell.letter));
    if (cell.kind === "dock") {
      const { truck } = cell;
      const there = !truck || (truck.there && truck.left > 0);
      const gone = truck && truck.left === 0 && truck.there;
      const text = gone ? "parti" : there ? SYMBOLS.truck : String(truck.at);
      map.append(svg("text", { x: cell.x * CELL + CELL / 2, y: cell.y * CELL + CELL / 2 + (there ? 7 : 4), class: `letter dock-letter${there ? " truck" : " due"}` }, text));
      if (truck) map.append(svg("title", {}, `Camion ${truck.id} : ${gone ? "chargé, parti" : truck.there ? `à quai, ${truck.left} commande${truck.left > 1 ? "s" : ""} à charger` : `attendu au tour ${truck.at}`}`));
    }
    if (cell.home) map.append(svg("circle", { cx: cell.x * CELL + CELL / 2, cy: cell.y * CELL + CELL / 2, r: CELL / 2 - 6, class: "home" }), svg("text", { x: cell.x * CELL + CELL / 2, y: cell.y * CELL + CELL / 2 + 4, class: "home-id" }, String(cell.home)), svg("title", {}, `Départ du robot ${cell.home} : il part d'ici et y revient (pas de borne « c » pour lui)`));
    if (cell.kind === "charge") map.append(svg("text", { x: cell.x * CELL + CELL / 2, y: cell.y * CELL + CELL / 2 + 6, class: "symbol" }, SYMBOLS.charge));
    if (cell.pallet) map.append(svg("rect", { x: cell.x * CELL + 7, y: cell.y * CELL + 7, width: CELL - 14, height: CELL - 14, rx: 3, class: "parcel" }), svg("text", { x: cell.x * CELL + CELL / 2, y: cell.y * CELL + CELL / 2 + 4, class: "letter pallet" }, cell.pallet));
  }
  for (const robot of robotsOf(state.day)) {
    if (robot.ahead.length > 1) map.append(svg("polyline", { points: robot.ahead.map((step) => `${step.x * CELL + CELL / 2},${step.y * CELL + CELL / 2}`).join(" "), class: `trail r${robot.id}` }));
  }
  for (const robot of robotsOf(state.day)) {
    const group = svg("g", { class: `robot r${robot.id}`, transform: `translate(${robot.x * CELL + CELL / 2} ${robot.y * CELL + CELL / 2})` });
    group.append(svg("title", {}, robot.label), svg("circle", { r: CELL / 2 - 5 }), svg("text", { y: 4, class: "robot-id" }, String(robot.id)));
    if (robot.carrying) group.append(svg("rect", { x: 4, y: -CELL / 2 + 2, width: 10, height: 10, rx: 2, class: "parcel" }));
    map.append(group);
  }
  return el("div", { class: "board-wrap" }, map);
}

function orders() {
  return el("ol", { class: "orders" }, ...ordersOf(state.day).map((order) => el("li", { class: order.status }, el("strong", {}, order.block), order.truck ? el("span", { class: "truck-tag" }, `camion ${order.truck}`) : null, ` ${order.label}`)));
}

function editor() {
  const { setup } = state;
  const field = (label, name, value, attrs = {}) => el("label", {}, label, el("input", { name, value: String(value), ...attrs }));
  return el(
    "details",
    { class: "editor" },
    el("summary", {}, "Changer d'entrepôt"),
    el("p", { class: "hint" }, "Le plan en texte : « . » le sol, une majuscule un bloc de rayons, « T » un quai où vient un camion, « w » une case devant un quai où une palette attend son camion (une par case), « c » une borne de charge d'où part un robot et où il revient, « ~ » une case qui peut se bloquer, « # » un mur ou l'extérieur. Les commandes sont des lettres de blocs, dans l'ordre où elles arrivent, un groupe par camion séparé par « / » (les quais dans l'ordre de lecture, de haut en bas) ; les camions arrivent aux tours donnés, séparés par des espaces."),
    el("form", { "data-form": "plan" }, el("textarea", { name: "text", rows: String(Math.max(5, setup.text.split("\n").length + 1)), spellcheck: "false" }, setup.text), el("div", { class: "fields" }, field("Robots", "robots", setup.robots, { type: "number", min: "1", max: "12" }), field("Commandes", "orders", setup.orders), field("Arrivée des camions (tours)", "trucks", (setup.trucks ?? []).join(" ")), field("Blocage (%)", "blocking", Math.round(100 * setup.blocking), { type: "number", min: "0", max: "100" }), field("Durée du blocage (tours)", "duration", setup.duration, { type: "number", min: "1" }), field("Fin de la journée (tours)", "horizon", setup.horizon, { type: "number", min: "10" })), el("button", { type: "submit" }, "Appliquer")),
    state.error ? el("p", { class: "error", role: "alert" }, state.error) : null,
  );
}

function comparison() {
  const buttons = el(
    "div",
    { class: "controls" },
    el("button", { type: "button", class: "quiet compare", "data-action": "compare" }, `Comparer les règles sur ${COMPARED} journées`),
    el("button", { type: "button", class: "quiet compare", "data-action": "compareSearch" }, `Comparer avec la recherche sur ${COMPARED_WITH_SEARCH} journées`),
  );
  if (!state.compared) return [buttons];
  const { days, rows: compared } = state.compared;
  const fixed = (value, digits = 1) => value.toFixed(digits).replace(".", ",");
  const rows = Object.entries(compared).map(([name, row]) =>
    el("tr", { class: name === state.rule ? "current" : null }, el("td", {}, RULE_LABELS[name]), el("td", { class: "num" }, fixed(row.delivered, 2)), el("td", { class: "num" }, fixed(row.finish)), el("td", { class: "num" }, fixed(row.truckWait)), el("td", { class: "num" }, name === "list" ? "—" : `${fixed(row.gain.mean)} (${fixed(row.gain.low)} à ${fixed(row.gain.high)})`), el("td", { class: "num" }, fixed(row.early)), el("td", { class: "num" }, fixed(row.waits)), el("td", { class: "num" }, fixed(row.replans, 2))),
  );
  const head = ["Règle", "livrées", "fini au tour", "temps à quai des camions (tours)", "temps à quai gagné sur la liste (IC 95 %)", "prêtes avant leur camion", "attentes des robots", "replanifiés"].map((label, i) => el("th", { class: i > 0 ? "num" : null }, label));
  return [el("h2", {}, `Les règles sur les mêmes ${days} journées (blocage ${Math.round(100 * compared.list.blockedDays)} % des jours)`), el("div", { class: "scroll" }, el("table", {}, el("thead", {}, el("tr", {}, ...head)), el("tbody", {}, ...rows))), buttons];
}

function render() {
  const over = isOver(state.day);
  app.replaceChildren(controls(), el("p", { class: "summary", "aria-live": "polite" }, state.busy || statusLine(state.day, over ? measuresOf(state.day) : null)), el("div", { class: "layout" }, board(), el("aside", {}, el("h2", {}, "Les commandes"), orders())), ...comparison(), editor());
}

function applyPlan(form) {
  const data = new FormData(form);
  const setup = {
    ...state.setup,
    label: "Entrepôt modifié",
    text: String(data.get("text")).replace(/\s+$/, ""),
    robots: Math.max(1, Number(data.get("robots")) || 1),
    orders: String(data.get("orders")).replace(/[^A-Z/]/g, ""),
    trucks: String(data.get("trucks")).split(/[\s,;]+/).filter(Boolean).map((value) => Math.max(0, Number(value) || 0)),
    blocking: Math.min(1, Math.max(0, Number(data.get("blocking")) / 100 || 0)),
    duration: Math.max(1, Number(data.get("duration")) || 1),
    horizon: Math.max(10, Number(data.get("horizon")) || 10),
  };
  try {
    createDay(setup, { blockage: null });
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

app.addEventListener("change", (event) => {
  const name = event.target.dataset?.knob;
  if (!name) return;
  if (name === "plan") Object.assign(state, { planId: event.target.value, setup: { ...PLANS[event.target.value] }, compared: null, error: "" });
  else if (name === "seed") state.seed = Math.max(1, Number(event.target.value) || 1);
  else if (name === "speed") state.speed = Number(event.target.value);
  else state[name] = event.target.value;
  if (name === "speed" && state.timer) play();
  else restart();
  render();
});
app.addEventListener("click", (event) => {
  const action = event.target.closest?.("[data-action]")?.dataset.action;
  if (!ACTIONS[action]) return;
  ACTIONS[action]();
  render();
});
app.addEventListener("submit", (event) => {
  event.preventDefault();
  applyPlan(event.target);
  render();
});
restart();
render();
