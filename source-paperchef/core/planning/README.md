# Bibliothèque → planification → documents

## Analyse du modèle précédent

`catering.services` contient déjà les services types complets : composants, recettes, règles, références, unités de production et préparations communes. Les colonnes facultatives `week_id`, `service_date`, `meal_type` mêlaient ce catalogue et une occurrence datée. Les générateurs de démonstration passaient un planning inventé en mémoire et répétaient quatre types pour remplir quatorze cases.

La base locale de référence examinée ne contenait aucune semaine ni affectation datée. Les deux générateurs hebdomadaires utilisent maintenant le planning persistant ; aucune boucle ne remplit les cases restantes.

## Migration 007

- `services` reste la table des types, avec les identifiants et relations existants. `service_templates` est une vue de bibliothèque, sans copie des recettes. `reference_headcount` reste la référence métier ; le champ historique `headcount` n’est pas l’effectif d’une occurrence.
- `weeks` est réutilisée, avec une semaine lundi-dimanche de sept jours.
- `planned_services` contient l’identifiant d’occurrence, `week_id`, date, `meal_period`, référence de type et `cover_count` réel. Une occurrence ne copie aucune recette lors de sa création.
- Une seule occurrence est autorisée par date/repas pour ce calendrier de cuisine. Les dates doivent appartenir à leur semaine. Déplacer une semaine occupée est refusé.
- Les affectations anciennes complètes sont migrées, avec leur effectif. Les affectations incomplètes, conflits de créneaux ou semaines incompatibles provoquent une erreur transactionnelle explicite, sans effacement silencieux. Les anciennes colonnes de `services` sont conservées pour compatibilité V0, vidées par la migration et ignorées par les nouvelles API.
- `components.menu_visible` et `component_menu_contributions` distinguent les plats visibles des contributions internes. Le Grana de finition devient invisible dans menu/allergènes et transmet ses allergènes aux deux lasagnes. Son calcul et son achat restent intacts.
- `regulation_rule_sets`, `regulation_rules`, `rule_versions` préparent des règles paramétrables et datées. Ces tables sont vides : aucun seuil réglementaire n’est inventé.

La migration est transactionnelle et idempotente via `schema_migrations`. Le moteur n’a pas été modifié. Les documents portrait existants restent conservés.

## API de planification

`PlanningRepository` fournit `library`, `createWeek`, `planService`, `getPlanned`, `weekServices`, `changeCovers`, `markServed`, `lastMeals`. La recherche par nom est disponible ; les filtres futurs utiliseront les relations existantes de catégories, ingrédients/allergènes, groupes et tags, sans doublon de catalogue.

Une nouvelle semaine n’insère aucun service. Ses quatorze créneaux sont construits dans les ViewModels et restent `null` jusqu’à une affectation explicite. Une affectation choisit un type existant et son effectif. Réutiliser volontairement un type dans une autre semaine est permis ; remplir automatiquement une case ne l’est pas.

La façade `loadService(plannedId)` charge le type puis lui applique les métadonnées d’occurrence. Le même calcul commun alimente :

- `plannedTechnicalSheet(repository, plannedId)` ;
- `plannedOrderSheet(repository, [plannedId, ...])`, occurrences distinctes explicitement choisies ;
- `weeklyOrderSheet(repository, weekId)`, toutes les occurrences réellement enregistrées ;
- `weeklyAllergenSheet(repository, weekId)` ;
- `weeklyMenuViewModel(repository, weekId)`.

Les anciennes fonctions sur types restent disponibles pour les tests et prévisualisations de bibliothèque ; elles ne planifient rien. Les nouvelles fonctions publiques de semaine n’acceptent aucune date ni quantité injectée à la place des occurrences.

Une commande de semaine vide retourne un état explicite `empty`, zéro service et zéro couvert, sans PDF d’achat fictif. Une commande de semaine partielle conserve la période complète de la semaine, avec son nombre réel d’occurrences. Les sources d’achat exposent `planned_service_id` et `service_template_id`, en plus des références de recettes et ingrédients. Menu et allergènes exposent également les deux identifiants.

## Historique

Une occurrence `planned` utilise le type courant et se recalcule à chaque génération. Au passage explicite à `served` par `markServed`, un snapshot automatique des **entrées persistantes utilisées** est conservé, y compris ingrédients/allergènes, règles, contributions internes et conversions. Il ne contient pas une saisie indépendante ni des totaux arrondis.

Les générations ultérieures utilisent ce snapshot pour une occurrence servie. Une modification de la bibliothèque ne change donc pas un menu déjà clôturé. La date, le type, l’effectif et le snapshot d’une occurrence servie sont immuables, et sa suppression est refusée. La clôture doit être réalisée au service effectif : une date passée seule ne fige pas automatiquement les données. Ce mécanisme simple évite de versionner immédiatement tout le graphe de recettes.

Les snapshots sont recalculables avec le moteur actuel. Un changement futur de version du moteur nécessitera d’identifier et conserver sa version pour reproduire strictement les anciens calculs ; aucune modification du moteur n’est introduite ici.

## Futurs cycles

`lastMeals('lunch', {before, limit:20, servedOnly})` et l’équivalent `dinner` récupèrent séparément les dernières occurrences réelles, en ordre chronologique. Le filtre `servedOnly` permet l’analyse rétrospective des repas clôturés ; sans ce filtre, on prépare une analyse du planning. Les cases vides ne sont pas des repas et la bibliothèque n’est jamais analysée comme un cycle.

`regulatoryCycleViewModel` expose les occurrences, le nombre observé et la complétude. Son statut reste `not_evaluated` ou `cycle_incomplete`, jamais une conformité inventée. Les futurs résultats détaillés par règle porteront le compte observé, seuils validés, version et statut ; aucun simple OUI/NON global.

## Démonstration et vérifications

Le générateur ne crée l’exemple que si aucune semaine occupée n’existe ; sinon il utilise les affectations réelles existantes. L’exemple enregistré comporte lundi midi Carbonnade/Limande, lundi soir Couscous, mardi midi Lasagnes, mardi soir Quiches : chacun à 100 couverts. Les dix autres créneaux sont vides. Les fichiers `demo-week.json` et `menu-semaine.json` exposent ce planning.

Les tests protègent les quatre occurrences, les dix cases null, les sommes exactes des commandes, les projections menu/allergènes, les effectifs indépendants, la finition invisible mais contributrice, l’historique, les contraintes, la migration d’une vraie affectation et les cycles séparés.

Suite complète : `node outputs/moteur-v0/run-tests.js` depuis le dossier de travail, ou `npm test` dans persistence. Résultat de cette itération : 84 tests réussis, aucun échec. Les deux PDF régénérés ont été contrôlés : une page A4 paysage chacun, quatre services et 400 couverts, dix cases allergènes vides, aucun débordement.
