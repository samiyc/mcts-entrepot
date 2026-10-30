# La revue qualité (30/10/2026)

Sami (30/10 au soir) : « lance la relecture du code », sur la grille de mcts-commun (`docs/feuille-de-route.md`,
§ 2.A) : la doc contre le code, les tests et leur couverture, les `eslint-disable`, les exports morts, les copies de la
lib, la graine et l'intervalle de chaque mesure. Chaque écart est classé comme chez lopin
(`docs/ecarts-spec-dev-test.md`) :
- **P0** : un résultat faux ;
- **P1** : un défaut du modèle, ou un trou de test sur ce qui décide ;
- **P2** : une dette qui coûte (du temps, des doublons) ;
- **P3** : à noter.

Les P0 et P1 sont corrigés ou proposés à Sami ; les P2 et P3 sont listés.

## Ce qui a été trouvé

| # | Classe | Écart | État |
|---|---|---|---|
| 1 | P1 | **Un relais annulé repart aussitôt, souvent avec la même paire** (`src/day-relays.js`, `relays`) : `callOff` puis `relayPair` dans le même tour. Sur six journées tracées, la même paire repart trois fois (trois quais 32 et 39, deux fois de suite au 39). La patience de 20 tours se répète sans rien changer. Toutes les commandes finissent livrées. | corrigé le 30/10 (Sami : « ok à corriger ») : une paire annulée ne repart pas avant 20 tours. Sur 100 journées de chaque plan sous les quatre règles, 2 journées changent (trois quais, la plus proche : fin 260,3 → 260,1), toutes livrées ; aucune empreinte ne bouge, le test des relais annulés le vérifie |
| 2 | P1 | **L'arbre de la recherche de la ligne ne tournait dans aucun test** (`problemFor` de `src/line-search.js`) : avec `calm`, l'heure courte de l'empreinte et du test (240 tours) ne cherchait jamais par un arbre. | corrigé : 360 tours, 8 arbres ; le test l'exige, l'empreinte de la ligne le tient (`464e4022bc9e5ec4`) |
| 3 | P1 | **L'arbre de la recherche de l'usine ne tournait dans aucun test** (`src/plant-search.js`). Elle cherche rarement : 0 arbre dans les heures du test, 10 dans l'heure 2 de la navette à heure fixe. | corrigé : un test sur cette heure, la même deux fois |
| 4 | P1 | **L'annulation d'un relais n'était pas testée** (`callOff`, `backToFetch`), alors qu'un défaut du 30/10 venait de là. | corrigé : trois journées où un relais est annulé, aucune commande sans robot |
| 5 | P1 | **La règle `lineCover` de l'usine n'avait aucun test.** | corrigé le 30/10 (557af95) |
| 6 | P2 | **Les distances au sol** (`distancesNow`, `src/warehouse.js`) refont en `Map` à clés texte ce que `createDistances` de la lib fait en `Int32Array`. | à essayer, empreintes identiques exigées |
| 7 | P3 | **Deux exports que rien n'appelle** : `compareLineRules` (`src/line-rules.js`) et l'alias `PLANT_RULES` (`src/plant.js`). | à retirer quand la file est vide |
| 8 | P3 | **Des exports utilisés seulement dans leur module** : `stationBlock`, `binsOnLine`, `HUMAN`, `formatOf`, `stoppedLane`, `menuOf`, `replayFile`, `STATUS_LABELS`. | à garder ou à dé-exporter, sans effet |
| 9 | P3 | **La graine de chaque décision** se mélange de la même façon dans les trois recherches (`Math.imul(seed, 0x9e3779b1) + t × 131 + …`, `search.js`, `line-search.js`, `plant-search.js`). `streamOf` de la lib est presque la même ; y passer changerait toutes les empreintes. | noté (déjà dans `outillage.md`) |
| 10 | P3 | **La moyenne** est écrite trois fois (`src/rules.js`, `src/line-rules.js`, `scripts/format.js`). La lib n'en a pas. | noté |
| 11 | P3 | **`npm run types`** tourne sans `strict` (`tsconfig.json`), et `src/` a peu de JSDoc (34 balises) : les types sont surtout déduits. | noté |
| 12 | P3 | **`scripts/search-bench.js`** part toujours de la journée 1 (pas de `--from`) ; les autres scripts de mesure prennent `--from`, `--days` et rendent un intervalle. | noté |
| 13 | — | La doc contre le code : six écarts, corrigés le 30/10 (557af95) : les gains du README, les six empreintes, les commandes de l'usine et de la nuit, des étapes faites encore « à faire ». | corrigé |

**« 2 cases réservées deux fois »**, signalé par la file pendant `regle-assemblage-021` : les deux dans des mondes de la
recherche (`overbookedInClone` de la trace), aucune dans la vraie journée. Noté pour `mcts-commun`.

**Aucun `eslint-disable`**, aucun `ts-ignore`, aucun TODO dans `src/` et `web/`, aucun `Math.random` : tout est tiré
d'une graine.

## La couverture

`node --test --experimental-test-coverage` (sous `--slot 4`), avant les tests ajoutés ce soir : **93 % des lignes,
91 % des branches, 90 % des fonctions**. `src/` est à 100 % des lignes, sauf :

| Module | Lignes | Ce qui manquait |
|---|---|---|
| `src/plant-search.js` | 74 % | l'arbre (`shortlistOf`, `problemFor`) : écart 3 |
| `src/line-search.js` | 80 % | l'arbre : écart 2 |
| `src/line-rules.js` | 80 % | `compareLineRules` : écart 7 |
| `src/day-relays.js` | 89 % | l'annulation d'un relais : écart 4 |
| `src/line-supermarket.js` | 92 % | les mondes avec une file de préparateurs (`pickersAfter`) |

Dans `web/`, ce qui manque est le dessin et l'écoute de la page (`dom.js`, `menus.js`, `models.js`), vérifiés dans
Chrome le 30/10 : chaque onglet, chaque plan sous chaque règle joué jusqu'au bout, sans erreur.

## La graine et l'intervalle de chaque mesure

Chaque script de mesure joue les mêmes journées ou heures pour toutes les règles, à partir d'une graine (`--from`), et
rend l'écart par paires avec son intervalle à 95 % (`paired` de la lib) : `compare.js`, `line-compare.js`,
`plant-compare.js`, `line-drivers.js`, `line-rollout.js`, `line-stock.js`. Les variantes (`--variant`) se comparent
par paires sur la recherche, mêmes unités. Seul `search-bench.js` n'a pas de `--from` (écart 12).
