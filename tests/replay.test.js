import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PLANS } from "../src/plans.js";
import { recording, replayDay, replayOf } from "../src/replay.js";
import { RULES } from "../src/rules.js";
import { isOver, measuresOf, runDay } from "../src/simulate.js";

describe("the replays (src/replay.js)", () => {
  it("plays a day again from its choices, move for move, under every rule and plan", () => {
    for (const [planId, setup] of Object.entries(PLANS)) {
      for (const [name, rule] of Object.entries(RULES)) {
        const choices = [];
        const { state, measures } = runDay(setup, 3, recording(rule, choices));
        assert.deepEqual(runDay(setup, 3, rule).measures, measures, `${planId}, ${name} : enregistrer change la journée`);
        const { day, choice } = replayDay(setup, 3, choices);
        assert.equal(choice, null, `${planId}, ${name} : la journée rejouée ne finit pas`);
        assert.ok(isOver(day));
        assert.deepEqual(measuresOf(day), measures, `${planId}, ${name} : pas la même journée`);
        assert.deepEqual(day.log, state.log);
      }
    }
  });

  it("keeps what the day was, and a copy of its choices", () => {
    const choices = [1, 2];
    const replay = replayOf({ planId: "petit", setup: PLANS.petit, seed: 4, rule: "list", choices, measures: {} });
    choices.push(3);
    assert.equal(replay.format, "entrepot/1");
    assert.deepEqual(replay.choices, [1, 2]);
    assert.match(replay.savedAt, /^\d{4}-\d\d-\d\dT/);
  });
});
