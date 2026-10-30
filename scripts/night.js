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
 * (Sami, 28/10/2026), the rollout campaign's aside. The same evening, mcts-commun's faster A* (2f5554f) and Node 24:
 * each cost times what the same measure now takes against the morning's (0.29 to 0.62), 0.6 where none was taken.
 */
const COSTS = {
  entrepot: { petit: 0.08, sami: 0.29, quais: 0.47, couloirs: 0.11, flux: 0.18, assemblage: 0.31 },
  ligne: { petite: 0.03, sami: 0.12, seul: 0.14, etroite: 0.05, retours: 0.2, tournee: 0.15, melange: 0.09, supermarche: 0.12 },
  usine: 0.18,
  plantRules: { usine: 0.07, train: 0.06 },
  forklift: 0.08,
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

/**
 * What diagnose says of the search as it plays today (Sami, 28/10/2026): the count of 27/10 mixed the diagnose before
 * and after mcts-commun a2c66bd (a close call judged on the margin, too few iterations silent once the early stop
 * settled), and its searches ran without earlyStop and calm. Every line over 20 hours, the plant over 20, each
 * warehouse plan over 10 days.
 */
const DIAGNOSE = [
  ...Object.entries(COSTS.ligne).map(([plan, cost]) => ({ id: `diagnose-ligne-${plan}`, script: "line-compare.js", args: `--plan ${plan} --search --diagnose`, cost, days: 20 })),
  { id: "diagnose-usine", script: "plant-compare.js", args: "--plan train --robots 1 --search --diagnose", cost: COSTS.usine, days: 20 },
  ...Object.entries(COSTS.entrepot).map(([plan, cost]) => ({ id: `diagnose-entrepot-${plan}`, script: "compare.js", args: `--plan ${plan} --search --diagnose`, cost, days: 10 })),
].map((measure) => ({ ...measure, folder: "diagnose" }));

/**
 * The step up to measure (Sami, 28/10/2026, mcts-commun docs/reglages.md « Le palier à mesurer »): today's search (A)
 * against four times its budget (B), 8 moves at the root (C), a tree of 3 with twice the budget (D), and all of them
 * with one more move below and the progressive widening (E), by pairs, with diagnose. Each measure costs `PALIER_COST`
 * times a unit of today's (the trial of 28/10 evening); 30 days a warehouse plan, 30 hours a line, 50 of the plant:
 * an hour of the whole machine at most.
 */
const PALIER_COST = 12;
const PALIER_VARIANTS = "--diagnose --variant budget=256 --variant rootWidth=8 --variant budget=128,depth=3 --variant budget=256,rootWidth=8,width=6,depth=3,widening=1";
const step = (cost) => Math.round(100 * PALIER_COST * cost) / 100;
const PALIER = [
  ...Object.entries(COSTS.entrepot).map(([plan, cost]) => ({ id: `palier-entrepot-${plan}`, script: "compare.js", args: `--plan ${plan} --search ${PALIER_VARIANTS}`, cost: step(cost), days: 30 })),
  ...Object.entries(COSTS.ligne).map(([plan, cost]) => ({ id: `palier-ligne-${plan}`, script: "line-compare.js", args: `--plan ${plan} --search ${PALIER_VARIANTS}`, cost: step(cost), days: 30 })),
  { id: "palier-usine", script: "plant-compare.js", args: `--plan train --robots 1 --search ${PALIER_VARIANTS}`, cost: step(COSTS.usine), days: 50 },
].map((measure) => ({ ...measure, folder: "palier" }));

/**
 * The line's rollout and the assembly's budget (Sami, 30/10/2026: "ok pour le défaut + mesure", "ok pour les mesures sur
 * l'assemblage"): the search played by the shortest cover, now the default, against the nearest, 100 hours of each
 * line; the assembly's search at 128 and 256 iterations against 64, over 100 days drawn. The search runs twice (the
 * line), seven times its share (the assembly: 1, 2 and 4).
 */
const REGLE = [
  ...Object.entries(COSTS.ligne).map(([plan, cost]) => ({ id: `regle-ligne-${plan}`, script: "line-compare.js", args: `--plan ${plan} --search --variant rollout=nearest`, cost: Math.round(200 * cost) / 100 })),
  { id: "regle-assemblage", script: "compare.js", args: "--plan assemblage --search --variant budget=128 --variant budget=256", cost: Math.round(700 * COSTS.entrepot.assemblage) / 100 },
].map((measure) => ({ ...measure, folder: "regle" }));

const write = (file, about, measures) => writeFileSync(new URL(file, ROOT), `${JSON.stringify({ about, jobs: measures.flatMap(jobsOf) }, null, 2)}\n`);
write("night.json", "Les mesures de nuit (Sami, 23/10/2026, écrites par npm run night) : la recherche contre les règles, 100 journées par plan de l'entrepôt aux réglages par défaut, 100 heures par ligne, l'usine ; en tranches d'une demi-heure au plus, réunies par un job après elles (mcts-commun, 27/10). mcts-backlog --add-file mcts-entrepot/night.json, puis mcts-backlog.", NIGHT);
write("night-rollout.json", "La règle de jeu de la recherche de la ligne (Sami, 26/10/2026, écrit par npm run night) : jouée par la plus proche ou par la couverture, sur les mêmes 100 heures par plan, et ce qu'en disent les 30 premières (scripts/line-rollout.js) ; en tranches d'une demi-heure au plus. mcts-backlog --add-file mcts-entrepot/night-rollout.json, puis mcts-backlog.", ROLLOUT);
write("essais-commun.json", "Les essais demandés par mcts-commun (27/10/2026 au soir, écrits par npm run night) : earlyStop par paires sur la recherche, 100 heures des tournées, du bord étroit et des bacs vides ; ce que dit diagnose des autres lignes, de l'usine et des plans de l'entrepôt. mcts-backlog --add-file mcts-entrepot/essais-commun.json --tag essais-commun-AAAA-MM-JJ.", ESSAIS);
write("decisions.json", "Les trois décisions à adopter (Sami, 27/10/2026, écrites par npm run night) : l'arrêt anticipé, calm et 128 itérations, chacun par paires sur la recherche d'aujourd'hui ; 100 heures par ligne, 30 journées par plan de l'entrepôt, 50 heures de l'usine. mcts-backlog --add-file mcts-entrepot/decisions.json --tag decisions-AAAA-MM-JJ.", DECISIONS);
write("horizon.json", "Des mondes plus légers pour la recherche (Sami, 28/10/2026, écrits par npm run night) : les chemins des mondes tirés planifiés moins loin, deux horizons par paires sur la recherche d'aujourd'hui ; 30 journées par plan de l'entrepôt, 100 heures par ligne, 50 heures de l'usine. mcts-backlog --add-file mcts-entrepot/horizon.json --tag horizon-AAAA-MM-JJ.", HORIZON);
write("diagnose.json", "Ce que dit diagnose de la recherche telle qu'elle joue aujourd'hui (Sami, 28/10/2026, écrit par npm run night) : le diagnose corrigé de mcts-commun (a2c66bd), avec earlyStop et calm par défaut ; 20 heures par ligne et de l'usine, 10 journées par plan de l'entrepôt. mcts-backlog --add-file mcts-entrepot/diagnose.json --tag diagnose-AAAA-MM-JJ.", DIAGNOSE);
write("palier.json", "Le palier de réglages à mesurer (Sami, 28/10/2026, écrit par npm run night ; mcts-commun docs/reglages.md) : la recherche d'aujourd'hui contre un budget ×4, 8 coups à la racine, une profondeur de 3 à budget ×2, et tout ensemble, par paires avec diagnose ; 30 journées par plan de l'entrepôt, 30 heures par ligne, 50 heures de l'usine. mcts-backlog --add-file mcts-entrepot/palier.json --tag palier-AAAA-MM-JJ.", PALIER);
write("regle.json", "La règle de jeu de la ligne et le budget de l'assemblage (Sami, 30/10/2026, écrit par npm run night) : la recherche de la ligne jouée par la couverture, le nouveau défaut, contre la plus proche, 100 heures par ligne ; la recherche de l'assemblage à 128 et 256 itérations contre 64, 100 journées. mcts-backlog --add-file mcts-entrepot/regle.json --tag regle-AAAA-MM-JJ.", REGLE);
console.log("night.json, night-rollout.json, essais-commun.json, decisions.json, horizon.json, diagnose.json, palier.json, regle.json");
