# Le modèle de l'entrepôt, première version (22/10/2026)

Une journée jouée tour par tour : des robots, des commandes, des chemins réservés dans l'espace et le
temps, une allée qui peut se bloquer sans prévenir, trois règles de référence et, depuis le soir du 22/10,
l'affectation par la recherche (plus bas).

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

(Ces chiffres datent d'avant la correction du 23/10, plus bas : dans les couloirs, la plus proche finit
désormais au tour 49,0.)

**La commande la plus proche n'est pas la meilleure règle.** Avide, elle sert d'abord ce qui est près du
camion et laisse les commandes lointaines pour la fin, où un seul robot les fait l'une après l'autre. La
liste, elle, mélange près et loin et répartit les longs trajets entre les robots. C'est le piège connu des
règles avides quand on mesure la fin de la journée ; une recherche qui regarde plusieurs affectations à
l'avance devrait l'éviter.

Une troisième règle, ajoutée le soir pour juger la recherche honnêtement : **la plus lointaine d'abord**,
la règle classique de l'ordonnancement pour finir tôt (le travail le plus long d'abord, *LPT*). Les longs
trajets partent au début et se répartissent entre les robots ; elle bat la liste partout (36,8, 60,2 et
46,0 sur 30 journées).

## La recherche (22/10, `src/search.js`)

