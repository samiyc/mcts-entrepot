# mcts-entrepot

Des robots d'entrepôt qui portent des colis du stock au camion, avec un cariste humain qui prend ses
propres commandes. Les robots ne le commandent pas : ils devinent ce qu'il va faire et replanifient à
chaque événement.

Statut (22/10/2026) : pas commencé. C'est l'étape 3 de la
[feuille de route](https://github.com/samiyc/lopin/blob/main/docs/ismcts-ailleurs/feuille-de-route.md),
avant la cuisine, qui reprendra le même moteur de grille.

## Deux étages

- **L'affectation** : quel robot prend quelle commande, et dans quel ordre. C'est là que vit la recherche
  (`mcts` de `mcts-commun`), avec une décision chaque fois qu'un robot se libère. La profondeur de l'arbre
  est le nombre de commandes, pas le nombre de pas.
- **Les chemins** : A* dans le temps, avec une table de réservations pour que deux robots ne visent pas la
  même case au même moment (`grid` de `mcts-commun`). Pas de pas de grille dans l'arbre : 4 robots à
  6 actions chacun font 1 296 actions jointes par tour.

## Le premier scénario

Le plan de Sami, 17 × 7 cases, le camion au bord droit :
- 4 robots, tous au camion au départ ;
- 12 commandes, une par bloc de stock : aller au bord du bloc, prendre, revenir déposer au camion ;
- une allée bloquée avec une probabilité de 0,2, pendant 10 tours, découverte en arrivant (le problème du
  voyageur canadien) ;
- la fin à 120 tours ; on compte les commandes livrées, moins les retards.

## La démarche

1. **Un simulateur de grille** pur et testé : le plan, les robots, les commandes, les blocages tirés au
   hasard.
2. **Des règles de référence** : la commande la plus proche, la plus ancienne.
3. **L'affectation par la recherche**, jugée contre elles, par paires, sur les mêmes journées.
4. **Le cariste** : un humain simulé (celui qui prend la commande la plus proche, la plus urgente, ou au
   hasard), puis un vrai joueur dans la page.

## D'où ça vient

- [`entrepot.md`](https://github.com/samiyc/lopin/blob/main/docs/ismcts-ailleurs/entrepot.md) : le
  découpage en deux étages, l'incertitude, la récompense, le plan pas à pas, ce qui existe déjà (le MAPF).
- [`feuille-de-route.md`](https://github.com/samiyc/lopin/blob/main/docs/ismcts-ailleurs/feuille-de-route.md)
  § 3 : la coopération entre un humain et des robots.
