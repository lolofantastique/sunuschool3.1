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

  /* ============================================================
     1. APPLICATION DU NOM D'ÉCOLE DEPUIS school_config.js
     ============================================================ */
  function applySchoolBranding() {
    const s = SC();
    if (!s.name) return;

    // Barre de connexion
    const loginName = $('login-school-name');
    if (loginName) loginName.textContent = s.name + ' • ' + (s.city || '');

    // Navbar
    const navName = $('nav-school-name');
    if (navName) navName.textContent = s.name + ' • ' + (s.city || '');

    const badge = $('nav-country-badge');
    if (badge) badge.textContent = (s.country || 'Sénégal') + ' 2.0';

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
     3. EXPORT EXCEL FONCTIONNEL (SheetJS)
     ============================================================ */
  window.exportRegistryClass = function () {
    if (typeof XLSX === 'undefined') {
      toast('⚠️ La librairie Excel n\'est pas chargée. Vérifiez votre connexion internet.');
      return;
    }
    const cls = classesMgtData.find(c => c.id === registryClassId);
    if (!cls) { toast('⚠️ Aucune classe sélectionnée.'); return; }

    const students = allStudentsDB
      .filter(s => s.classe === cls.name || classKey(s.classe) === classKey(cls.name))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));

    if (!students.length) {
      toast('⚠️ Aucun élève à exporter dans cette classe.');
      return;
    }

    const sc = SC();
    const data = [
      [sc.name || 'SunuSchool', '', '', '', '', '', ''],
      ['Classe : ' + cls.name, 'Niveau : ' + cls.level, '', '', '', '', ''],
      ['Prof. Principal : ' + cls.pp, 'Salle : ' + (cls.room || '—'), '', '', 'Effectif : ' + cls.effectif, '', ''],
      ['Année scolaire : ' + (sc.schoolYear || '2025-2026'), '', '', '', '', '', ''],
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
                <input type="text" id="cfg-year" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="2025 - 2026">
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

  window.saveSchoolConfig = function () {
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
            .replace(/2025 - 2026/g, esc(s.schoolYear || '2025 - 2026'));
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

    applySchoolBranding();
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
