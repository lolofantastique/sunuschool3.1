# Sauvegarde Supabase de SunuSchool

Ce dossier garde une copie du code qui tourne sur le projet Supabase (`bmhdxzkuhueflnricgpx`). Le site lui-même (index.html, script.js...) n'est pas concerné.

## Contenu

- `migrations/` : les scripts SQL, à rejouer dans l'ordre des numéros.
- `functions/create-account/index.ts` : la fonction Supabase qui crée les comptes (élève, enseignant, administrateur), version 5.

## Ordre des migrations

1. `00_schema_initial.sql` : tables, fonctions d'aide, règles RLS et droits de départ.
2. `20261009213131_multi_school_isolation.sql` : plusieurs écoles dans une seule base (school_id + règle d'isolation).
3. `20261009225805_fix_teacher_directory_school_scope.sql` : la liste des enseignants est limitée à l'école de l'utilisateur.
4. `20261012214424_fix_sync_teacher_subject_school.sql` : la création automatique de la matière d'un enseignant tient compte de l'école.
5. `20261013151258_add_is_director.sql` : champ is_director et droit de modifier la fiche de l'école réservé au directeur.

## Ce qui manque (important)

Ces éléments existent dans la base en ligne mais leur code n'est pas dans ce dossier :

- La création de la table `schools` (colonnes name, city, logo_url) et l'ajout des colonnes `school_id`, faits avant la migration 2 par un script exécuté à la main.
- Les migrations `revoke_anon_execute_helpers` et `teacher_subject_autosync` (6 octobre 2026), ainsi que les fonctions `my_class_ranks()` et `teacher_directory()` et le déclencheur `teachers_sync_subject`.

Pour reconstruire la base à l'identique, exportez d'abord son schéma actuel depuis Supabase (Database > Schema, ou `supabase db dump`) et gardez-le ici.

## Règles à respecter

- Ne jamais mettre la clé `service_role` dans le code du site.
- Tester toute migration sur une copie avant la production, et faire une sauvegarde avant.
