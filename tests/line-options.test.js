import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LINE_PLANS } from "../src/line-plan.js";
import { VARIANT_OF, lineOf, optionsOf, setupOf, withSetting } from "../web/line-options.js";

const unlabelled = ({ label: _label, ...setup }) => setup;

describe("the line's settings in the side panel (web/line-options.js)", () => {
  it("makes every named variant of Sami's line from the line and its settings, as the night measures play it", () => {
    for (const id of Object.keys(VARIANT_OF)) assert.deepEqual(unlabelled(setupOf(lineOf(id), optionsOf(LINE_PLANS[id]))), unlabelled(LINE_PLANS[id]), id);
    for (const id of ["petite", "sami", "etroite"]) assert.deepEqual(unlabelled(setupOf(id, optionsOf(LINE_PLANS[id]))), unlabelled(LINE_PLANS[id]), id);
  });

  it("changes one setting, keeps the others and the driver, and names them in the label", () => {
    const setup = withSetting({ ...LINE_PLANS.seul, human: true }, "seul", "supermarket", "pickers");
    assert.deepEqual(optionsOf(setup), { ...optionsOf(LINE_PLANS.seul), supermarket: "pickers" });
    assert.equal(setup.human, true);
    assert.equal(setup.label, "Longue ligne : 5 postes, 12 références, une allée qui se bloque ; 1 robot, le supermarché servi par 3 préparateurs");
    assert.deepEqual(unlabelled(withSetting(setup, "sami", "supermarket", "none")), { ...unlabelled(LINE_PLANS.seul), human: true });
  });
});
