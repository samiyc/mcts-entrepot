import { parsePlan } from "mcts-commun/grid.js";

/**
 * A warehouse read from its plan (plans.js): the floor, the dock, each block's pickup cells (the floor cells
 * beside it), and the cells that may get blocked. Static: what moves is in simulate.js.
 */
const FLOOR = new Set([".", "T", "~"]);
const SIDES = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
export const isBlock = (char) => /^[A-Z]$/.test(char) && char !== "T";

/** The warehouse of `text`: `{ plan, dock, blocks: Map(letter → pickup cells), blockable, floor(char) }`. */
export function readWarehouse(text) {
  const plan = parsePlan(text);
  const [dock] = plan.find("T");
  if (!dock) throw new Error("le plan n'a pas de camion (T)");
  const blocks = new Map();
  for (let y = 0; y < plan.height; y += 1) {
    for (let x = 0; x < plan.width; x += 1) {
      const char = plan.at(x, y);
      if (!isBlock(char)) continue;
      const cells = blocks.get(char) ?? [];
      for (const [dx, dy] of SIDES) {
        const side = { x: x + dx, y: y + dy };
        if (FLOOR.has(plan.at(side.x, side.y)) && !cells.some((cell) => cell.x === side.x && cell.y === side.y)) cells.push(side);
      }
      blocks.set(char, cells);
    }
  }
  return { plan, dock, blocks, blockable: plan.find("~"), floor: (char) => FLOOR.has(char) };
}

/** Floor distances from `from` (a breadth-first search), `~` cells left out while `closed`: a Map "x,y" → steps. */
export function distancesFrom(warehouse, from, closed = false) {
  const { plan, floor } = warehouse;
  const distances = new Map([[`${from.x},${from.y}`, 0]]);
  const queue = [from];
  for (let i = 0; i < queue.length; i += 1) {
    const cell = queue[i];
    const steps = distances.get(`${cell.x},${cell.y}`);
    for (const [dx, dy] of SIDES) {
      const next = { x: cell.x + dx, y: cell.y + dy };
      const char = plan.at(next.x, next.y);
      const key = `${next.x},${next.y}`;
      if (!floor(char) || (closed && char === "~") || distances.has(key)) continue;
      distances.set(key, steps + 1);
      queue.push(next);
    }
  }
  return distances;
}

/** The pickup cell of `block` nearest in `distances`, with its distance; null if none can be reached. */
export function nearestPickup(warehouse, block, distances) {
  let best = null;
  for (const cell of warehouse.blocks.get(block) ?? []) {
    const steps = distances.get(`${cell.x},${cell.y}`);
    if (steps !== undefined && (!best || steps < best.steps)) best = { cell, steps };
  }
  return best;
}

export { SIDES };
