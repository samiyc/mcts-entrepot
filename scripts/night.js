import { writeFileSync } from "node:fs";

/**
 * `npm run night`: night.json and night-rollout.json, the long measures for the machine's queue (mcts-backlog
 * --add-file, which dates each id), from what a unit cost on the night of 26 to 27/10/2026. mcts-commun asks of its
 * jobs (docs/backlog.md, « Recommandations aux projets », 27/10): half an hour at most, cut in slices with a job that
 * merges them after, an honest estimate and a limit beyond the worst case. A measure whose units take longer is cut in
 * slices of `SLICE` minutes; each slice writes its units (`--out`), the merge makes the table of them (`--merge`) and
 * exits with 1 if some are missing.
 */
const ROOT = new URL("../", import.meta.url);
const SLICE = 25;
const DAYS = 100;

/** The jobs of one measure: `days` units of `cost` minutes (every rule and the search), sliced to `SLICE` minutes. */
function jobsOf({ id, script, args, cost, days = DAYS, folder = "night" }) {
  // As many slices as the units need, their sizes a unit apart at most.
  const count = Math.ceil(days / Math.max(1, Math.floor(SLICE / cost)));
  const minutes = (units) => Math.max(1, Math.ceil(units * cost));
  const job = (jobId, command, units) => ({ id: jobId, command, estimate: `${minutes(units)} min`, limit: Math.max(30, 3 * minutes(units)) });
  const fileOf = (jobId) => `tmp/${folder}/${jobId}.jsonl`;
  const run = ["node", `scripts/${script}`, args].filter(Boolean).join(" ");
  const command = (from, units, jobId) => `${run} --from ${from} --days ${units} --out ${fileOf(jobId)}`;
  if (count === 1) return [job(id, command(1, days, id), days)];
  const sizes = Array.from({ length: count }, (_, i) => Math.floor(days / count) + (i < days % count ? 1 : 0));
  const slices = sizes.map((units, i) => ({ from: 1 + sizes.slice(0, i).reduce((sum, one) => sum + one, 0), units }));
  const ids = slices.map(({ from }) => `${id}-${String(from).padStart(3, "0")}`);
  const merge = { id: `${id}-reunion`, command: `${run} --from 1 --days ${days} --merge ${ids.map(fileOf).join(" ")}`, estimate: "1 min", limit: 10, after: ids };
  return [...slices.map(({ from, units }, i) => job(ids[i], command(from, units, ids[i]), units)), merge];
}

/**
 * A unit's minutes as measured on 28/10/2026 (earlyStop and calm on, the screen before A*): the rules and the search,
 * eighteen measures run together, twice over for a night's load; the higher of that and what the same measure took
 * on 27/10 in the queue, a tenth off for the screen. docs/outillage.md has the table; every measure below takes them
 * (Sami, 28/10/2026), the rollout campaign's aside.
 */
const COSTS = {
  entrepot: { petit: 0.13, sami: 0.47, quais: 1.08, couloirs: 0.36, flux: 0.36, assemblage: 0.59 },
  ligne: { petite: 0.05, sami: 0.19, seul: 0.22, etroite: 0.07, retours: 0.54, tournee: 0.24, melange: 0.15, supermarche: 0.19 },
  usine: 0.28,
  plantRules: { usine: 0.11, train: 0.1 },
  forklift: 0.12,
};

const NIGHT = [
  ...Object.entries(COSTS.entrepot).map(([plan, cost]) => ({ id: `ent-${plan}`, script: "compare.js", args: `--plan ${plan} --search`, cost })),
  ...Object.entries(COSTS.ligne).map(([plan, cost]) => ({ id: `ligne-${plan}`, script: "line-compare.js", args: `--plan ${plan} --search`, cost })),
  { id: "ligne-cariste", script: "line-drivers.js", args: "", cost: COSTS.forklift },
  { id: "usine", script: "plant-compare.js", args: "--plan usine", cost: COSTS.plantRules.usine },
  { id: "usine-train", script: "plant-compare.js", args: "--plan train", cost: COSTS.plantRules.train },
  { id: "usine-train-recherche", script: "plant-compare.js", args: "--plan train --robots 1 --search", cost: COSTS.usine },
];

/** The rollout campaign (26/10, measured again on 27/10 by day): an hour of each line, its rules and both searches. */
const ROLLOUT = [["petite", 0.11], ["etroite", 0.08], ["seul", 0.58], ["melange", 0.54], ["tournee", 0.52], ["sami", 1.38], ["retours", 2.33]]
  .map(([plan, cost]) => ({ id: `ligne-jeu-${plan}`, script: "line-rollout.js", args: `--plan ${plan} --short 30`, cost }));

/**
 * The trials mcts-commun asked of the warehouse (27/10/2026 evening, its docs/essais-projets.md): `earlyStop` paired on
 * the search over 100 hours of the lines where the search wins (tours, the narrow edge, the empties; the search twice,
 * the early one about three quarters of the other), and what `diagnose` says of the other lines, the plant and the
 * warehouse's plans. Three quarters more where the search runs twice.
 */
const ESSAIS = [
  ...["tournee", "etroite", "retours"].map((plan) => ({ id: `essai-arret-${plan}`, script: "line-compare.js", args: `--plan ${plan} --search --early`, cost: Math.round(175 * COSTS.ligne[plan]) / 100 })),
  ...["petite", "sami", "seul", "melange", "supermarche"].map((plan) => ({ id: `essai-diagnose-${plan}`, script: "line-compare.js", args: `--plan ${plan} --search --diagnose`, cost: COSTS.ligne[plan], days: 20 })),
  { id: "essai-diagnose-usine", script: "plant-compare.js", args: "--plan train --robots 1 --search --diagnose", cost: COSTS.usine, days: 20 },
  ...Object.entries(COSTS.entrepot)
    .map(([plan, cost]) => ({ id: `essai-diagnose-${plan}-jour`, script: "compare.js", args: `--plan ${plan} --search --diagnose`, cost, days: 10 })),
].map((measure) => ({ ...measure, folder: "essais" }));

