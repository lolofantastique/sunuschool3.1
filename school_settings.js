/* =============================================================
   SunuSchool — school_settings.js
   Corrige les 5 problèmes critiques :
   1. Nom de l'école centralisé (SCHOOL config)
   2. Authentification Supabase réelle
   3. Export Excel fonctionnel (SheetJS)
   4. QR Code sur les reçus (QRCode.js)
   5. Panneau Paramètres de l'école
   ============================================================= */
(function () {
  'use strict';

  /* ============================================================
     UTILITAIRES
     ============================================================ */
  const $ = id => document.getElementById(id);
  const SC = () => window.SCHOOL || {};
  const toast = m => { try { showToast(m); } catch (_) { alert(m); } };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const schoolYearStart = () => {
    const match = String(SC().schoolYear || '').match(/\b20\d{2}\b/);
    return match ? match[0] : String(new Date().getFullYear());
  };
  window.sunuMatriculePrefix = () => 'SN-' + schoolYearStart() + '-';
  window.sunuReceiptPrefix = () => 'REC-' + new Date().getFullYear() + '-';

  /* ============================================================
     1. APPLICATION DU NOM D'ÉCOLE & GESTION MULTI-ÉTABLISSEMENT
     ============================================================ */
  function applySchoolBranding() {
    const s = SC();
    if (!s.name) return;

    // Barre de connexion
    const loginName = $('login-school-name');
    if (loginName) loginName.textContent = s.name + ' • ' + (s.city || '');

    // Sélecteur d'école sur la modale de login
    const schoolActiveName = $('school-active-name');
    if (schoolActiveName) {
      schoolActiveName.textContent = s.name + (s.city ? ' • ' + s.city : '');
    }

    // Navbar
    const navName = $('nav-school-name');
    if (navName) navName.textContent = s.name + ' • ' + (s.city || '');

    const badge = $('nav-country-badge');
    if (badge) badge.textContent = (s.country || 'Sénégal') + ' 2.0';

    ['registry-school-year', 'schedule-school-year'].forEach(id => {
      const year = $(id);
      if (year) year.textContent = 'Année Scolaire ' + (s.schoolYear || '2026 - 2027');
    });

    const matriculePreview = $('matricule-preview');
    if (matriculePreview) {
      const number = (matriculePreview.textContent.match(/\d+$/) || ['0001'])[0];
      matriculePreview.textContent = window.sunuMatriculePrefix() + number.padStart(4, '0');
    }

    // Logo dans la navbar
    const logo = $('nav-logo');
    if (logo) {
      if (s.logo) {
        logo.innerHTML = `<img src="${esc(s.logo)}" alt="Logo" class="w-full h-full object-cover">`;
      } else {
        logo.textContent = (s.shortName || s.name || 'S')[0].toUpperCase();
      }
    }

    // En-tête du reçu de caisse
    const rcptName = $('rcpt-school-name');
    if (rcptName) rcptName.textContent = s.name || rcptName.textContent;
    const rcptCity = $('rcpt-school-city');
    if (rcptCity) rcptCity.textContent = (s.city || 'Touba Mosquée') + ' • ' + (s.phone || '+221 33 800 00 00');

    // Titre de la page
    document.title = 'SunuSchool — ' + s.name;
  }

  // Applique une école chargée depuis Supabase
  window.applySchoolData = function (school, options = {}) {
    if (!school) return;
    window.SCHOOL = {
      id:         school.id,
      slug:       school.slug,
      name:       school.name,
      shortName:  school.short_name || school.name,
      city:       school.city || '',
      phone:      school.phone || '',
      email:      school.email || '',
      ia:         school.ia || '',
      ief:        school.ief || '',
      schoolYear: school.school_year || '2026 - 2027',
      currency:   school.currency || 'FCFA',
      country:    school.country || 'Sénégal',
      logo:       school.logo || ''
    };

    if (options.saveSlug) {
      try { localStorage.setItem('sunuschool-active-slug', school.slug); } catch (_) {}
    }

    if (options.updateUrl && window.history && window.history.replaceState) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('ecole', school.slug);
        window.history.replaceState({}, '', url.toString());
      } catch (_) {}
    }

    applySchoolBranding();
  };

  // Détecte l'école (URL param ?ecole=, sous-domaine, localStorage, ou défaut) et la charge depuis Supabase
  async function detectAndLoadSchool() {
    let targetSlug = null;

    // 1. URL param : ?ecole=slug ou ?school=slug ou ?s=slug
    try {
      const params = new URLSearchParams(window.location.search);
      targetSlug = params.get('ecole') || params.get('school') || params.get('s') || params.get('slug');
    } catch (_) {}

    // 2. Sous-domaine éventuel (ex: excellence.sunuschool.app)
    if (!targetSlug && window.location.hostname) {
      const parts = window.location.hostname.split('.');
      if (parts.length >= 3 && !['www', 'app', 'localhost', '127'].includes(parts[0])) {
        targetSlug = parts[0];
      }
    }

    // 3. LocalStorage
    if (!targetSlug) {
      try { targetSlug = localStorage.getItem('sunuschool-active-slug'); } catch (_) {}
    }

    // 4. Fallback vers school_config.js
    if (!targetSlug && window.SCHOOL && window.SCHOOL.slug) {
      targetSlug = window.SCHOOL.slug;
    }

    // Requête Supabase si client disponible
    if (window.sb && targetSlug) {
      try {
        const { data: school, error } = await window.sb
          .from('schools')
          .select('*')
          .eq('slug', targetSlug)
          .eq('is_active', true)
          .maybeSingle();

        if (school) {
          window.applySchoolData(school, { saveSlug: true });
        }
      } catch (err) {
        console.warn('Erreur chargement école Supabase :', err);
      }
    }

    applySchoolBranding();
    initSchoolPicker();
  }

  // Initialise la liste des écoles pour le sélecteur
  async function initSchoolPicker() {
    const dropdown = $('school-picker-dropdown');
    if (!dropdown || !window.sb) return;

    try {
      const { data: schools, error } = await window.sb
        .from('schools')
        .select('id, slug, name, short_name, city, logo')
        .eq('is_active', true)
        .order('name');

      if (error || !schools || !schools.length) {
        dropdown.innerHTML = '<div class="text-[11px] text-slate-400 text-center py-2">Aucun autre établissement</div>';
        return;
      }

      dropdown.innerHTML = schools.map(s => {
        const isCurrent = (window.SCHOOL && window.SCHOOL.slug === s.slug);
        return `
          <button type="button" onclick="selectSchool('${esc(s.slug)}')" class="w-full text-left p-2 rounded-xl hover:bg-slate-50 transition flex items-center justify-between gap-2 text-xs group ${isCurrent ? 'bg-emerald-50/50' : ''}">
            <div class="truncate">
              <span class="font-bold text-slate-800 group-hover:text-emerald-700 block truncate">${esc(s.name)}</span>
              <span class="text-[10.5px] text-slate-400 block truncate">${esc(s.city || 'Sénégal')}</span>
            </div>
            ${isCurrent ? '<span class="text-emerald-600 font-bold text-xs shrink-0">✓</span>' : ''}
          </button>
        `;
      }).join('');

      const btnToggle = $('btn-toggle-school-picker');
      if (btnToggle) {
        if (schools.length <= 1) {
          btnToggle.classList.add('hidden');
        } else {
          btnToggle.classList.remove('hidden');
        }
      }
    } catch (e) {
      console.warn('Erreur initSchoolPicker :', e);
    }
  }

  window.toggleSchoolPicker = function () {
    const dd = $('school-picker-dropdown');
    if (!dd) return;
    const isHidden = dd.classList.contains('hidden');
    if (isHidden) {
      dd.classList.remove('hidden');
      initSchoolPicker();
    } else {
      dd.classList.add('hidden');
    }
  };

  window.selectSchool = async function (slug) {
    if (!window.sb || !slug) return;
    try {
      const { data: school, error } = await window.sb
        .from('schools')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle();

      if (school) {
        window.applySchoolData(school, { saveSlug: true, updateUrl: true });
        const dd = $('school-picker-dropdown');
        if (dd) dd.classList.add('hidden');
        toast(`🏫 Établissement : ${school.name}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  /* ============================================================
     2. ÉTAT ET CONNEXION SUPABASE
        script.js gère déjà l'authentification et l'hydratation
        complète des tables depuis Supabase via enterSession().
     ============================================================ */
  function checkSupabaseStatus() {
    if (window.sb) {
      console.log('✅ SunuSchool connecté au backend Supabase Cloud');
    }
  }

  /* ============================================================
     3. IMPRESSION DE CLASSE & IMPORT/EXPORT EXCEL (SheetJS)
     ============================================================ */

  // Helper pour récupérer la classe actuellement affichée dans le registre
  function getActiveRegistryClass() {
    if (typeof window.getRegistryClass === 'function') {
      const c = window.getRegistryClass();
      if (c) return c;
    }
    const cId = typeof registryClassId !== 'undefined' ? registryClassId : null;
    const list = typeof classesMgtData !== 'undefined' ? classesMgtData : [];
    return list.find(c => c.id === cId) || list[0] || null;
  }

  // 1. IMPRESSION DE LA LISTE DE LA CLASSE CONCERNÉE
  window.printClassList = function () {
    const cls = getActiveRegistryClass();
    if (!cls) {
      toast('⚠️ Aucune classe sélectionnée.');
      return;
    }

    const students = (typeof allStudentsDB !== 'undefined' ? allStudentsDB : [])
      .filter(s => s.classe === cls.name || (typeof classKey === 'function' && classKey(s.classe) === classKey(cls.name)))
      .sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr'));

    if (!students.length) {
      toast(`⚠️ Aucun élève enregistré dans la classe ${cls.name}.`);
      return;
    }

    const sc = SC();
    const schoolName = sc.name || 'Groupe Scolaire Al-Amine';
    const schoolCity = sc.city || 'Touba Mosquée';
    const schoolPhone = sc.phone || '+221 33 800 00 00';
    const schoolIA = sc.ia || 'IA Diourbel';
    const schoolIEF = sc.ief || 'IEF Touba';
    const schoolYear = sc.schoolYear || '2026 - 2027';
    const country = sc.country || 'République du Sénégal';

    const nbFilles = students.filter(s => s.sexe === 'F').length;
    const nbGarcons = students.filter(s => s.sexe === 'M').length;

    const printWin = window.open('', '_blank');
    if (!printWin) {
      toast('⚠️ Fenêtre pop-up bloquée. Autorisez les pop-ups pour imprimer la liste.');
      return;
    }

    const rowsHtml = students.map((s, idx) => `
      <tr>
        <td style="text-align:center;font-weight:bold;color:#475569;">${idx + 1}</td>
        <td style="font-family:monospace;font-weight:bold;color:#0369a1;">${esc(s.matricule || '—')}</td>
        <td style="font-weight:bold;text-transform:uppercase;color:#0f172a;">${esc(s.nom || '—')}</td>
        <td style="text-align:center;font-weight:bold;color:${s.sexe === 'F' ? '#be185d' : '#0369a1'};">${s.sexe === 'F' ? 'F' : 'M'}</td>
        <td>${esc(s.parent || '—')}</td>
        <td style="font-family:monospace;">${esc(s.phone || '—')}</td>
        <td style="text-align:center;font-size:10px;">${esc(s.statut || 'Inscrit')}</td>
        <td style="min-width:65px;"></td>
      </tr>
    `).join('');

    const pageHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Liste des élèves — Classe de ${esc(cls.name)}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    body { font-family: "Segoe UI", Arial, sans-serif; font-size: 11px; color: #1e293b; margin: 0; padding: 15px; }
    .no-print { margin-bottom: 15px; text-align: right; }
    .no-print button { padding: 8px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; border: none; font-size: 12px; }
    .btn-print { background: #0284c7; color: white; margin-right: 6px; }
    .btn-close { background: #64748b; color: white; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; }
    .header-col { width: 33%; }
    .header-col.left { text-align: left; }
    .header-col.center { text-align: center; }
    .header-col.right { text-align: right; }
    .school-title { font-size: 15px; font-weight: 900; text-transform: uppercase; color: #0f172a; margin: 2px 0; }
    .doc-title { text-align: center; font-size: 16px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; margin: 14px 0 8px 0; color: #0f172a; }
    .class-meta { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 11px; }
    .class-meta b { color: #0f172a; }
    table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    th { background: #f1f5f9; border: 1px solid #94a3b8; padding: 6px 8px; text-align: left; font-size: 10px; text-transform: uppercase; font-weight: 800; color: #334155; }
    td { border: 1px solid #cbd5e1; padding: 5px 8px; vertical-align: middle; }
    tr:nth-child(even) td { background-color: #fafaf9; }
    .stats-bar { margin-top: 10px; display: flex; justify-content: space-between; font-weight: bold; font-size: 11px; color: #334155; background: #f8fafc; padding: 6px 12px; border-radius: 6px; }
    .signatures { margin-top: 40px; display: flex; justify-content: space-between; }
    .sig-box { width: 40%; text-align: center; }
    .sig-box .title { font-weight: 800; text-transform: uppercase; margin-bottom: 50px; font-size: 11px; color: #1e293b; }
    .sig-line { border-top: 1px dashed #64748b; padding-top: 4px; font-size: 9px; color: #64748b; }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button class="btn-print" onclick="window.print()">🖨️ Imprimer la Liste</button>
    <button class="btn-close" onclick="window.close()">✕ Fermer</button>
  </div>

  <div class="header">
    <div class="header-col left">
      <div style="font-weight:900;text-transform:uppercase;font-size:10px;">${esc(country)}</div>
      <div style="font-size:9.5px;color:#475569;">Ministère de l'Éducation Nationale</div>
      <div style="font-size:9.5px;color:#475569;">${esc(schoolIA)} • ${esc(schoolIEF)}</div>
    </div>
    <div class="header-col center">
      <div class="school-title">${esc(schoolName)}</div>
      <div style="font-size:9.5px;color:#475569;">${esc(schoolCity)} • Tél : ${esc(schoolPhone)}</div>
    </div>
    <div class="header-col right">
      <div style="font-weight:bold;font-size:10.5px;">Année Scolaire : ${esc(schoolYear)}</div>
      <div style="font-size:9.5px;color:#64748b;">Date d'édition : ${new Date().toLocaleDateString('fr-FR')}</div>
    </div>
  </div>

  <div class="doc-title">LISTE NOMINATIVE OFFICIELLE DES ÉLÈVES</div>

  <div class="class-meta">
    <div>Classe : <b style="font-size:13px;color:#0369a1;">${esc(cls.name)}</b> (${esc(cls.level || '—')})</div>
    <div>Prof. Principal : <b>${esc(cls.pp || 'Non défini')}</b></div>
    <div>Salle : <b>${esc(cls.room || '—')}</b></div>
    <div>Effectif Total : <b>${students.length} élève(s)</b></div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:28px;text-align:center;">N°</th>
        <th style="width:105px;">Matricule</th>
        <th>Nom & Prénom</th>
        <th style="width:36px;text-align:center;">Sexe</th>
        <th>Parent / Tuteur Légal</th>
        <th style="width:115px;">Téléphone WhatsApp</th>
        <th style="width:75px;text-align:center;">Scolarité</th>
        <th style="width:85px;text-align:center;">Visa / Émargement</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="stats-bar">
    <div>Répartition des élèves : <b>${nbFilles} fille(s)</b> • <b>${nbGarcons} garçon(s)</b></div>
    <div>Effectif total : <b>${students.length} élèves inscrits</b></div>
  </div>

  <div class="signatures">
    <div class="sig-box">
      <div class="title">Le Professeur Principal</div>
      <div class="sig-line">Visa et Signature</div>
    </div>
    <div class="sig-box">
      <div class="title">Le Chef d'Établissement</div>
      <div class="sig-line">Cachet et Signature</div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 400);
    };
  <\/script>
</body>
</html>`;

    printWin.document.open();
    printWin.document.write(pageHtml);
    printWin.document.close();
  };

  // 2. MODAL D'IMPORTATION EXCEL POUR LA CLASSE SÉLECTIONNÉE
  window._excelImportList = [];

  window.openImportExcelModal = function () {
    const cls = getActiveRegistryClass();
    if (!cls) {
      toast('⚠️ Veuillez d’abord sélectionner une classe dans le registre.');
      return;
    }

    const badge = $('import-excel-class-badge');
    if (badge) badge.textContent = cls.name + ' (' + cls.level + ')';

    // Réinitialiser les champs et l'aperçu
    const fileInput = $('excel-import-file-input');
    if (fileInput) fileInput.value = '';
    const filenameLabel = $('excel-import-filename');
    if (filenameLabel) filenameLabel.textContent = 'Cliquez ici pour choisir un fichier Excel';

    const previewContainer = $('excel-preview-container');
    if (previewContainer) previewContainer.classList.add('hidden');

    const confirmBtn = $('btn-confirm-import-excel');
    if (confirmBtn) confirmBtn.disabled = true;

    window._excelImportList = [];

    const modal = $('excel-import-modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  };

  window.closeImportExcelModal = function () {
    const modal = $('excel-import-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  };

  // 3. TÉLÉCHARGER UN MODÈLE EXCEL TYPE
  window.downloadExcelTemplate = function () {
    if (typeof XLSX === 'undefined') {
      toast('⚠️ Librairie Excel non disponible.');
      return;
    }
    const cls = getActiveRegistryClass();
    const className = cls ? cls.name : '3ème A';

    const headers = ['Nom', 'Prénom', 'Sexe (M/F)', 'Parent / Tuteur', 'Téléphone', 'Mensualité (FCFA)'];
    const sampleRows = [
      ['DIOP', 'Fatou', 'F', 'Moussa Diop', '+221 77 123 45 67', 30000],
      ['NDIAYE', 'Babacar', 'M', 'Aïssatou Ndiaye', '+221 78 234 56 78', 30000],
      ['FALL', 'Modou', 'M', 'Cheikh Fall', '+221 76 345 67 89', 30000]
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    ws['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 25 }, { wch: 20 }, { wch: 18 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Modele_Eleves');

    XLSX.writeFile(wb, 'Modele_Import_Eleves_' + className.replace(/\s/g, '_') + '.xlsx');
    toast('✅ Modèle Excel téléchargé ! Remplissez-le puis glissez-le dans la fenêtre.');
  };

  // 4. LECTURE ET PARSING DU FICHIER EXCEL SÉLECTIONNÉ
  window.handleExcelImportFile = function (e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (typeof XLSX === 'undefined') {
      toast('⚠️ La librairie Excel n\'est pas disponible. Vérifiez votre connexion internet.');
      return;
    }

    const filenameLabel = $('excel-import-filename');
    if (filenameLabel) filenameLabel.textContent = '📄 ' + file.name + ' (' + Math.round(file.size / 1024) + ' Ko)';

    const reader = new FileReader();
    reader.onload = function (evt) {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rawJson.length) {
          toast('⚠️ Le fichier Excel sélectionné est vide.');
          return;
        }

        // Fonction pour normaliser les noms de colonnes
        const cleanKey = k => String(k || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

        const parsed = [];
        rawJson.forEach(row => {
          let valNom = '', valPrenom = '', valSexe = '', valParent = '', valPhone = '', valFee = '';

          for (const [k, v] of Object.entries(row)) {
            const ck = cleanKey(k);
            if (ck === 'nom' || ck === 'nomfamille' || ck === 'lastname') valNom = String(v).trim();
            else if (ck === 'prenom' || ck === 'firstname') valPrenom = String(v).trim();
            else if (ck === 'nomprenom' || ck === 'nomcomplet' || ck === 'eleve') {
              if (!valNom) valNom = String(v).trim();
            }
            else if (ck.includes('sexe') || ck.includes('genre') || ck === 'sex' || ck === 'mf') valSexe = String(v).trim();
            else if (ck.includes('parent') || ck.includes('tuteur') || ck.includes('responsable')) valParent = String(v).trim();
            else if (ck.includes('tel') || ck.includes('phone') || ck.includes('contact') || ck.includes('whatsapp')) valPhone = String(v).trim();
            else if (ck.includes('mensualite') || ck.includes('frais') || ck.includes('scolarite') || ck.includes('fee')) valFee = String(v).trim();
          }

          let fullName = '';
          if (valNom && valPrenom) fullName = valNom.toUpperCase() + ' ' + valPrenom;
          else if (valNom) fullName = valNom;
          else if (valPrenom) fullName = valPrenom;

          if (!fullName) return; // ignorer les lignes vides

          let sex = 'M';
          const upSex = valSexe.toUpperCase();
          if (upSex.startsWith('F') || upSex.includes('FILLE') || upSex.includes('FEMME')) sex = 'F';

          const feeNum = parseInt(String(valFee).replace(/\D/g, ''), 10) || 30000;

          parsed.push({
            nom: fullName,
            sexe: sex,
            parent: valParent || 'Parent / Tuteur',
            phone: valPhone || '—',
            fee: feeNum
          });
        });

        if (!parsed.length) {
          toast('⚠️ Aucune ligne d’élève valide trouvée dans ce fichier Excel.');
          return;
        }

        window._excelImportList = parsed;

        // Afficher l'aperçu dans le tableau
        const tbody = $('excel-preview-tbody');
        if (tbody) {
          tbody.innerHTML = parsed.map((s, idx) => `
            <tr class="hover:bg-slate-50">
              <td class="py-2 px-3 text-center font-bold text-slate-400">${idx + 1}</td>
              <td class="py-2 px-3 font-bold text-slate-900">${esc(s.nom)}</td>
              <td class="py-2 px-3 text-center font-bold ${s.sexe === 'F' ? 'text-pink-600' : 'text-sky-600'}">${s.sexe === 'F' ? '👧 Fille' : '👦 Garçon'}</td>
              <td class="py-2 px-3 text-slate-700">${esc(s.parent)}</td>
              <td class="py-2 px-3 font-mono text-slate-600">${esc(s.phone)}</td>
            </tr>
          `).join('');
        }

        const countBadge = $('excel-preview-count');
        if (countBadge) countBadge.textContent = `${parsed.length} élève(s) détecté(s)`;

        const container = $('excel-preview-container');
        if (container) container.classList.remove('hidden');

        const confirmBtn = $('btn-confirm-import-excel');
        if (confirmBtn) {
          confirmBtn.disabled = false;
          confirmBtn.innerHTML = `<span>🚀 Insérer les ${parsed.length} élèves dans la classe</span>`;
        }

        toast(`✨ ${parsed.length} élève(s) détecté(s) avec succès !`);

      } catch (err) {
        console.error(err);
        toast('⚠️ Erreur lors de la lecture du fichier Excel : ' + (err.message || err));
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // 5. CONFIRMATION DE L'INSERTION DANS LA CLASSE
  window.confirmExcelImport = async function () {
    const cls = getActiveRegistryClass();
    if (!cls) {
      toast('⚠️ Classe introuvable.');
      return;
    }

    const list = window._excelImportList;
    if (!list || !list.length) {
      toast('⚠️ Aucun élève à importer.');
      return;
    }

    const confirmBtn = $('btn-confirm-import-excel');
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Insertion en cours…';
    }

    try {
      if (typeof window.b4CreateStudentAccount !== 'function') throw new Error('Création de comptes indisponible. Rechargez la page.');
      const credentials = [];
      const failures = [];
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (confirmBtn) confirmBtn.textContent = `Création des comptes : ${i + 1}/${list.length}`;
        try {
          const account = await window.b4CreateStudentAccount({
            full_name: item.nom,
            class_id: Number(cls.id),
            sex: item.sexe,
            parent_name: item.parent === 'Parent / Tuteur' ? null : item.parent,
            phone: item.phone === '—' ? null : item.phone,
            monthly_fee: item.fee
          });
          credentials.push({ name: account.full_name, matricule: account.matricule, password: account.password });
        } catch (error) {
          failures.push({ name: item.nom, message: error.message || String(error) });
        }
      }

      if (credentials.length && window.sunuReload) await window.sunuReload();
      closeImportExcelModal();
      if (credentials.length && window.b4ShowCredentialsList) window.b4ShowCredentialsList(credentials);
      if (failures.length) {
        const names = failures.slice(0, 3).map(f => f.name).join(', ');
        toast(`${credentials.length} compte(s) créé(s), ${failures.length} échec(s)${names ? ' : ' + names : ''}.`);
      } else {
        toast(`🎉 ${credentials.length} compte(s) créé(s) dans ${cls.name}.`);
      }

    } catch (err) {
      console.error(err);
      toast('⚠️ Erreur lors de l’insertion : ' + (err.message || err));
    } finally {
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = `<span>🚀 Insérer les élèves dans la classe</span>`;
      }
    }
  };

  // 6. EXPORT EXCEL DE LA CLASSE CONCERNÉE
  window.exportRegistryClass = function () {
    if (typeof XLSX === 'undefined') {
      toast('⚠️ La librairie Excel n\'est pas chargée. Vérifiez votre connexion internet.');
      return;
    }
    const cls = getActiveRegistryClass();
    if (!cls) { toast('⚠️ Aucune classe sélectionnée.'); return; }

    const students = (typeof allStudentsDB !== 'undefined' ? allStudentsDB : [])
      .filter(s => s.classe === cls.name || (typeof classKey === 'function' && classKey(s.classe) === classKey(cls.name)))
      .sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr'));

    if (!students.length) {
      toast('⚠️ Aucun élève à exporter dans cette classe.');
      return;
    }

    const sc = SC();
    const data = [
      [sc.name || 'SunuSchool', '', '', '', '', '', ''],
      ['Classe : ' + cls.name, 'Niveau : ' + (cls.level || '—'), '', '', '', '', ''],
      ['Prof. Principal : ' + (cls.pp || 'Non assigné'), 'Salle : ' + (cls.room || '—'), '', '', 'Effectif : ' + cls.effectif, '', ''],
      ['Année scolaire : ' + (sc.schoolYear || '2026-2027'), '', '', '', '', '', ''],
      [], // Ligne vide
      ['N°', 'Nom & Prénom', 'Matricule', 'Sexe', 'Parent / Tuteur', 'Téléphone', 'Scolarité', 'Statut'],
      ...students.map((s, i) => [
        i + 1,
        s.nom,
        s.matricule,
        s.sexe === 'F' ? 'Fille' : 'Garçon',
        s.parent,
        s.phone,
        s.fee,
        s.statut
      ]),
      [],
      ['', '', '', '', '', 'Total élèves exportés :', students.length, '']
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);

    // Styles de largeur de colonnes
    ws['!cols'] = [
      { wch: 4 }, { wch: 30 }, { wch: 16 }, { wch: 8 },
      { wch: 25 }, { wch: 18 }, { wch: 14 }, { wch: 12 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Classe ' + cls.name.replace(/[\/\\:*?"<>|]/g, '-'));

    const filename = 'SunuSchool_' + cls.name.replace(/\s/g, '_') + '_' + new Date().toISOString().slice(0, 10) + '.xlsx';
    XLSX.writeFile(wb, filename);
    toast('✅ Export Excel de la classe ' + cls.name + ' téléchargé avec succès !');
  };

  // Export général de tous les élèves
  window.exportAllStudentsExcel = function () {
    if (typeof XLSX === 'undefined') {
      toast('⚠️ Librairie Excel non chargée.');
      return;
    }
    const sc = SC();
    const wb = XLSX.utils.book_new();

    // Feuille par classe
    classesMgtData.forEach(cls => {
      const students = allStudentsDB
        .filter(s => classKey(s.classe) === classKey(cls.name))
        .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));

      if (!students.length) return;

      const rows = [
        ['N°', 'Nom & Prénom', 'Matricule', 'Sexe', 'Parent', 'Téléphone', 'Mensualité', 'Statut'],
        ...students.map((s, i) => [i + 1, s.nom, s.matricule, s.sexe === 'F' ? 'F' : 'M', s.parent, s.phone, s.fee, s.statut])
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [{ wch: 4 }, { wch: 28 }, { wch: 16 }, { wch: 5 }, { wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, ws, cls.name.replace(/[\/\\:*?"<>|]/g, '-').slice(0, 31));
    });

    const filename = 'SunuSchool_Tous_Eleves_' + new Date().toISOString().slice(0, 10) + '.xlsx';
    XLSX.writeFile(wb, filename);
    toast('✅ Export Excel complet téléchargé !');
  };

  // Export des paiements
  window.exportPaymentsExcel = function () {
    if (typeof XLSX === 'undefined' || typeof PAY === 'undefined') { toast('⚠️ Données non disponibles.'); return; }
    const rows = [
      ['Date', 'Élève', 'Matricule', 'Classe', 'Mois', 'Mode', 'Montant (FCFA)', 'Réf. Transaction', 'N° Reçu'],
      ...PAY.map(p => {
        const s = allStudentsDB.find(x => x.matricule === p.mat) || {};
        return [p.date, s.nom || p.mat, p.mat, s.classe || '—', p.month, p.method, p.amount, p.ref, p.rec];
      })
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 15 }, { wch: 20 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Paiements');
    XLSX.writeFile(wb, 'SunuSchool_Paiements_' + new Date().toISOString().slice(0, 10) + '.xlsx');
    toast('✅ Export paiements téléchargé !');
  };

  /* ============================================================
     4. QR CODE SUR LES REÇUS
     ============================================================ */
  function generateReceiptQR(data) {
    const container = $('receipt-qr');
    if (!container || typeof QRCode === 'undefined') return;
    container.innerHTML = '';
    try {
      QRCode.toCanvas(
        Object.assign(document.createElement('canvas'), { style: 'width:64px;height:64px' }),
        data,
        { width: 64, margin: 0, color: { dark: '#0f172a', light: '#ffffff' } },
        (err, canvas) => {
          if (!err) { container.innerHTML = ''; container.appendChild(canvas); }
        }
      );
    } catch (_) {}
  }

  // Intercepter la validation de caisse pour générer le QR
  const origCashPayment = window.handleCashPayment;
  if (typeof origCashPayment === 'function') {
    window.handleCashPayment = function (e) {
      const result = origCashPayment.apply(this, arguments);
      const rcptNum = ($('rcpt-number') || {}).textContent || '';
      const student = ($('rcpt-student') || {}).textContent || '';
      const amount  = ($('rcpt-amount') || {}).textContent || '';
      const date    = new Date().toLocaleDateString('fr-FR');
      const qrData  = `SunuSchool|${rcptNum}|${student}|${amount}|${date}`;
      generateReceiptQR(qrData);
      // Mettre à jour le nom de l'école dans le reçu
      applySchoolInReceipt();
      return result;
    };
  }

  function applySchoolInReceipt() {
    const s = SC();
    // Nom de l'école dans l'en-tête du reçu (si le DOM le permet)
    document.querySelectorAll('#receipt-preview-card h4').forEach(el => {
      if (el.textContent.includes('Al-Amine') || el.textContent.includes('Groupe Scolaire')) {
        el.textContent = s.name || el.textContent;
      }
    });
    document.querySelectorAll('#receipt-preview-card p').forEach(el => {
      if (el.textContent.includes('Touba Mosquée') || el.textContent.includes('800 00 00')) {
        el.textContent = (s.city || 'Touba Mosquée') + ' • ' + (s.phone || '+221 33 800 00 00');
      }
    });
  }

  /* ============================================================
     5. PANNEAU PARAMÈTRES DE L'ÉCOLE
     ============================================================ */
  function createSettingsTab() {
    if ($('tab-school-settings')) return;
    const main = document.querySelector('main');
    if (!main) return;

    const tab = document.createElement('div');
    tab.id = 'tab-school-settings';
    tab.className = 'tab-content hidden space-y-6';
    tab.innerHTML = `
      <!-- Header -->
      <div class="bg-gradient-to-r from-slate-900 via-violet-950 to-slate-900 text-white p-6 rounded-3xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span class="bg-violet-500/20 text-violet-300 border border-violet-400/30 text-[11px] font-bold px-2.5 py-0.5 rounded-full">Administration</span>
          <h1 class="text-2xl font-black tracking-tight mt-1">⚙️ Paramètres de l'École</h1>
          <p class="text-slate-300 text-xs">Personnalisez les informations de votre établissement. Ces informations apparaissent sur tous les documents imprimés.</p>
        </div>
        <div class="flex gap-3">
          <button onclick="exportAllStudentsExcel()" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow transition">
            📥 Exporter tous les élèves (Excel)
          </button>
          <button onclick="exportPaymentsExcel()" class="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow transition">
            📥 Exporter les paiements (Excel)
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <!-- Formulaire de configuration -->
        <div class="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-4">
          <h3 class="font-extrabold text-slate-900 text-sm border-b border-slate-100 pb-3 flex items-center gap-2">
            <span class="w-7 h-7 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center">🏫</span>
            Informations de l'Établissement
          </h3>

          <div class="space-y-3 text-xs">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Nom complet de l'école *</label>
              <input type="text" id="cfg-name" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="Ex: Groupe Scolaire Al-Amine">
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Nom court</label>
                <input type="text" id="cfg-short" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="Al-Amine">
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Ville / Quartier</label>
                <input type="text" id="cfg-city" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="Touba Mosquée">
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Téléphone</label>
                <input type="tel" id="cfg-phone" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono font-medium focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="+221 33 800 00 00">
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Email</label>
                <input type="email" id="cfg-email" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="contact@ecole.sn">
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Inspection Académique (IA)</label>
                <input type="text" id="cfg-ia" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="IA Diourbel">
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">IEF</label>
                <input type="text" id="cfg-ief" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="IEF Touba">
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Année Scolaire</label>
                <input type="text" id="cfg-year" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="2026 - 2027">
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Pays</label>
                <input type="text" id="cfg-country" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="Sénégal">
              </div>
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">URL du Logo <span class="font-normal text-slate-400">(laisser vide pour l'initiale automatique)</span></label>
              <input type="url" id="cfg-logo" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono font-medium focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="https://...">
            </div>
            <button onclick="saveSchoolConfig()" class="w-full bg-violet-700 hover:bg-violet-800 text-white font-extrabold py-3 rounded-2xl shadow transition active:scale-95">
              ✓ Enregistrer les paramètres
            </button>
          </div>
        </div>

        <!-- Aperçu + outils d'export -->
        <div class="space-y-5">

          <!-- Aperçu de l'en-tête de document -->
          <div class="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 space-y-3">
            <h3 class="font-extrabold text-slate-900 text-sm border-b border-slate-100 pb-3">👁️ Aperçu de l'en-tête des documents</h3>
            <div id="settings-preview" class="bg-slate-50 rounded-2xl border border-slate-200 p-4 text-xs space-y-1">
              <!-- Rempli dynamiquement -->
            </div>
          </div>

          <!-- Outils d'export -->
          <div class="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 space-y-3">
            <h3 class="font-extrabold text-slate-900 text-sm border-b border-slate-100 pb-3">📥 Exports de données</h3>
            <div class="grid grid-cols-1 gap-2 text-xs">
              <button onclick="exportAllStudentsExcel()" class="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold py-2.5 rounded-xl transition text-left px-4">
                📊 Exporter tous les élèves → Excel (multi-feuilles par classe)
              </button>
              <button onclick="exportRegistryClass()" class="bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 font-bold py-2.5 rounded-xl transition text-left px-4">
                📋 Exporter la classe sélectionnée → Excel
              </button>
              <button onclick="exportPaymentsExcel()" class="bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 font-bold py-2.5 rounded-xl transition text-left px-4">
                💵 Exporter tous les paiements → Excel
              </button>
              <button onclick="window.print()" class="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition text-left px-4">
                🖨️ Imprimer la page actuelle
              </button>
            </div>
          </div>

          <!-- Carte info système -->
          <div class="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5">
            <h3 class="font-extrabold text-slate-900 text-sm border-b border-slate-100 pb-3">ℹ️ Informations système</h3>
            <div class="grid grid-cols-2 gap-2 text-xs mt-2">
              <div class="bg-slate-50 rounded-xl p-3">
                <span class="block text-slate-400 font-semibold mb-0.5">Version</span>
                <span class="font-extrabold text-slate-900">SunuSchool v11</span>
              </div>
              <div class="bg-slate-50 rounded-xl p-3">
                <span class="block text-slate-400 font-semibold mb-0.5">Base de données</span>
                <span class="font-extrabold text-emerald-700">Supabase ☁️</span>
              </div>
              <div class="bg-slate-50 rounded-xl p-3">
                <span class="block text-slate-400 font-semibold mb-0.5">Élèves</span>
                <span class="font-extrabold text-slate-900" id="cfg-stat-students">—</span>
              </div>
              <div class="bg-slate-50 rounded-xl p-3">
                <span class="block text-slate-400 font-semibold mb-0.5">Enseignants</span>
                <span class="font-extrabold text-slate-900" id="cfg-stat-teachers">—</span>
              </div>
              <div class="bg-slate-50 rounded-xl p-3">
                <span class="block text-slate-400 font-semibold mb-0.5">Classes</span>
                <span class="font-extrabold text-slate-900" id="cfg-stat-classes">—</span>
              </div>
              <div class="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                <span class="block text-emerald-600 font-semibold mb-0.5">Total paiements</span>
                <span class="font-extrabold text-emerald-800" id="cfg-stat-payments">—</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Section Gestion des Administrateurs (multi-admin) -->
      <div class="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-6">
        <div class="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span class="bg-indigo-100 text-indigo-800 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full">Multi-Administrateurs</span>
            <h3 class="font-black text-slate-900 text-lg mt-1 flex items-center gap-2">
              <span>👥</span> Administrateurs de l'Établissement
            </h3>
            <p class="text-xs text-slate-500">Tous les administrateurs enregistrés ont les pleins pouvoirs : créer des classes, inscrire élèves et enseignants, et gérer l'école.</p>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Formulaire création administrateur -->
          <div class="lg:col-span-1 bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-3">
            <h4 class="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
              <span>➕</span> Nouveau Compte Administrateur
            </h4>
            <form onsubmit="handleCreateAdmin(event)" class="space-y-3 text-xs">
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Nom complet *</label>
                <input type="text" id="adm-nom" required placeholder="Ex: M. Mamadou Ba" class="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Matricule <span class="font-normal text-slate-400">(laisser vide pour auto)</span></label>
                <input type="text" id="adm-mat" placeholder="Ex: ADM-2025-002" class="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-mono font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500">
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Mot de passe <span class="font-normal text-slate-400">(laisser vide pour auto)</span></label>
                <input type="text" id="adm-pwd" placeholder="8 caractères minimum" class="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-mono font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500">
              </div>
              <button type="submit" class="w-full bg-indigo-700 hover:bg-indigo-800 text-white font-extrabold py-2.5 rounded-xl shadow transition">
                ✓ Créer l'Administrateur
              </button>
            </form>
          </div>

          <!-- Table des administrateurs -->
          <div class="lg:col-span-2 overflow-hidden border border-slate-200 rounded-2xl">
            <div class="bg-slate-100/70 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <span class="text-xs font-bold text-slate-700">Comptes Administrateurs Actifs</span>
              <button type="button" onclick="loadAdminsList()" class="text-[11px] text-indigo-700 hover:text-indigo-900 font-bold">🔄 Actualiser</button>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs">
                <thead class="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th class="py-2.5 px-4">Administrateur</th>
                    <th class="py-2.5 px-4">Matricule</th>
                    <th class="py-2.5 px-4">Date de création</th>
                    <th class="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody id="admins-table-body" class="divide-y divide-slate-100">
                  <tr><td colspan="4" class="p-4 text-center text-slate-400">Chargement des administrateurs…</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
    main.appendChild(tab);
  }

  // Remplir les champs du formulaire depuis SCHOOL
  function fillSettingsForm() {
    const s = SC();
    const fields = [
      ['cfg-name',    s.name],
      ['cfg-short',   s.shortName],
      ['cfg-city',    s.city],
      ['cfg-phone',   s.phone],
      ['cfg-email',   s.email],
      ['cfg-ia',      s.ia],
      ['cfg-ief',     s.ief],
      ['cfg-year',    s.schoolYear],
      ['cfg-country', s.country],
      ['cfg-logo',    s.logo],
    ];
    fields.forEach(([id, val]) => { const el = $(id); if (el && val) el.value = val; });
    updateSettingsPreview();
    updateSystemStats();
  }

  function updateSettingsPreview() {
    const preview = $('settings-preview');
    if (!preview) return;
    const name    = ($('cfg-name')    || {}).value || SC().name    || 'Nom de l\'école';
    const city    = ($('cfg-city')    || {}).value || SC().city    || 'Ville';
    const phone   = ($('cfg-phone')   || {}).value || SC().phone   || '';
    const ia      = ($('cfg-ia')      || {}).value || SC().ia      || '';
    const ief     = ($('cfg-ief')     || {}).value || SC().ief     || '';
    const year    = ($('cfg-year')    || {}).value || SC().schoolYear || '';

    preview.innerHTML = `
      <div class="text-center border-b border-slate-200 pb-2 mb-2">
        <p class="font-black text-sm uppercase text-slate-900">${esc(name)}</p>
        <p class="text-slate-500">${esc(city)} ${phone ? '• ' + esc(phone) : ''}</p>
        ${ia || ief ? `<p class="text-slate-400">${esc(ia)}${ia && ief ? ' • ' : ''}${esc(ief)}</p>` : ''}
      </div>
      <p class="text-center text-emerald-700 font-bold">Bulletin Scolaire — Année ${esc(year)}</p>
    `;
  }

  function updateSystemStats() {
    try {
      const stats = {
        'cfg-stat-students': (typeof allStudentsDB !== 'undefined' ? allStudentsDB.length : '—') + ' élèves',
        'cfg-stat-teachers': (typeof teachersData !== 'undefined' ? teachersData.length : '—') + ' enseignants',
        'cfg-stat-classes':  (typeof classesMgtData !== 'undefined' ? classesMgtData.length : '—') + ' classes',
        'cfg-stat-payments': (typeof PAY !== 'undefined' ? PAY.reduce((a, p) => a + (p.amount || 0), 0).toLocaleString('fr-FR') + ' FCFA' : '—'),
      };
      Object.entries(stats).forEach(([id, val]) => { const el = $(id); if (el) el.textContent = val; });
    } catch (_) {}
  }

  window.saveSchoolConfig = async function () {
    const s = window.SCHOOL;
    if (!s) { toast('⚠️ Module de configuration non chargé.'); return; }

    s.name       = ($('cfg-name')    || {}).value?.trim() || s.name;
    s.shortName  = ($('cfg-short')   || {}).value?.trim() || s.shortName;
    s.city       = ($('cfg-city')    || {}).value?.trim() || s.city;
    s.phone      = ($('cfg-phone')   || {}).value?.trim() || s.phone;
    s.email      = ($('cfg-email')   || {}).value?.trim() || s.email;
    s.ia         = ($('cfg-ia')      || {}).value?.trim() || s.ia;
    s.ief        = ($('cfg-ief')     || {}).value?.trim() || s.ief;
    s.schoolYear = ($('cfg-year')    || {}).value?.trim() || s.schoolYear;
    s.country    = ($('cfg-country') || {}).value?.trim() || s.country;
    s.logo       = ($('cfg-logo')    || {}).value?.trim() || s.logo;

    // Sauvegarder en localStorage pour persistance session
    try { localStorage.setItem('sunuschool-config', JSON.stringify(s)); } catch (_) {}

    // Sauvegarder dans Supabase si connecté en tant qu'admin
    if (window.sb && typeof currentRole !== 'undefined' && currentRole === 'admin' && s.id) {
      try {
        const { error } = await window.sb.from('schools').update({
          name: s.name,
          short_name: s.shortName,
          city: s.city,
          phone: s.phone,
          email: s.email,
          ia: s.ia,
          ief: s.ief,
          school_year: s.schoolYear,
          country: s.country,
          logo: s.logo
        }).eq('id', s.id);
        if (error) console.warn('Erreur mise à jour école Supabase :', error);
      } catch (errSup) {
        console.warn('Erreur sauvegarde Supabase :', errSup);
      }
    }

    // Réappliquer le branding partout
    applySchoolBranding();
    updateSettingsPreview();
    updateSystemStats();
    toast('✅ Paramètres de l\'école enregistrés et appliqués.');
  };

  /* ============================================================
     PATCH : Nom d'école dans le bulletin et les reçus
     ============================================================ */
  function patchBulletinHeader() {
    const origRenderReportCard = window.renderReportCard;
    if (typeof origRenderReportCard !== 'function') return;

    window.renderReportCard = function () {
      origRenderReportCard.apply(this, arguments);
      const s = SC();
      if (!s.name) return;
      // Remplacer "Al-Amine" dans le bulletin si présent
      const sheet = $('rc-sheet');
      if (!sheet) return;
      sheet.querySelectorAll('p').forEach(el => {
        if (el.textContent.includes('Al-Amine') || el.innerHTML.includes('Al-Amine')) {
          el.innerHTML = el.innerHTML
            .replace(/Groupe Scolaire Al-Amine/g, esc(s.name))
            .replace(/IA Diourbel/g, esc(s.ia || 'IA Diourbel'))
            .replace(/IEF Touba/g, esc(s.ief || 'IEF Touba'))
            .replace(/\b20\d{2}\s*-\s*20\d{2}\b/g, esc(s.schoolYear || '2026 - 2027'));
        }
      });
    };
  }

  /* ============================================================
     DROITS : ajouter "school-settings" aux onglets admin
     ============================================================ */
  function patchRoleAccess() {
    const tryPatch = setInterval(() => {
      if (typeof ALLOWED === 'undefined') return;
      clearInterval(tryPatch);
      if (ALLOWED.admin && !ALLOWED.admin.includes('school-settings')) {
        ALLOWED.admin.push('school-settings');
      }
      if (typeof ALL_TABS !== 'undefined' && !ALL_TABS.includes('school-settings')) {
        ALL_TABS.push('school-settings');
      }
      const b = $('btn-school-settings');
      if (b && typeof currentRole !== 'undefined') {
        b.classList.toggle('hidden', currentRole !== 'admin');
      }
    }, 200);
  }

  /* ============================================================
     INITIALISATION
     ============================================================ */
  function init() {
    // Charger la config sauvegardée en localStorage (si l'admin a modifié)
    try {
      const saved = localStorage.getItem('sunuschool-config');
      if (saved) Object.assign(window.SCHOOL, JSON.parse(saved));
    } catch (_) {}

    window.sunuSchoolReady = detectAndLoadSchool();
    checkSupabaseStatus();
    createSettingsTab();
    patchBulletinHeader();
    patchRoleAccess();

    // Ajouter les live-listeners sur les champs de paramètres
    document.addEventListener('input', e => {
      if (e.target && e.target.id && e.target.id.startsWith('cfg-')) updateSettingsPreview();
    });

    // Quand on ouvre l'onglet Paramètres, remplir les champs
    const origSwitch = window.switchTab;
    if (typeof origSwitch === 'function') {
      window.switchTab = function (id) {
        origSwitch.apply(this, arguments);
        if (id === 'school-settings') {
          fillSettingsForm();
          updateSystemStats();
          if (typeof window.loadAdminsList === 'function') {
            window.loadAdminsList();
          }
        }
      };
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
