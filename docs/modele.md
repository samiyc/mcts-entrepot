# Le modèle de l'entrepôt, première version (22/10/2026)

Une journée jouée tour par tour, sans recherche encore : des robots, des commandes, des chemins réservés
dans l'espace et le temps, et une allée qui peut se bloquer sans prévenir.

## Ce qui se passe

- **Le plan** est un texte (`src/plans.js`) : `.` le sol, une majuscule un bloc de rayons, `T` le camion,
  `~` une case qui peut se bloquer, `#` un mur. Trois plans pour commencer : un petit entrepôt de 9 × 4, le
  plan de Sami de 17 × 7 avec son couloir de la ligne 2, deux couloirs étroits. La page permet d'en
  dessiner un autre.
- **Les commandes** sont des lettres de blocs, dans l'ordre où elles arrivent ; toutes sont là au départ.
- **Un robot libre** reçoit une commande de la règle, va jusqu'à une case de sol au bord du bloc, prend
  (un tour), rapporte au camion, dépose (un tour).
- **Les chemins** : chaque trajet est un chemin A* dans l'espace et le temps (`grid` de `mcts-commun`),
  réservé autour des chemins déjà réservés. Jamais deux robots dans la même case, jamais deux robots qui se
  croisent ; le camion se partage, mais ses passages sont réservés aussi.
- **Le caché** : l'allée `~` se bloque avec une probabilité donnée, pendant un nombre de tours donné, à un
  tour inconnu. Un robot ne le voit qu'à côté, juste avant d'avancer ; alors tous le savent et l'évitent pour
  la durée du blocage. Un robot pris dedans peut en ressortir.

## Ce qu'on mesure

- **Le tour où la dernière commande est livrée** (l'horizon si certaines restent) : le score principal.
- Les commandes livrées, le tour moyen de livraison, les pas, les attentes, les trajets refaits après un
  blocage.
- Les règles jouent les mêmes journées tirées et se comparent par paires (`npm run compare`).

## Premiers résultats (100 journées par plan)

| Plan | la plus proche | dans l'ordre de la liste | écart |
|---|---|---|---|
| petit entrepôt | 41,0 | 44,8 | la plus proche gagne 3,8 tours (3,3 à 4,3) |
| plan de Sami | 71,1 | 66,3 | la plus proche **perd** 4,8 tours (4,6 à 5,0) |
| deux couloirs | 58,0 | 46,2 | la plus proche **perd** 11,8 tours |

**La commande la plus proche n'est pas la meilleure règle.** Avide, elle sert d'abord ce qui est près du
camion et laisse les commandes lointaines pour la fin, où un seul robot les fait l'une après l'autre. La
liste, elle, mélange près et loin et répartit les longs trajets entre les robots. C'est le piège connu des
règles avides quand on mesure la fin de la journée ; une recherche qui regarde plusieurs affectations à
l'avance devrait l'éviter.

## La suite

1. **L'affectation par la recherche** (`search` de `mcts-commun`) : à chaque robot libre, tirer des journées
   compatibles avec ce qu'on sait (le blocage pas encore vu), comparer les commandes possibles.
2. **Le cariste** : un humain simulé (le plus proche, le plus urgent, au hasard) qui prend ses propres
   commandes, puis un vrai joueur dans la page.
3. **Des commandes qui arrivent pendant la journée**, avec des échéances.
