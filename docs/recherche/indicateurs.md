# Les indicateurs

Sami (26/10/2026) : rapprocher la simulation des mesures réelles. Ce fichier liste ce que mesurent les usines et les
entrepôts, ce que le simulateur compte déjà, et ce qu'il ajoutera, pour comparer les stratégies d'ordonnancement. Les
définitions sont dans [glossaire.md](glossaire.md), les sources dans [logistique.md](logistique.md),
[production.md](production.md) et [aleas-qualite.md](aleas-qualite.md).

## L'entrepôt

| Indicateur réel | Déjà compté | Nom dans le code | À ajouter |
|---|---|---|---|
| Makespan d'une vague | oui | `finish` | — |
| Temps à quai des camions | oui | `truckWait` | le temps à quai **maximal** d'un camion, pas seulement la somme |
| Délai moyen de préparation | oui | `meanDelivery` | le délai **maximal** d'une commande |
| Préparation anticipée | oui | `early` | — |
| Taux de service | en partie | `delivered` / `orders` | les commandes livrées **avant leur heure limite**, quand elles en auront une |
| Congestion | oui | `waits`, `stuck`, `replans` | le pic de robots en attente au même tour |
| Zone de pré-chargement saturée | oui (journal) | `overflow` | en mesure, pas seulement au journal |
| Lignes par heure | non | — | les livraisons par tour et par robot (le rendement d'un robot) |
| Taux d'utilisation des robots | non | — | la part des tours où un robot porte ou va chercher |
| Dock-to-stock | non | — | avec la réception, plus tard |

## L'atelier

| Indicateur réel | Ce qu'il compte | Ce que le simulateur comptera |
|---|---|---|
| **Makespan** | la fin du dernier OF | le tour où le dernier OF est fini |
| **Retard** (*tardiness*) | de combien un OF finit après son échéance | le retard total, le retard **maximal**, le nombre d'OF en retard |
| **Délai de fabrication** (*lead time*) | de l'entrée d'un OF à sa sortie | moyen et maximal |
| **En-cours** (WIP) | les pièces commencées pas finies | moyen et **maximal** |
| **TRS du goulot** | disponibilité × performance × qualité de la machine contrainte | par machine, et celui du goulot à part |
| **Arrêt du goulot** | les minutes où la contrainte ne produit pas : panne, attente d'outil, attente de pièce | par cause |
| **FPY**, **RTY** | les pièces bonnes du premier coup, la perte cumulée | par opération et sur la gamme |
| **Taux de rebut** | les pièces éliminées | et les OF relancés pour les remplacer |
| **Retouches** | les passages en plus | le temps de machine qu'elles ont pris, au goulot surtout |
| **MTTR observé** | la durée réelle des pannes | contre le MTTR tiré, pour vérifier le tirage |
| **Attente d'une ressource rare** | un outil spécial, un régleur, un poste de contrôle | le temps où une machine attend l'outil qu'une autre tient |

## Pourquoi des maxima

Une moyenne cache le pire. C'est la leçon de mcts-urgences : le pic de patients en attente et l'attente maximale par
niveau disent ce que la moyenne lisse. Ici :
- **le temps à quai maximal** : un camion qui attend trois heures fait manquer sa livraison suivante, même si les autres
  partent à l'heure ;
- **le retard maximal** : l'OF d'un client qui attend un avion au sol (AOG) compte plus que la moyenne ;
- **l'en-cours maximal** : c'est lui qui remplit l'atelier, et qui bloque les allées des robots.

## Comment on compare

Les règles de CLAUDE.md :
- les règles simples d'abord, sur les mêmes journées ;
- la recherche doit les battre **par paires**, avec son intervalle ;
- un premier tri rapide peut rejeter une stratégie, jamais la promouvoir.

Un indicateur ajouté **ne change pas ce que font les robots**, mais les empreintes hachent aussi les mesures
(`tests/fingerprint.test.js`) : une mesure de plus change donc leur hachage. Son commit le dit, et vérifie que le journal
de chaque journée, lui, est identique.
