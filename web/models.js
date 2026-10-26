import { LINE_PLANS } from "../src/line-plan.js";
import { LINE_RULES, LINE_RULE_LABELS, summaryOfLine } from "../src/line-rules.js";
import * as line from "../src/line.js";
import { PLANS } from "../src/plans.js";
import { RULES, RULE_LABELS, summaryOf } from "../src/rules.js";
import * as warehouse from "../src/simulate.js";

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
  },
  ligne: {
    kind: "ligne",
    plans: LINE_PLANS,
    rules: LINE_RULES,
    labels: LINE_RULE_LABELS,
    start: (setup, seed) => line.createLine(setup, line.drawLineDay(seed, setup)),
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
  },
};

/** A simulation's own state on the page: its plan, rule, day, the choices made, what it compared, a replay opened. */
export const simOf = (kind, planId) => ({
  kind,
  planId,
  setup: { ...MODELS[kind].plans[planId] },
  rule: "search",
  seed: 1,
  speed: 4,
  day: null,
  choices: [],
  thinking: false,
  timer: null,
  compared: null,
  error: "",
  busy: "",
  run: 0,
  replay: null,
  kept: false,
});
