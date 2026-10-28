import { search } from "mcts-commun/mcts.js";
import { createRng } from "mcts-commun/random.js";
import { withLegHorizon } from "./day-basics.js";
import { redrawLine } from "./line-search.js";
import { LINE_RULES } from "./line-rules.js";
import { WAREHOUSE_RULES, advancePlant, choosePlant, vehiclesLeft } from "./plant.js";
import { drawWorld } from "./search.js";

/**
 * The search in the plant (Sami, 26/10/2026; docs/recherche/feuille-de-route.md: a warehouse search that knows the
 * line): which order an idle robot of the warehouse takes, judged on what the line loses. A world is the whole plant:
 * the warehouse's aisle drawn again (search.js), the line's hidden ones too (its aisle, its shortages, the models after
 * the frozen sequence), the orders under way as they are, the warehouse will bring them. It is played `lookahead` turns,
 * the line under its rule (`lineRule`), the warehouse under `rollout` beyond the tree, and scored on the turns the line
 * stood still against the rollout's from the same point. When the rollout stops the line in none of the worlds drawn
 * for that base, there is nothing to win: the rollout's choice, without a tree.
 */
export const PLANT_SEARCH_SETTINGS = Object.freeze({ budget: 64, depth: 2, explore: 0.3, width: 5, spread: 20, seed: 1, lookahead: 360, lineRule: "kanban", rollout: "list", earlyStop: true, legHorizon: null });

/** A plant consistent with what the robots know at this choice: the warehouse's, the line's, played up to `limit`. */
export function drawPlantWorld(plant, rng, limit) {
  const line = redrawLine(plant.line, rng, { restocks: false });
  const warehouse = drawWorld(plant.warehouse, rng);
  warehouse.plantLine = line;
  // The orders under way are the line's copies: the pallets the world's warehouse brings fill the world's supermarket.
  const copies = new Map(plant.line.restocks.map((order, i) => [order, line.restocks[i]]));
  const sent = new Map([...plant.sent].filter(([, order]) => copies.has(order)).map(([id, order]) => [id, copies.get(order)]));
  return { ...plant, line, warehouse, sent, seen: 0, limit, choice: warehouse.choice };
}

const ask = (world, rule) => rule({ id: world.choice.robot.id, x: world.choice.robot.x, y: world.choice.robot.y }, world.choice.open, { t: world.t, reach: world.choice.reach, state: world.warehouse })?.id;

function rollOut(world, lineRule, rule) {
  while (world.choice) {
    choosePlant(world, world.choice, ask(world, rule));
    world.choice = advancePlant(world, lineRule);
  }
  return world;
}

/** The shortlist: the first of the list, the nearest, the reference the line runs out of first; `width` at most. */
function shortlistOf(world, moves, width) {
  const { reach } = world.choice;
  const near = [...moves].sort((a, b) => reach(a.order) - reach(b.order) || a.order.id - b.order.id);
  const short = [...moves].sort((a, b) => vehiclesLeft(world.line, a.order.block) - vehiclesLeft(world.line, b.order.block) || a.order.id - b.order.id);
  const ranked = [...moves.slice(0, 2), ...near.slice(0, 2), ...short.slice(0, 2), ...near];
  return [...new Map(ranked.map((move) => [move.key, move])).values()].slice(0, width);
}

function problemFor(base, { width, spread, lineRule, rule }) {
  return {
    sample: (plant, rng) => drawPlantWorld(plant, rng, plant.limit),
    actor: () => "robots",
    moves: (world) => world.choice.open.map((order) => ({ id: order.id, order, key: `${world.choice.robot.id}>${order.id}` })),
    shortlist: (world, moves) => shortlistOf(world, moves, width),
    key: (move) => move.key,
    play(world, move) {
      choosePlant(world, world.choice, move.id);
      world.choice = advancePlant(world, lineRule);
      return world;
    },
    over: (world) => !world.choice,
    rollout: (world) => rollOut(world, lineRule, rule),
    score: (world) => Math.min(1, Math.max(0, 0.5 + (base - world.line.stopped) / spread)),
  };
}

/** The rollout's mean stop over a few drawn worlds: the scores' middle. */
function baseOf(root, rng, rules, runs = 4) {
  let total = 0;
  for (let i = 0; i < runs; i += 1) total += rollOut(drawPlantWorld(root, rng, root.limit), rules.lineRule, rules.rule).line.stopped;
  return total / runs;
}

/**
 * The search as a warehouse rule in the plant (plant.js gives it the plant, `context.plant`): a single open order is
 * taken at once; otherwise `budget` iterations, seeded from the turn and the robot. `earlyStop`, `legHorizon` and
 * `onSearch` as in search.js.
 * @param {Record<string, any> & import("./types.js").SearchHooks} [options]
 * @returns {import("./types.js").Rule}
 */
export function plantSearchRule(options = {}) {
  const { budget, depth, explore, width, spread, seed, lookahead, lineRule, rollout, earlyStop, legHorizon, onSearch } = { ...PLANT_SEARCH_SETTINGS, ...options };
  const rules = { lineRule: LINE_RULES[lineRule], rule: WAREHOUSE_RULES[rollout] };
  return (robot, open, context) => {
    // The plant, not a warehouse's day: the rule's types know only the warehouse's.
    const plant = /** @type {any} */ (context).plant;
    if (open.length === 1) return open[0];
    const rng = createRng((Math.imul(seed, 0x9e3779b1) + plant.t * 131 + robot.id * 7 + open.length) >>> 0);
    // The warehouse's legs and the line's both planned `legHorizon` ahead in the worlds drawn.
    const root = { ...plant, warehouse: withLegHorizon(plant.warehouse, legHorizon), line: withLegHorizon(plant.line, legHorizon), limit: Math.min(plant.line.setup.horizon, plant.t + lookahead) };
    const base = baseOf(root, rng, rules);
    if (base === plant.line.stopped) return rules.rule(robot, open, context);
    const found = search(root, problemFor(base, { width, spread, ...rules }), { budget, rng, depth, explore, common: true, earlyStop });
    onSearch?.(found, depth);
    return open.find((order) => order.id === found.move?.id) ?? rules.rule(robot, open, context);
  };
}
