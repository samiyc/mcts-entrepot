import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRng } from "mcts-commun/random.js";
import { PLANS } from "../src/plans.js";
import { RULES } from "../src/rules.js";
import { drawWorld } from "../src/search.js";
import { advance, choose, createDay, drawDay, isOver, runDay, stepDay } from "../src/simulate.js";
import { readWarehouse } from "../src/warehouse.js";

const setup = PLANS.assemblage;
const eventAt = (state, type, kit) => state.log.find((event) => event.type === type && event.kit === kit)?.t;

describe("the assembly station: a specialist assembles parts the robots bring (src/day-kits.js)", () => {
  it("reads S as a station, and wants one when the setup has kits", () => {
    const warehouse = readWarehouse(setup.text);
    assert.deepEqual(warehouse.stations.map(({ x, y }) => ({ x, y })), [{ x: 1, y: 7 }]);
    assert.equal(warehouse.blocks.has("S"), false);
    assert.throws(() => createDay({ ...setup, text: PLANS.flux.text }, drawDay(1, setup)), /poste d'assemblage/);
  });

  it("starts a kit once its parts are in, one at a time, ends it after its drawn work, and carries its parcel to the truck", () => {
    for (let seed = 1; seed <= 6; seed += 1) {
      for (const rule of Object.values(RULES)) {
        const { state, measures } = runDay(setup, seed, rule);
        assert.equal(measures.delivered, measures.orders, `jour ${seed}`);
        assert.equal(measures.assembled, setup.kits.length);
        for (const kit of state.kits) {
          const parts = state.orders.filter((order) => order.kit === kit.k && !order.parcel);
          const parcel = state.orders.find((order) => order.kit === kit.k && order.parcel);
          assert.ok(parts.every((part) => part.deliveredAt <= kit.startedAt), "les pièces avant l'assemblage");
          assert.equal(kit.doneAt - kit.startedAt, state.day.works[kit.k]);
          const [min, max] = setup.kits[kit.k].work;
          assert.ok(state.day.works[kit.k] >= min && state.day.works[kit.k] <= max);
          assert.equal(eventAt(state, "assembled", kit.k), kit.doneAt);
          assert.ok(parcel.deliveredAt > kit.doneAt && parcel.truck === setup.kits[kit.k].truck);
        }
        const [first, second] = [...state.kits].sort((a, b) => a.startedAt - b.startedAt);
        assert.ok(second.startedAt >= first.doneAt, "un spécialiste, un assemblage à la fois");
      }
    }
  });

  it("hides the parcel from the rules until it is assembled", () => {
    const state = createDay(setup, drawDay(2, setup));
    const seen = [];
    const rule = (robot, open, context) => {
      seen.push(...open.filter((order) => order.parcel).map((order) => [order.kit, state.t]));
      return RULES.list(robot, open, context);
    };
    while (!isOver(state)) stepDay(state, rule);
    for (const [k, t] of seen) assert.ok(t >= state.kits[k].doneAt);
  });

  it("draws the works again in the search's worlds, keeps the kits done, and leaves the day as it is", () => {
    // At a choice, as the search draws its worlds, while a kit is under way.
    const state = createDay(setup, drawDay(3, setup));
    let choice = advance(state);
    while (!state.kits.some((kit) => kit.startedAt !== null && kit.doneAt === null)) {
      choose(state, choice, RULES.list(choice.robot, choice.open)?.id);
      choice = advance(state);
    }
    const before = JSON.stringify(state.kits);
    const world = drawWorld(state, createRng(4));
    assert.equal(JSON.stringify(state.kits), before);
    for (const [k, kit] of world.kits.entries()) {
      if (state.kits[k].doneAt !== null) assert.deepEqual(kit, state.kits[k]);
      else if (state.kits[k].startedAt !== null) assert.ok(kit.until > state.t);
    }
  });
});
