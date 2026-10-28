import { search } from "mcts-commun/mcts.js";
import { createRng } from "mcts-commun/random.js";
import { drawWorldOrders } from "./day-arrivals.js";
import { drawWorldKits } from "./day-kits.js";
import { withLegHorizon } from "./day-basics.js";
import { RULES } from "./rules.js";
import { advance, choose, cloneDay, drawBlockages, measuresOf, nextChoice } from "./simulate.js";

/**
 * The search (ISMCTS, `search` of mcts-commun) choosing which order an idle robot takes. It knows what the
 * robots know: the plan, the orders, where every robot is and where it goes. What it cannot know, the
 * blockages not seen yet, it draws again at every iteration from the plan's odds, starting after now (the one
 * seen and still on is as seen). The robot's choices are judged on common worlds, a tree of `depth` choices
 * (this robot's, then the next idle robot's), the list order beyond, to the end of the day.
 *
 * A world is scored against the list order's day from the same point: ½ for the same finish, a turn earlier
 * or later worth `1 / spread` per truck, so that a few turns weigh in the tree as they do in the warehouse.
 */
// earlyStop on since 27/10/2026 (Sami): the same days to the turn on every plan, a search up to a third shorter.
// legHorizon (28/10/2026, measured by pairs): the legs of the worlds drawn planned that many turns ahead, null for LEG_HORIZON.
// rootWidth and widening (28/10/2026, the step up mcts-commun's docs/reglages.md measures): the moves kept at the root, null
// for width, and mcts-commun's progressive widening below it, 0 for none.
export const SEARCH_SETTINGS = Object.freeze({ budget: 64, depth: 2, explore: 0.3, width: 5, spread: 20, seed: 1, earlyStop: true, legHorizon: null, rootWidth: null, widening: 0 });

/** A world consistent with what the robots know at this choice. */
export function drawWorld(state, rng) {
  const world = cloneDay(state);
  // The blockage seen and still on is as seen; the ones to come are drawn again from the plan's odds.
  const { known } = state;
  const now = state.t <= known.blockedUntil ? [{ from: known.seenAt, to: known.blockedUntil + 1 }] : [];
  world.day = { blockages: [...now, ...drawBlockages(rng, state.setup, Math.max(state.t, known.blockedUntil) + 1)] };
  // The orders still to come, drawn again (a day with arrivals only: the others draw as before).
  drawWorldOrders(world, state, rng);
  // The kits' works not seen yet, drawn again (a day with kits only).
  drawWorldKits(world, state, rng);
  world.choice = nextChoice(world);
  return world;
}

/** The day's cost from here: the turns trucks wait for their last pallet (the last delivery's turn with one truck there from the start), and a quarter of the mean delivery turn. */
const costOf = (world) => {
  const measures = measuresOf(world);
  return measures.truckWait + measures.meanDelivery / 4;
};

/** The list order to the end of the day. */
function rollOut(world) {
  while (world.choice) {
    choose(world, world.choice, RULES.list(world.choice.robot, world.choice.open)?.id);
    world.choice = advance(world);
  }
  return world;
}

const byReach = (choice) => (a, b) => choice.reach(a.order) - choice.reach(b.order) || a.order.id - b.order.id;

/** The shortlist: the nearest orders, the first of the list, the farthest; `width` at most. */
function shortlistOf(world, moves, width) {
  const near = [...moves].sort(byReach(world.choice));
  const ranked = [...near.slice(0, 3), ...[...moves].sort((a, b) => a.order.id - b.order.id).slice(0, 1), ...near.slice(-1), ...near];
  return [...new Map(ranked.map((move) => [move.key, move])).values()].slice(0, width);
}

function problemFor(base, { width, rootWidth, spread }) {
  return {
    sample: drawWorld,
    actor: () => "robots",
    moves: (world) => world.choice.open.map((order) => ({ id: order.id, order, key: `${world.choice.robot.id}>${order.id}` })),
    shortlist: (world, moves, where) => shortlistOf(world, moves, (where?.root && rootWidth) || width),
    key: (move) => move.key,
    play(world, move) {
      choose(world, world.choice, move.id);
      world.choice = advance(world);
      return world;
    },
    over: (world) => !world.choice,
    rollout: rollOut,
    score: (world) => Math.min(1, Math.max(0, 0.5 + (base - costOf(world)) / spread)),
  };
}

/** The list order's mean cost over a few drawn worlds: the scores' middle. */
function baseOf(state, rng, runs = 4) {
  let total = 0;
  for (let i = 0; i < runs; i += 1) total += costOf(rollOut(drawWorld(state, rng)));
  return total / runs;
}

/**
 * The search as a rule (simulate.js's signature, reading `context.state`): a single open order is taken at
 * once; otherwise `budget` iterations, seeded from the turn and the robot. `earlyStop` (mcts-commun, 27/10/2026, on
 * by default) stops a search once its leader cannot be caught; `legHorizon` plans the legs of the worlds drawn that many turns
 * ahead, lighter than LEG_HORIZON (28/10/2026, off by default); `rootWidth` keeps more moves at the root than `width`
 * below it, `widening` widens below it progressively (28/10/2026, off by default); `onSearch(found, depth)` sees each
 * result (scripts/searches.js).
 * @param {Record<string, any> & import("./types.js").SearchHooks} [options]
 * @returns {import("./types.js").Rule}
 */
export function searchRule(options = {}) {
  const { budget, depth, explore, width, rootWidth, widening, spread, seed, earlyStop, legHorizon, onSearch } = { ...SEARCH_SETTINGS, ...options };
  return (robot, open, context) => {
    if (open.length === 1) return open[0];
    const state = withLegHorizon(context.state, legHorizon);
    const rng = createRng((Math.imul(seed, 0x9e3779b1) + state.t * 131 + robot.id * 7 + open.length) >>> 0);
    // The trucks' waits add up: the scale grows with them, or every world of a three-truck day scores 0 or 1.
    const found = search(state, problemFor(baseOf(state, rng), { width, rootWidth, spread: spread * state.trucks.length }), { budget, rng, depth, explore, common: true, widening, earlyStop });
    onSearch?.(found, depth);
    return open.find((order) => order.id === found.move?.id) ?? RULES.list(robot, open);
  };
}
