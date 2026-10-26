# L'homme et le robot

Sami (26/10/2026) : les interactions homme-robot, la sécurité des travailleurs, les points d'engorgement. La feuille de
route de `docs/modele.md` prévoit un personnage au clavier (Z Q S D et E), comme le chef de la cuisine, qui prend et
pose des colis parmi les robots. Ce fichier dit ce que les normes et les accidents réels demandent de lui, et des robots
autour de lui. Les termes sont dans [glossaire.md](glossaire.md).

## Les robots mobiles parmi les gens : ISO 3691-4

- **Ce qu'elle couvre** : les chariots sans conducteur, leur commande, leurs équipements de prise de charge, leurs
  bornes de charge et leurs postes de transfert. La façon de naviguer n'y change rien : un tracteur guidé par une bande
  et un AMR libre y sont tous deux.
- **L'édition en vigueur** est l'ISO 3691-4:2023. Un projet de troisième édition est à l'enquête ; il nomme
  explicitement les AMR, les AGV et les tracteurs.
- **Elle s'appuie** sur l'ISO 13849-1 (la fiabilité des fonctions de sécurité) et l'IEC 61496 (les capteurs, dont les
  scrutateurs laser).
- **En Europe**, sa version EN est harmonisée avec la directive Machines : un véhicule conforme est présumé sûr pour ce
  qu'elle couvre.
- **Les vitesses** sont limitées quand la détection des personnes est coupée ou réduite, à l'accostage par exemple. Le
  chiffre est dans le texte de la norme, pas dans les sources trouvées.

## Les robots qui travaillent au contact : ISO 10218 et ISO/TS 15066

L'ISO 10218 donne les exigences générales ; l'ISO/TS 15066 précise les quatre modes collaboratifs :
- **l'arrêt nominal de sécurité surveillé** : le robot s'arrête quand une personne entre, et repart quand elle sort ;
- **le guidage à la main** : la personne mène le robot ;
- **la surveillance de la vitesse et de la séparation** : une distance minimale est gardée, freinage compris ; le robot
  s'arrête si elle n'est plus tenue ;
- **la limitation de puissance et d'effort** : le contact peut arriver, mais sans blesser. La norme donne les efforts
  et pressions admissibles pour chaque partie du corps, en distinguant le coincement (quasi statique) du choc
  (transitoire).

Pour certaines applications à puissance limitée, les protecteurs classiques (les grilles) ne sont plus nécessaires. Le
statut actuel de l'ISO/TS 15066 (intégrée ou non à une nouvelle ISO 10218) est à vérifier sur iso.org.

## Ce que disent les accidents

- **Aux États-Unis**, les chariots élévateurs ont tué 97 personnes en 2024, d'après une analyse des données de l'OSHA.
  Les collisions et les heurts en sont la première cause (23 décès).
- **Une estimation plus ancienne** de l'OSHA : environ 85 morts et 34 900 blessés graves par an.
- **Les piétons heurtés** font 45 % des blessures d'une étude de l'université Monash. Les lieux les plus touchés : les
  usines, les entrepôts, les entrepôts frigorifiques, les grossistes et les transporteurs.
- **La règle de priorité** : la norme américaine des chariots (ANSI B56, version 2015) demande au cariste de céder le
  passage aux piétons.
- **Aucune statistique trouvée** ne porte sur les flottes mixtes AMR et chariots. C'est un manque des sources.

## Les points d'engorgement

Ce que le modèle a déjà rencontré, et ce que la réalité y ajoute :
- **La porte du camion** : un seul robot à la fois, une file, un chargeur par zone (`day-queues.js`, `truck.loaders`).
  Dans un entrepôt réel, c'est le cariste qui charge le camion. Le robot pose sur la zone de pré-chargement, et
  l'humain prend le relais.
- **L'allée unique** : deux robots nez à nez, l'un cède le passage, ou un relais (`giveWay`, `day-relays.js`).
- **La co-activité** : un AMR **ralentit, puis s'arrête**, quand un piéton ou un cariste entre dans le champ de son
  scrutateur. Aujourd'hui, le modèle ne connaît que les cases réservées. Une **zone de ralentissement** autour du
  personnage (deux cases, par exemple : c'est une hypothèse) rendrait le coût de la co-activité visible.
- **Les zones réservées** : des allées interdites aux robots aux heures de réapprovisionnement, ou interdites aux
  piétons. Ce serait une variante du `~`, prévue par le plan.

## Ce que ferait le personnage au clavier

Dans l'esprit de mcts-urgences (l'humain dans le rôle d'un interne, guidé, l'ordonnancement global à la machine) :
- **la machine décide l'ensemble** : quel robot prend quelle commande, qui charge quel camion ;
- **l'humain fait des tâches locales et visibles** : charger un camion depuis la zone de pré-chargement (le rôle réel
  du cariste), dégager une allée bloquée, rapporter une palette qu'aucun robot ne peut atteindre ;
- **les robots le voient comme un piéton** : ils ralentissent près de lui et ne réservent jamais sa case. Lui ne réserve
  rien, il marche ;
- **un humain au hasard** se simule aussi (une politique aléatoire, comme dans urgences), pour mesurer ce qu'il coûte
  ou rapporte, par paires sur les mêmes journées ;
- **un replay de la journée** permet ensuite de voir l'effet de ses retards sur les camions.

Dans l'atelier ([feuille-de-route.md](feuille-de-route.md)), l'humain serait **le régleur**. Il monte un outil, répare
une machine, décide du sort d'une pièce rejetée. Ce sont les tâches que les robots ne font pas.

## Sources

- [Fabrico, ISO 3691-4](https://www.fabrico.io/blog/iso-3691-4-driverless-industrial-trucks/)
- [ISO, ISO/DIS 3691-4](https://www.iso.org/standard/88615.html?browse=tc)
- [Automate.org, ISO/TS 15066 expliquée](https://www.automate.org/tech-papers/iso-ts-15066-explained)
- [ISO, communiqué de 2016 sur l'ISO/TS 15066](https://www.iso.org/news/2016/03/Ref2057.html)
- [ABB, présentation sécurité](https://library.e.abb.com/public/188d2f386fbd4417a484ba4cf56b0df9/Safety_WS.pdf)
- [Matthias, ABB YuMi et les nouvelles normes](https://www.researchgate.net/profile/Bjoern_Matthias/publication/282778835_New_safety_standards_for_collaborative_robots_ABB_YuMiR_dual-arm_robot/links/561c32ea08ae6d17308b128b/New-safety-standards-for-collaborative-robots-ABB-YuMiR-dual-arm-robot.pdf)
- [DC Velocity, 97 morts en 2024](https://www.dcvelocity.com/forklift-accidents-claimed-97-lives-in-2024)
- [Monash University, chariots et blessures graves](https://www.monash.edu/muarc/archive/our-publications/reports/muarc030)
- [eLCOSH, alerte de l'OSHA sur les piétons](https://elcosh.org/document/4287/d001559/Hazard+Alert%253A+Pedestrian+Workers+Killed+by+Forklifts.html)
- [NIST, livre blanc sur la sécurité des chariots](https://www.nist.gov/document/permis-09-forklift-safety-whitepaperpdf)
- [ISHN, éviter les collisions de chariots](https://www.ishn.com/articles/104518-avoid-costly-forklift-truck-collisions)
