# Sauvegarde Supabase de SunuSchool

Ce dossier garde une copie du code qui tourne sur le projet Supabase (`bmhdxzkuhueflnricgpx`). Le site lui-même (index.html, script.js...) n'est pas concerné.

## Fichiers de référence

- `schema_actuel.sql` : le schéma RÉEL de la base, relu dans la base le 13/10/2026 et mis à jour le 14/10/2026 (tables, contraintes, index, fonctions, déclencheur, vue, règles d'accès, stockage des logos). C'est la référence pour reconstruire la base sur un projet neuf.
- `functions/create-account/index.ts` : la fonction Supabase qui crée les comptes (élève, enseignant, administrateur), version 6. Seul le directeur (`is_director`) peut créer un administrateur.

## Historique des migrations (dossier migrations/)

Ces fichiers racontent ce qui a été fait, dans l'ordre, mais NE reflètent PLUS l'état actuel : les règles d'accès ont été réécrites depuis, directement dans le SQL Editor. Ne pas les rejouer sur la base actuelle.

1. `00_schema_initial.sql` : schéma de départ (une seule école).
2. `20261009213131_multi_school_isolation.sql` : plusieurs écoles dans une seule base.
3. `20261009225805_fix_teacher_directory_school_scope.sql`.
4. `20261012214424_fix_sync_teacher_subject_school.sql`.
5. `20261013151258_add_is_director.sql` : champ is_director.
6. `20261013172800_security_fixes_payments_settings_grades_fk.sql` : paiements limités à l'élève concerné, paramètres de l'école réservés au directeur, lien de la table grades corrigé.
7. `20261014002100_trash_phones_logos.sql` : corbeille des enseignants (deleted_at), plusieurs numéros par école (phones), espace de stockage des logos, fonction purge_trash().

## Points connus

- La lecture de la table `schools` est publique : le site s'en sert avant la connexion (recherche par slug). Le téléphone et l'e-mail de l'école sont donc lisibles par tous.
- Les rôles anon et authenticated ont tous les droits de table (réglage par défaut de Supabase) ; c'est RLS qui protège. À durcir plus tard.
- La base est prête pour la corbeille de 30 jours, les numéros multiples et les logos, mais le site ne les utilise pas encore. Tant que le site n'est pas modifié, la suppression d'une classe ou d'un enseignant reste définitive. `purge_trash()` n'est pas planifiée.
- Plusieurs index sont en double (voir schema_actuel.sql) ; sans danger.

## Règles à respecter

- Ne jamais mettre la clé `service_role` dans le code du site.
- Tester toute modification sur une copie avant la production, et faire une sauvegarde avant.
- Après chaque changement fait à la main dans Supabase, mettre à jour `schema_actuel.sql`.
