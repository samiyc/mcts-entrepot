import { LINE_PLANS } from "../src/line-plan.js";
import { LINE_RULES, LINE_RULE_LABELS, summaryOfLine } from "../src/line-rules.js";
import * as line from "../src/line.js";
import { PLANS } from "../src/plans.js";
import * as plant from "../src/plant.js";
import { RULES, RULE_LABELS, summaryOf } from "../src/rules.js";
import * as warehouse from "../src/simulate.js";
import { startingSetup } from "./line-options.js";

/**
 * What the page plays, by simulation (Sami, 26/10/2026: a tab each): the plans, the rules and their labels, how a day
 * starts, turns and ends, its measures, how a comparison sums up, the rule the others are measured against, and how
 * many days a comparison plays. The page's games (game.js) and tabs read these, never the modules of one simulation
 * directly.
 */
export const MODELS = {
  entrepot: {
    kind: "entrepot",
    plans: PLANS,
    rules: RULES,
    labels: RULE_LABELS,
    start: (setup, seed) => warehouse.createDay(setup, warehouse.drawDay(seed, setup)),
    beginTurn: warehouse.beginTurn,
    nextChoice: warehouse.nextChoice,
    choose: warehouse.choose,
    endTurn: warehouse.endTurn,
    isOver: warehouse.isOver,
    stepDay: warehouse.stepDay,
    measuresOf: warehouse.measuresOf,
    runDay: warehouse.runDay,
    summaryOf,
    base: "list",
    measure: "truckWait",
    compared: Object.freeze({ rules: 100, search: 12 }),
    // The day's last turn, for the players' keys (replay-keys.js).
    horizon: (setup) => setup.horizon,
  },
  ligne: {
    kind: "ligne",
    plans: LINE_PLANS,
    rules: LINE_RULES,
    labels: LINE_RULE_LABELS,
    start: line.startLine,
    beginTurn: line.beginTurn,
    nextChoice: line.nextChoice,
    choose: line.choose,
    endTurn: line.endTurn,
    isOver: line.isOver,
    stepDay: line.stepDay,
    measuresOf: line.measuresOfLine,
    runDay: line.runLine,
    summaryOf: summaryOfLine,
    base: "kanban",
    measure: "stopped",
    // An hour of the line is three times a warehouse's day, and the comparison runs in the page's thread.
    compared: Object.freeze({ rules: 30, search: 8 }),
    horizon: (setup) => setup.horizon,
  },
};

/** The plant (26/10/2026): the line under its rule, the warehouse under its own (`setup.warehouseRule`); rules only, no replay yet. */
const PLANT_LABELS = Object.fromEntries(Object.entries(LINE_RULE_LABELS).filter(([name]) => name !== "search"));
MODELS.usine = {
  kind: "usine",
  plans: plant.PLANT_PLANS,
  rules: LINE_RULES,
  labels: PLANT_LABELS,
  start: plant.startPlant,
  isOver: plant.isPlantOver,
  stepDay: plant.stepPlant,
  measuresOf: plant.measuresOfPlant,
  runDay: plant.runPlant,
  summaryOf: summaryOfLine,
  base: "kanban",
  measure: "stopped",
  compared: Object.freeze({ rules: 20, search: 0 }),
  horizon: (setup) => setup.line.horizon,
  defaultRule: "kanban",
  noReplay: true,
};

/** The setup a plan starts with on the page: the line's named with its settings (line-options.js), the others as they are. */
export const setupFor = (kind, planId) => (kind === "ligne" ? startingSetup(planId) : { ...MODELS[kind].plans[planId] });

/** A simulation's own state on the page: its plan, rule, day, the choices made, what it compared, a replay opened. */
export const simOf = (kind, planId) => ({
  kind,
  planId,
  setup: setupFor(kind, planId),
  rule: MODELS[kind].defaultRule ?? "search",
  seed: 1,
  speed: 4,
  day: null,
  choices: [],
  // The search's choices made before the day was taken back (game.js `seek`).
  known: [],
  thinking: false,
  timer: null,
  compared: null,
  error: "",
  busy: "",
  run: 0,
  replay: null,
  kept: false,
});