/**
 * The three decisions to adopt (Sami, 27/10/2026: test the early stop, `calm` and more iterations, then make them the
 * default if they hold), each paired on the search of today. The line: `calm` with the early stop, then 128 iterations
 * on top, over 100 hours of each line. The warehouse and the plant have no `calm`: the early stop, then 128 iterations,
 * over 30 days of each plan and 50 hours of the plant. A cost is the search's, three and a quarter times over (the
 * search, the early stop at three quarters at most, 128 iterations at twice), four times where the early stop saved
 * nothing (the warehouse, tried on two days).
 */
const LINE_VARIANTS = "--variant calm=1,earlyStop=1 --variant calm=1,earlyStop=1,budget=128";
const WAREHOUSE_VARIANTS = "--variant earlyStop=1 --variant earlyStop=1,budget=128";
const DECISIONS = [
  ...Object.entries(COSTS.ligne).map(([plan, cost]) => ({ id: `choix-ligne-${plan}`, script: "line-compare.js", args: `--plan ${plan} --search ${LINE_VARIANTS}`, cost: Math.round(325 * cost) / 100 })),
  ...Object.entries(COSTS.entrepot).map(([plan, cost]) => ({ id: `choix-entrepot-${plan}`, script: "compare.js", args: `--plan ${plan} --search ${WAREHOUSE_VARIANTS}`, cost: 4 * cost, days: 30 })),
  { id: "choix-usine", script: "plant-compare.js", args: `--plan train --robots 1 --search ${WAREHOUSE_VARIANTS}`, cost: 4 * COSTS.usine, days: 50 },
].map((measure) => ({ ...measure, folder: "choix" }));

/**
 * Lighter worlds for the search (Sami, 28/10/2026, to test): the legs of the worlds drawn planned fewer turns ahead,
 * paired on the search of today. Two horizons each, above the longest floor distance (20 in the warehouse, 31 on the
 * lines, which the plant's line shares). The search runs three times: three times its cost, less the rules'.
 */
const horizons = (one, other) => `--variant legHorizon=${one} --variant legHorizon=${other}`;
const HORIZON = [
  ...Object.entries(COSTS.entrepot).map(([plan, cost]) => ({ id: `horizon-entrepot-${plan}`, script: "compare.js", args: `--plan ${plan} --search ${horizons(40, 24)}`, cost: Math.round(280 * cost) / 100, days: 30 })),
  ...Object.entries(COSTS.ligne).map(([plan, cost]) => ({ id: `horizon-ligne-${plan}`, script: "line-compare.js", args: `--plan ${plan} --search ${horizons(48, 36)}`, cost: Math.round(280 * cost) / 100 })),
  { id: "horizon-usine", script: "plant-compare.js", args: `--plan train --robots 1 --search ${horizons(48, 36)}`, cost: Math.round(280 * COSTS.usine) / 100, days: 50 },
].map((measure) => ({ ...measure, folder: "horizon" }));

const write = (file, about, measures) => writeFileSync(new URL(file, ROOT), `${JSON.stringify({ about, jobs: measures.flatMap(jobsOf) }, null, 2)}\n`);
write("night.json", "Les mesures de nuit (Sami, 23/10/2026, écrites par npm run night) : la recherche contre les règles, 100 journées par plan de l'entrepôt aux réglages par défaut, 100 heures par ligne, l'usine ; en tranches d'une demi-heure au plus, réunies par un job après elles (mcts-commun, 27/10). mcts-backlog --add-file mcts-entrepot/night.json, puis mcts-backlog.", NIGHT);
write("night-rollout.json", "La règle de jeu de la recherche de la ligne (Sami, 26/10/2026, écrit par npm run night) : jouée par la plus proche ou par la couverture, sur les mêmes 100 heures par plan, et ce qu'en disent les 30 premières (scripts/line-rollout.js) ; en tranches d'une demi-heure au plus. mcts-backlog --add-file mcts-entrepot/night-rollout.json, puis mcts-backlog.", ROLLOUT);
write("essais-commun.json", "Les essais demandés par mcts-commun (27/10/2026 au soir, écrits par npm run night) : earlyStop par paires sur la recherche, 100 heures des tournées, du bord étroit et des bacs vides ; ce que dit diagnose des autres lignes, de l'usine et des plans de l'entrepôt. mcts-backlog --add-file mcts-entrepot/essais-commun.json --tag essais-commun-AAAA-MM-JJ.", ESSAIS);
write("decisions.json", "Les trois décisions à adopter (Sami, 27/10/2026, écrites par npm run night) : l'arrêt anticipé, calm et 128 itérations, chacun par paires sur la recherche d'aujourd'hui ; 100 heures par ligne, 30 journées par plan de l'entrepôt, 50 heures de l'usine. mcts-backlog --add-file mcts-entrepot/decisions.json --tag decisions-AAAA-MM-JJ.", DECISIONS);
write("horizon.json", "Des mondes plus légers pour la recherche (Sami, 28/10/2026, écrits par npm run night) : les chemins des mondes tirés planifiés moins loin, deux horizons par paires sur la recherche d'aujourd'hui ; 30 journées par plan de l'entrepôt, 100 heures par ligne, 50 heures de l'usine. mcts-backlog --add-file mcts-entrepot/horizon.json --tag horizon-AAAA-MM-JJ.", HORIZON);
console.log("night.json, night-rollout.json, essais-commun.json, decisions.json, horizon.json");
