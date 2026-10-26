# Les hypothèses chiffrées : ce qui est sourcé, ce qui reste à confirmer

Sami (26/10/2026) : chercher en ligne ; ce qu'on ne trouve pas, le lister ici, avec la valeur estimée, pour pouvoir
poser la question à un chercheur ou à quelqu'un qui travaille dans ces entrepôts et ces usines. Garder une trace, et ne
pas trop s'écarter du réel. Ça reste une simulation : il y aura toujours des écarts et des imprévus.

Ce fichier est cette trace. Pour chaque chiffre du modèle :
- **la valeur utilisée**, et où elle est dans le code ;
- **ce que les recherches ont trouvé** (le 26/10/2026), avec la source, et si c'est un vendeur ;
- **l'écart** entre les deux, quand il y en a un ;
- **la question** à poser, à la fin, numérotée.

Les statuts :
- **sourcée** : un chiffre publié, d'une étude ou du constructeur ;
- **ordre de grandeur** : trouvé chez un vendeur ou dans un exemple, plausible, pas mesuré ;
- **estimée** : rien trouvé en ligne ; à confirmer sur le terrain.

## Le tableau

| Hypothèse | Valeur du modèle | Où | Statut | Question |
|---|---|---|---|---|
| Le takt | 55 s (11 tours) | `LINE.takt` | sourcée (Toyota Georgetown) | — |
| Un tour | 5 s | `LINE.turnSeconds` | choix du modèle | — |
| Une case | ≈ 5 m | `ligne-cadencee.md` | choix du modèle | Q1 |
| Vitesse d'un robot | 1 case par tour, ≈ 1 m/s | toutes les simulations | ordre de grandeur | Q2 |
| Ralentir près du cariste | moitié de la vitesse, cases voisines | `line-human.js`, `caution` | ordre de grandeur | Q3 |
| Vitesse du cariste | 1 case par tour, ≈ 1 m/s | `line-human.js` | ordre de grandeur | Q4 |
| Prendre ou poser une charge | 1 tour (5 s) | `day-turn.js` | estimée | Q5 |
| Pièces par bac | 12 | `LINE.binPieces` | ordre de grandeur (un exemple) | Q6 |
| Bacs au bord de ligne | 2 par référence | `LINE.bins` | sourcée (le *two-bin*) | Q6 |
| Bacs par tournée | 4 KLT d'environ 15 kg | `LINE.tourBins` | estimée | Q7 |
| Mélange des modèles | 60 % essence, 40 % hybride | `LINE.mix` | estimée, sans doute loin | Q8 |
| Séquence connue d'avance | 20 véhicules, ≈ 18 min | `LINE.frozen` | estimée, sans doute trop court | Q9 |
| Le supermarché | 3 bacs, commande à 1 | `LINE.supermarket` | estimée | Q10 |
| Délai de l'entrepôt | 10 à 40 min | `LINE.supermarket.lead` | estimée | Q11 |
| Les préparateurs | 3, 2 à 6 min par commande | `LINE.pickedSupermarket` | ordre de grandeur | Q12 |
| La navette | 5 min, à la demande ; ou un départ toutes les 20 min (plan `train`) | `LINE.shuttle`, `LINE.shuttleEvery` | ordre de grandeur (un exemple de vendeur) | Q13 |
| Les ruptures fournisseur | 1 par heure, 5 à 15 min | `LINE.shortagesPerHour`, `shortageTurns` | estimée | Q14 |
| Le coût d'un arrêt | 10 000 à 50 000 $ la minute | `LINE.stopCostPerMinute` | ordre de grandeur | — |
| L'allée bloquée | 80 % du temps, 8 tours | `PLANS.*.blocking`, `duration` | réglage de test de Sami | Q15 |
| Les camions | aux tours 20, 40, 60 | `PLANS.sami.trucks` | réglage de test | Q16 |
| Les commandes du jour | 4 au départ, une tous les 15 tours, plus rien après 200 | `PLANS.flux.arrivals` | estimée | Q17 |
| Les batteries | pas modélisées | — | choix du modèle | Q18 |

