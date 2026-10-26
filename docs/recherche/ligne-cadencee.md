# La ligne cadencée : les vraies données

Sami (26/10/2026) : on commence par la ligne cadencée, des robots dès l'étape 1, et **des vraies données pour
commencer**. Une ligne automobile, parce que c'est là que le takt se compte en secondes. À cette échelle, les robots et
la grille du modèle ont un sens ; le takt de l'A320 se compte en jours ([production.md](production.md)). Les termes
sont dans [glossaire.md](glossaire.md).

## Ce que les sources donnent

| Donnée | Valeur | Source |
|---|---|---|
| **Takt d'une ligne Toyota** (Georgetown, Kentucky) | un véhicule toutes les 55 s, 55 s à chaque poste | Assembly Magazine (2006) ; le président de l'usine (WUKY, 2015) ; 57 s dans une étude de cas |
| **Takt de Toyota Texas** | un camion toutes les 60 s, environ 1 000 par jour | communiqué de Toyota |
| **Un ancien takt de Georgetown** | 128 s par poste, puis 72 s | Assembly Magazine |
| **Le bac** | KLT VDA 4280 : 400 × 300 mm, 24 litres | catalogues de fabricants de bacs |
| **Ce que dure un bac** | une pièce toutes les 50 s, 12 par bac : un bac dure 10 minutes ; pour une boucle d'une heure, 7 bacs (6 + 1) | All About Lean, calcul du *milk run* |
| **La tournée d'un train de manutention** | toutes les 15 à 60 minutes selon la ligne | un vendeur (FleetRabbit), sans étude citée |
| **Un AMR au bord de ligne** | Omron LD-90 : 1,35 m/s au plus, 90 kg de charge, 12 à 15 h d'autonomie | fiches d'Omron |
| **BMW et ses AMR Omron** | −60 % de manutention manuelle ; plus de 60 % du temps des opérateurs passait à porter des pièces | étude de cas d'Omron |
| **Le coût d'un arrêt de ligne automobile** | 10 000 à 50 000 $ par minute | un vendeur de GMAO, sans étude citée |
| **Les petits arrêts** | quelques secondes répétées sur un poste font manquer l'objectif de la journée | un vendeur (TeepTrak) |

Les études académiques sur l'alimentation des lignes, à lire pour l'étape 2 :
- **Bae, Evans et Summers** (Winter Simulation Conference 2016) : un *milk run* simulé dans une usine automobile ; les
  tournées optimisées, recommandées ou à la demande, jugées sur l'utilisation du train et sur les postes affamés ;
- **Alnahhal et Noche** (SpringerPlus, 2013) : un train qui sert un groupe de postes depuis des supermarchés
  décentralisés ; le kanban dit au conducteur combien de bacs poser à chaque arrêt ;
- **Lolli et al.** (IJPR, 2016) : combien de kanbans par tournée, et combien d'opérateurs pour ne jamais manquer en
  ligne ;
- **Savino et Mazza** (Assembly Automation, 2015) : un supermarché de ligne en bacs, avec un double kanban de
  prélèvement ; passer des palettes aux bacs réduit l'en-cours.

## Comment le modèle les prend

**Le temps** :
- **un tour = 5 secondes** ;
- **le takt = 55 s, donc 11 tours** (Georgetown) ;
- **une journée simulée = une heure de ligne, 720 tours, environ 65 véhicules**.

L'heure plutôt que la journée de travail : une journée de recherche dure déjà de 3 à 15 s sur 160 à 260 tours
([../modele.md](../modele.md)). À 720 tours, on mesure d'abord, et l'on raccourcit si besoin.

**L'espace** : **une case ≈ 5 m**. Un robot qui avance d'une case par tour roule à 1 m/s, sous les 1,35 m/s du
LD-90 : il garde de la marge pour ralentir près des gens.

**Le bac** :
- **12 pièces par bac** (All About Lean) ;
- un poste prend une pièce de chaque référence par véhicule ;
- un bac dure donc 12 takts, 132 tours, 11 minutes ;
- **deux bacs par référence au bord de ligne** (le *two-bin*) : quand le premier est vide, une demande part, et le
  second couvre 11 minutes de plus. C'est le temps qu'a un robot pour rapporter un bac plein.

**L'arrêt** : quand un poste n'a plus de pièce d'une référence au moment du takt, **toute la ligne s'arrête** jusqu'à
ce qu'elle arrive. Le compteur de l'arrêt est **la mesure principale**, en secondes. À 10 000 $ la minute (le bas de la
fourchette du vendeur), une minute d'arrêt se lit aussi en coût ; ce coût n'est qu'un ordre de grandeur.

## Les hypothèses (sans source, réglables)

Elles sont dans `src/line-hypotheses.js` :
- **la rupture fournisseur** : une référence manque au supermarché, en moyenne une fois par heure, pendant 5 à
  15 minutes. Aucune donnée publique n'a été trouvée ;
- **le temps de prise et de pose d'un bac** : un tour chacun, comme les palettes de l'entrepôt ;
- **la taille des plans** : 3 à 5 postes, 2 à 4 références par poste. Une vraie ligne finale compte des centaines de
  postes ; le modèle en prend un tronçon, servi par son supermarché.

## Sources

- [Assembly Magazine, Toyota accélère la ligne de Georgetown](https://assemblymag.com/articles/86474-toyota-to-speed-up-georgetown-assembly-line)
- [WUKY, le premier Lexus de Georgetown (2015)](https://www.wuky.org/local-regional-news/2015-10-19/first-lexus-rolls-off-the-line-at-georgetown-toyota-plant)
- [Toyota, communiqué sur l'usine du Texas](https://pressroom.toyota.com/?generate_pdf=63700)
- [Étude de cas Toyota Motor Manufacturing (SlideShare)](https://www.slideshare.net/slideshow/toyota-motor-manufacturing-inc-case-study/24965030)
- [Boxic24, KLT VDA 4280](https://boxic24.com/english/RL-KLT-4280-5005.html)
- [All About Lean, les calculs du milk run](https://www.allaboutlean.com/milk-run-calculations/)
- [FleetRabbit, les trains de manutention](https://fleetrabbit.com/industry/manufacturing-fleet/tow-tractor-tugger-fleet-management-plant-material-flow)
- [Bae, Evans et Summers, WSC 2016](https://www.informs-sim.org/wsc16papers/251.pdf)
- [Alnahhal et Noche, SpringerPlus 2013](https://springerplus.springeropen.com/track/pdf/10.1186/2193-1801-2-415)
- [Lolli et al., IJPR 2016](https://iris.unimore.it/handle/11380/1082392)
- [Savino et Mazza, Assembly Automation 2015](https://www.emerald.com/insight/content/doi/10.1108/AA-07-2014-068/full/html)
- [Omron, la série LD](https://robotics.omron.com/products/mobile-robots/ld-series/), [fiche LD-90](https://industrial.omron.eu/en/products/37042-20000)
- [Omron, BMW et les AMR](https://robotics.omron.com/case-studies/logistics-automation-amr-omron/)
- [Oxmaint, le coût d'un arrêt de ligne automobile](https://oxmaint.com/article/automotive-manufacturing-cmms)
- [TeepTrak, l'automobile](https://teeptrak.com/en/industries/automotive-mobility/)
