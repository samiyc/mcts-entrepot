# Les aléas : rejets, retouches, pannes, outils

Sami (26/10/2026) : gérer les ressources et le matériel spécialisé, ou rare, pour ne pas ralentir la chaîne quand une
pièce est rejetée ou qu'une machine-outil est endommagée et part en réparation. Ce fichier dit ce que l'industrie fait
de ces aléas, puis comment chacun devient **un événement caché tiré de la graine**, comme les blocages d'allée
aujourd'hui (`drawBlockages`, `src/simulate.js`). Les termes sont dans [glossaire.md](glossaire.md).

## Le sort d'une pièce non conforme

Le circuit, d'après l'ISO 9001 (article 8.7), que l'EN 9100 de l'aéronautique reprend :
1. **détecter** : au contrôle en cours de fabrication, au contrôle final ;
2. **isoler** : la pièce, ou tout le lot, part en quarantaine (le blocage qualité) ;
3. **statuer** : une commission (le MRB) décide ;
4. **enregistrer** : la fiche de non-conformité ;
5. **analyser et agir** : la cause, pour que ça ne revienne pas (le 8D).

Les décisions possibles :

| Décision | Ce qu'elle fait | Ce qu'elle coûte au modèle |
|---|---|---|
| **Accepter avec dérogation** | la pièce part, avec l'accord formel du client | un temps d'attente de la décision |
| **Retoucher** | la ramener à l'exigence d'origine | un passage de plus sur une machine, souvent la même |
| **Réparer, reprendre** | la rendre acceptable pour l'usage, sans la ramener à l'origine ; souvent avec dérogation | un passage sur un poste de réparation, une décision |
| **Rebuter** | l'éliminer, rendue inutilisable | tout son parcours perdu ; un nouvel OF repart du début |

**Le rendement au premier passage** (FPY) compte les pièces bonnes sans retouche ni rebut ; le **rendement final**
compte aussi les pièces retouchées. Le rendement et le taux de rebut ne font pas 100 % à eux deux : la retouche est
entre les deux. Sur plusieurs étapes, le **RTY** multiplie les FPY : 95 % à chacune de cinq étapes ne fait plus que
77 % au bout.

**Une retouche est un flux rentrant** : la pièce revient sur une machine déjà chargée. Si cette machine est le goulot,
la retouche lui prend du temps à elle, donc à tout l'atelier ([production.md](production.md)).

## Les pannes

- **Le MTBF** est le temps moyen entre deux pannes ; **le MTTR**, le temps moyen de la panne détectée à la reprise.
- **Ils pèsent sur le TRS** (l'OEE) par la disponibilité : un MTBF plus long rend les pannes plus rares, un MTTR plus
  court les rend plus brèves.
- **Le TRS** = disponibilité × performance × qualité :
  - la disponibilité est le temps de marche sur le temps planifié ;
  - la performance est la cadence réelle sur la cadence nominale ;
  - la qualité est la part des pièces bonnes.
- **85 % est la référence « classe mondiale »**, d'après les objectifs de la TPM de Nakajima : 90 % de disponibilité,
  95 % de performance, 99,9 % de qualité. Les usines réelles seraient plutôt entre 40 et 65 % ; ce sont des chiffres
  de vendeurs, qui ne s'accordent pas.
- **Pour le TRS**, une pièce rebutée et une pièce retouchée pèsent pareil : toutes deux font baisser la qualité.
- **En France**, la norme NF E60-182 (AFNOR, 2002) fixe le TRS, le TRG et le TRE.

**Les pièces de rechange.** En maintenance aéronautique, l'attente d'une pièce compte plus que la main-d'œuvre dans les
retards de hangar. Un vendeur l'estime à 30 % du temps perdu non planifié ; c'est un chiffre non sourcé. Les **pièces
tournantes** (*rotables*) se réparent et reviennent au stock : la taille de ce stock est elle-même une décision.

## Les outils

- **Un outil s'use** : sa durée de vie se compte en minutes de coupe, ou en pièces.
- **Un outil qui casse** fait souvent une pièce mauvaise : un rejet et une panne à la fois.
- **L'outillerie** répare, réaffûte, mesure, et garde l'historique de chaque outil.
- **Un outil spécial** (un porte-outil long, une fraise de forme) n'existe parfois qu'en un ou deux exemplaires pour
  plusieurs machines. C'est la ressource rare de Sami.

## Comment chaque aléa devient un événement caché

Le modèle sait déjà faire : la journée tire ses blocages de la graine (`drawDay`). Les robots ne les voient qu'à côté.
La recherche retire, dans chacun de ses mondes, ceux qu'on n'a pas encore vus (`drawWorld`, `src/search.js`). Les
aléas de l'atelier se tirent de la même façon.

| Aléa | Ce qui est tiré de la graine | Quand on le découvre | Ce que la recherche retire dans ses mondes |
|---|---|---|---|
| **Rejet au contrôle** | pour chaque pièce et chaque contrôle, bonne ou non, puis retouche, réparation ou rebut | à la fin du contrôle | le sort des pièces pas encore contrôlées, d'après un taux connu |
| **Panne de machine** | les instants des pannes (d'après un MTBF), et leurs durées (d'après un MTTR) | quand elle arrive | les pannes à venir ; une panne en cours garde sa fin tirée, inconnue mais bornée |
| **Usure d'un outil** | sa durée de vie réelle, autour de la durée nominale | quand il est mesuré, ou quand il casse | la vie qui reste aux outils montés |
| **Casse d'un outil** | l'instant, rare | quand elle arrive : une pièce mauvaise de plus | les casses à venir |
| **Une décision de MRB** | sa durée | quand elle tombe | la durée des décisions en cours |

Ce qui se reprend tel quel du modèle actuel :
- **la graine** : `createRng` de mcts-commun, une journée rejouée à l'identique ;
- **les mondes communs** de la recherche (`common: true`) : chaque coup est jugé sur les mêmes aléas tirés ;
- **la mesure par paires** contre les règles simples, avec son intervalle (`paired`).

Ce qui est nouveau :
- **des aléas par ressource**, et non plus une seule allée : chaque machine a ses pannes, chaque outil sa vie ;
- **des taux plutôt qu'une part du temps** : un rejet se tire par pièce, une panne par heure de marche.

## Les chiffres à poser en hypothèses

Aucune source publique trouvée ne donne de taux de rejet, de MTBF ou de MTTR typiques par type de machine. Ce sont des
données d'usine. Le modèle les pose donc comme **hypothèses**, rassemblées en un seul endroit du code (comme
`src/pathway-hypotheses.js` dans mcts-urgences) et réglables dans la page. Il les mesure ensuite à plusieurs niveaux :
- un taux de rejet de 2, 5 et 10 % ;
- une machine qui tombe une fois par jour, ou une fois par semaine ;
- un MTTR d'une demi-heure, ou de quatre heures.

