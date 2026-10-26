# Ce que mesurent les entrepôts, et ce que mesure le modèle

Sami (26/10/2026) : la variante logistique est déjà commencée (Ulog, Amazon). Ce fichier compare ce que les entrepôts
réels mesurent à ce que le modèle mesure (`docs/modele.md`). Les termes sont dans [glossaire.md](glossaire.md).

## Les indicateurs des entrepôts

Le WERC (Warehousing Education and Research Council) publie chaque année des références, les *DC Measures*. Les
chiffres ci-dessous en viennent par des résumés : les seuils varient d'une année à l'autre, et il faut vérifier le
rapport de l'année avant de s'en servir.

| Indicateur | Ce qu'il compte | Les meilleurs (WERC, par des résumés) |
|---|---|---|
| Dock-to-stock | de l'arrivée de la marchandise à sa mise en stock | moins de 3 à 3,5 heures |
| Lignes préparées et expédiées par heure | le rendement d'un préparateur | 70 et plus (73,8 dans un rapport plus récent) |
| Précision de la préparation | les lignes sans erreur | 99,68 % |
| Rotation des camions | de l'arrivée d'un camion à son départ | pas de référence WERC trouvée |

Les entrepôts suivent aussi :
- le **taux de service** : les commandes complètes et à l'heure ;
- le **coût par commande** ;
- le **taux d'occupation** des emplacements ;
- les **heures de quai** : combien de temps chaque porte est prise.

## Les rendements de la préparation

- **Une station goods-to-person** (AutoStore) : 120 prélèvements par heure, la cadence habituelle en Europe selon un
  article de presse sur Medline. Une station redessinée y atteignait 220 à 320 par heure, et le volume a crû de 25 %
  sans embauche.
- **Un robot préleveur** à une station AutoStore : jusqu'à 1 000 prélèvements par heure, selon Swisslog. C'est un
  chiffre de vendeur, et il est ancien.
- **Les unités diffèrent** : un prélèvement, une ligne et un bac ne se comparent pas.

## La chaîne du froid

- **Les plages** : le frais de 0 à 5 °C (produits laitiers, fruits et légumes) ; le surgelé à −18 °C ou moins ; l'ambiant
  contrôlé de 15 à 25 °C, courant pour la pharmacie.
- **Le temps hors du froid** se compte en minutes. Un guide de prestataire vise moins de 30 minutes du quai à la zone
  froide : c'est une recommandation de vendeur, pas une norme.
- **Une commande à plusieurs températures** se prépare d'abord dans la zone la plus chaude et se charge dans l'ordre
  inverse, pour que rien ne reste trop longtemps dehors.
- **Le FEFO remplace le FIFO** pour ce qui se périme.
- **L'avis d'expédition** (*ASN*) annonce la marchandise et sa température avant qu'elle arrive. Le quai est préparé
  d'avance.

## Ce que le modèle mesure déjà

| Le modèle | Le nom réel | Ce qui manque pour coller |
|---|---|---|
| `finish`, le tour de la dernière livraison | le makespan d'une vague de préparation | un tour ne vaut pas une durée réelle |
| `truckWait`, la somme des temps à quai | la rotation des camions, les heures de quai | le chargement réel prend des minutes par palette, pas un tour |
| `meanDelivery` | le délai moyen de préparation | — |
| `early`, les commandes prêtes avant leur camion | la préparation anticipée en zone de pré-chargement | — |
| `waits`, `stuck`, `replans` | la congestion des allées, les arrêts des AMR | — |
| `relays` | un transbordement | rare dans les entrepôts réels ; plutôt un robot qui cède le passage |
| `overflow` | une zone de pré-chargement saturée | — |

## Les écarts du modèle

1. **Toutes les commandes sont là au départ.** Dans un entrepôt réel, elles arrivent toute la journée, par vagues,
   avec une heure limite (*cut-off*) avant le départ du camion. C'est l'étape 5 de « La suite » dans `modele.md`.
2. **Une commande = une palette = un bloc.** Une vraie commande a plusieurs lignes, dans plusieurs allées, réunies avant
   l'expédition. C'est l'étape 4 de `modele.md`, la zone d'assemblage.
3. **Pas de réception.** Les camions ne font que charger ; un entrepôt reçoit autant qu'il expédie, souvent aux mêmes
   portes. Un camion à décharger avant d'être rechargé rapprocherait le modèle d'un *cross-dock*.
4. **Pas de batterie.** Les bornes `c` ne servent que de place de départ ; un robot réel s'arrête pour charger, et la
   recharge est une ressource rare aux heures pleines.
5. **L'unité de temps.** Un tour est un pas de case. Pour comparer à des minutes, il faudrait fixer une case
   (environ 1 à 1,5 m) et une vitesse (un AMR roule autour de 1 à 2 m/s), et donner aux prises et aux poses une durée
   en tours. Ce sont des **hypothèses**, sans source ici, à mettre dans le code comme telles.
6. **La sécurité est parfaite.** Les robots ne se touchent jamais, par construction. Dans la réalité, un AMR ralentit
   près d'un piéton, et c'est une perte de rendement à mesurer ([homme-robot.md](homme-robot.md)).

## Sources

- [WERC DC Metrics, infographie Yale](https://www.yale.com/globalassets/coms/yale/north-america/documents/white-papers/snack-drawer/YALE-1520_WERC-DC-Metrics-infographic.pdf),
  et [une autre version](https://www.yale.com/globalassets/coms/yale/north-america/documents/white-papers/snack-drawer/yale-1520_werc-dc-metrics-infographic_072924.pdf)
- [Yale, DC metrics white paper (2024)](https://dcvelocity.com/ext/resources/files/pdfs/whitepapers/yale_dc_metrics_wp_aug2024.pdf)
- [Extensiv, 3PL fulfillment KPIs](https://www.extensiv.com/blog/3pl-fulfillment-kpis-formulas-benchmarks)
- [Cleverence, warehouse KPIs](https://www.cleverence.com/articles/for-business/kpis-for-warehouse-4827/)
- [Supply Chain 247, Medline et le goods-to-person](https://www.supplychain247.com/article/medline_industries_embraces_goods_to_person_picking/aptean)
- [Logistics Matters, Swisslog](https://www.logisticsmatters.co.uk/?p=18437)
- [Element Logic, picking KPIs](https://www.elementlogic.net/uk/?p=1440)
- [Fleetrabbit, les zones de température](https://fleetrabbit.com/industry/food-and-beverage/what-are-temperature-zones-explained-with-benchmarks)
- [Racklify, cold cross-docking](https://racklify.com/encyclopedia/cold-cross-docking-what-it-is-and-how-it-works/)
- [Cleverence, cold chain](https://www.cleverence.com/amp/articles/3pl-business/manage-food-and-beverage-logistics-cold-chain-essentials-4721/)
- [AMZ Prep, FEFO](https://amzprep.com/pet-product-cold-storage-fulfillment/)
