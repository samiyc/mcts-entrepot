import { parsePlan } from "mcts-commun/grid.js";

/**
 * A warehouse read from its plan (plans.js): the floor, the docks with their bays, the charging points, each
 * block's pickup cells (the floor cells beside it), and the cells that may get blocked. Static: what moves is
 * in simulate.js.
 */
const FLOOR = new Set([".", "T", "~", "c", "w"]);
const SIDES = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
export const isBlock = (char) => /^[A-Z]$/.test(char) && char !== "T";

/**
 * A dock's bay: the `w` cells joined to it through other `w` cells, nearest the truck first (so the far end
 * fills first and the aisle into the bay stays open).
 */
function bayOf(plan, dock) {
  const distances = new Map([[`${dock.x},${dock.y}`, 0]]);
  const queue = [dock];
  const bay = [];
  for (let i = 0; i < queue.length; i += 1) {
    const cell = queue[i];
    for (const [dx, dy] of SIDES) {
      const next = { x: cell.x + dx, y: cell.y + dy };
      const key = `${next.x},${next.y}`;
      if (plan.at(next.x, next.y) !== "w" || distances.has(key)) continue;
      distances.set(key, distances.get(`${cell.x},${cell.y}`) + 1);
      queue.push(next);
      bay.push(next);
    }
  }
  return bay;
}

/**
 * The warehouse of `text`: `{ plan, dock, docks, charges, blocks: Map(letter → pickup cells), blockable,
 * floor(char) }`. Each dock is `{ x, y, bay }`, in reading order; `dock` is the first.
 */
/**
 * Waiting zones away from the trucks (Sami, 23/10): a group of `w` cells touching no truck belongs to the truck
 * nearest it on the floor, its cells after that truck's own bay, nearest the truck first.
 */
function attachZones(plan, docks) {
  const key = (cell) => `${cell.x},${cell.y}`;
  const owned = new Set(docks.flatMap((dock) => dock.bay.map(key)));
  const floorFrom = (from) => {
    const distances = new Map([[key(from), 0]]);
    const queue = [from];
    for (let i = 0; i < queue.length; i += 1) {
      for (const [dx, dy] of SIDES) {
        const next = { x: queue[i].x + dx, y: queue[i].y + dy };
        if (!FLOOR.has(plan.at(next.x, next.y)) || distances.has(key(next))) continue;
        distances.set(key(next), distances.get(key(queue[i])) + 1);
        queue.push(next);
      }
    }
    return distances;
  };
  const maps = docks.map(floorFrom);
  for (const start of plan.find("w")) {
    if (owned.has(key(start))) continue;
    const zone = [start];
    owned.add(key(start));
    for (let i = 0; i < zone.length; i += 1) {
      for (const [dx, dy] of SIDES) {
        const next = { x: zone[i].x + dx, y: zone[i].y + dy };
        if (plan.at(next.x, next.y) !== "w" || owned.has(key(next))) continue;
        owned.add(key(next));
        zone.push(next);
      }
    }
    const reach = maps.map((distances) => Math.min(...zone.map((cell) => distances.get(key(cell)) ?? Infinity)));
    const nearest = reach.indexOf(Math.min(...reach));
    if (reach[nearest] === Infinity) continue;
    docks[nearest].bay.push(...zone.sort((a, b) => maps[nearest].get(key(a)) - maps[nearest].get(key(b))));
  }
}

export function readWarehouse(text) {
  const plan = parsePlan(text);
  const docks = plan.find("T").map((cell) => ({ ...cell, bay: bayOf(plan, cell) }));
  attachZones(plan, docks);
  const [dock] = docks;
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
  return { plan, dock, docks, charges: plan.find("c"), blocks, blockable: plan.find("~"), floor: (char) => FLOOR.has(char) };
}

/** Floor distances from `from` (a breadth-first search), `~` cells left out while `closed`: a Map "x,y" → steps. */
export function distancesFrom(warehouse, from, closed = false) {
  // Static (walls and `~` only, no robot): remembered per warehouse and cell; callers only read the map.
  if (!memo.has(warehouse)) memo.set(warehouse, new Map());
  const known = memo.get(warehouse);
  const key = `${from.x},${from.y},${closed ? 1 : 0}`;
  if (!known.has(key)) known.set(key, distancesNow(warehouse, from, closed));
  return known.get(key);
}
const memo = new WeakMap();

function distancesNow(warehouse, from, closed) {
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
