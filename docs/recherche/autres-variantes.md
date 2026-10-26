# D'autres variantes

Sami (26/10/2026) : « Autre variantes ? ». Deux types sont déjà nommés : la logistique (Ulog, Amazon), commencée, et
la production (Airbus, Intel, Haimer, WMG), à venir. En voici d'autres. Pour chacune : ce qu'elle ajoute au modèle, et
ce qu'elle reprend de ce qui existe. Les termes sont dans [glossaire.md](glossaire.md), les sources dans les autres
fichiers du dossier.

## Le cross-dock

Les camions arrivent pleins, et leurs palettes repartent presque aussitôt dans d'autres camions, sans être stockées.
- **Ce qu'elle ajoute** : des camions à décharger autant qu'à charger, aux mêmes portes ; des palettes qui n'existent
  qu'à l'arrivée de leur camion, à une heure incertaine (le retard d'un transporteur est l'aléa caché) ; un tri par
  destination.
- **Ce qu'elle reprend** : les quais, les zones de pré-chargement, les chargeurs, la file au camion. C'est la plus
  proche du modèle actuel ; elle ne demande presque que la réception.

## L'entrepôt frigorifique

La chaîne du froid : des zones à températures différentes, et un temps maximal hors du froid.
- **Ce qu'elle ajoute** : une **échéance par palette** (le temps passé hors de sa zone) ; des portes entre les zones,
  qui sont des passages lents ; le FEFO plutôt que le FIFO ; des commandes à plusieurs températures, préparées dans
  l'ordre de la plus chaude à la plus froide.
- **Ce qu'elle reprend** : tout le modèle, avec un compteur de plus par palette et un coût quand il dépasse.

## La préparation e-commerce (goods-to-person)

Le stock vient au préparateur : des robots apportent les étagères ou les bacs à des stations fixes, où un humain
prélève (le Kiva d'Amazon, AutoStore).
- **Ce qu'elle ajoute** : des **stations humaines** comme ressource rare (une station sert 120 à 300 prélèvements par
  heure selon les sources) ; beaucoup de petites commandes, qui arrivent toute la journée ; le choix de quelle étagère
  apporter à quelle station, et dans quel ordre.
- **Ce qu'elle reprend** : les robots porteurs, les chemins réservés, les règles d'affectation. Le rôle du camion passe
  à la station.

## La pharmacie hospitalière

Le pont vers mcts-urgences : un robot ou un coursier porte les médicaments et les prélèvements entre la pharmacie, le
laboratoire et les services.
- **Ce qu'elle ajoute** : des **urgences** (un médicament pour un patient en SAUV passe avant tout) ; la traçabilité
  par lot ; des produits au froid.
- **Ce qu'elle reprend** : les chemins et les règles. Elle pourrait partager ses patients avec mcts-urgences, chaque
  dépôt restant seul juge de son modèle.

## L'atelier de maintenance aéronautique (MRO)

Un hangar où l'on révise des avions, et un atelier où l'on répare leurs pièces tournantes.
- **Ce qu'elle ajoute** : le **travail découvert en route** (une inspection révèle une réparation imprévue : c'est
  l'aléa caché) ; des pièces de rechange qui manquent ; un avion cloué au sol (AOG) qui passe devant tout ; des
  techniciens habilités par type de travail.
- **Ce qu'elle reprend** : l'ordonnancement de l'atelier ([feuille-de-route.md](feuille-de-route.md)), avec l'avion
  comme poste de travail immobile et les robots qui y portent les pièces.

## La ligne cadencée et son bord de ligne

La ligne d'assemblage (l'A320) : un poste qui manque d'une pièce arrête la ligne au takt suivant.
- **Ce qu'elle ajoute** : une **échéance par poste et par takt** ; le *kitting* (préparer le lot de pièces d'un poste) ;
  des pièces qui manquent chez un fournisseur.
- **Ce qu'elle reprend** : le magasin est l'entrepôt actuel ; les camions deviennent les postes de la ligne. C'est
  peut-être **le pont le plus simple** entre l'entrepôt et la production : on garde tout, et on remplace « le camion
  attend » par « la ligne s'arrête ».

## Laquelle d'abord

| Variante | Proche du modèle | Ce que la recherche peut y gagner | Effort |
|---|---|---|---|
| Ligne cadencée et bord de ligne | très | anticiper les pièces des postes à venir, malgré les retards | faible |
| Cross-dock | très | l'ordre de déchargement, malgré les retards des camions | faible |
| Entrepôt frigorifique | très | l'ordre de préparation, sous l'échéance du froid | faible |
| Atelier d'usinage (job shop) | moyen | les OF autour du goulot, les pannes, les rejets, les outils rares | moyen |
| Goods-to-person | moyen | l'ordre des étagères aux stations | moyen |
| MRO | loin | le travail découvert, les pièces qui manquent | fort |
| Pharmacie hospitalière | loin | les urgences parmi le courant | moyen, avec mcts-urgences |

La feuille de route propose l'**atelier d'usinage**, parce que c'est ce que Sami demande : l'ordonnancement et les
ressources rares plutôt que les trajets. La **ligne cadencée** pourrait passer avant, comme marchepied : elle garde
tout l'entrepôt et y ajoute seulement des échéances par poste. C'est à Sami de choisir
([feuille-de-route.md](feuille-de-route.md), « Les choix à faire »).