**Comment elle joue.** Chaque fois qu'un robot libre a au moins deux commandes possibles, `search` de
`mcts-commun` joue des journées compatibles avec ce que savent les robots : le blocage pas encore vu est
retiré au sort (s'il arrive, et quand, après maintenant) ; un blocage vu reste tel quel. Elle choisit
parmi 5 commandes : les 3 plus proches, la première de la liste, la plus lointaine. L'arbre va deux choix
plus loin (ce robot, puis le suivant qui se libère), puis la liste joue jusqu'au bout de la journée. Une
journée est notée sur le tour de la dernière livraison plus un quart du tour moyen de livraison, comparé à
ce que fait la liste depuis le même point. 64 itérations par choix, sur des mondes communs (la k-ième
visite de chaque commande joue la même journée).

**Ce qu'elle donne** (`scripts/search-bench.js`, 30 journées par plan, les mêmes pour toutes les règles).
Le tour où la dernière commande est livrée, plus bas c'est mieux :

| Plan | la plus proche | la liste | la plus lointaine | recherche | recherche sur la plus lointaine |
|---|---|---|---|---|---|
| petit entrepôt | 40,7 | 44,7 | 36,8 | **36,5** | +0,3 tour (−0,2 à +0,9) |
| plan de Sami | 71,1 | 66,5 | 60,2 | **57,3** | **+2,9 tours (+2,8 à +3,1)**, 30 journées sur 30 |
| deux couloirs | 49,0 | 46,2 | 41,0 | **37,0** | **+4,0 tours (+4,0 à +4,0)**, 30 journées sur 30 |

Chiffres refaits le 23/10 après la correction des cases de ramassage (plus bas) : elle ne change que les
couloirs, où les règles finissent plus tôt (la plus lointaine 46,0 → 41,0) ; l'avance de la recherche y passe
de 9 à 4 tours.

- **La recherche finit avant les trois règles**, et de loin sur les couloirs étroits, où une affectation
  mal pensée fait attendre les robots les uns derrière les autres.
- **Elle livre aussi plus tôt en moyenne** : la plus lointaine d'abord finit tôt mais fait attendre les
  commandes proches (tour moyen 27,4 sur le petit entrepôt, 44,2 sur le plan de Sami, 36,5 dans les couloirs) ; la
  recherche, 21,9, 35,2 et 19,8.
- Ses réglages par défaut sont les meilleurs essayés : explorer moins (0,15), noter plus serré (10) ou
  doubler le budget (128) ne font pas mieux.
- Chaque choix de la recherche prend une centaine de millisecondes ; une journée, 1 à 4 s.

## Les quais, les camions et les bornes (23/10, Sami)

Sami a redessiné son entrepôt (le plan **« Trois quais »**, 22 × 7) :

```
.....................#
c.AAA.BBB.CCC.DDD.wwwT
c....~~~~~...........#
..EEE.FFF.GGG.HHH.wwwT
c....................#
c.III.JJJ.KKK.LLL.wwwT
.....................#
```

- **`c` une borne de charge** : chaque robot part de la sienne, à gauche dans le hangar, et y retourne
  quand il n'a rien à faire. En chemin, il peut encore recevoir une commande. Plus de robots que de bornes :
  elles se partagent. Un plan sans `c` fait partir les robots du camion, comme avant.
- **`T` un quai, `w` sa baie** : les cases devant la porte. Les commandes se répartissent entre les camions
  par `/` (`AFKD/EJCH/IBGL`, les quais de haut en bas), et chaque camion arrive à son tour (20, 40, 60).
  - Une commande se prépare **avant** son camion : la palette attend sur une case de la baie, une palette
    par case, et elle est chargée quand le camion arrive.
  - Une commande ne se prend que s'il reste une case libre dans sa baie (elle la réserve en partant), ou
    si son camion est déjà là, auquel cas la palette est chargée dès qu'elle est posée.
  - La baie se remplit depuis le camion, pour que l'allée qui y mène reste libre.
- **`#` le mur, ou l'extérieur** entre les camions.
- **La mesure : l'attente des camions**, la somme, pour chaque camion, des tours entre son arrivée et sa
  dernière palette. Avec un seul camion là dès le départ, c'est le tour de la fin, comme avant : les trois
  premiers plans et leurs chiffres ne bougent pas (vérifié, même empreinte). La recherche se juge sur cette
  attente, son échelle multipliée par le nombre de camions.
- **Une quatrième règle** pour juger honnêtement : **le camion attendu d'abord**, la commande la plus
  proche parmi celles du camion qui arrive le premier.

**Ce que ça donne** (30 journées, attente des camions en tours ; les journées se ressemblent presque toutes,
le blocage ne changeant presque rien sur ce plan) :

| la plus proche | la plus lointaine | le camion attendu d'abord | la liste | recherche |
|---|---|---|---|---|
| 84,1 | 134,1 | 67,9 | 39,0 | **32,0** (8 journées sur 8, +7 tours sur la liste) |

- **La liste gagne parmi les règles**, parce qu'elle est écrite dans l'ordre des camions et qu'elle mélange
  près et loin. « Le camion attendu d'abord » perd 29 tours sur elle : prendre d'abord les commandes proches
  de chaque camion laisse les lointaines pour la fin.
- **La plus lointaine d'abord**, la meilleure règle des premiers plans, est **la pire ici** : elle ignore
  les camions.
- **Avec 3 cases par baie et 4 commandes par camion**, la quatrième commande de chaque camion ne peut partir
  qu'à son arrivée. C'est ce qui rend la décision intéressante : quoi préparer à l'avance.
- La recherche notait d'abord comme la liste, coup pour coup : avec trois camions, ses écarts dépassaient son
  échelle (20 tours) et chaque monde valait 0 ou 1. Avec l'échelle multipliée par le nombre de camions, elle
  gagne 7 tours.

**Une correction au passage.** Un robot garé pour de bon sur la case de ramassage d'un bloc empêchait les
autres d'aller y chercher : leur trajet échouait, et ils restaient sur place toute la journée. Le robot
essaie maintenant les autres cases du bloc, de la plus proche à la plus lointaine. Un trajet de dépôt qu'on
ne trouve pas tout de suite est retenté à chaque tour. Cela ne changeait que les couloirs (tableau plus haut).

## La suite

1. **Le cariste** : un humain simulé (le plus proche, le plus urgent, au hasard) qui prend ses propres
   commandes, puis un vrai joueur dans la page. Sami (23/10) : le déplacer au clavier, Z Q S D et E pour
   prendre et déposer, comme le chef de la cuisine.
2. **Des commandes qui arrivent pendant la journée**, avec des échéances.
