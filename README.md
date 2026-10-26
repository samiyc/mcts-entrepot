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
| `node scripts/compare-merge.js FICHIER…` | une longue mesure faite en morceaux (`compare -- --from N --out FICHIER`), réunie et comparée par paires |
| `npm run line -- [--plan tournee] [--search]` | les règles de la ligne, et la recherche, sur les mêmes heures |
| `node scripts/line-drivers.js` | ce que le cariste apporte à la ligne, ou ce qu'il coûte |
| `npm run check` | le lint, les types et les tests ; le hook le relance avant chaque commit |

Les mesures longues passent par la file de la machine (`mcts-backlog --add-file mcts-entrepot/night.json`).
L'outillage est décrit dans [`docs/outillage.md`](docs/outillage.md), le journal des versions dans la page.

## Deux étages

- **L'affectation** : quel robot prend quelle commande (ou quel bac), et dans quel ordre. C'est là que joue la
  recherche (`mcts` de `mcts-commun`) : une décision chaque fois qu'un robot se libère. Elle tire au sort, dans chacun
  de ses mondes, ce que les robots ne savent pas : les blocages à venir, les ruptures, les modèles des véhicules après
  la séquence connue, les délais de l'entrepôt.
- **Les chemins** : A* dans le temps, avec une table de réservations pour que deux robots ne visent jamais la même case
  au même moment (`grid` de `mcts-commun`).

## Ce que la recherche gagne

Toujours par paires sur les mêmes journées, contre la meilleure règle simple :
- **L'entrepôt** : 26 tours sur le plan de Sami, 14 aux trois quais (les mesures de nuit du 23/10).
- **La ligne cadencée, tournées de 4 bacs** : 59 tours d'arrêt de moins par heure (de 48,9 à 69,6 ; 36 % d'arrêt en
  moins). C'est quand il faut choisir les bacs qui complètent une tournée qu'elle fait le plus la différence.
- **Les lignes bien servies** : rien. Il n'y a presque pas d'arrêt à éviter.

## D'où ça vient

- [`entrepot.md`](https://github.com/samiyc/lopin/blob/main/docs/ismcts-ailleurs/entrepot.md) : le découpage en deux
  étages, l'incertitude, la récompense.
- [`feuille-de-route.md`](https://github.com/samiyc/lopin/blob/main/docs/ismcts-ailleurs/feuille-de-route.md) § 3 :
  la coopération entre un humain et des robots.
