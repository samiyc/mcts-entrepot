# mcts-entrepot

Des robots qui portent des charges sur une grille, une recherche (ISMCTS) qui leur répartit le travail en
imaginant ce qui peut arriver, et une personne au milieu d'eux. Deux simulations, chacune dans un onglet de la page :

- **L'entrepôt** : les robots vont chercher les commandes dans les rayons et les portent aux camions. Ils passent par
  les quais et leurs zones d'attente, où un chargeur humain met les palettes dans les camions, et des relais entre
  robots. Une allée peut se bloquer sans prévenir. Un poste d'assemblage, où un spécialiste câble ou met en colis les pièces que les robots lui apportent.
  La mesure : le temps à quai des camions ([`docs/modele.md`](docs/modele.md)).
- **La ligne cadencée** (26/10/2026) : une ligne d'assemblage automobile au takt de Toyota (un véhicule toutes les
  55 s). Les robots apportent les bacs du supermarché au bord de ligne. S'il manque une pièce à un poste, toute la
  ligne s'arrête ; la mesure, c'est l'arrêt de la ligne. La ligne a aussi :
  - des tournées de plusieurs bacs, et le retour des bacs vides ;
  - deux modèles de véhicules mêlés, essence et hybride ;
  - des ruptures fournisseur, et un supermarché réapprovisionné par l'entrepôt ;
  - un cariste au clavier ([`docs/modele-ligne.md`](docs/modele-ligne.md)).
- **L'usine** (26/10/2026) : les deux ensemble, sur une seule horloge. Le supermarché de la ligne commande à
  l'entrepôt, dont les robots préparent la palette ; une navette la lui apporte, à la demande ou à heure fixe
  (`src/plant.js`, `npm run plant`).

Les données réelles, le glossaire des termes de l'industrie et la feuille de route sont dans
[`docs/recherche/`](docs/recherche/README.md). Les chiffres que les sources ne donnent pas, et les questions à poser
au terrain, sont dans [`docs/recherche/hypotheses.md`](docs/recherche/hypotheses.md).

## Lancer

| Commande | Ce qu'elle fait |
|---|---|
| `npm run page` | la page, http://127.0.0.1:4802/web/ : Entrepôt, Ligne cadencée, Usine, Comparaisons, Replays, Stats |
| `npm run compare -- [--plan sami] [--search]` | les règles de l'entrepôt, et la recherche, sur les mêmes journées |
| `npm run line -- [--plan tournee] [--search] [--diagnose] [--early]` | les règles de la ligne, et la recherche, sur les mêmes heures ; ce que voient ses recherches, et l'arrêt anticipé par paires |
| `npm run plant -- [--plan train] [--robots N] [--search]` | l'usine : les règles de l'entrepôt, et sa recherche, sur les mêmes heures |
| `node scripts/line-drivers.js` | ce que le cariste apporte à la ligne, ou ce qu'il coûte |
| `npm run night` | `night.json`, `night-rollout.json`, `essais-commun.json`, `decisions.json`, `horizon.json`, `diagnose.json` et `palier.json`, les mesures longues pour la file, en tranches d'une demi-heure au plus |
| `npm run check` | le lint, les types et les tests ; le hook le relance avant chaque commit |

Les mesures longues passent par la file de la machine (`mcts-backlog --add-file mcts-entrepot/night.json`). Chaque
script de mesure prend `--from N --days D --out FICHIER` (une ligne JSON par journée ou par heure) et
`--merge FICHIER…`, qui réunit les tranches en un seul tableau ([`docs/outillage.md`](docs/outillage.md), « Les jobs de
la file »).
L'outillage est décrit dans [`docs/outillage.md`](docs/outillage.md), le journal des versions dans la page.
La revue qualité (la doc, les tests, la lib, les mesures) est dans [`docs/qualite.md`](docs/qualite.md).

## Deux étages

- **L'affectation** : quel robot prend quelle commande (ou quel bac), et dans quel ordre. C'est là que joue la
  recherche (`mcts` de `mcts-commun`) : une décision chaque fois qu'un robot se libère. Elle tire au sort, dans chacun
  de ses mondes, ce que les robots ne savent pas : les blocages à venir, les ruptures, les modèles des véhicules après
  la séquence connue, les délais de l'entrepôt.
- **Les chemins** : A* dans le temps, avec une table de réservations pour que deux robots ne visent jamais la même case
  au même moment (`grid` de `mcts-commun`).

## Ce que la recherche gagne

Toujours par paires sur les mêmes journées, contre la meilleure règle simple (la nuit du 30/10, 100 journées ou
100 heures par plan) :
- **L'entrepôt** : 4,4 tours sur le plan de Sami, 4,1 au flux, 2,2 aux couloirs ; aux trois quais, 50,7 tours à quai
  des camions de moins. À l'assemblage, son gain (3,2) n'est pas sûr.
- **La ligne cadencée, tournées de 4 bacs** : 47,6 tours d'arrêt de moins par heure (de 36,2 à 58,9 ; 31 % d'arrêt en
  moins). C'est quand il faut choisir les bacs qui complètent une tournée qu'elle fait le plus la différence. Sur la
  ligne à un robot : 15,3.
- **Les lignes bien servies** : rien. Il n'y a presque pas d'arrêt à éviter.

## D'où ça vient

- [`entrepot.md`](https://github.com/samiyc/lopin/blob/main/docs/ismcts-ailleurs/entrepot.md) : le découpage en deux
  étages, l'incertitude, la récompense.
- [`feuille-de-route.md`](https://github.com/samiyc/lopin/blob/main/docs/ismcts-ailleurs/feuille-de-route.md) § 3 :
  la coopération entre un humain et des robots.
