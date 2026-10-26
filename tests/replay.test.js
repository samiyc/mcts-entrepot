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

describe("the replays of the assembly line", () => {
  it("plays an hour of the line again from its choices, under every rule and plan", async () => {
    const { LINE_PLANS } = await import("../src/line-plan.js");
    const { LINE_RULES } = await import("../src/line-rules.js");
    const { measuresOfLine, runLine } = await import("../src/line.js");
    for (const [planId, setup] of Object.entries(LINE_PLANS)) {
      for (const [name, rule] of Object.entries(LINE_RULES)) {
        const choices = [];
        const { state, measures } = runLine(setup, 4, recording(rule, choices));
        const { day, choice } = replayDay(setup, 4, choices, "ligne");
        assert.equal(choice, null, `${planId}, ${name} : l'heure rejouée ne finit pas`);
        assert.deepEqual(measuresOfLine(day), measures, `${planId}, ${name} : pas la même heure`);
        assert.deepEqual(day.log, state.log);
      }
    }
  });
});
