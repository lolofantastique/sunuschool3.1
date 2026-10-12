/* SunuSchool — Configuration Supabase
   ⚠️  Ce fichier est dans .gitignore : NE JAMAIS le pousser sur GitHub.
   Les deux valeurs ci-dessous sont PUBLIQUES par conception.
   La sécurité vient des politiques RLS de Supabase, pas du secret de ces clés.
   Ne mettez JAMAIS ici la clé secrète (service_role / secret). */
window.SUNU_CONFIG = {
  supabaseUrl: 'https://bmhdxzkuhueflnricgpx.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtaGR4emt1aHVlZmxucmljZ3B4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExNjM0NTAsImV4cCI6MjEwNjczOTQ1MH0.RndPHezoaQfwNHrkAc1YF7f1Ob3X6B7tPoSymgr7zrs',

  /* Format email pour Supabase Auth : {matricule}@{slug}.sunuschool.app
     Exemple : sn-2025-0412@al-amine-touba.sunuschool.app
     Ce domaine n'a pas besoin d'exister — c'est juste un identifiant interne.
     ⚠️ Doit rester IDENTIQUE après la mise en production (les comptes en dépendent). */
  get emailDomain() {
    const slug = (window.SCHOOL && window.SCHOOL.slug) || 'default';
    return slug + '.sunuschool.app';
  }
};
