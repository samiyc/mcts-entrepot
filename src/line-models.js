/**
 * The mix of models on the line (Sami, 26/10/2026; docs/recherche/feuille-de-route.md, step 2): each vehicle is of a
 * model, drawn by its share (`setup.models`, `[{ name, share, skip }]`), and a model skips the references in its `skip`
 * (a petrol car takes no part of the hybrid's). The sequence is fixed some vehicles ahead (the *heijunka*): the robots
 * know the next `setup.frozen` vehicles, not the ones after (the search draws them again). Without `setup.models` every
 * vehicle takes every reference, as in step 1.
 */

/** `count` models drawn by their shares. */
export function drawSequence(rng, setup, count) {
  const total = setup.models.reduce((sum, model) => sum + model.share, 0);
  return Array.from({ length: count }, () => {
    let draw = rng.next() * total;
    return setup.models.findIndex((model) => (draw -= model.share) < 0);
  });
}

/** The vehicles an hour can make, and a few more. */
export const vehiclesOf = (setup) => Math.ceil(setup.horizon / setup.takt) + 2;

/** The model of the `k`-th vehicle, or null without a mix. */
export const modelAt = (state, k) => (state.setup.models ? state.setup.models[state.day.sequence[k]] : null);

/** Does `model` (null: no mix) take reference `ref`? */
export const uses = (model, ref) => !model || !model.skip.includes(ref);

/** The models the robots know: the vehicle being made and the `frozen` after it. */
export const knownModels = (state) => (state.setup.models ? state.day.sequence.slice(state.produced, state.produced + (state.setup.frozen ?? 0) + 1).map((index) => state.setup.models[index]) : []);

/** The share of the known vehicles that take `ref` (1 without a mix; the vehicles to come keep the same share at the least). */
export function usageOf(state, ref) {
  if (!state.setup.models) return 1;
  const known = knownModels(state);
  return Math.max(0.05, known.filter((model) => uses(model, ref)).length / Math.max(1, known.length));
}

/** A world's sequence: the vehicles made and those known as they are, the ones after drawn again. */
export function worldSequence(state, rng) {
  if (!state.setup.models) return state.day.sequence;
  const known = state.day.sequence.slice(0, state.produced + (state.setup.frozen ?? 0) + 1);
  return [...known, ...drawSequence(rng, state.setup, Math.max(0, state.day.sequence.length - known.length))];
}
