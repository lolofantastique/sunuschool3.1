/* =============================================================
   SunuSchool — Configuration de l'établissement
   Modifiez ces valeurs pour personnaliser le logiciel
   pour votre école sans toucher au reste du code.

   ⚠️  IMPORTANT pour le système multi-école :
   Le champ "slug" identifie l'école de façon unique dans Supabase.
   Il doit correspondre exactement au slug enregistré dans la table
   "schools" de votre base de données Supabase.
   ============================================================= */
window.SCHOOL = {
  /* ── Identifiant unique de l'école (NE PAS CHANGER après la mise en prod) ── */
  slug:        'al-amine-touba',             // ← Slug Supabase (table schools.slug)

  /* ── Informations d'affichage ── */
  name:        'Groupe Scolaire Al-Amine',   // Nom complet de l'établissement
  shortName:   'Al-Amine',                   // Nom court (reçus, bulletins)
  city:        'Touba Mosquée',              // Ville / Quartier
  phone:       '+221 33 800 00 00',          // Téléphone principal
  email:       'contact@alamine-touba.sn',  // Email (facultatif)
  ia:          'IA Diourbel',               // Inspection Académique
  ief:         'IEF Touba',                 // Inspection de l'Éducation
  schoolYear:  '2026 - 2027',               // Année scolaire en cours
  logo:        '',                           // URL du logo (laisser vide = initiale auto)
  currency:    'FCFA',                       // Devise
  country:     'Sénégal',                   // Pays (badge dans la navbar)
};
