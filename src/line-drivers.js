import { createRng } from "mcts-commun/random.js";
import { besides, closed, keyOf, sameCell } from "./day-basics.js";
import { coverOf } from "./line-rules.js";
import { distancesFrom } from "./warehouse.js";

/**
 * Drivers played by the machine (Sami, 26/10/2026, step 3; as the random human of mcts-urgences): to measure what a
 * person on the line brings or costs, by pairs on the same hours, without a person at the keys. Each gives the driver's
 * action of the turn, `(state) => action` (line-human.js).
 */
const MOVES = [
  ["up", 0, -1],
  ["down", 0, 1],
  ["left", -1, 0],
  ["right", 1, 0],
];

/** The step towards the nearest of `cells`, or `act` once on one; `wait` when no step brings it nearer. */
function towards(state, human, cells) {
  if (cells.some((cell) => sameCell(cell, human))) return "act";
  const maps = cells.map((cell) => distancesFrom(state.warehouse, cell, closed(state)));
  const far = (cell) => Math.min(...maps.map((map) => map.get(keyOf(cell)) ?? Infinity));
  const here = far(human);
  const busy = new Set(state.robots.map(keyOf));
  const best = MOVES.map(([name, dx, dy]) => ({ name, cell: { x: human.x + dx, y: human.y + dy } }))
    .filter(({ cell }) => !busy.has(keyOf(cell)) && far(cell) < here)
    .sort((a, b) => far(a.cell) - far(b.cell))[0];
  return best?.name ?? "wait";
}

/** The cells beside the block of `request`: where the driver takes its bin. */
const pickupCells = (state, request) => state.warehouse.blocks.get(request.block);

/**
 * The helping driver: with a bin, to its station; without, to the open request whose lane is nearest to stopping the
 * line (the shortest cover), not one the robots know short.
 */
export function helpingDriver(state) {
  const human = state.human;
  if (human.load !== null) {
    const request = state.orders.find((order) => order.id === human.load);
    return towards(state, human, state.stations[request.station].access);
  }
  const open = state.orders.filter((order) => order.status === "open" && state.known.short[order.block] === undefined);
  if (open.length === 0) return "wait";
  const urgent = open.reduce((best, order) => (coverOf(state, order) < coverOf(state, best) ? order : best));
  const cells = pickupCells(state, urgent);
  // Beside the block already: take it.
  return cells.some((cell) => sameCell(cell, human)) || besides(human).some((cell) => state.warehouse.plan.at(cell.x, cell.y) === urgent.block) ? "act" : towards(state, human, cells);
}

/** A driver wandering at random, from its own seed: what a person who does not help costs. */
export function randomDriver(seed) {
  const rng = createRng(seed);
  const actions = ["up", "down", "left", "right", "act", "wait"];
  return () => actions[rng.int(actions.length)];
}

export const DRIVERS = Object.freeze({ helping: () => helpingDriver, random: randomDriver });