## Le temps et l'espace

**Le tour et la case.** Un tour dure 5 s et une case fait environ 5 m. Un robot qui avance d'une case par tour roule
donc à 1 m/s. Ce sont des choix pour que les deux simulations partagent une horloge (l'usine, `src/plant.js`). Avant
la ligne, l'entrepôt n'avait pas d'échelle ; à 5 s le tour, une de ses journées de 240 tours dure 20 minutes. C'est
un écart à garder en tête : ses « journées » sont des fenêtres courtes.

**La vitesse des robots.** Ce qu'on a trouvé :
- l'Omron LD-90 roule à 1,35 m/s au plus (fiche d'Omron, déjà dans [ligne-cadencee.md](ligne-cadencee.md)) ;
- le Fetch RollerTop, un AMR à rouleaux pour les bacs, à 1,75 m/s au plus ([fiche CSSI](https://cssi.com/wp-content/uploads/cssi_fetch-rollertop-AMR-brochure.pdf)) ;
- un exemple de calcul autour de l'ISO 3691-4 prend 1,5 m/s à pleine charge ([Fabrico](https://www.fabrico.io/blog/iso-3691-4-driverless-industrial-trucks/), un vendeur).

1 m/s de moyenne, virages et croisements compris, reste donc plausible. Ce n'est pas une mesure.

**Ralentir près des gens.** Le modèle divise la vitesse par deux sur les cases voisines du cariste, soit environ
0,5 m/s. Ce qu'on a trouvé :
- l'ISO 3691-4 laisse les zones de vitesse à l'analyse de risque du site ;
- quand la détection des personnes est coupée, à l'accostage par exemple, elle demanderait au plus 0,3 m/s. Ce chiffre
  vient d'un vendeur ([Fabrico](https://www.fabrico.io/blog/iso-3691-4-driverless-industrial-trucks/)), pas du texte
  de la norme, qu'on n'a pas lu ;
- les capteurs ont deux champs : un champ d'alerte qui fait ralentir, un champ de protection qui arrête le robot ;
- un intégrateur de MiR règle ces zones sur la carte, selon le passage ([IDEC](https://en.idec-fs.com/mir/column/column-4/)).

**Le cariste.** Il avance d'une case par tour, environ 1 m/s, comme un robot. Ce qu'on a trouvé :
- près des piétons, un chariot doit rouler au pas, 5 à 7 km/h (1,4 à 1,9 m/s), selon WorkSafe Victoria, repris par
  [Adaptalift](https://www.adaptalift.com.au/articles/2013-02-01-forklift-speed-limits-and-braking-in-the-warehouse) ;
- un guide de vendeur donne 3 à 6 km/h là où il y a du monde, 6 à 10 km/h dans l'entrepôt, 10 à 15 km/h dans les
  grandes allées ([Racklify](https://racklify.com/encyclopedia/setting-up-forklift-speed-limiters-by-warehouse-zone-practical-guide/)) ;
- à 6 km/h, un chariot met environ 3 m à s'arrêter.

Le cariste du modèle est donc un peu lent ; près de la ligne, c'est raisonnable.

**Prendre ou poser une charge.** Un tour, 5 s, pour une palette dans l'entrepôt comme pour un bac sur la ligne. Ce
qu'on a trouvé :
- aucun temps de transfert publié pour un AMR à rouleaux. Les fabricants de convoyeurs d'accostage décrivent la poignée
  de main par infrarouge, sans durée ([Interroll](https://logisticsmanager.com/interroll-presents-newly-launched-conveyor-solution-at-intralogistex-2024), [IKI](https://www.iki.com/products/pallet-unitized-loads/amr-avg-interface)) ;
- pour charger un camion au chariot : 43 à 86 s par palette, d'après un brevet qui compte 10 à 20 min pour 14
  palettes ([US5082415](https://patents.google.com/patent/US5082415)) ; 82 s sur un forum de transporteurs ; 30 s chez
  un vendeur de systèmes de chargement.

Pour un bac posé sur une étagère par un AMR, 5 s se défend. **Pour une palette posée dans un camion, c'est 10 à 15 fois
trop court.** Si le temps à quai doit se lire en minutes, c'est le premier chiffre à corriger.

## La ligne

**Les pièces par bac et les deux bacs.** 12 pièces par bac viennent d'un exemple d'All About Lean
([ligne-cadencee.md](ligne-cadencee.md)). Le *two-bin* est la règle connue du kanban. Un bac dure donc 11 minutes, et
le bord de ligne couvre 22 minutes. Un vendeur conseille d'en garder **une à deux heures** au bord de ligne
([Unex](https://blog.unex.com/automotive-manufacturing)). Le modèle est donc tendu, exprès : c'est là que les choix des
robots comptent. Le nombre de pièces dépend de la pièce : 12 vis ou 12 faisceaux, ce n'est pas le même bac.

**Les bacs par tournée.** 4 bacs d'environ 15 kg, sous les 90 kg du LD-90. Ce qu'on a trouvé :
- les KLT en plastique supportent 30 à 50 kg sans trop fléchir, jusqu'à 75 kg avec un double fond
  ([BITO](https://shop.bito.com/en-gb/p/small-parts-containers-klt-pv_6434/209835/6966718)). C'est de la
  résistance, pas de l'ergonomie ;
- 15 kg, c'est la charge d'un KLT en carton ([Industrial Production](https://www.industrial-production.de/materials-handling/small-load-carriers---more-efficient-from-corrugated-board.htm)) ;
- pour la manutention à la main, l'équation de levage du NIOSH part de 23 kg dans les meilleures conditions. Ce chiffre
  est connu, on ne l'a pas revérifié ici ; la norme EN 1005-2 n'a pas été lue.

**Le mélange des modèles.** 60 % essence et 40 % hybride, sans source. Ce qu'on a trouvé : Toyota Motor Europe a vendu
**77 % de véhicules électrifiés** en 2025, et presque 100 % d'hybrides là où le modèle existe en hybride
([New Mobility](https://newmobility.news/en/2026/01/16/toyota-motor-europe-scores-sales-record-in-2025/),
[Toyota UK](https://media.toyota.co.uk/?p=65400)). Ce sont des ventes, pas la production d'une ligne. Une ligne
Toyota européenne serait plutôt à **20 % essence, 80 % hybride**. On n'a pas changé la valeur : ce qui compte pour le
modèle, c'est qu'un modèle rare fasse manquer des pièces qu'on ne sert pas souvent. Le chiffre se règle dans la page.

**La séquence connue d'avance.** Le modèle laisse voir aux robots les 20 véhicules suivants (environ 18 minutes) ; au
delà, les modèles sont tirés au sort. Ce qu'on a trouvé :
- dans les études, la séquence est **figée des jours ou des semaines avant**, d'après le délai du fournisseur le plus
  lent. Quatre semaines dans une étude de cas sur des tracteurs, avec un fournisseur à 18 jours
  ([BVL](https://www.bvl.de/files/1951/1988/1852/1865/12159_2010_Article_26.pdf)) ;
- un éditeur annonce une séquence verrouillée sur les 4 à 8 heures suivantes ([Blue Yonder](https://info.blueyonder.com/order-management-commerce/what-is-blue-yonder-order-sequencing)) ;
- la séquence peut quand même changer au dernier moment, quand une caisse sort de la peinture en retard ou qu'une pièce
  manque : un brevet porte sur ce reséquencement ([USPTO 9823651](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/9823651)).

**18 minutes, c'est sans doute bien plus court que ce que voit une vraie logistique de bord de ligne.** L'incertitude
réelle serait plutôt le reséquencement : quelques véhicules qui changent de place, pas une suite inconnue.

**Le coût d'un arrêt.** 10 000 à 50 000 $ la minute, d'après un vendeur de GMAO. Siemens (*True Cost of Downtime*,
2024) donne 2,3 millions de dollars l'heure pour une ligne automobile à l'arrêt, soit environ 38 000 $ la minute
([Reliamag](https://reliamag.com/guides/industrial-downtime-cost-benchmarks/), qui rappelle que le chiffre vaut pour les
grandes usines). La fourchette tient.

## Le supermarché, l'entrepôt et la navette

**Le supermarché.** 3 bacs par référence (33 minutes de ligne), une commande à l'entrepôt quand il n'en reste qu'un,
servie en 10 à 40 minutes. Ce qu'on a trouvé :
- les supermarchés de l'automobile sont réapprovisionnés par kanban, et les trains de manutention partent à heures
  fixes ([Unibo](https://cris.unibo.it/handle/11585/306125), [Unipd](https://www.research.unipd.it/handle/11577/2806704)) ;
- aucun chiffre publié sur le stock d'un supermarché ou le délai depuis l'entrepôt.

C'est un cas tendu, choisi pour que la ligne puisse manquer. Avec 4 bacs et 5 à 20 minutes, elle ne s'arrêtait jamais
([../modele-ligne.md](../modele-ligne.md)).

**Les préparateurs.** 3 préparateurs, 2 à 6 minutes par commande, plus 5 minutes de trajet. Un cariste à mât rétractable
déplace 15 à 16 palettes à l'heure, trajets compris, soit environ 4 minutes par palette
([Hyster](https://www.hyster.com/globalassets/coms/hyster/apac/product%20brochures/reach-truck/n30-35zdr2-n30zdrs2-n35-45zr2-n35-40zrs2-brochure.pdf),
une étude du constructeur). La fourchette est dans le bon ordre de grandeur. Pour des bacs prélevés un à un, on n'a
trouvé aucun temps par bac.

**La navette.** 5 minutes, et elle part dès qu'une palette est prête. Ce qu'on a trouvé :
- les trains de manutention font des boucles de 15 à 60 minutes ([FleetRabbit](https://fleetrabbit.com/industry/manufacturing-fleet/tow-tractor-tugger-fleet-management-plant-material-flow), un vendeur) ;
- un exemple compte 20 minutes, dont 8 de route sur 800 m et 12 d'arrêts, avec un départ toutes les 20 ou 30 minutes
  ([Fabrico](https://www.fabrico.io/blog/tugger-train-vs-forklift-material-transport/), un exemple, pas une mesure).

**La vraie navette part sans doute à heure fixe** : une palette prête attend le prochain départ, 10 à 15 minutes en
moyenne. Le modèle était donc optimiste sur ce trajet. Depuis le 26/10 au soir, l'usine a la navette à heure fixe
(`setup.shuttleEvery`, plan `train`, un départ toutes les 20 minutes, `LINE.shuttleEvery`) ; le délai moyen passe
d'environ 8 à 17 minutes ([../modele-ligne.md](../modele-ligne.md)).

## Les aléas

**Les ruptures fournisseur.** Une par heure en moyenne, de 5 à 15 minutes. On n'a trouvé que des arrêts d'usine entiers
dans la presse : AvtoVAZ en 2021, Volvo à Ridgeville, Stellantis à Mirafiori en 2026, pour des composants ou des puces
([S&P](https://autotechinsight.spglobal.com/news/5282170/volvo-cars-halts-us-plant-production-due-to-shortage-of-auto-parts)).
Ces arrêts durent des jours, pas des minutes. Aucune source ne donne la fréquence des petits manques au supermarché. Une
étude de cas de Kaizen Institute dit qu'en passant à une commande tirée par la consommation, une usine a réduit ses
arrêts de 52 % ([Kaizen](https://kaizen.com/insights/case-study-internal-logistics-flow-optimisation-in-assembly-manufacturing/)),
sans dire combien il y en avait.

**L'allée bloquée.** 80 % du temps, 8 tours à la fois, sur les cases `~`. C'est le réglage de test de Sami du 23/10 : un
cas dur, choisi pour voir la recherche à l'œuvre, pas un chiffre réel. On n'a trouvé aucune mesure de la fréquence des
allées bloquées. Un brevet décrit un robot qui contourne une allée bloquée et y revient au moins cinq minutes plus tard
([USPTO 11436543](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/11436543)) ; ce délai donne un ordre
de grandeur de la durée d'un blocage.

## L'entrepôt seul

**Les camions.** Sur le plan de Sami, les camions arrivent aux tours 20, 40 et 60, donc toutes les 100 secondes à 5 s
le tour. C'est un réglage pour tester l'ordre de service ; un vrai quai reçoit ses camions sur des créneaux d'une demi-heure
ou d'une heure. Rien n'a été cherché là-dessus.

**Les commandes du jour.** 4 au départ, puis une tous les 15 tours en moyenne (75 s), plus aucune après le tour 200 :
c'est la limite de commande (*cut-off*). Sans source ; c'est le plan de test `flux`.

**Les batteries.** Pas modélisées. Le LD-90 tient 12 à 15 heures, le RollerTop environ 9 heures. Sur une heure de ligne,
on peut les oublier ; sur un poste de 8 heures, non.

## Les questions à poser

À un responsable logistique d'usine automobile, ou au chef d'équipe du bord de ligne :
- **Q6** : combien de pièces par bac, et combien de bacs par référence au bord de ligne ? Combien de temps de ligne
  couvre le bord de ligne, pour une pièce courante et pour une pièce encombrante ?
- **Q8** : sur une ligne qui fait deux motorisations, quelle est la part de chacune, et combien de références ne servent
  qu'à l'une ?
- **Q9** : combien de véhicules d'avance la logistique du bord de ligne connaît-elle la séquence ? Combien de fois par
  heure un véhicule change-t-il de place dans la séquence ?
- **Q10** : combien de bacs par référence au supermarché, et quand part la commande vers l'entrepôt ?
- **Q13** : comment le supermarché est-il servi depuis l'entrepôt : un train à heure fixe, ou à la demande ? Combien de
  temps dure la boucle ?
- **Q14** : combien de fois par heure, ou par poste, une référence manque-t-elle au supermarché, et combien de temps ?
  Combien de ces manques arrêtent vraiment la ligne ?

À un préparateur ou à un cariste d'entrepôt (Ulog, par exemple) :
- **Q4** : à quelle vitesse roulez-vous dans les allées, et près des piétons ?
- **Q5** : combien de temps pour prendre une palette au rack, et pour la poser dans un camion ?
- **Q11, Q12** : entre la commande et la palette au quai, combien de temps ? Combien de préparateurs en même temps ?
- **Q15** : combien de fois par jour une allée est-elle bloquée (une palette laissée, un chariot en panne), et combien
  de temps ?
- **Q16, Q17** : combien de camions par heure à un quai ? Combien de commandes arrivent pendant la journée, et à quelle
  heure est la limite ?

À un intégrateur d'AMR, ou à quelqu'un qui en exploite :
- **Q1** : quelle largeur d'allée faut-il pour qu'un AMR croise un autre AMR, ou un cariste ?
- **Q2** : quelle vitesse moyenne réelle, arrêts et croisements compris ?
- **Q3** : à quelle vitesse roule-t-il près d'une personne, et à quelle distance ralentit-il ?
- **Q5** : combien de secondes pour prendre ou poser un bac, ou une palette ?
- **Q7** : combien de bacs, et quel poids, sur une tournée ?
- **Q18** : combien de temps entre deux charges, et combien dure une charge ?

## Le journal des réponses

Quand une réponse arrive, l'écrire ici : la date, qui l'a donnée (son métier, pas son nom), la valeur, et ce qui a
changé dans le code. Puis changer la valeur dans `src/line-hypotheses.js` ou dans le plan, relancer les mesures, et le
dire dans le journal des versions (`docs/changelog.json`), avec les chiffres d'avant et d'après.

| Date | Question | Réponse | Qui | Ce qui a changé |
|---|---|---|---|---|
| — | — | — | — | — |