## Sources

- [travail-industrie.com, retouche, reprise, dérogation](https://travail-industrie.com/nos-formations/formation-qualiticien-technicien-qualite-industrie/module/4/chapitre/1)
- [OQLF, le rebut](https://vitrinelinguistique.oqlf.gouv.qc.ca/fiche-gdt/fiche/8353242/rebut)
- [Techniques de l'ingénieur, le rebut](https://www.techniques-ingenieur.fr/glossaire/rebut)
- [ANSES, la dérogation](https://www.anses.fr/system/files/LSV043_PS_009_J-CAPA.pdf?download=1)
- [AFNOR, fiche pratique aéronautique](https://fichespratiques.afnor.org/wp-content/uploads/2020/01/0200_FP_AERO_06.2019.pdf)
- [Elsmar, AS9100 et les dispositions](https://elsmar.com/elsmarqualityforum/threads/as9100-control-of-nonconforming-outputs-rework-dispositions.81874/page-2)
- [SG Systems, FPY et rendement final](https://sgsystemsglobal.com/?p=16693)
- [Guidewheel, FPY et rebut](https://www.guidewheel.com/blog/first-pass-yield-scrap-rate)
- [Fabrico, rendement et taux de rebut](https://www.fabrico.io/fr/blog/yield-vs-scrap-rate/)
- [Inzonex, améliorer le FPY](https://inzonex.co.uk/ai/practices/first-pass-yield-improvement)
- [Oxmaint, MTBF, MTTR et OEE](https://oxmaint.com/industries/manufacturing-plant/mtbf-mttr-and-oee-reliability-kpis-guide-2026)
- [Siemens, MTBF, MTTR et OEE](https://www.assetmanagement.siemens.com/blog/mastering-mtbf-mttr-and-oee-the-triple-crown-of-asset-capacity-planning)
- [TeepTrak, les trois composantes](https://teeptrak.com/en/?p=93402)
- [AFNOR, NF E60-182](https://www.boutique.afnor.org/en-gb/standard/nf-e60182/manufacturing-systems-performance-indications-overall-equipment-effectivene/fa120534/513)
- [Kaizen Institute, le TRS](https://kaizen.com/fr/publications/trs-ameliorer-efficacite-equipements/)
- [Oxmaint, les pièces de rechange en MRO](https://oxmaint.com/industries/aviation-management/aviation-spare-parts-lead-time-scheduling-cmms-guide)
- [Proudfoot, MRO](https://proudfoot.com/industries/mro/)
- [Production Machining, le préréglage](https://www.productionmachining.com/articles/reducing-downtime-with-tool-presetting)
