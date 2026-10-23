/* SunuSchool v11 - Logique de l'application */

    let currentRole = 'student';              // rôle de la session (modifié uniquement par une connexion réussie)
    let pendingRole = 'student';              // rôle choisi dans la fenêtre de connexion
    let currentStudentMat = 'SN-2025-0412';   // élève connecté (par défaut : Fatou Diop)
    let currentTeacherId = null;              // enseignant connecté
    const GRADES_OWNER_ID = 2;                // M. Cheikh Seck : seul à pouvoir saisir les notes de Mathématiques
    let gradesMeta = { by: 'M. Cheikh Seck', at: null };
    let selectedDayKey = 'lun';
    let dailyCash = 140000;
    const studentMatriculePrefix = () => window.sunuMatriculePrefix ? window.sunuMatriculePrefix() : `SN-${new Date().getFullYear()}-`;

    // =========================================================
    // CLASSES & EFFECTIFS : filtre par niveau, cartes et listes dynamiques
    // =========================================================
    const LEVELS = [
      { key: 'all',      label: 'Tous les niveaux', icon: '🏫' },
      { key: 'Primaire', label: 'Primaire',         icon: '🎒' },
      { key: 'Collège',  label: 'Collège',          icon: '📘' },
      { key: 'Lycée',    label: 'Lycée',            icon: '🎓' }
    ];
    var registryLevel = 'all', registryClassId = null;
    var schedLevel = 'all', schedClassId = null;
    window.getRegistryClass = function() {
      return (typeof classesMgtData !== 'undefined' ? classesMgtData : []).find(c => c.id === registryClassId) || (typeof classesMgtData !== 'undefined' ? classesMgtData[0] : null);
    };
    window.classStudents = classStudents;

    function classStudents(cls) {
      return allStudentsDB.filter(s => classKey(s.classe) === classKey(cls.name)).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    }
    function levelStats(key) {
      const list = key === 'all' ? classesMgtData : classesMgtData.filter(c => c.level === key);
      return { n: list.length, eleves: list.reduce((s, c) => s + c.effectif, 0) };
    }

    function renderRegistry() {
      const cardsBox = document.getElementById('registry-cards');
      if (!cardsBox) return;
      const lv = LEVELS.find(l => l.key === registryLevel) || LEVELS[0];
      document.getElementById('level-label').textContent = lv.icon + ' ' + lv.label;
      document.getElementById('level-menu').innerHTML = LEVELS.map(l => {
        const st = levelStats(l.key), active = l.key === registryLevel;
        return `<button type="button" role="option" aria-selected="${active}" onclick="selectLevel('${l.key}')"
          class="w-full text-left px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-blue-50 ${active ? 'bg-blue-50 text-blue-700 font-extrabold' : 'text-slate-700 font-semibold'}">
          <span>${l.icon} ${l.label}</span>
          <span class="text-[10px] text-slate-400 font-medium">${st.n} classe${st.n > 1 ? 's' : ''} • ${st.eleves} élèves</span></button>`;
      }).join('');

      const list = classesMgtData.filter(c => registryLevel === 'all' || c.level === registryLevel);
      if (!list.some(c => c.id === registryClassId)) {
        registryClassId = (list.find(c => classStudents(c).length) || list[0] || {}).id ?? null;
      }
      cardsBox.innerHTML = list.length ? list.map(c => {
        const on = c.id === registryClassId;
        return `<div onclick="selectClassRegistry(${c.id})" class="class-card cursor-pointer p-4 rounded-2xl transition hover:shadow-md ${on ? 'border-2 border-blue-600 bg-blue-50/50 shadow-sm' : 'border border-slate-200 bg-white shadow-xs hover:border-blue-500'}">
          <div class="flex items-center justify-between font-bold text-slate-900">
            <span class="text-sm">${esc(c.name)}${registryLevel === 'all' ? ` <span class="text-[10px] font-semibold text-slate-400">(${c.level})</span>` : ''}</span>
            <span class="w-2.5 h-2.5 rounded-full ${on ? 'bg-blue-600' : 'bg-slate-300'}"></span>
          </div>
          <div class="text-2xl font-extrabold ${on ? 'text-blue-700' : 'text-slate-900'} mt-2">${c.effectif} <span class="text-xs font-normal text-slate-500">élèves</span></div>
          <div class="text-[10px] ${on ? 'text-emerald-700' : 'text-slate-400'} font-semibold mt-1">PP : ${esc(c.pp)}</div>
        </div>`;
      }).join('') : `
        <div class="col-span-full bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center text-slate-500">
          <div class="text-3xl mb-2">📭</div>
          <p class="font-semibold">Aucune classe au niveau « ${esc(lv.label)} » pour le moment.</p>
          <button onclick="switchTab('classes-management')" class="mt-3 bg-violet-700 hover:bg-violet-800 text-white font-bold text-xs px-4 py-2 rounded-xl">➕ Créer une classe</button>
        </div>`;
      document.getElementById('registry-total').textContent = classesMgtData.reduce((s, c) => s + c.effectif, 0);
      renderRegistryList();
    }

    function renderRegistryList() {
      const cls = classesMgtData.find(c => c.id === registryClassId);
      const title = document.getElementById('class-title-detail');
      const tbody = document.getElementById('nominal-students-body');
      if (!cls) {
        title.textContent = 'Liste Nominative : aucune classe sélectionnée';
        tbody.innerHTML = '<tr><td colspan="8" class="py-8 text-center text-slate-400">Choisissez une classe pour voir ses élèves.</td></tr>';
        return;
      }
      title.textContent = `Liste Nominative : Classe de ${cls.name} (${cls.effectif} élèves)`;
      const students = classStudents(cls);
      if (!students.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="py-8 text-center text-slate-400">Aucun élève enregistré dans cette classe.</td></tr>';
        return;
      }
      tbody.innerHTML = students.map((s, i) => `
        <tr class="hover:bg-slate-50 transition">
          <td class="py-3 px-4 text-center font-bold text-slate-400">${i + 1}</td>
          <td class="py-3 px-4 font-bold text-slate-900">${esc(s.nom)}</td>
          <td class="py-3 px-4 font-mono text-[11px] text-blue-700 font-bold">${esc(s.matricule)}</td>
          <td class="py-3 px-4 font-semibold text-slate-600">${s.sexe}</td>
          <td class="py-3 px-4 text-slate-700">${esc(s.parent)}</td>
          <td class="py-3 px-4 font-mono text-slate-600">${esc(s.phone)}</td>
          <td class="py-3 px-4 text-center"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${s.statutClass}">${esc(s.statut)}</span></td>
          <td class="py-3 px-4 text-center">
            <div class="flex items-center justify-center gap-1.5">
              <button onclick="openDossier(${allStudentsDB.indexOf(s)})" class="bg-white border border-slate-200 hover:border-blue-500 text-slate-700 hover:text-blue-700 font-bold px-2 py-1 rounded-lg text-[10px] shadow-xs">Dossier</button>
              <button onclick="openEditStudent(${allStudentsDB.indexOf(s)}, false)" title="Corriger les informations" class="bg-white border border-slate-200 hover:border-amber-500 text-slate-700 hover:text-amber-700 font-bold px-2 py-1 rounded-lg text-[10px] shadow-xs">✏️ Modifier</button>
            </div>
          </td>
        </tr>`).join('')
        + (students.length < cls.effectif ? `<tr><td colspan="8" class="py-2.5 px-4 text-[11px] text-slate-400">Prototype : ${students.length} élève(s) enregistré(s) sur un effectif déclaré de ${cls.effectif}.</td></tr>` : '');
    }

    // ---------- Modification d'un élève ----------
    const STATUTS = { 'Payé': 'bg-emerald-100 text-emerald-800', 'En retard': 'bg-rose-100 text-rose-800', 'Non payé': 'bg-amber-100 text-amber-800' };
    function fmtFee(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA'; }
    let editStudentFromDossier = false;

    function openEditStudent(i, fromDossier) {
      const s = allStudentsDB[i];
      if (!s) return;
      editStudentFromDossier = !!fromDossier;
      document.getElementById('se-index').value = i;
      document.getElementById('se-nom').value = s.nom;
      document.getElementById('se-matricule').value = s.matricule;
      document.getElementById('se-sexe').value = s.sexe;
      document.getElementById('se-class').value = s.classe;
      document.getElementById('se-parent').value = s.parent;
      document.getElementById('se-phone').value = s.phone;
      document.getElementById('se-fee').value = digitsOf(s.fee);
      document.getElementById('se-statut').value = STATUTS[s.statut] ? s.statut : 'Non payé';
      openModal('student-edit-modal');
      document.getElementById('se-nom').focus();
    }
    function cancelEditStudent() {
      closeModal('student-edit-modal');
      if (editStudentFromDossier) openDossier(Number(document.getElementById('se-index').value));
    }

    function handleEditStudent(e) {
      e.preventDefault();
      const i = Number(document.getElementById('se-index').value);
      const s = allStudentsDB[i];
      if (!s) return;
      const nom = document.getElementById('se-nom').value.trim();
      const matricule = document.getElementById('se-matricule').value.trim();
      const typedClass = document.getElementById('se-class').value.trim();
      const phone = document.getElementById('se-phone').value.trim();
      const newCls = classesMgtData.find(c => classKey(c.name) === classKey(typedClass));
      if (!nom || !matricule) { showToast('⚠️ Le nom et le matricule sont obligatoires.'); return; }
      if (allStudentsDB.some((o, k) => k !== i && alnum(o.matricule) === alnum(matricule))) { showToast(`⚠️ Le matricule ${matricule} est déjà attribué à un autre élève.`); return; }
      if (!newCls) { showToast(`⚠️ La classe "${typedClass}" n'existe pas.`); return; }
      if (digitsOf(phone).length < 9) { showToast('⚠️ Numéro de téléphone invalide.'); return; }

      const oldCls = classesMgtData.find(c => classKey(c.name) === classKey(s.classe));
      const g = studentsData.find(x => x.name === s.nom);
      const wasCurrent = s.matricule === currentStudentMat;
      const identityChanged = !!g && (g.name !== nom || g.matricule !== matricule);
      if (oldCls !== newCls) {                                  // changement de classe : les effectifs suivent
        if (oldCls) oldCls.effectif = Math.max(0, oldCls.effectif - 1);
        newCls.effectif += 1;
      }
      const statut = document.getElementById('se-statut').value;
      Object.assign(s, {
        nom, matricule, sexe: document.getElementById('se-sexe').value, classe: newCls.name,
        parent: document.getElementById('se-parent').value.trim(), phone,
        fee: fmtFee(document.getElementById('se-fee').value || 0), statut, statutClass: STATUTS[statut]
      });
      if (g) { g.name = nom; g.matricule = matricule; }
      if (wasCurrent) currentStudentMat = matricule;          // les notes suivent l'élève
      closeModal('student-edit-modal');
      renderClassesMgtTable();                                   // effectifs, registre, listes
      renderReportCard();
      renderStudentSpace();
      if (identityChanged) renderGradesTable();
      handleStudentSearch();
      showToast(`✏️ Informations de ${nom} corrigées.`);
      if (editStudentFromDossier) openDossier(i);
    }

    function renderCashStudents() {
      const sel = document.getElementById('cash-student-select');
      if (!sel) return;
      const keep = sel.value;
      sel.innerHTML = allStudentsDB.map(s => `<option value="${esc(s.nom + ' - ' + s.classe + ' (' + s.matricule + ')')}">${esc(s.nom)} • ${esc(s.classe)} (${esc(s.matricule)})</option>`).join('');
      if ([...sel.options].some(o => o.value === keep)) sel.value = keep;
    }

    function selectClassRegistry(id) { registryClassId = id; renderRegistry(); }
    function selectLevel(key) { registryLevel = key; closeLevelMenu(); renderRegistry(); }
    function openDossier(i) {
      const s = allStudentsDB[i];
      if (!s) return;
      const g = studentsData.find(x => x.name === s.nom);
      const cls = classesMgtData.find(c => classKey(c.name) === classKey(s.classe));
      const initials = s.nom.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
      const avatar = s.sexe === 'F' ? 'bg-pink-100 text-pink-700' : 'bg-sky-100 text-sky-700';
      const box = (label, value, extra = '') => `<div class="bg-slate-50 rounded-xl p-3 border border-slate-200 ${extra}"><span class="block text-slate-400 font-semibold mb-0.5">${label}</span><span class="font-extrabold text-slate-900">${value}</span></div>`;
      const section = (title, content) => `<div class="space-y-2"><h4 class="font-extrabold text-slate-700 uppercase tracking-wider text-[10px]">${title}</h4>${content}</div>`;

      // Enseignants qui interviennent dans la classe
      const profs = teachersData.filter(t => t.slots.some(sl => classKey(sl.classe) === classKey(s.classe)));
      const profsHtml = profs.length
        ? `<div class="flex flex-wrap gap-1.5">${profs.map(t => `<span class="bg-violet-50 text-violet-800 border border-violet-100 font-semibold px-2.5 py-1 rounded-full">${esc(t.name)} <span class="text-violet-500 font-normal">• ${esc(t.subject)}</span></span>`).join('')}</div>`
        : '<p class="text-slate-400">Aucun enseignant affecté à cette classe pour le moment.</p>';

      // Résultats scolaires (si des notes existent)
      let resultsHtml;
      if (g && canSeeGradesOf(s)) {
        const rows = SUBJECTS.map(x => {
          const m = subjectAvg(g, x.key);
          return `<tr class="border-b border-slate-100"><td class="py-1.5 px-3 font-semibold">${x.name}</td><td class="py-1.5 px-3 text-center">${x.coeff}</td><td class="py-1.5 px-3 text-center font-bold ${m >= 10 ? '' : 'text-rose-700'}">${m.toFixed(2)}</td></tr>`;
        }).join('');
        resultsHtml = `
          <div class="overflow-x-auto"><table class="w-full text-left border border-slate-200 rounded-xl overflow-hidden">
            <thead class="bg-slate-100 text-slate-600 uppercase text-[10px] tracking-wider"><tr><th class="py-2 px-3">Matière</th><th class="py-2 px-3 text-center">Coeff</th><th class="py-2 px-3 text-center">Moyenne /20</th></tr></thead>
            <tbody>${rows}</tbody>
          </table></div>
          <p class="font-extrabold text-slate-900">Moyenne générale : <span class="${overallAvg(g) >= 10 ? 'text-emerald-700' : 'text-rose-700'}">${overallAvg(g).toFixed(2)} / 20</span> • ${rankLabel(rankOf(g))} sur ${studentsData.length}</p>`;
      } else {
        resultsHtml = g ? '<p class="text-slate-400">🔒 Notes confidentielles : consultables uniquement par l\'élève concerné, ses enseignants et l\'administration.</p>' : '<p class="text-slate-400">Aucune note saisie pour cet élève dans ce prototype.</p>';
      }

      document.getElementById('dossier-body').innerHTML = `
        <div class="flex items-center gap-3">
          <div class="w-14 h-14 rounded-2xl ${avatar} flex items-center justify-center font-extrabold text-xl">${esc(initials)}</div>
          <div>
            <p class="font-extrabold text-slate-900 text-base">${esc(s.nom)}</p>
            <p class="font-mono text-sky-700 font-bold">${esc(s.matricule)}</p>
          </div>
          <span class="ml-auto px-2.5 py-1 rounded-full text-[10px] font-bold ${s.statutClass}">${esc(s.statut)}</span>
        </div>
        ${section('Identité & scolarité', `<div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
          ${box('Classe', esc(s.classe))}
          ${box('Niveau', cls ? esc(cls.level) : '—')}
          ${box('Salle', cls ? esc(cls.room || '—') : '—')}
          ${box('Sexe', s.sexe === 'F' ? '👧 Fille' : '👦 Garçon')}
          ${box('Prof. principal', cls ? esc(cls.pp) : '—', 'col-span-2')}
        </div>`)}
        ${section('Parent / Tuteur légal', `<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          ${box('Nom', esc(s.parent))}
          ${box('📱 Téléphone WhatsApp', `<a href="tel:+${digitsOf(s.phone)}" class="font-mono text-emerald-700 hover:underline">${esc(s.phone)}</a>`)}
        </div>`)}
        ${section('Situation financière', `<div class="grid grid-cols-2 gap-2">
          ${box('💵 Mensualité', esc(s.fee))}
          ${box('Statut', `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${s.statutClass}">${esc(s.statut)}</span>`)}
        </div>`)}
        ${section('Résultats scolaires', resultsHtml)}
        ${section('Enseignants de la classe', profsHtml)}
        <div class="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100">
          <button onclick="closeModal('student-dossier-modal'); openStudentReport(${i})" class="flex-1 bg-slate-900 hover:bg-black text-white font-bold py-2.5 rounded-xl">📄 Voir le Bulletin</button>
          <button onclick="contactParent(${i})" class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl">💬 Contacter le Parent</button>
          <button onclick="closeModal('student-dossier-modal'); openEditStudent(${i}, true)" class="sm:w-28 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold py-2.5 rounded-xl">✏️ Modifier</button>
          <button onclick="closeModal('student-dossier-modal')" class="sm:w-24 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl">Fermer</button>
        </div>`;
      openModal('student-dossier-modal');
    }
    function exportRegistryClass() {
      const cls = classesMgtData.find(c => c.id === registryClassId);
      showToast(cls ? `Exportation Excel de la classe de ${cls.name} effectuée !` : 'Aucune classe sélectionnée.');
    }

    // Menu déroulant du niveau
    function toggleLevelMenu(e) {
      e.stopPropagation();
      const open = document.getElementById('level-menu').classList.toggle('hidden') === false;
      document.getElementById('level-btn').setAttribute('aria-expanded', open);
    }
    function closeLevelMenu() {
      document.getElementById('level-menu').classList.add('hidden');
      document.getElementById('level-btn').setAttribute('aria-expanded', 'false');
    }
    document.addEventListener('click', e => { if (!e.target.closest('#level-dd')) closeLevelMenu(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLevelMenu(); });

    // Cash Payment Handler
    function handleCashPayment(e) {
      e.preventDefault();
      const student = document.getElementById('cash-student-select').value;
      const amount = parseInt(document.getElementById('cash-amount-input').value) || 0;
      const payer = document.getElementById('cash-payer-name').value;
      const motif = document.getElementById('cash-month-select').value;

      dailyCash += amount;
      document.getElementById('total-cash-counter').innerText = dailyCash.toLocaleString() + " FCFA";
      document.getElementById('box-cash-total').innerText = (845000 + dailyCash).toLocaleString() + " FCFA";

      // Update receipt preview
      const rcptNum = (window.sunuReceiptPrefix ? window.sunuReceiptPrefix() : `REC-${new Date().getFullYear()}-`) + Math.floor(100 + Math.random() * 900);
      document.getElementById('rcpt-number').innerText = "REÇU N° " + rcptNum;
      document.getElementById('rcpt-student').innerText = student;
      document.getElementById('rcpt-payer').innerText = payer;
      document.getElementById('rcpt-motif').innerText = motif;
      document.getElementById('rcpt-amount').innerText = amount.toLocaleString() + " FCFA";

      showToast(`💵 Encaissement de ${amount.toLocaleString()} FCFA validé ! Reçu officiel généré et SMS transmis.`);
    }

    function openLoginModal() { document.getElementById('login-modal').classList.remove('hidden'); }
    function dismissLoginModal() { document.getElementById('login-modal').classList.add('hidden'); }

    const LOGIN_DEMO = {
      student: { label: 'Numéro de compte unique (Matricule)', placeholder: 'Votre matricule', value: '' },
      teacher: { label: 'Matricule enseignant', placeholder: 'Votre matricule', value: '' },
      admin:   { label: 'Identifiant administrateur', placeholder: 'Votre identifiant', value: '' }
    };
    function setLoginRole(role) {
      pendingRole = role;   // le rôle de la session ne change qu'à la connexion
      const tabs = { student: 'tab-login-student', teacher: 'tab-login-teacher', admin: 'tab-login-admin' };
      Object.entries(tabs).forEach(([r, id]) => {
        document.getElementById(id).className = 'py-2 rounded-xl transition ' + (r === role ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-800');
      });
      const d = LOGIN_DEMO[role];
      document.getElementById('login-identifier-label').textContent = d.label;
      const input = document.getElementById('login-id-input');
      input.placeholder = d.placeholder; input.value = d.value;
    }


    function handleLogin(e) {
      if (e && e.preventDefault) e.preventDefault();
      const id = document.getElementById('login-id-input').value.trim();
      const role = pendingRole;
      let label;
      if (role === 'student') {
        const s = allStudentsDB.find(x => alnum(x.matricule) === alnum(id));
        if (!s) { showToast(`⚠️ Matricule élève inconnu : « ${id} ».`); return; }
        currentStudentMat = s.matricule; label = '🎓 ' + s.nom;
      } else if (role === 'teacher') {
        const t = teachersData.find(x => alnum(x.matricule) === alnum(id));
        if (!t) { showToast(`⚠️ Matricule enseignant inconnu : « ${id} ».`); return; }
        currentTeacherId = t.id; label = '👨‍🏫 ' + t.name;
      } else {
        if (!id) { showToast('⚠️ Identifiant administrateur requis.'); return; }
        label = '🧑‍💼 Administration';
      }
      currentRole = role;
      document.getElementById('session-label').textContent = label;
      dismissLoginModal();
      refreshAccess();
      if (role === 'student') switchTab('student');
      else if (role === 'teacher') switchTab('teacher');
      else switchTab('classes-registry');
    }

    function switchTab(tabId) {
      document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('bg-white', 'text-slate-900', 'shadow-sm');
        btn.classList.add('text-slate-600');
      });

      const selectedTab = document.getElementById('tab-' + tabId);
      const selectedBtn = document.getElementById('btn-' + tabId);
      if (selectedTab) selectedTab.classList.remove('hidden');
      if (tabId === 'teachers-registry') renderTeachers();
      if (tabId === 'student') renderStudentSpace();
      if (tabId === 'admin-hub') renderSchedules();
      if (selectedBtn) {
        selectedBtn.classList.add('bg-white', 'text-slate-900', 'shadow-sm');
        selectedBtn.classList.remove('text-slate-600');
      }
    }

    // =========================================================
    // DROITS D'ACCÈS AUX NOTES + ESPACE ÉLÈVE
    // =========================================================
    function currentStudent() { return allStudentsDB.find(s => s.matricule === currentStudentMat) || null; }
    function gradesOf(s) { return s ? studentsData.find(x => x.matricule === s.matricule) || null : null; }
    // Seul le professeur propriétaire des notes peut les saisir ou les modifier (ni l'administration, ni les élèves)
    function canEditGrades() { return currentRole === 'teacher' && currentTeacherId === GRADES_OWNER_ID; }
    // Un élève ne voit que ses propres notes ; professeurs et administration voient tout
    function canSeeGradesOf(s) { return currentRole !== 'student' || (!!s && s.matricule === currentStudentMat); }

    function applyGradesAccess() {
      const banner = document.getElementById('grades-access-banner');
      if (!banner) return;
      const edit = canEditGrades();
      let msg = '';
      if (currentRole === 'student') msg = '🔒 Espace réservé aux enseignants. Vos propres notes sont consultables dans « 🎓 Espace Élève ».';
      else if (currentRole === 'admin') msg = "🔒 Consultation seule : seul le professeur peut saisir ou modifier les notes. L'administration ne peut pas les modifier.";
      else if (!edit) msg = '🔒 Ces notes de Mathématiques sont saisies par M. Cheikh Seck : vous pouvez les consulter mais pas les modifier.';
      banner.textContent = msg;
      banner.classList.toggle('hidden', !msg);
      document.getElementById('grades-table-card').classList.toggle('hidden', currentRole === 'student');
      const btn = document.getElementById('grades-save-btn');
      btn.disabled = !edit;
      btn.classList.toggle('opacity-40', !edit);
      btn.classList.toggle('cursor-not-allowed', !edit);
      btn.title = edit ? '' : 'Réservé au professeur';
    }

    const DAY_FULL = { Lun: 'Lundi', Mar: 'Mardi', Mer: 'Mercredi', Jeu: 'Jeudi', Ven: 'Vendredi', Sam: 'Samedi' };

    // Tableau Jours × Horaires d'une classe, construit à partir des horaires enregistrés pour les professeurs
    function weekTableHtml(className) {
      const rows = teachersData.flatMap(t => t.slots.filter(sl => classKey(sl.classe) === classKey(className)).map(sl => ({ ...sl, t })));
      if (!rows.length) {
        return `<div class="text-center text-slate-400 text-xs py-8"><div class="text-3xl mb-2">🗓️</div>Aucun cours n'est encore programmé pour la classe ${esc(className)}.<br>Les horaires apparaîtront ici dès qu'ils seront enregistrés pour les professeurs.</div>`;
      }
      const today = ['', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][new Date().getDay()] || '';
      const ranges = [...new Map(rows.map(r => [r.start + '-' + r.end, r])).values()]
        .sort((a, b) => toMin(a.start) - toMin(b.start) || toMin(a.end) - toMin(b.end));
      const head = DAYS.map(d => `<th class="py-2.5 px-2 text-center font-extrabold uppercase tracking-wide text-[10px] ${d === today ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}">${DAY_FULL[d]}${d === today ? '<span class="block normal-case font-semibold text-[9px]">Aujourd\'hui</span>' : ''}</th>`).join('');
      const body = ranges.map(r => `<tr><th class="py-2 px-3 text-left whitespace-nowrap text-[11px] font-extrabold text-slate-700 bg-slate-50 border-t border-slate-100">${r.start} - ${r.end}</th>${DAYS.map(d => {
        const here = rows.filter(x => x.day === d && x.start === r.start && x.end === r.end);
        return `<td class="align-top p-1.5 border-t border-slate-100 ${d === today ? 'bg-emerald-50/60' : ''}">${here.length ? here.map(x => `
          <div class="rounded-xl border border-sky-200 bg-sky-50 px-2 py-1.5 mb-1 last:mb-0">
            <p class="font-extrabold text-slate-900 text-[11px] leading-tight">${esc(x.t.subject)}</p>
            <p class="text-[10px] text-slate-600">${esc(x.t.name)}</p>
            <p class="text-[10px] text-slate-400">${esc(x.room)}</p>
          </div>`).join('') : '<span class="block text-center text-slate-300">—</span>'}</td>`;
      }).join('')}</tr>`).join('');

      // Récapitulatif par matière
      const bySubject = {};
      rows.forEach(r => {
        const k = r.t.subject + '|' + r.t.name;
        bySubject[k] = bySubject[k] || { subject: r.t.subject, teacher: r.t.name, h: 0 };
        bySubject[k].h += (toMin(r.end) - toMin(r.start)) / 60;
      });
      const total = Object.values(bySubject).reduce((s, x) => s + x.h, 0);
      const recap = Object.values(bySubject).sort((a, b) => b.h - a.h).map(x =>
        `<span class="bg-violet-50 text-violet-800 border border-violet-100 font-semibold px-2.5 py-1 rounded-full">${esc(x.subject)} <span class="text-violet-500 font-normal">• ${esc(x.teacher)} • ${fmtHours(x.h)}</span></span>`).join('');

      return `<table class="w-full min-w-[720px] text-xs border-separate border-spacing-0 rounded-2xl overflow-hidden border border-slate-200">
          <thead><tr><th class="py-2.5 px-3 text-left bg-slate-100 text-slate-600 uppercase tracking-wide text-[10px]">Horaires</th>${head}</tr></thead>
          <tbody>${body}</tbody></table>
        <div class="mt-3 text-xs space-y-2"><p class="font-extrabold text-slate-900">Total : ${fmtHours(total)} de cours par semaine</p><div class="flex flex-wrap gap-1.5">${recap}</div></div>`;
    }

    // ---------- Onglet « Emplois du Temps » : cycle → classes → emploi du temps ----------
    function classHours(cls) {
      return teachersData.flatMap(t => t.slots).filter(sl => classKey(sl.classe) === classKey(cls.name))
        .reduce((h, sl) => h + (toMin(sl.end) - toMin(sl.start)) / 60, 0);
    }

    function renderSchedules() {
      const cardsBox = document.getElementById('sched-cards');
      if (!cardsBox) return;
      const lv = LEVELS.find(l => l.key === schedLevel) || LEVELS[0];
      document.getElementById('sched-level-label').textContent = lv.icon + ' ' + lv.label;
      document.getElementById('sched-level-menu').innerHTML = LEVELS.map(l => {
        const st = levelStats(l.key), active = l.key === schedLevel;
        return `<button type="button" role="option" aria-selected="${active}" onclick="selectSchedLevel('${l.key}')"
          class="w-full text-left px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-indigo-50 ${active ? 'bg-indigo-50 text-indigo-700 font-extrabold' : 'text-slate-700 font-semibold'}">
          <span>${l.icon} ${l.label}</span>
          <span class="text-[10px] text-slate-400 font-medium">${st.n} classe${st.n > 1 ? 's' : ''}</span></button>`;
      }).join('');

      const list = classesMgtData.filter(c => schedLevel === 'all' || c.level === schedLevel);
      if (!list.some(c => c.id === schedClassId)) {
        schedClassId = (list.find(c => classHours(c) > 0) || list[0] || {}).id ?? null;
      }
      cardsBox.innerHTML = list.length ? list.map(c => {
        const on = c.id === schedClassId, h = classHours(c);
        return `<div onclick="selectSchedClass(${c.id})" class="cursor-pointer p-4 rounded-2xl transition hover:shadow-md ${on ? 'border-2 border-indigo-600 bg-indigo-50/50 shadow-sm' : 'border border-slate-200 bg-white shadow-xs hover:border-indigo-500'}">
          <div class="flex items-center justify-between font-bold text-slate-900">
            <span class="text-sm">${esc(c.name)}${schedLevel === 'all' ? ` <span class="text-[10px] font-semibold text-slate-400">(${c.level})</span>` : ''}</span>
            <span class="w-2.5 h-2.5 rounded-full ${on ? 'bg-indigo-600' : 'bg-slate-300'}"></span>
          </div>
          <div class="text-2xl font-extrabold ${on ? 'text-indigo-700' : 'text-slate-900'} mt-2">${fmtHours(h)} <span class="text-xs font-normal text-slate-500">/ semaine</span></div>
          <div class="text-[10px] ${h ? 'text-slate-400' : 'text-amber-600'} font-semibold mt-1">${h ? esc(c.room || '—') : 'Aucun cours programmé'}</div>
        </div>`;
      }).join('') : `
        <div class="col-span-full bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center text-slate-500">
          <div class="text-3xl mb-2">📭</div>
          <p class="font-semibold">Aucune classe au niveau « ${esc(lv.label)} » pour le moment.</p>
          <button onclick="switchTab('classes-management')" class="mt-3 bg-violet-700 hover:bg-violet-800 text-white font-bold text-xs px-4 py-2 rounded-xl">➕ Créer une classe</button>
        </div>`;

      const cls = classesMgtData.find(c => c.id === schedClassId);
      document.getElementById('sched-detail').innerHTML = cls ? `
        <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 class="font-extrabold text-slate-900 text-base">📅 Emploi du temps : Classe de ${esc(cls.name)}</h3>
            <p class="text-xs text-slate-500">${cls.level} • ${esc(cls.room || '—')} • Professeur principal : ${esc(cls.pp)} • ${cls.effectif} élèves</p>
          </div>
          <button onclick="window.print()" class="no-print bg-slate-900 hover:bg-black text-white font-bold text-xs px-4 py-2 rounded-xl shrink-0">🖨️ Imprimer</button>
        </div>
        <div class="overflow-x-auto custom-scrollbar">${weekTableHtml(cls.name)}</div>`
        : '<p class="text-center text-xs text-slate-400 py-10">Choisissez une classe pour afficher son emploi du temps.</p>';
    }

    function selectSchedClass(id) { schedClassId = id; renderSchedules(); }
    function selectSchedLevel(key) { schedLevel = key; closeSchedMenu(); renderSchedules(); }
    function toggleSchedMenu(e) {
      e.stopPropagation();
      const open = document.getElementById('sched-level-menu').classList.toggle('hidden') === false;
      document.getElementById('sched-level-btn').setAttribute('aria-expanded', open);
    }
    function closeSchedMenu() {
      const m = document.getElementById('sched-level-menu');
      if (m) { m.classList.add('hidden'); document.getElementById('sched-level-btn').setAttribute('aria-expanded', 'false'); }
    }
    document.addEventListener('click', e => { if (!e.target.closest('#sched-level-dd')) closeSchedMenu(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSchedMenu(); });

    function renderStudentSpace() {
      const s = currentStudent();
      if (!s || !document.getElementById('stu-name')) return;
      const g = gradesOf(s);
      const cls = classesMgtData.find(c => classKey(c.name) === classKey(s.classe));
      const set = (id, v) => { document.getElementById(id).textContent = v; };
      const parts = s.nom.split(' ');
      set('stu-initials', ((parts[1] || parts[0])[0] + parts[0][0]).toUpperCase());
      set('stu-name', s.nom);
      set('stu-badge', s.sexe === 'F' ? 'Élève Régulière' : 'Élève Régulier');
      set('stu-class-label', cls ? `${s.classe} (${cls.level})` : s.classe);
      set('stu-matricule', s.matricule);
      set('stu-pp', 'Professeur Principal : ' + (cls ? cls.pp : '—'));
      set('stu-avg', g ? overallAvg(g).toFixed(2) : '—');
      set('stu-rank', g ? rankLabel(rankOf(g)) : '—');
      set('stu-rank-total', g ? studentsData.length : '—');
      set('stu-sched-title', `Mon Emploi du Temps (Classe de ${s.classe})`);
      document.getElementById('schedule-container').innerHTML = weekTableHtml(s.classe);

      // Mes notes
      const when = gradesMeta.at ? ' • dernière mise à jour le ' + gradesMeta.at.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '';
      const head = `<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
        <div><h3 class="font-extrabold text-slate-900 text-base">📊 Mes Notes</h3>
        <p class="text-xs text-slate-500">Notes saisies et validées par vos enseignants${when}</p></div>
        <button onclick="switchTab('reportcard')" class="bg-slate-900 hover:bg-black text-white font-bold text-xs px-4 py-2 rounded-xl">📄 Voir mon bulletin</button></div>`;
      if (!g) {
        document.getElementById('my-grades').innerHTML = head + '<p class="text-xs text-slate-400 py-4 text-center">Vos enseignants n\'ont pas encore saisi vos notes. Elles apparaîtront ici dès qu\'elles seront validées.</p>';
        return;
      }
      const rows = SUBJECTS.map(x => {
        const m = subjectAvg(g, x.key), maths = x.key === 'maths';
        const c = v => `<td class="py-2.5 px-3 text-center">${maths ? v : '<span class="text-slate-300">—</span>'}</td>`;
        return `<tr class="border-b border-slate-100"><td class="py-2.5 px-3 font-bold text-slate-900">${x.name}<span class="block text-[10px] font-normal text-slate-400">${x.teacher} • coeff ${x.coeff}</span></td>
          ${c(g.d1)}${c(g.d2)}${c(g.compo)}
          <td class="py-2.5 px-3 text-center font-extrabold ${m >= 10 ? 'text-emerald-700' : 'text-rose-700'} bg-slate-50">${m.toFixed(2)}</td></tr>`;
      }).join('');
      document.getElementById('my-grades').innerHTML = head + `
        <div class="overflow-x-auto"><table class="w-full text-left text-xs">
          <thead class="bg-slate-100 text-slate-600 uppercase text-[10px] tracking-wider"><tr><th class="py-2.5 px-3">Matière</th><th class="py-2.5 px-3 text-center">Devoir 1</th><th class="py-2.5 px-3 text-center">Devoir 2</th><th class="py-2.5 px-3 text-center">Compo</th><th class="py-2.5 px-3 text-center">Moyenne</th></tr></thead>
          <tbody>${rows}</tbody></table></div>
        <p class="text-xs font-extrabold text-slate-900">Moyenne générale : <span class="${overallAvg(g) >= 10 ? 'text-emerald-700' : 'text-rose-700'}">${overallAvg(g).toFixed(2)} / 20</span> • ${rankLabel(rankOf(g))} sur ${studentsData.length}</p>
        <p class="text-[11px] text-slate-400">Le détail des devoirs et de la composition est disponible pour les matières dont l'enseignant a saisi les notes (Mathématiques).</p>`;
    }

    // Recalcule tout ce qui dépend du rôle connecté
    function refreshAccess() {
      renderGradesTable();      // inclut applyGradesAccess()
      renderReportCard();
      renderStudentSpace();
    }


    // =========================================================
    // NOTES & BULLETIN (données fictives, en mémoire uniquement)
    // =========================================================
    const SUBJECTS = [
      { key: 'maths', name: 'Mathématiques',       coeff: 3, teacher: 'M. Seck' },
      { key: 'fr',    name: 'Français',            coeff: 3, teacher: 'M. Diallo' },
      { key: 'sp',    name: 'Sciences Physiques',  coeff: 2, teacher: 'M. Sow' },
      { key: 'hg',    name: 'Histoire-Géographie', coeff: 2, teacher: 'Mme Ba' },
      { key: 'ang',   name: 'Anglais',             coeff: 2, teacher: 'Mme Ndiaye' },
      { key: 'svt',   name: 'SVT',                 coeff: 2, teacher: 'M. Fall' }
    ];

    // d1, d2, compo = notes de Mathématiques saisies par le prof ; others = moyennes des autres matières
    const studentsData = [
      { id: 1, name: "DIOP Fatou",     matricule: "SN-2025-0412", d1: 17,   d2: 17, compo: 18,   others: { fr: 16,   sp: 15,   hg: 15.5, ang: 16,   svt: 16 } },
      { id: 2, name: "NDIAYE Babacar", matricule: "SN-2025-0104", d1: 14,   d2: 15, compo: 14.5, others: { fr: 13,   sp: 14,   hg: 12.5, ang: 13.5, svt: 14 } },
      { id: 3, name: "FALL Modou",     matricule: "SN-2025-0899", d1: 9,    d2: 8,  compo: 10,   others: { fr: 10.5, sp: 9,    hg: 11,   ang: 9.5,  svt: 10 } },
      { id: 4, name: "SOW Aminata",    matricule: "SN-2025-0321", d1: 15,   d2: 16, compo: 15.5, others: { fr: 15,   sp: 14.5, hg: 16,   ang: 15,   svt: 14 } },
      { id: 5, name: "SECK Cheikh",    matricule: "SN-2025-0677", d1: 12,   d2: 13, compo: 12.5, others: { fr: 12,   sp: 13,   hg: 12,   ang: 11,   svt: 12.5 } },
      { id: 6, name: "GUEYE Khady",    matricule: "SN-2025-0955", d1: 16,   d2: 14, compo: 15,   others: { fr: 14.5, sp: 15,   hg: 14,   ang: 16.5, svt: 15 } }
    ];

    function mathAvg(s) { return (s.d1 + s.d2 + s.compo * 2) / 4; }
    function subjectAvg(s, key) { return key === 'maths' ? mathAvg(s) : s.others[key]; }
    function overallAvg(s) {
      let total = 0, coeffs = 0;
      SUBJECTS.forEach(x => { total += subjectAvg(s, x.key) * x.coeff; coeffs += x.coeff; });
      return total / coeffs;
    }
    function rankOf(s) {
      const sorted = [...studentsData].sort((a, b) => overallAvg(b) - overallAvg(a));
      return sorted.findIndex(x => x.id === s.id) + 1;
    }
    function rankLabel(r) { return r === 1 ? '1ère' : r + 'ème'; }
    function appreciation(m) {
      if (m >= 16) return 'Excellent travail, félicitations.';
      if (m >= 14) return 'Très bon trimestre, continuez ainsi.';
      if (m >= 12) return 'Bon travail, des progrès sont possibles.';
      if (m >= 10) return 'Résultats passables, il faut s\'investir davantage.';
      return 'Résultats insuffisants, un suivi renforcé est nécessaire.';
    }
    function isValidGrade(v) { return v !== '' && !isNaN(v) && Number(v) >= 0 && Number(v) <= 20; }

    function renderGradesTable() {
      const tbody = document.getElementById('grades-table-body');
      tbody.innerHTML = '';
      studentsData.forEach(s => {
        const cell = (field) => `
          <td class="py-2 px-4 text-center">
            <input type="number" min="0" max="20" step="0.25" value="${s[field]}" data-f="${field}"
              oninput="onGradeInput(this)" ${canEditGrades() ? '' : 'disabled'}
              class="grade-input disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed w-20 text-center font-bold border border-slate-300 rounded-lg py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500">
          </td>`;
        const row = document.createElement('tr');
        row.dataset.id = s.id;
        row.innerHTML = `
          <td class="py-3 px-4 font-bold text-slate-900">${s.name}<span class="block font-mono text-[10px] text-slate-400">${s.matricule}</span></td>
          ${cell('d1')}${cell('d2')}${cell('compo')}
          <td class="py-3 px-4 text-center font-extrabold text-emerald-700 bg-slate-50 grade-avg">${mathAvg(s).toFixed(2)}</td>
        `;
        tbody.appendChild(row);
      });
      applyGradesAccess();
    }

    function onGradeInput(el) {
      const row = el.closest('tr');
      const inputs = row.querySelectorAll('.grade-input');
      let ok = true;
      inputs.forEach(i => {
        const valid = isValidGrade(i.value);
        i.classList.toggle('border-rose-500', !valid);
        i.classList.toggle('bg-rose-50', !valid);
        i.classList.toggle('border-slate-300', valid);
        if (!valid) ok = false;
      });
      const avgCell = row.querySelector('.grade-avg');
      if (ok) {
        const [d1, d2, compo] = Array.from(inputs).map(i => Number(i.value));
        avgCell.textContent = ((d1 + d2 + compo * 2) / 4).toFixed(2);
      } else {
        avgCell.textContent = '—';
      }
    }

    function saveGrades() {
      if (!canEditGrades()) { showToast('🔒 Seul le professeur concerné peut saisir ou modifier ces notes.'); return; }
      const rows = document.querySelectorAll('#grades-table-body tr');
      let allValid = true;
      rows.forEach(row => {
        row.querySelectorAll('.grade-input').forEach(i => { if (!isValidGrade(i.value)) allValid = false; });
      });
      if (!allValid) {
        showToast('⚠️ Certaines notes sont vides ou hors de 0–20. Corrigez les champs en rouge.');
        return;
      }
      rows.forEach(row => {
        const s = studentsData.find(x => x.id === Number(row.dataset.id));
        row.querySelectorAll('.grade-input').forEach(i => { s[i.dataset.f] = Number(i.value); });
      });
      gradesMeta.at = new Date();
      renderReportCard();
      updateStudentBanner();
      showToast('💾 Notes enregistrées. Les élèves peuvent maintenant consulter leurs notes.');
    }

    function updateStudentBanner() { renderStudentSpace(); }

    function renderReportCard() {
      const select = document.getElementById('rc-select');
      const list = currentRole === 'student' ? studentsData.filter(x => x.matricule === currentStudentMat) : studentsData;
      const keepSel = select.value;
      select.innerHTML = '';
      select.disabled = currentRole === 'student';
      list.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id; opt.textContent = s.name + ' (' + s.matricule + ')';
        select.appendChild(opt);
      });
      if (keepSel) select.value = keepSel;
      if (!list.length) {
        document.getElementById('rc-sheet').innerHTML = '<p class="text-center text-slate-400 py-8">Aucun bulletin disponible : vos notes n\'ont pas encore été saisies par vos enseignants.</p>';
        return;
      }
      const s = list.find(x => x.id === Number(select.value)) || list[0];
      const moy = overallAvg(s);
      const rank = rankOf(s);
      const moyClass = moy >= 10 ? 'text-emerald-700' : 'text-rose-700';

      const rowsHtml = SUBJECTS.map(x => {
        const m = subjectAvg(s, x.key);
        return `
          <tr class="border-b border-slate-100">
            <td class="py-2 px-3 font-semibold">${x.name}</td>
            <td class="py-2 px-3 text-slate-500">${x.teacher}</td>
            <td class="py-2 px-3 text-center">${x.coeff}</td>
            <td class="py-2 px-3 text-center font-bold ${m >= 10 ? '' : 'text-rose-700'}">${m.toFixed(2)}</td>
            <td class="py-2 px-3 text-center">${(m * x.coeff).toFixed(2)}</td>
          </tr>`;
      }).join('');
      const totalCoeff = SUBJECTS.reduce((a, x) => a + x.coeff, 0);

      document.getElementById('rc-sheet').innerHTML = `
        <h2 class="font-extrabold text-center text-sm uppercase">Bulletin Officiel - République du Sénégal</h2>
        <p class="text-center text-slate-500 text-[10px]">${(window.SCHOOL && window.SCHOOL.ia) || 'IA Diourbel'} • ${(window.SCHOOL && window.SCHOOL.ief) || 'IEF Touba'} • ${(window.SCHOOL && window.SCHOOL.name) || 'Groupe Scolaire Al-Amine'} • Année scolaire ${(window.SCHOOL && window.SCHOOL.schoolYear) || '2026 - 2027'}</p>
        <div class="bg-slate-50 p-3 rounded-xl my-4 flex flex-wrap justify-between gap-2 font-bold">
          <span>Élève : ${s.name} (3ème A)</span>
          <span>N° Unique : ${s.matricule}</span>
          <span class="${moyClass}">Moyenne : ${moy.toFixed(2)} / 20 (${rankLabel(rank)} sur ${studentsData.length})</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead class="bg-slate-100 text-slate-600 uppercase text-[10px] tracking-wider">
              <tr>
                <th class="py-2 px-3">Matière</th><th class="py-2 px-3">Enseignant</th>
                <th class="py-2 px-3 text-center">Coeff</th><th class="py-2 px-3 text-center">Moyenne /20</th>
                <th class="py-2 px-3 text-center">Points</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
            <tfoot>
              <tr class="bg-slate-50 font-extrabold">
                <td class="py-2 px-3" colspan="2">Total / Moyenne générale</td>
                <td class="py-2 px-3 text-center">${totalCoeff}</td>
                <td class="py-2 px-3 text-center ${moyClass}">${moy.toFixed(2)}</td>
                <td class="py-2 px-3 text-center">${(moy * totalCoeff).toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div class="mt-4 p-3 rounded-xl border border-slate-200">
          <span class="font-bold">Appréciation du conseil de classe :</span> ${appreciation(moy)}
        </div>
        <p class="mt-3 text-[10px] text-slate-400">Rang calculé parmi les ${studentsData.length} élèves dont les notes sont saisies dans ce prototype.</p>
      `;
    }

    function showToast(msg) {
      const toast = document.getElementById('toast');
      document.getElementById('toast-msg').innerText = msg;
      toast.classList.remove('hidden');
      toast.classList.add('flex');
      setTimeout(() => {
        toast.classList.add('hidden');
        toast.classList.remove('flex');
      }, 3500);
    }

    // =========================================================
    // CLASSES MANAGEMENT DATA (déclaré AVANT init pour éviter l'erreur TDZ)
    // =========================================================
    var classesMgtData = [
      { name: "6ème A",       level: "Collège", effectif: 45, pp: "M. Amadou Diallo", room: "Salle 01" },
      { name: "3ème A",       level: "Collège", effectif: 42, pp: "M. Amadou Diallo", room: "Salle 04" },
      { name: "3ème B",       level: "Collège", effectif: 38, pp: "Mme Fatou Ndiaye",  room: "Salle 05" },
      { name: "4ème A",       level: "Collège", effectif: 40, pp: "M. Ibrahima Sow",   room: "Salle 06" },
      { name: "2nde C",       level: "Lycée",   effectif: 36, pp: "M. Oumar Seck",     room: "Salle 10" },
      { name: "Terminale S2", level: "Lycée",   effectif: 32, pp: "M. Oumar Seck",     room: "Salle 12" }
    ];
    var nextMatriculeNum = 469;
    var nextClassId = 1;
    classesMgtData.forEach(c => { c.id = nextClassId++; });
    var classesTrash = [];            // [{ cls, deletedAt }]
    var teachersTrash = [];           // [{ teacher, deletedAt }]  ← NOUVEAU : corbeille enseignants
    var ctxClassId = null, ctxOpenedAt = 0;
    const TRASH_DAYS = 30, DAY_MS = 86400000;

    // Base de données des élèves pour la recherche
    var allStudentsDB = [
      { nom: "DIOP Fatou",      matricule: "SN-2025-0412", sexe: "F", classe: "3ème A", parent: "M. Moussa Diop",       phone: "+221 77 123 45 67", fee: "30 000 FCFA", statut: "Payé",      statutClass: "bg-emerald-100 text-emerald-800" },
      { nom: "NDIAYE Babacar",  matricule: "SN-2025-0104", sexe: "M", classe: "3ème A", parent: "Mme Aïssatou Ndiaye",  phone: "+221 78 234 56 78", fee: "30 000 FCFA", statut: "Payé",      statutClass: "bg-emerald-100 text-emerald-800" },
      { nom: "FALL Modou",      matricule: "SN-2025-0899", sexe: "M", classe: "3ème A", parent: "M. Cheikh Fall",       phone: "+221 76 345 67 89", fee: "30 000 FCFA", statut: "En retard", statutClass: "bg-rose-100 text-rose-800"        },
      { nom: "SOW Aminata",     matricule: "SN-2025-0321", sexe: "F", classe: "3ème A", parent: "M. Ousmane Sow",       phone: "+221 70 456 78 90", fee: "30 000 FCFA", statut: "Payé",      statutClass: "bg-emerald-100 text-emerald-800" },
      { nom: "SECK Cheikh",     matricule: "SN-2025-0677", sexe: "M", classe: "3ème A", parent: "Mme Mariama Seck",     phone: "+221 77 567 89 01", fee: "30 000 FCFA", statut: "Payé",      statutClass: "bg-emerald-100 text-emerald-800" },
      { nom: "GUEYE Khady",     matricule: "SN-2025-0955", sexe: "F", classe: "3ème A", parent: "M. Ibrahima Gueye",   phone: "+221 78 678 90 12", fee: "30 000 FCFA", statut: "Payé",      statutClass: "bg-emerald-100 text-emerald-800" },
      { nom: "CISSE Mamadou",   matricule: "SN-2025-0211", sexe: "M", classe: "3ème B", parent: "M. Abdou Cisse",       phone: "+221 77 111 22 33", fee: "30 000 FCFA", statut: "Payé",      statutClass: "bg-emerald-100 text-emerald-800" },
      { nom: "DIENG Rama",      matricule: "SN-2025-0544", sexe: "F", classe: "3ème B", parent: "Mme Fama Dieng",       phone: "+221 78 222 33 44", fee: "30 000 FCFA", statut: "En retard", statutClass: "bg-rose-100 text-rose-800"        },
      { nom: "BA Mariama",      matricule: "SN-2025-0912", sexe: "F", classe: "4ème A", parent: "M. Amadou Ba",         phone: "+221 77 999 88 77", fee: "35 000 FCFA", statut: "En retard", statutClass: "bg-rose-100 text-rose-800"        },
      { nom: "SARR Oumar",      matricule: "SN-2025-0723", sexe: "M", classe: "Tle S2", parent: "M. Cheikh Sarr",       phone: "+221 70 888 77 66", fee: "40 000 FCFA", statut: "Payé",      statutClass: "bg-emerald-100 text-emerald-800" }
    ];

    // =========================================================
    // ENSEIGNANTS (données fictives, en mémoire)
    // =========================================================
    const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const S = (day, start, end, classe, room) => ({ day, start, end, classe, room });
    let teachersData = [
      { id: 1, matricule: 'ENS-2025-001', name: 'M. Amadou Diallo',  subject: 'Français',            phone: '+221 77 410 22 18', slots: [S('Mar','10:00','12:00','3ème A','Salle 04'), S('Mer','08:00','10:00','3ème A','Salle 04'), S('Jeu','08:00','10:00','6ème A','Salle 01'), S('Ven','10:00','12:00','6ème A','Salle 01')] },
      { id: 2, matricule: 'ENS-2025-002', name: 'M. Cheikh Seck',    subject: 'Mathématiques',       phone: '+221 78 520 33 41', slots: [S('Lun','08:00','10:00','3ème A','Salle 04'), S('Lun','14:00','16:00','3ème B','Salle 05'), S('Mer','10:00','12:00','4ème A','Salle 06'), S('Jeu','10:00','12:00','3ème A','Salle 04'), S('Ven','08:00','10:00','3ème B','Salle 05')] },
      { id: 3, matricule: 'ENS-2025-003', name: 'M. Ibrahima Sow',   subject: 'Sciences Physiques',  phone: '+221 76 630 47 55', slots: [S('Lun','10:00','12:00','3ème A','Salle 04'), S('Mar','10:00','12:00','4ème A','Salle 06'), S('Jeu','08:00','10:00','3ème B','Salle 05'), S('Sam','08:00','10:00','2nde C','Salle 10')] },
      { id: 4, matricule: 'ENS-2025-004', name: 'Mme Aïssatou Ba',   subject: 'Histoire-Géographie', phone: '+221 70 740 15 62', slots: [S('Mar','08:00','10:00','3ème A','Salle 04'), S('Mer','08:00','10:00','4ème A','Salle 06'), S('Ven','10:00','12:00','3ème B','Salle 05'), S('Sam','10:00','12:00','6ème A','Salle 01')] },
      { id: 5, matricule: 'ENS-2025-005', name: 'Mme Fatou Ndiaye',  subject: 'Anglais',             phone: '+221 77 850 29 36', slots: [S('Lun','08:00','10:00','3ème B','Salle 05'), S('Mer','08:00','10:00','6ème A','Salle 01'), S('Jeu','14:00','16:00','3ème A','Salle 04'), S('Ven','08:00','10:00','4ème A','Salle 06')] },
      { id: 6, matricule: 'ENS-2025-006', name: 'M. Ousmane Fall',   subject: 'SVT',                 phone: '+221 78 960 51 74', slots: [S('Mar','14:00','16:00','3ème A','Salle 04'), S('Mer','10:00','12:00','3ème B','Salle 05'), S('Jeu','10:00','12:00','6ème A','Salle 01'), S('Sam','08:00','10:00','3ème A','Salle 04')] },
      { id: 7, matricule: 'ENS-2025-007', name: 'M. Oumar Seck',     subject: 'Mathématiques (Lycée)', phone: '+221 70 180 64 27', slots: [S('Lun','08:00','10:00','Terminale S2','Salle 12'), S('Mar','08:00','10:00','2nde C','Salle 10'), S('Mer','08:00','10:00','Terminale S2','Salle 12'), S('Jeu','10:00','12:00','2nde C','Salle 10'), S('Ven','08:00','10:00','Terminale S2','Salle 12')] }
    ];
    let nextTeacherId = 8, nextTeacherNum = 8, selectedTeacherId = 1;

    // Init
    renderGradesTable();
    renderReportCard();
    updateStudentBanner();
    renderClassesMgtTable();
    renderTeachers();
    switchTab('classes-registry');

    // =========================================================
    // CLASSES MANAGEMENT DATA & FUNCTIONS (suite — les fonctions sont ici)
    // =========================================================
    // (les données classesMgtData et allStudentsDB sont déclarées plus haut)


    function esc(s) {
      return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    }
    // Clé de comparaison : "3ème A" = "3eme A", "Terminale S2" = "Tle S2"
    function classKey(s) {
      return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '').replace('terminale', 'tle');
    }
    function openModal(id) { const el = document.getElementById(id); el.classList.remove('hidden'); el.classList.add('flex'); }
    function closeModal(id) { const el = document.getElementById(id); el.classList.add('hidden'); el.classList.remove('flex'); }
    function purgeExpiredTrash() {
      const now = Date.now();
      classesTrash   = classesTrash.filter(t => now - t.deletedAt < TRASH_DAYS * DAY_MS);
      teachersTrash  = teachersTrash.filter(t => now - t.deletedAt < TRASH_DAYS * DAY_MS);
    }
    function nameTaken(name, exceptId) {
      return classesMgtData.some(c => c.id !== exceptId && classKey(c.name) === classKey(name));
    }
    function levelColor(level) {
      return level === 'Primaire' ? 'text-blue-700 bg-blue-50' : level === 'Collège' ? 'text-emerald-700 bg-emerald-50' : 'text-orange-700 bg-orange-50';
    }

    function renderClassesMgtTable() {
      purgeExpiredTrash();
      const tbody = document.getElementById('classes-mgt-table');
      if (!tbody) return;
      tbody.innerHTML = '';
      if (!classesMgtData.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="py-8 text-center text-slate-400">Aucune classe. Créez-en une ou restaurez-en une depuis la corbeille.</td></tr>';
      }
      classesMgtData.forEach(cls => {
        const row = document.createElement('tr');
        row.dataset.id = cls.id;
        row.className = 'hover:bg-violet-50/30 transition select-none';
        row.style.cursor = 'context-menu';
        row.innerHTML = `
          <td class="py-3 px-4 font-extrabold text-slate-900">${esc(cls.name)}</td>
          <td class="py-3 px-4"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${levelColor(cls.level)}">${cls.level}</span></td>
          <td class="py-3 px-4 text-center font-extrabold text-xl text-slate-900">${cls.effectif} <span class="text-xs font-normal text-slate-400">élèves</span></td>
          <td class="py-3 px-4 text-slate-700 font-medium text-xs">${esc(cls.pp)}</td>
          <td class="py-3 px-4 text-slate-500 text-xs font-medium">${esc(cls.room || '—')}</td>
          <td class="py-3 px-4 text-center">
            <button onclick="openClassList(${cls.id})" class="bg-white border border-slate-200 hover:border-violet-400 text-slate-600 hover:text-violet-700 font-bold px-3 py-1 rounded-lg text-[10px] shadow-xs">Liste</button>
          </td>
        `;
        tbody.appendChild(row);
      });

      document.getElementById('mgt-total-classes').innerText = classesMgtData.length;
      document.getElementById('mgt-total-students').innerText = classesMgtData.reduce((s, c) => s + c.effectif, 0);
      document.getElementById('trash-count').innerText = classesTrash.length;

      // Liste des classes du formulaire d'inscription (toujours à jour)
      document.getElementById('class-options').innerHTML =
        classesMgtData.map(c => `<option value="${esc(c.name)}">${c.effectif} élèves</option>`).join('');
      const pps = [...new Set(classesMgtData.map(c => c.pp).filter(n => n && !n.startsWith('—')))];
      document.getElementById('pp-options').innerHTML = pps.map(n => `<option value="${esc(n)}"></option>`).join('');
      renderRegistry();
      renderCashStudents();
      renderSchedules();
    }

    // ---------- Liste complète des élèves d'une classe ----------
    function openClassList(id) {
      const cls = classesMgtData.find(c => c.id === id);
      if (!cls) return;
      const students = allStudentsDB
        .filter(s => classKey(s.classe) === classKey(cls.name))
        .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
      document.getElementById('cl-title').textContent = 'Liste des élèves : ' + cls.name;
      document.getElementById('cl-sub').textContent = `${cls.level} • PP : ${cls.pp} • ${cls.room || '—'} • Effectif : ${cls.effectif} élèves`;

      let html;
      if (!students.length) {
        html = '<div class="p-10 text-center text-slate-400 text-sm"><div class="text-3xl mb-2">📭</div>Aucun élève enregistré dans cette classe.</div>';
      } else {
        const rows = students.map((s, i) => `
          <tr class="hover:bg-slate-50">
            <td class="py-2.5 px-4 text-center font-bold text-slate-400">${i + 1}</td>
            <td class="py-2.5 px-4 font-bold text-slate-900">${esc(s.nom)}</td>
            <td class="py-2.5 px-4 font-mono text-[11px] text-blue-700 font-bold">${s.matricule}</td>
            <td class="py-2.5 px-4 font-semibold text-slate-600">${s.sexe}</td>
            <td class="py-2.5 px-4 text-slate-700">${esc(s.parent)}</td>
            <td class="py-2.5 px-4 font-mono text-slate-600">${esc(s.phone)}</td>
            <td class="py-2.5 px-4 text-center"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${s.statutClass}">${s.statut}</span></td>
          </tr>`).join('');
        html = `
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-100 text-slate-600 font-semibold uppercase tracking-wider sticky top-0">
              <tr><th class="py-3 px-4 w-12 text-center">N°</th><th class="py-3 px-4">Élève</th><th class="py-3 px-4">N° de Compte</th><th class="py-3 px-4">Sexe</th><th class="py-3 px-4">Parent / Tuteur</th><th class="py-3 px-4">Téléphone</th><th class="py-3 px-4 text-center">Scolarité</th></tr>
            </thead>
            <tbody class="divide-y divide-slate-100">${rows}</tbody>
          </table>`;
        if (students.length < cls.effectif) {
          html += `<p class="px-5 py-3 text-[11px] text-slate-400 border-t border-slate-100">Prototype : ${students.length} élève(s) enregistré(s) sur un effectif déclaré de ${cls.effectif}.</p>`;
        }
      }
      document.getElementById('cl-body').innerHTML = html;
      openModal('class-list-modal');
    }

    // ---------- Menu clic droit ----------
    function openCtxMenu(id, x, y) {
      const cls = classesMgtData.find(c => c.id === id);
      if (!cls) return;
      ctxClassId = id; ctxOpenedAt = Date.now();
      document.getElementById('ctx-title').textContent = cls.name;
      const m = document.getElementById('ctx-menu');
      m.classList.remove('hidden');
      m.style.left = Math.max(8, Math.min(x, window.innerWidth - m.offsetWidth - 8)) + 'px';
      m.style.top = Math.max(8, Math.min(y, window.innerHeight - m.offsetHeight - 8)) + 'px';
    }
    function closeCtxMenu() { document.getElementById('ctx-menu').classList.add('hidden'); }
    function ctxEdit()   { if (Date.now() - ctxOpenedAt < 350) return; const id = ctxClassId; closeCtxMenu(); openEditClass(id); }
    function ctxDelete() { if (Date.now() - ctxOpenedAt < 350) return; const id = ctxClassId; closeCtxMenu(); moveClassToTrash(id); }

    (function initClassContextMenu() {
      const tbody = document.getElementById('classes-mgt-table');
      tbody.addEventListener('contextmenu', e => {
        const tr = e.target.closest('tr[data-id]');
        if (!tr) return;
        e.preventDefault();
        openCtxMenu(Number(tr.dataset.id), e.clientX, e.clientY);
      });
      // Appui long (mobile)
      let timer = null;
      tbody.addEventListener('touchstart', e => {
        const tr = e.target.closest('tr[data-id]');
        if (!tr) return;
        const t = e.touches[0];
        timer = setTimeout(() => openCtxMenu(Number(tr.dataset.id), t.clientX, t.clientY), 550);
      }, { passive: true });
      ['touchmove', 'touchend', 'touchcancel'].forEach(ev => tbody.addEventListener(ev, () => clearTimeout(timer), { passive: true }));

      document.addEventListener('click', e => { if (!e.target.closest('#ctx-menu')) closeCtxMenu(); });
      document.addEventListener('contextmenu', e => { if (!e.target.closest('#classes-mgt-table tr[data-id]')) closeCtxMenu(); });
      window.addEventListener('scroll', closeCtxMenu, true);
      window.addEventListener('resize', closeCtxMenu);
      document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        closeCtxMenu();
        ['class-list-modal', 'class-edit-modal', 'class-trash-modal', 'student-dossier-modal', 'student-edit-modal'].forEach(closeModal);
      });
    })();

    // ---------- Modifier ----------
    function openEditClass(id) {
      const cls = classesMgtData.find(c => c.id === id);
      if (!cls) return;
      document.getElementById('edit-cls-id').value = id;
      document.getElementById('edit-cls-name').value = cls.name;
      document.getElementById('edit-cls-level').value = cls.level;
      document.getElementById('edit-cls-room').value = cls.room || '';
      document.getElementById('edit-cls-pp').value = cls.pp.startsWith('—') ? '' : cls.pp;
      openModal('class-edit-modal');
      document.getElementById('edit-cls-name').focus();
    }

    function handleEditClass(e) {
      e.preventDefault();
      const id = Number(document.getElementById('edit-cls-id').value);
      const cls = classesMgtData.find(c => c.id === id);
      if (!cls) return;
      const name = document.getElementById('edit-cls-name').value.trim();
      if (!name) return;
      if (nameTaken(name, id)) { showToast(`⚠️ Une classe nommée "${name}" existe déjà.`); return; }
      const oldName = cls.name;
      // Les élèves suivent la classe renommée
      if (classKey(oldName) !== classKey(name) || oldName !== name) {
        allStudentsDB.forEach(s => { if (classKey(s.classe) === classKey(oldName)) s.classe = name; });
      }
      teachersData.forEach(t => t.slots.forEach(sl => { if (classKey(sl.classe) === classKey(oldName)) sl.classe = name; }));
      cls.name = name;
      cls.level = document.getElementById('edit-cls-level').value;
      cls.room = document.getElementById('edit-cls-room').value.trim() || 'À définir';
      cls.pp = document.getElementById('edit-cls-pp').value.trim() || '— Pas encore assigné —';
      closeModal('class-edit-modal');
      renderClassesMgtTable();
      showToast(oldName === name ? `✏️ Classe "${name}" modifiée.` : `✏️ Classe "${oldName}" renommée en "${name}".`);
    }

    // ---------- Supprimer (vers la corbeille, 30 jours) ----------
    function moveClassToTrash(id) {
      const i = classesMgtData.findIndex(c => c.id === id);
      if (i < 0) return;
      const [cls] = classesMgtData.splice(i, 1);
      classesTrash.push({ cls, deletedAt: Date.now() });
      renderClassesMgtTable();
      showToast(`🗑️ Classe "${cls.name}" déplacée dans la corbeille (conservée ${TRASH_DAYS} jours).`);
    }

    function openTrash() { renderTrash(); openModal('class-trash-modal'); }

    function renderTrash() {
      purgeExpiredTrash();
      const body = document.getElementById('trash-body');
      if (!classesTrash.length) {
        body.innerHTML = '<div class="p-10 text-center text-slate-400 text-sm"><div class="text-3xl mb-2">✨</div>La corbeille est vide.</div>';
        return;
      }
      body.innerHTML = classesTrash.map(t => {
        const daysLeft = Math.max(1, Math.ceil((t.deletedAt + TRASH_DAYS * DAY_MS - Date.now()) / DAY_MS));
        return `
          <div class="px-5 py-3.5 flex items-center justify-between gap-3 text-xs">
            <div>
              <p class="font-extrabold text-slate-900 text-sm">${esc(t.cls.name)} <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${levelColor(t.cls.level)}">${t.cls.level}</span></p>
              <p class="text-slate-500">${t.cls.effectif} élèves • supprimée le ${new Date(t.deletedAt).toLocaleDateString('fr-FR')}</p>
              <p class="text-amber-600 font-semibold">Suppression définitive dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}</p>
            </div>
            <div class="flex gap-1.5 shrink-0">
              <button onclick="restoreClass(${t.cls.id})" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-[11px]">↩ Restaurer</button>
              <button onclick="purgeClass(this, ${t.cls.id})" class="bg-white border border-slate-300 hover:border-rose-400 text-rose-600 font-bold px-3 py-1.5 rounded-lg text-[11px]">Supprimer</button>
            </div>
          </div>`;
      }).join('');
    }

    function restoreClass(id) {
      const i = classesTrash.findIndex(t => t.cls.id === id);
      if (i < 0) return;
      const cls = classesTrash[i].cls;
      if (nameTaken(cls.name, id)) { showToast(`⚠️ Une classe "${cls.name}" existe déjà : renommez-la avant de restaurer.`); return; }
      classesTrash.splice(i, 1);
      classesMgtData.push(cls);
      renderClassesMgtTable();
      renderTrash();
      showToast(`↩ Classe "${cls.name}" restaurée.`);
    }

    // Suppression définitive : deux clics (pas de boîte de dialogue du navigateur)
    function purgeClass(btn, id) {
      if (!btn.dataset.armed) {
        btn.dataset.armed = '1';
        btn.textContent = 'Confirmer ?';
        btn.classList.add('bg-rose-600', 'text-white');
        setTimeout(() => {
          if (!btn.isConnected) return;
          delete btn.dataset.armed; btn.textContent = 'Supprimer'; btn.classList.remove('bg-rose-600', 'text-white');
        }, 3000);
        return;
      }
      const i = classesTrash.findIndex(t => t.cls.id === id);
      if (i < 0) return;
      const name = classesTrash[i].cls.name;
      classesTrash.splice(i, 1);
      renderClassesMgtTable();
      renderTrash();
      showToast(`❌ Classe "${name}" supprimée définitivement.`);
    }

    function handleCreateClass(e) {
      e.preventDefault();
      const name  = document.getElementById('cls-name').value.trim();
      const level = document.getElementById('cls-level').value;
      const room  = document.getElementById('cls-room').value.trim() || 'À définir';
      const pp    = document.getElementById('cls-pp').value.trim() || '— Pas encore assigné —';
      if (nameTaken(name, null)) { showToast(`⚠️ Une classe nommée "${name}" existe déjà.`); return; }

      classesMgtData.push({ id: nextClassId++, name, level, effectif: 0, pp, room });
      renderClassesMgtTable();
      document.getElementById('cls-name').value = '';
      document.getElementById('cls-room').value = '';
      document.getElementById('cls-pp').value = '';
      showToast(`🏫 Classe "${name}" créée avec succès ! Effectif : 0 élève.`);
    }


    // =========================================================
    // ENSEIGNANTS : affichage et actions
    // =========================================================
    function teacherClasses(t) { return [...new Set(t.slots.map(s => s.classe))]; }
    function teacherHours(t) { return t.slots.reduce((h, s) => h + (toMin(s.end) - toMin(s.start)) / 60, 0); }
    function fmtHours(h) { return (Math.round(h * 10) / 10).toString().replace('.', ',') + ' h'; }
    function slotsOverlap(a, b) { return a.day === b.day && toMin(a.start) < toMin(b.end) && toMin(b.start) < toMin(a.end); }

    function renderTeachers() {
      const tbody = document.getElementById('teachers-body');
      if (!tbody) return;
      const raw = document.getElementById('t-search').value.trim();
      const q = raw.toLowerCase();
      const byId = new Set(findTeachers(raw).map(t => t.id));
      const list = teachersData.filter(t => !q || [t.name, t.subject, ...teacherClasses(t)].some(v => v.toLowerCase().includes(q)) || byId.has(t.id));
      // La fiche affichée suit la recherche : le premier résultat est sélectionné
      if (q && list.length && !list.some(t => t.id === selectedTeacherId)) selectedTeacherId = list[0].id;
      tbody.innerHTML = list.length ? '' : '<tr><td colspan="6" class="py-8 text-center text-slate-400">Aucun enseignant trouvé.</td></tr>';
      list.forEach(t => {
        const ppOf = classesMgtData.filter(c => c.pp === t.name).map(c => c.name);
        const days = DAYS.filter(d => t.slots.some(s => s.day === d));
        const row = document.createElement('tr');
        row.className = 'cursor-pointer transition ' + (t.id === selectedTeacherId ? 'bg-sky-50' : 'hover:bg-slate-50');
        row.onclick = () => selectTeacher(t.id);
        row.innerHTML = `
          <td class="py-3 px-4"><p class="font-extrabold text-slate-900">${esc(t.name)}</p><p class="text-slate-500">${esc(t.subject)}${ppOf.length ? ` • <span class="text-emerald-700 font-bold">PP ${esc(ppOf.join(', '))}</span>` : ''}</p></td>
          <td class="py-3 px-4 font-mono text-[11px] font-bold text-sky-700">${t.matricule}</td>
          <td class="py-3 px-4 font-mono text-slate-600">${esc(t.phone)}</td>
          <td class="py-3 px-4"><div class="flex flex-wrap gap-1">${teacherClasses(t).map(c => `<span class="bg-violet-50 text-violet-700 font-bold text-[10px] px-2 py-0.5 rounded-full">${esc(c)}</span>`).join('') || '<span class="text-slate-400">—</span>'}</div></td>
          <td class="py-3 px-4 text-slate-600 font-semibold">${days.join(' • ') || '—'}</td>
          <td class="py-3 px-4 text-center font-extrabold text-slate-900">${fmtHours(teacherHours(t))}</td>`;
        tbody.appendChild(row);
      });
      document.getElementById('tch-count').innerText = teachersData.length;
      document.getElementById('tch-hours').innerText = fmtHours(teachersData.reduce((h, t) => h + teacherHours(t), 0));
      syncTeacherMatricule();
      renderTeacherDetail(q && !list.length ? raw : null);
      renderSchedules();
    }

    function selectTeacher(id) { selectedTeacherId = id; renderTeachers(); }

    function renderTeacherDetail(noMatchQuery) {
      const box = document.getElementById('teacher-detail');
      if (noMatchQuery) {
        const st = findStudents(noMatchQuery)[0];
        box.innerHTML = st
          ? `<div class="text-center text-xs space-y-2 py-4"><p class="text-slate-600">Cet identifiant correspond à un <b>élève</b> : <b>${esc(st.nom)}</b> (${esc(st.classe)}).</p>
              <button onclick="openStudentFromSearch(${allStudentsDB.indexOf(st)})" class="bg-sky-700 hover:bg-sky-800 text-white font-bold px-4 py-2 rounded-xl">Voir la fiche de l'élève</button></div>`
          : `<div class="text-center text-slate-400 text-xs py-6"><div class="text-3xl mb-2">🔎</div><p class="font-semibold text-slate-500">Aucun enseignant trouvé pour « ${esc(noMatchQuery)} ».</p><p>Vérifiez le matricule ou le numéro de téléphone.</p></div>`;
        return;
      }
      const t = teachersData.find(x => x.id === selectedTeacherId);
      if (!t) { box.innerHTML = '<p class="text-center text-slate-400 text-xs py-6">Sélectionnez un enseignant pour voir son emploi du temps.</p>'; return; }
      const cols = DAYS.map(d => {
        const items = t.slots.filter(s => s.day === d).sort((a, b) => toMin(a.start) - toMin(b.start));
        return `<div class="bg-slate-50 rounded-2xl border border-slate-200 p-2 space-y-1.5 min-h-[72px]">
          <p class="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">${d}</p>
          ${items.map(s => `<div class="bg-white rounded-xl border border-sky-200 px-2 py-1.5 text-[11px] relative">
              <button onclick="removeSlot(${t.slots.indexOf(s)})" title="Retirer ce créneau" class="absolute top-1 right-1.5 text-slate-300 hover:text-rose-600 font-bold leading-none">✕</button>
              <p class="font-extrabold text-slate-900">${s.start} - ${s.end}</p>
              <p class="text-violet-700 font-bold">${esc(s.classe)}</p><p class="text-slate-500">${esc(s.room)}</p></div>`).join('') || '<p class="text-[10px] text-slate-300">Libre</p>'}
        </div>`;
      }).join('');
      const f = 'bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 w-full';
      box.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 class="font-extrabold text-slate-900 text-base">${esc(t.name)} <span class="text-xs font-semibold text-slate-500">• ${esc(t.subject)}</span></h3>
            <p class="text-xs text-slate-500 mt-0.5"><span class="font-mono font-bold text-sky-700">${t.matricule}</span> • <span class="font-mono">${esc(t.phone)}</span> • ${fmtHours(teacherHours(t))} par semaine</p>
          </div>
          <div class="flex gap-2 shrink-0">
            <button onclick="editTeacher(${t.id})" class="bg-white border border-slate-300 hover:border-sky-500 text-slate-700 font-bold text-[11px] px-3 py-1.5 rounded-lg">✏️ Modifier</button>
            <button onclick="deleteTeacher(this, ${t.id})" class="bg-white border border-slate-300 hover:border-rose-400 text-rose-600 font-bold text-[11px] px-3 py-1.5 rounded-lg">🗑️ Corbeille</button>
          </div>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">${cols}</div>
        <form onsubmit="handleAddSlot(event)" class="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end pt-3 border-t border-slate-100">
          <div><label class="block text-[10px] font-semibold text-slate-600 mb-1">Jour</label><select id="sl-day" class="${f}">${DAYS.map(d => `<option>${d}</option>`).join('')}</select></div>
          <div><label class="block text-[10px] font-semibold text-slate-600 mb-1">Début</label><input type="time" id="sl-start" value="08:00" required class="${f}"></div>
          <div><label class="block text-[10px] font-semibold text-slate-600 mb-1">Fin</label><input type="time" id="sl-end" value="10:00" required class="${f}"></div>
          <div><label class="block text-[10px] font-semibold text-slate-600 mb-1">Classe</label><input type="text" id="sl-class" list="class-options" autocomplete="off" required placeholder="3ème A" class="${f}"></div>
          <div><label class="block text-[10px] font-semibold text-slate-600 mb-1">Salle</label><input type="text" id="sl-room" placeholder="auto" class="${f}"></div>
          <button type="submit" class="bg-sky-700 hover:bg-sky-800 text-white font-extrabold text-xs py-2 rounded-xl col-span-2 sm:col-span-1">+ Créneau</button>
        </form>`;
    }

    // Ajoute un créneau à un professeur après vérification (classe, horaires, conflits)
    function addSlot(t, day, start, end, typedClass, roomIn) {
      const cls = classesMgtData.find(c => classKey(c.name) === classKey(typedClass));
      if (!cls) return { ok: false, msg: `⚠️ La classe "${typedClass}" n'existe pas.` };
      if (!start || !end || toMin(end) <= toMin(start)) return { ok: false, msg: "⚠️ L'heure de fin doit être après l'heure de début." };
      const slot = S(day, start, end, cls.name, roomIn || cls.room || 'À définir');
      const busy = t.slots.find(s => slotsOverlap(s, slot));
      if (busy) return { ok: false, msg: `⚠️ ${t.name} a déjà cours ${busy.day} de ${busy.start} à ${busy.end} (${busy.classe}).` };
      const clash = teachersData.find(o => o.id !== t.id && o.slots.some(s => classKey(s.classe) === classKey(cls.name) && slotsOverlap(s, slot)));
      if (clash) return { ok: false, msg: `⚠️ ${cls.name} a déjà cours à ce moment avec ${clash.name}.` };
      t.slots.push(slot);
      return { ok: true, slot, cls };
    }

    function handleAddSlot(e) {
      e.preventDefault();
      const t = teachersData.find(x => x.id === selectedTeacherId);
      if (!t) return;
      const r = addSlot(t, document.getElementById('sl-day').value, document.getElementById('sl-start').value, document.getElementById('sl-end').value,
        document.getElementById('sl-class').value.trim(), document.getElementById('sl-room').value.trim());
      if (!r.ok) { showToast(r.msg); return; }
      renderTeachers();
      renderStudentSpace();
      showToast(`📅 Créneau ajouté : ${r.slot.day} ${r.slot.start}-${r.slot.end} • ${r.cls.name}. Visible par les élèves de la classe.`);
    }

    function removeSlot(idx) {
      const t = teachersData.find(x => x.id === selectedTeacherId);
      if (!t || !t.slots[idx]) return;
      const [s] = t.slots.splice(idx, 1);
      renderTeachers();
      renderStudentSpace();
      showToast(`Créneau retiré : ${s.day} ${s.start}-${s.end} (${s.classe})`);
    }

    function syncTeacherMatricule() {
      const el = document.getElementById('t-matricule');
      if (!el || document.getElementById('t-id').value) return;   // en modification : on garde le matricule de la fiche
      const auto = 'ENS-2025-' + String(nextTeacherNum).padStart(3, '0');
      if (!el.value || el.value === el.dataset.auto) el.value = auto;
      el.dataset.auto = auto;
    }

    function handleTeacherSubmit(e) {
      e.preventDefault();
      const id = Number(document.getElementById('t-id').value) || 0;
      const name = document.getElementById('t-name').value.trim();
      const subject = document.getElementById('t-subject').value.trim();
      const phone = document.getElementById('t-phone').value.trim();
      const matricule = document.getElementById('t-matricule').value.trim();
      if (!matricule) { showToast('⚠️ Le matricule est obligatoire.'); return; }
      if (teachersData.some(x => x.id !== id && alnum(x.matricule) === alnum(matricule))) { showToast(`⚠️ Le matricule ${matricule} est déjà attribué à un autre enseignant.`); return; }
      if (digitsOf(phone).length < 9) { showToast('⚠️ Numéro de téléphone invalide.'); return; }
      if (id) {
        const t = teachersData.find(x => x.id === id);
        const oldName = t.name;
        Object.assign(t, { name, subject, phone, matricule });
        // Les classes dont il est professeur principal suivent le nouveau nom
        if (oldName !== name) { classesMgtData.forEach(c => { if (c.pp === oldName) c.pp = name; }); renderClassesMgtTable(); }
        showToast(`✏️ Fiche de ${name} corrigée.`);
      } else {
        const auto = 'ENS-2025-' + String(nextTeacherNum).padStart(3, '0');
        if (matricule === auto) nextTeacherNum++;
        const t = { id: nextTeacherId++, matricule, name, subject, phone, slots: [] };
        teachersData.push(t);
        selectedTeacherId = t.id;
        showToast(`👨‍🏫 ${name} enregistré(e) — Matricule : ${t.matricule}`);
      }
      resetTeacherForm();
    }

    function resetTeacherForm() {
      ['t-id', 't-name', 't-subject', 't-phone', 't-matricule'].forEach(i => document.getElementById(i).value = '');
      document.getElementById('tf-title').innerText = '➕ Ajouter un Enseignant';
      document.getElementById('t-submit').innerText = "✓ Enregistrer l'Enseignant";
      document.getElementById('t-cancel').classList.add('hidden');
      renderTeachers();
    }

    function editTeacher(id) {
      const t = teachersData.find(x => x.id === id);
      if (!t) return;
      document.getElementById('t-id').value = id;
      document.getElementById('t-name').value = t.name;
      document.getElementById('t-subject').value = t.subject;
      document.getElementById('t-phone').value = t.phone;
      document.getElementById('tf-title').innerText = '✏️ Modifier la fiche';
      document.getElementById('t-submit').innerText = '✓ Enregistrer les modifications';
      document.getElementById('t-cancel').classList.remove('hidden');
      const mEl = document.getElementById('t-matricule'); mEl.value = t.matricule; mEl.dataset.auto = '';
      document.getElementById('teacher-form-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.getElementById('t-name').focus();
    }

    // ── Corbeille enseignants (30 jours) ──
    function deleteTeacher(btn, id) {
      if (!btn.dataset.armed) {
        btn.dataset.armed = '1'; btn.textContent = 'Confirmer ?'; btn.classList.add('bg-rose-600', 'text-white');
        setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.textContent = '🗑️ Supprimer'; btn.classList.remove('bg-rose-600', 'text-white'); } }, 3000);
        return;
      }
      const i = teachersData.findIndex(t => t.id === id);
      if (i < 0) return;
      const [t] = teachersData.splice(i, 1);
      teachersTrash.push({ teacher: t, deletedAt: Date.now() });
      selectedTeacherId = teachersData.length ? teachersData[0].id : null;
      resetTeacherForm();
      renderTeachers();
      document.getElementById('teacher-trash-count') && (document.getElementById('teacher-trash-count').textContent = teachersTrash.length);
      showToast(`🗑️ ${t.name} déplacé(e) dans la corbeille (conservé ${TRASH_DAYS} jours).`);
    }

    window.openTeacherTrash = function() {
      purgeExpiredTrash();
      let modal = document.getElementById('teacher-trash-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'teacher-trash-modal';
        modal.className = 'hidden fixed inset-0 z-[200] bg-slate-950/60 p-4 items-start justify-center overflow-y-auto';
        modal.innerHTML = `<div class="bg-white rounded-3xl shadow-2xl max-w-lg w-full mt-10 mb-10 overflow-hidden">
          <div class="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100">
            <h2 class="font-black text-slate-900 text-base">🗑️ Corbeille — Enseignants</h2>
            <button onclick="closeModal('teacher-trash-modal')" class="text-slate-400 hover:text-slate-900 text-xl font-bold">✕</button>
          </div>
          <div id="teacher-trash-body" class="divide-y divide-slate-100"></div>
        </div>`;
        document.body.appendChild(modal);
      }
      renderTeacherTrash();
      openModal('teacher-trash-modal');
    };

    function renderTeacherTrash() {
      purgeExpiredTrash();
      const body = document.getElementById('teacher-trash-body');
      if (!body) return;
      if (!teachersTrash.length) {
        body.innerHTML = '<div class="p-10 text-center text-slate-400 text-sm"><div class="text-3xl mb-2">✨</div>La corbeille enseignants est vide.</div>';
        return;
      }
      body.innerHTML = teachersTrash.map(t => {
        const daysLeft = Math.max(1, Math.ceil((t.deletedAt + TRASH_DAYS * DAY_MS - Date.now()) / DAY_MS));
        return `<div class="px-5 py-3.5 flex items-center justify-between gap-3 text-xs">
          <div>
            <p class="font-extrabold text-slate-900 text-sm">${esc(t.teacher.name)} <span class="text-slate-500 font-normal">• ${esc(t.teacher.subject)}</span></p>
            <p class="text-slate-500 font-mono">${esc(t.teacher.matricule)} • ${esc(t.teacher.phone)}</p>
            <p class="text-amber-600 font-semibold">Suppression définitive dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}</p>
          </div>
          <div class="flex gap-1.5 shrink-0">
            <button onclick="restoreTeacher(${t.teacher.id})" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-[11px]">↩ Restaurer</button>
            <button onclick="purgeTeacher(this, ${t.teacher.id})" class="bg-white border border-slate-300 hover:border-rose-400 text-rose-600 font-bold px-3 py-1.5 rounded-lg text-[11px]">Supprimer</button>
          </div>
        </div>`;
      }).join('');
    }

    window.restoreTeacher = function(id) {
      const i = teachersTrash.findIndex(t => t.teacher.id === id);
      if (i < 0) return;
      const t = teachersTrash[i].teacher;
      teachersTrash.splice(i, 1);
      teachersData.push(t);
      selectedTeacherId = t.id;
      renderTeachers();
      renderTeacherTrash();
      showToast(`↩ ${t.name} restauré(e) dans le registre.`);
    };

    window.purgeTeacher = function(btn, id) {
      if (!btn.dataset.armed) {
        btn.dataset.armed = '1'; btn.textContent = 'Confirmer ?'; btn.classList.add('bg-rose-600', 'text-white');
        setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.textContent = 'Supprimer'; btn.classList.remove('bg-rose-600', 'text-white'); } }, 3000);
        return;
      }
      const i = teachersTrash.findIndex(t => t.teacher.id === id);
      if (i < 0) return;
      const name = teachersTrash[i].teacher.name;
      teachersTrash.splice(i, 1);
      renderTeacherTrash();
      showToast(`❌ ${name} supprimé(e) définitivement.`);
    };

    function handleEnrollStudent(e) {
      e.preventDefault();
      const nom     = document.getElementById('stu-nom').value.trim().toUpperCase();
      const prenom  = document.getElementById('stu-prenom').value.trim();
      const sexe    = document.getElementById('stu-sexe').value;
      const typedClass = document.getElementById('stu-class').value.trim();
      const matched = classesMgtData.find(c => classKey(c.name) === classKey(typedClass));
      const cls     = matched ? matched.name : '';
      const parent  = document.getElementById('stu-parent').value.trim();
      const phone   = document.getElementById('stu-phone').value.trim();
      const fee     = document.getElementById('stu-fee').value;
      if (!cls) {
        showToast(classesMgtData.length
          ? `⚠️ La classe "${typedClass}" n'existe pas. Vérifiez le nom ou créez-la d'abord.`
          : '⚠️ Aucune classe disponible : créez ou restaurez une classe d\'abord.');
        return;
      }
      const matricule = studentMatriculePrefix() + String(nextMatriculeNum).padStart(4, '0');

      // Add to searchable DB
      allStudentsDB.push({
        nom: nom + ' ' + prenom,
        matricule,
        sexe,
        classe: cls,
        parent,
        phone,
        fee: parseInt(fee).toLocaleString() + ' FCFA',
        statut: 'Non payé',
        statutClass: 'bg-amber-100 text-amber-800'
      });

      nextMatriculeNum++;
      document.getElementById('matricule-preview').innerText = studentMatriculePrefix() + String(nextMatriculeNum).padStart(4, '0');

      // Increment effectif
      classesMgtData.forEach(c => { if (c.name === cls) c.effectif += 1; });
      renderClassesMgtTable();

      // Add to enrollment feed
      const feed = document.getElementById('enrollment-feed');
      const colorMap = { F: 'bg-pink-100 text-pink-700', M: 'bg-sky-100 text-sky-700' };
      const color = colorMap[sexe] || 'bg-slate-100 text-slate-700';
      const row = document.createElement('div');
      row.className = 'px-5 py-3.5 flex items-center justify-between hover:bg-slate-50 border-t border-slate-100 text-xs bg-emerald-50/30';
      row.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full ${color} flex items-center justify-center font-bold text-sm">${sexe}</div>
          <div>
            <p class="font-bold text-slate-900">${nom} ${prenom}</p>
            <p class="text-slate-500">${cls} • <span class="font-mono">${matricule}</span> • Parent: ${parent}</p>
          </div>
        </div>
        <span class="text-emerald-700 text-[10px] font-bold">Nouveau ✓</span>
      `;
      feed.prepend(row);

      showToast(`🎓 ${nom} ${prenom} inscrit(e) en ${cls} — Matricule : ${matricule}`);

      document.getElementById('stu-nom').value    = '';
      document.getElementById('stu-prenom').value = '';
      document.getElementById('stu-parent').value = '';
      document.getElementById('stu-phone').value  = '';
    }

    // =========================================================
    // RECHERCHE PAR MATRICULE / TÉLÉPHONE (élèves et enseignants)
    // =========================================================
    function alnum(s) { return String(s).toLowerCase().replace(/[^a-z0-9]/g, ''); }
    function digitsOf(s) { return String(s).replace(/\D/g, ''); }

    // Élèves : matricule (complet ou partiel) ou téléphone du parent/tuteur
    function findStudents(raw) {
      const qa = alnum(raw), qd = digitsOf(raw);
      if (qa.length < 3) return [];
      return allStudentsDB.filter(s => alnum(s.matricule).includes(qa) || (qd.length >= 4 && digitsOf(s.phone).includes(qd)));
    }
    // Enseignants : matricule ou téléphone
    function findTeachers(raw) {
      const qa = alnum(raw), qd = digitsOf(raw);
      if (qa.length < 3) return [];
      return teachersData.filter(t => alnum(t.matricule).includes(qa) || (qd.length >= 4 && digitsOf(t.phone).includes(qd)));
    }

    function studentCardHtml(s) {
      const i = allStudentsDB.indexOf(s);
      const avatarColor = s.sexe === 'F' ? 'bg-pink-100 text-pink-700' : 'bg-sky-100 text-sky-700';
      const initials = s.nom.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
      const g = studentsData.find(x => x.name === s.nom);
      const cls = classesMgtData.find(c => classKey(c.name) === classKey(s.classe));
      const box = (label, value, extra = '') => `<div class="bg-white rounded-xl p-2.5 border border-slate-200 ${extra}"><span class="block text-slate-400 font-semibold mb-0.5">${label}</span><span class="font-extrabold text-slate-900">${value}</span></div>`;
      return `
        <div class="bg-sky-50 border border-sky-200 rounded-2xl p-4 space-y-3 text-xs">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-2xl ${avatarColor} flex items-center justify-center font-extrabold text-lg">${esc(initials)}</div>
            <div>
              <p class="font-extrabold text-slate-900 text-sm">${esc(s.nom)}</p>
              <p class="font-mono text-sky-700 font-bold text-[11px]">${esc(s.matricule)}</p>
            </div>
            <span class="ml-auto px-2.5 py-1 rounded-full text-[10px] font-bold ${s.statutClass}">${esc(s.statut)}</span>
          </div>
          <div class="grid grid-cols-2 gap-2 pt-2 border-t border-sky-200">
            ${box('Classe', esc(s.classe))}
            ${box('Sexe', s.sexe === 'F' ? '👧 Fille' : '👦 Garçon')}
            ${box('Parent / Tuteur', esc(s.parent), 'col-span-2')}
            ${box('📱 Téléphone WhatsApp', `<span class="font-mono text-emerald-700">${esc(s.phone)}</span>`, 'col-span-2')}
            ${box('💵 Mensualité', esc(s.fee))}
            ${box('Prof. principal', esc(cls ? cls.pp : '—'))}
            ${g && canSeeGradesOf(s) ? box('📊 Moyenne générale', `${overallAvg(g).toFixed(2)} / 20 • ${rankLabel(rankOf(g))} sur ${studentsData.length}`, 'col-span-2') : ''}
          </div>
          <div class="flex gap-2 pt-1">
            <button onclick="openStudentReport(${i})" class="flex-1 bg-slate-900 text-white font-bold py-2 rounded-xl text-[11px] hover:bg-black transition">📄 Voir Bulletin</button>
            <button onclick="contactParent(${i})" class="flex-1 bg-emerald-600 text-white font-bold py-2 rounded-xl text-[11px] hover:bg-emerald-700 transition">💬 Contacter Parent</button>
          </div>
        </div>`;
    }

    function openStudentReport(i) {
      const s = allStudentsDB[i];
      const g = s && studentsData.find(x => x.name === s.nom);
      if (g && !canSeeGradesOf(s)) { showToast('🔒 Notes confidentielles : réservées à l\'élève concerné, à ses enseignants et à l\'administration.'); return; }
      if (!g) { showToast(`Aucune note saisie pour ${s ? s.nom : 'cet élève'} dans ce prototype.`); return; }
      switchTab('reportcard');
      document.getElementById('rc-select').value = g.id;
      renderReportCard();
    }
    function contactParent(i) {
      const s = allStudentsDB[i];
      if (s) showToast(`💬 Message WhatsApp envoyé à ${s.parent} (${s.phone})...`);
    }
    function openTeacherFromSearch(id) {
      selectedTeacherId = id;
      document.getElementById('t-search').value = '';
      switchTab('teachers-registry');
    }
    function openStudentFromSearch(i) {
      const s = allStudentsDB[i];
      if (!s) return;
      document.getElementById('t-search').value = '';
      switchTab('classes-registry');
      document.getElementById('search-input').value = s.matricule;
      handleStudentSearch();
    }

    function handleStudentSearch() {
      const raw = document.getElementById('search-input').value.trim();
      const resultBox = document.getElementById('search-result');
      const noResultBox = document.getElementById('search-no-result');
      resultBox.classList.add('hidden');
      noResultBox.classList.add('hidden');
      if (alnum(raw).length < 3) return;

      const found = findStudents(raw);
      if (found.length) {
        const shown = found.slice(0, 5);
        const head = found.length > 1
          ? `<p class="text-[11px] font-semibold text-slate-600">${found.length} élèves correspondent${found.length > 5 ? ' (5 premiers affichés, précisez la recherche)' : ' (fratrie ou matricules proches)'}.</p>` : '';
        resultBox.innerHTML = `<div class="space-y-3">${head}${shown.map(studentCardHtml).join('')}</div>`;
        resultBox.classList.remove('hidden');
        return;
      }
      // Pas d'élève : peut-être un enseignant ?
      const t = findTeachers(raw)[0];
      if (t) {
        resultBox.innerHTML = `
          <div class="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs space-y-2">
            <p class="font-semibold text-slate-700">Cet identifiant correspond à un <b>enseignant</b> :</p>
            <p class="font-extrabold text-slate-900 text-sm">${esc(t.name)} <span class="font-normal text-slate-500">• ${esc(t.subject)}</span></p>
            <p class="font-mono text-slate-600">${esc(t.matricule)} • ${esc(t.phone)}</p>
            <button onclick="openTeacherFromSearch(${t.id})" class="w-full bg-sky-700 hover:bg-sky-800 text-white font-bold py-2 rounded-xl text-[11px]">Voir sa fiche et son emploi du temps</button>
          </div>`;
        resultBox.classList.remove('hidden');
      } else {
        noResultBox.classList.remove('hidden');
      }
    }

/* ===== SunuSchool v9 : + espace de paiement ===== */
(() => {
  const VERSION = 'v9';
  const SKEY = 'sunuschool-data-v9', OLDKEYS = ['sunuschool-data-v8', 'sunuschool-data-v7'];
  const SEM = { S1: '1er Semestre', S2: '2nd Semestre' };
  const clamp = v => Math.max(0, Math.min(20, v));
  const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $ = id => document.getElementById(id);
  const fmtC = c => String(c).replace('.', ',');
  const money = n => Number(n || 0).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ') + ' FCFA';
  const safe = fn => { try { return fn(); } catch (e) { console.error(e); } };
  const todayISO = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  let GR = { S1: {}, S2: {} };
  let ATT = {};
  let PAY = [];
  let selClass = null, selSem = 'S1', rcMat = '';
  let attClass = null, attDate = todayISO();
  const absF = { cls: '', from: '2026-09-01', to: todayISO(), q: '' };
  const payF = { cls: '', status: '', q: '' };
  let payMonths = new Set(), payMethod = 'Wave', payPhone = '', lastReceipt = null;

  /* ---------- Droits par rôle ---------- */
  const ALL_TABS = ['classes-registry','classes-management','teachers-registry','cash-payment','student','teacher','admin-hub','reportcard','absences','payments','school-settings'];
  const ALLOWED = { student: ['student','reportcard','payments'], teacher: ['teacher','teachers-registry'], admin: ALL_TABS };
  const HOME = { student: 'student', teacher: 'teacher', admin: 'classes-registry' };
  const allowedTabs = () => ALLOWED[currentRole] || [];

  function applyRoleUI() {
    ALL_TABS.forEach(id => { const b = $('btn-' + id); if (b) b.classList.toggle('hidden', !allowedTabs().includes(id)); });
    const form = $('teacher-form-card'); if (form) form.classList.toggle('hidden', currentRole !== 'admin');
    const tools = $('admin-tools'); if (tools) tools.classList.toggle('hidden', currentRole !== 'admin');
    const visible = ALL_TABS.find(id => { const el = $('tab-' + id); return el && !el.classList.contains('hidden'); });
    if (visible && !allowedTabs().includes(visible)) switchTab(HOME[currentRole]);
  }
  const origSwitch = window.switchTab;
  window.switchTab = function (id) {
    if (!allowedTabs().includes(id)) { showToast('🔒 Cette section n\'est pas accessible avec votre profil.'); id = HOME[currentRole]; }
    origSwitch(id);
    if (id === 'teacher') renderGradesTable();
    if (id === 'reportcard') { if (currentRole === 'student') rcMat = currentStudentMat; renderReportCard(); }
    if (id === 'teachers-registry') decorateTeacherRegistry();
    if (id === 'absences') renderAbsAdmin();
    if (id === 'payments') renderPayments();
  };
  const denyWrite = a => { if (a[0] && a[0].preventDefault) a[0].preventDefault(); showToast('🔒 Lecture seule : seule l\'administration modifie le registre des enseignants.'); };
  ['deleteTeacher','removeSlot','handleAddSlot'].forEach(n => {
    const o = window[n]; if (typeof o !== 'function') return;
    window[n] = function (...a) { if (currentRole !== 'admin') return denyWrite(a); const r = o.apply(this, a); saveAll(); return r; };
  });
  function decorateTeacherRegistry() {
    if (currentRole === 'admin') return;
    const box = $('teacher-detail'); if (!box) return;
    box.querySelectorAll('button').forEach(b => { if (/editTeacher|deleteTeacher|removeSlot/.test(b.getAttribute('onclick') || '')) b.remove(); });
    box.querySelectorAll('form').forEach(f => f.remove());
    box.querySelectorAll('[onsubmit]').forEach(f => f.remove());
  }
  const origDetail = window.renderTeacherDetail;
  window.renderTeacherDetail = function (q) {
    if (currentRole !== 'admin' && q) { $('teacher-detail').innerHTML = `<div class="text-center text-slate-400 text-xs py-6"><div class="text-3xl mb-2">🔎</div><p class="font-semibold text-slate-500">Aucun enseignant trouvé pour « ${E(q)} ».</p></div>`; return; }
    origDetail(q); decorateTeacherRegistry();
  };

  /* ---------- Matières & coefficients ---------- */
  const subjKeyOf = name => { const x = SUBJECTS.find(s => String(name).startsWith(s.name)); return x ? x.key : null; };
  const subjKeyForTeacher = t => {
    let k = subjKeyOf(t.subject);
    if (!k) { k = 'x_' + classKey(t.subject).replace(/[^a-z0-9]/g, ''); if (!SUBJECTS.find(s => s.key === k)) SUBJECTS.push({ key: k, name: t.subject, coeff: typeof t.coeff === 'number' ? t.coeff : 1, teacher: t.name }); }
    return k;
  };
  const coeffOf = t => typeof t.coeff === 'number' ? t.coeff : ((SUBJECTS.find(s => String(t.subject).startsWith(s.name)) || {}).coeff ?? 1);
  function syncSubjects() {
    teachersData.forEach(t => {
      if (typeof t.coeff !== 'number') return;
      const k = subjKeyForTeacher(t), s = SUBJECTS.find(x => x.key === k);
      if (s) { s.coeff = t.coeff; if (k.startsWith('x_')) { s.teacher = t.name; s.name = t.subject; } }
    });
  }
  function ensureCoeffField() {
    if ($('t-coeff')) return;
    const subj = $('t-subject'); if (!subj) return;
    const d = document.createElement('div');
    d.innerHTML = `<label class="block font-semibold text-slate-700 mb-1">Coefficient de la matière</label>
      <input type="number" id="t-coeff" min="0.5" max="10" step="0.5" required placeholder="ex : 3" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500">`;
    const holder = subj.parentElement; holder.parentNode.insertBefore(d, holder.nextSibling);
  }
  const origSubmit = window.handleTeacherSubmit;
  window.handleTeacherSubmit = function (e) {
    if (currentRole !== 'admin') return denyWrite([e]);
    ensureCoeffField();
    const raw = $('t-coeff').value, c = Number(raw);
    if (raw === '' || isNaN(c) || c < 0.5 || c > 10) { if (e && e.preventDefault) e.preventDefault(); showToast('⚠️ Coefficient invalide : saisissez une valeur entre 0,5 et 10.'); return; }
    const id = Number($('t-id').value) || 0, before = teachersData.length;
    origSubmit.call(this, e);
    const t = id ? ($('t-id').value === '' ? teachersData.find(x => x.id === id) : null) : (teachersData.length > before ? teachersData[teachersData.length - 1] : null);
    if (!t) return;
    t.coeff = c; syncSubjects(); renderTeachers(); saveAll();
    showToast(`✅ ${t.name} • ${t.subject} • coefficient ${fmtC(c)} enregistré.`);
  };
  const origEdit = window.editTeacher;
  window.editTeacher = function (id) {
    if (currentRole !== 'admin') return denyWrite([]);
    ensureCoeffField(); origEdit.call(this, id);
    const t = teachersData.find(x => x.id === id); if (t) $('t-coeff').value = coeffOf(t);
  };
  const origReset = window.resetTeacherForm;
  window.resetTeacherForm = function () { ensureCoeffField(); $('t-coeff').value = ''; origReset(); };
  const origRT = window.renderTeachers;
  window.renderTeachers = function () {
    origRT();
    const tb = $('teachers-body'); if (!tb) return;
    [...tb.children].forEach(row => {
      const tds = row.children; if (!tds || tds.length < 2) return;
      const t = teachersData.find(x => x.matricule === (tds[1].textContent || '').trim()); if (!t) return;
      const p = tds[0].querySelector && tds[0].querySelector('p + p');
      if (p && !/coeff/.test(p.innerHTML)) p.innerHTML += ` • <span class="text-amber-700 font-bold">coeff ${fmtC(coeffOf(t))}</span>`;
    });
    decorateTeacherRegistry();
  };

  /* ---------- Recherche administrateur ---------- */
  window.handleStudentSearch = function () {
    const raw = $('search-input').value.trim(), res = $('search-result'), none = $('search-no-result');
    res.classList.add('hidden'); none.classList.add('hidden');
    if (alnum(raw).length < 3 || currentRole !== 'admin') return;
    const st = findStudents(raw), th = findTeachers(raw);
    if (!st.length && !th.length) { none.classList.remove('hidden'); return; }
    const sHead = st.length ? `<p class="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">🎓 Élèves (${st.length}${st.length > 5 ? ', 5 premiers affichés' : ''})</p>` : '';
    const tHead = th.length ? `<p class="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">👨‍🏫 Enseignants (${th.length})</p>` : '';
    const tCards = th.slice(0, 5).map(t => `
      <div class="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs space-y-2">
        <p class="font-extrabold text-slate-900 text-sm">${E(t.name)} <span class="font-normal text-slate-500">• ${E(t.subject)} • coeff ${fmtC(coeffOf(t))}</span></p>
        <p class="font-mono text-slate-600">${E(t.matricule)} • ${E(t.phone)}</p>
        <p class="text-slate-500">Classes : ${teacherClasses(t).map(E).join(', ') || '—'} • ${fmtHours(teacherHours(t))} / semaine</p>
        <button onclick="openTeacherFromSearch(${t.id})" class="w-full bg-sky-700 hover:bg-sky-800 text-white font-bold py-2 rounded-xl text-[11px]">Voir sa fiche et son emploi du temps</button>
      </div>`).join('');
    res.innerHTML = `<div class="space-y-3">${sHead}${st.slice(0, 5).map(studentCardHtml).join('')}${tHead}${tCards}</div>`;
    res.classList.remove('hidden');
  };

  /* ---------- Paiements : logique ---------- */
  const MONTHS = ['Octobre','Novembre','Décembre','Janvier','Février','Mars','Avril','Mai','Juin'];
  const MONTH_NUM = [9, 10, 11, 0, 1, 2, 3, 4, 5];
  const METHODS = { 'Wave': 'bg-sky-100 text-sky-800', 'Orange Money': 'bg-orange-100 text-orange-800', 'Espèces': 'bg-emerald-100 text-emerald-800' };
  const currentMonthIdx = () => MONTH_NUM.indexOf(new Date().getMonth());
  const feeOf = s => { const n = parseInt(digitsOf(s.fee || '0'), 10); return n > 0 ? n : 0; };
  const payRecs = mat => PAY.filter(p => p.mat === mat);
  const paidFor = (mat, month) => PAY.filter(p => p.mat === mat && p.month === month).reduce((a, p) => a + p.amount, 0);
  const isPaid = (s, month) => feeOf(s) > 0 && paidFor(s.matricule, month) >= feeOf(s);
  function dueNow(s) {
    const ci = currentMonthIdx(), fee = feeOf(s); let due = 0, late = 0;
    if (ci < 0) return { due: 0, late: 0 };
    for (let i = 0; i <= ci; i++) { const rest = Math.max(0, fee - paidFor(s.matricule, MONTHS[i])); due += rest; if (i < ci && rest > 0) late++; }
    return { due, late };
  }
  function refreshStatut(s) {
    const d = dueNow(s);
    if (d.due === 0) { s.statut = 'Payé'; s.statutClass = 'bg-emerald-100 text-emerald-800'; }
    else if (d.late > 0) { s.statut = 'En retard'; s.statutClass = 'bg-rose-100 text-rose-800'; }
    else { s.statut = 'Non payé'; s.statutClass = 'bg-amber-100 text-amber-800'; }
  }
  const newRef = (method) => (method === 'Wave' ? 'WV-' : method === 'Orange Money' ? 'OM-' : 'CSH-') + String(Math.floor(100000 + Math.random() * 900000));
  const recNo = () => (window.sunuReceiptPrefix ? window.sunuReceiptPrefix() : `REC-${new Date().getFullYear()}-`) + String(PAY.length + 1).padStart(4, '0');
  function buildSeedPay() {
    const out = [];
    allStudentsDB.forEach(s => {
      const fee = feeOf(s); if (!fee) return;
      if (s.statut === 'Payé') out.push({ id: 'seed-' + s.matricule, rec: 'REC-2026-D' + s.matricule.slice(-3), mat: s.matricule, month: 'Octobre', amount: fee, method: s.sexe === 'F' ? 'Orange Money' : 'Wave', ref: 'DEMO', date: '2026-10-01', by: 'Démonstration' });
    });
    return out;
  }

  /* ---------- Onglet Paiements ---------- */
  function createPayTab() {
    if ($('tab-payments') || !$('tab-reportcard')) return;
    const ref = $('btn-absences') || $('btn-reportcard');
    if (ref) {
      const b = document.createElement('button');
      b.id = 'btn-payments'; b.className = $('btn-reportcard').className + ' hidden'; b.textContent = '💳 Paiements';
      b.setAttribute('onclick', "switchTab('payments')");
      ref.parentNode.insertBefore(b, ref.nextSibling);
    }
    const tab = document.createElement('div');
    tab.id = 'tab-payments'; tab.className = 'tab-content hidden space-y-6';
    tab.innerHTML = '<div id="pay-root" class="space-y-6"></div>';
    $('tab-reportcard').parentNode.appendChild(tab);
  }
  const kpi = (l, v, c) => `<div class="bg-white rounded-2xl border border-slate-200 p-4 text-center"><p class="text-[10px] font-bold uppercase text-slate-500">${l}</p><p class="text-lg font-black ${c}">${v}</p></div>`;

  function receiptHtml(r) {
    const s = allStudentsDB.find(x => x.matricule === r.mat);
    return `<div class="bg-white rounded-3xl border-2 border-dashed border-emerald-300 p-6 space-y-2 text-xs max-w-md">
      <p class="text-center font-extrabold text-sm uppercase">${(window.SCHOOL && window.SCHOOL.name) || 'Groupe Scolaire Al-Amine'}</p><p class="text-center text-slate-500">${(window.SCHOOL && window.SCHOOL.city) || 'Touba Mosquée'} • ${(window.SCHOOL && window.SCHOOL.phone) || '+221 33 800 00 00'}</p>
      <p class="text-center font-black text-emerald-700">REÇU DE PAIEMENT N° ${E(r.rec)}</p>
      <div class="border-t border-slate-200 pt-2 space-y-1">
        <p><b>Élève :</b> ${E(s ? s.nom : r.mat)} (${E(r.mat)})</p><p><b>Classe :</b> ${E(s ? s.classe : '—')}</p>
        <p><b>Motif :</b> Scolarité ${E(r.months || r.month)}</p><p><b>Mode :</b> ${E(r.method)} • Réf. ${E(r.ref)}</p>
        <p><b>Date :</b> ${E(r.date)}</p><p class="text-base font-black text-slate-900"><b>Montant :</b> ${money(r.total ?? r.amount)}</p></div>
      <p class="text-center text-emerald-700 font-bold">✓ Paiement enregistré</p>
      <button onclick="printReceiptDedicated(${JSON.stringify(r).replace(/"/g,'&quot;')})" class="no-print w-full bg-slate-900 text-white font-bold py-2 rounded-xl">🖨️ Imprimer le reçu</button></div>`;
  }

  // Impression dédiée du reçu : ouvre une petite fenêtre au format reçu (80mm)
  window.printReceiptDedicated = function(r) {
    if (typeof r === 'string') { try { r = JSON.parse(r); } catch(_) {} }
    const s = allStudentsDB.find(x => x.matricule === r.mat);
    const schoolName = (window.SCHOOL && window.SCHOOL.name) || 'Groupe Scolaire';
    const schoolCity = (window.SCHOOL && window.SCHOOL.city) || '';
    const schoolPhone = (window.SCHOOL && window.SCHOOL.phone) || '';
    const schoolYear = (window.SCHOOL && window.SCHOOL.schoolYear) || '';
    const w = window.open('', '_blank', 'width=340,height=600,scrollbars=yes');
    if (!w) { showToast('⚠️ Autorisez les pop-ups pour imprimer le reçu.'); return; }
    w.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
      <title>Reçu ${E(r.rec)}</title>
      <style>
        @page { size: 80mm auto; margin: 4mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Courier New', monospace; font-size: 10pt; width: 72mm; color: #000; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .big { font-size: 12pt; font-weight: bold; }
        .line { border-top: 1px dashed #000; margin: 4px 0; }
        .doubleline { border-top: 2px solid #000; margin: 4px 0; }
        .row { display: flex; justify-content: space-between; margin: 2px 0; }
        .amount { font-size: 14pt; font-weight: bold; text-align: center; margin: 6px 0; }
        .footer { font-size: 8pt; text-align: center; margin-top: 6px; color: #444; }
        .signature { margin-top: 16px; display: flex; justify-content: space-between; font-size: 8pt; }
        @media print { body { width: 72mm; } button { display: none !important; } }
      </style>
    </head><body>
      <div class="center bold big">${E(schoolName)}</div>
      <div class="center" style="font-size:9pt">${E(schoolCity)}${schoolCity && schoolPhone ? ' — ' : ''}${E(schoolPhone)}</div>
      ${schoolYear ? `<div class="center" style="font-size:9pt">Année scolaire : ${E(schoolYear)}</div>` : ''}
      <div class="doubleline"></div>
      <div class="center bold" style="font-size:11pt">REÇU DE PAIEMENT</div>
      <div class="center" style="font-size:9pt">N° ${E(r.rec)}</div>
      <div class="line"></div>
      <div class="row"><span>Élève :</span><span class="bold">${E(s ? s.nom : r.mat)}</span></div>
      <div class="row"><span>Matricule :</span><span>${E(r.mat)}</span></div>
      <div class="row"><span>Classe :</span><span>${E(s ? s.classe : '—')}</span></div>
      <div class="line"></div>
      <div class="row"><span>Motif :</span><span>Scolarité ${E(r.months || r.month)}</span></div>
      <div class="row"><span>Mode :</span><span>${E(r.method)}</span></div>
      <div class="row"><span>Réf. :</span><span>${E(r.ref || '—')}</span></div>
      <div class="row"><span>Date :</span><span>${E(r.date)}</span></div>
      <div class="line"></div>
      <div class="amount">${String(r.total ?? r.amount).replace(/\B(?=(\d{3})+(?!\d))/g,' ')} FCFA</div>
      <div class="center bold">✓ Paiement confirmé</div>
      <div class="line"></div>
      <div class="signature">
        <div>Cachet de l'école</div>
        <div>Signature</div>
      </div>
      <div class="footer">Conservez ce reçu. Merci de votre confiance.</div>
      <br>
      <div class="center"><button onclick="window.print();window.close()" style="background:#000;color:#fff;border:none;padding:8px 24px;border-radius:6px;cursor:pointer;font-size:11pt">🖨️ Imprimer</button></div>
    </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  window.payToggle = function (m) {
    const s = currentStudent(); if (!s || isPaid(s, m)) return;
    if (payMonths.has(m)) payMonths.delete(m); else payMonths.add(m);
    const tot = $('pay-total'); if (tot) tot.textContent = money([...payMonths].reduce((a, mm) => a + Math.max(0, feeOf(s) - paidFor(s.matricule, mm)), 0));
  };
  window.paySetMethod = m => { payMethod = m; };
  window.paySetPhone = v => { payPhone = v; };
  window.payNow = function () {
    if (currentRole !== 'student') return;
    const s = currentStudent(); if (!s) return;
    const months = MONTHS.filter(m => payMonths.has(m) && !isPaid(s, m));
    if (!months.length) { showToast('⚠️ Choisissez au moins un mois à payer.'); return; }
    const d = digitsOf(payPhone).replace(/^221/, '');
    if (!/^7[05-8]\d{7}$/.test(d)) { showToast(`⚠️ Numéro ${payMethod} invalide : 9 chiffres commençant par 70, 75, 76, 77 ou 78.`); return; }
    const total = months.reduce((a, m) => a + Math.max(0, feeOf(s) - paidFor(s.matricule, m)), 0);
    if (!confirm(`Payer ${money(total)} (${months.join(', ')}) avec ${payMethod} depuis le ${d} ?\n\nSimulation : aucun argent réel n'est débité.`)) return;
    const ref = newRef(payMethod), rec = recNo(), date = todayISO();
    months.forEach(m => PAY.push({ id: 'p' + Date.now() + m, rec, mat: s.matricule, month: m, amount: Math.max(0, feeOf(s) - paidFor(s.matricule, m)), method: payMethod, ref, date, by: 'Parent/Élève', phone: d }));
    refreshStatut(s);
    lastReceipt = { rec, mat: s.matricule, months: months.join(', '), total, method: payMethod, ref, date };
    payMonths = new Set(); saveAll(); renderPayments();
    showToast(`✅ Paiement ${payMethod} de ${money(total)} confirmé • Reçu ${rec}.`);
  };
  window.payShowReceipt = function (rec) {
    const rs = PAY.filter(p => p.rec === rec); if (!rs.length) return;
    const a = rs[0];
    lastReceipt = { rec, mat: a.mat, months: rs.map(p => p.month).join(', '), total: rs.reduce((n, p) => n + p.amount, 0), method: a.method, ref: a.ref, date: a.date };
    renderPayments();
  };

  function renderPayStudent(root) {
    const s = currentStudent();
    if (!s) { root.innerHTML = '<div class="bg-white p-8 rounded-3xl border text-center text-slate-400">Aucun élève connecté.</div>'; return; }
    const fee = feeOf(s), ci = currentMonthIdx(), d = dueNow(s);
    const paidCount = MONTHS.filter(m => isPaid(s, m)).length;
    const grid = MONTHS.map((m, i) => {
      const paid = isPaid(s, m), part = !paid && paidFor(s.matricule, m) > 0, late = !paid && ci >= 0 && i < ci;
      const cls = paid ? 'bg-emerald-50 border-emerald-300' : late ? 'bg-rose-50 border-rose-300' : 'bg-white border-slate-200';
      const state = paid ? '<span class="text-emerald-700 font-bold">✓ Payé</span>' : part ? `<span class="text-amber-700 font-bold">Partiel (${money(paidFor(s.matricule, m))})</span>` : late ? '<span class="text-rose-700 font-bold">En retard</span>' : '<span class="text-slate-400">À payer</span>';
      return `<label class="border ${cls} rounded-2xl p-3 flex items-center gap-2 text-xs ${paid ? 'opacity-80' : 'cursor-pointer hover:border-sky-400'}">
        <input type="checkbox" ${paid ? 'disabled' : ''} ${payMonths.has(m) ? 'checked' : ''} onchange="payToggle('${m}')" class="accent-sky-700"><span class="flex-1"><b>${m}</b><br>${state}</span></label>`;
    }).join('');
    const hist = payRecs(s.matricule).slice().reverse().map(p => `<tr class="border-b border-slate-100"><td class="py-2 px-3 font-mono">${E(p.date)}</td><td class="py-2 px-3 font-semibold">Scolarité ${E(p.month)}</td>
      <td class="py-2 px-3"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${METHODS[p.method] || ''}">${E(p.method)}</span></td><td class="py-2 px-3 text-right font-bold">${money(p.amount)}</td>
      <td class="py-2 px-3 font-mono text-slate-500">${E(p.rec)}</td><td class="py-2 px-3 text-center"><button onclick="payShowReceipt('${E(p.rec)}')" class="text-sky-700 font-bold">Reçu</button></td></tr>`).join('') || '<tr><td colspan="6" class="py-6 text-center text-slate-400">Aucun paiement enregistré.</td></tr>';
    const mOpt = (v, l, c) => `<label class="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 cursor-pointer hover:border-sky-400"><input type="radio" name="pay-method" ${payMethod === v ? 'checked' : ''} onchange="paySetMethod('${v}')" class="accent-sky-700"><span class="font-bold ${c}">${l}</span></label>`;
    root.innerHTML = `<div class="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white p-6 rounded-3xl shadow-lg">
        <h1 class="text-2xl font-black tracking-tight">Espace de Paiement</h1><p class="text-slate-300 text-xs">${E(s.nom)} • ${E(s.classe)} • Mensualité : <b>${money(fee)}</b></p></div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">${kpi('Mois payés', paidCount + ' / ' + MONTHS.length, 'text-emerald-700')}${kpi('Reste dû à ce jour', money(d.due), d.due ? 'text-rose-700' : 'text-emerald-700')}${kpi('Mois en retard', d.late, d.late ? 'text-rose-700' : 'text-slate-700')}${kpi('Statut', E(s.statut), 'text-slate-900')}</div>
      <div class="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-4">
        <h3 class="font-extrabold text-slate-900 text-sm">💳 Payer la scolarité</h3>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">${grid}</div>
        <div class="grid sm:grid-cols-3 gap-3 text-xs">${mOpt('Wave', 'Wave', 'text-sky-700')}${mOpt('Orange Money', 'Orange Money', 'text-orange-600')}
          <input type="tel" placeholder="Numéro ${E(payMethod)} (ex : 77 123 45 67)" value="${E(payPhone)}" oninput="paySetPhone(this.value)" class="border border-slate-300 rounded-xl px-3 py-2 font-mono font-semibold"></div>
        <div class="flex flex-wrap items-center justify-between gap-3"><p class="text-sm font-bold text-slate-700">Total à payer : <span id="pay-total" class="text-emerald-700 text-lg font-black">${money([...payMonths].reduce((a, mm) => a + Math.max(0, fee - paidFor(s.matricule, mm)), 0))}</span></p>
          <button onclick="payNow()" class="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-3 rounded-xl shadow">Payer maintenant</button></div>
        <p class="text-[11px] text-slate-400">Simulation : aucun argent réel n'est débité. En production, le parent validerait le paiement sur son téléphone via Wave ou Orange Money.</p></div>
      ${lastReceipt && lastReceipt.mat === s.matricule ? receiptHtml(lastReceipt) : ''}
      <div class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"><div class="p-4 border-b border-slate-100 font-extrabold text-sm text-slate-900">Historique de mes paiements</div>
        <div class="overflow-x-auto"><table class="w-full text-left text-xs"><thead class="bg-slate-100 text-slate-600 uppercase text-[10px]"><tr><th class="py-2 px-3">Date</th><th class="py-2 px-3">Motif</th><th class="py-2 px-3">Mode</th><th class="py-2 px-3 text-right">Montant</th><th class="py-2 px-3">Reçu</th><th class="py-2 px-3"></th></tr></thead><tbody>${hist}</tbody></table></div></div>`;
  }

  window.payFilter = function () { payF.cls = $('pay-class').value; payF.status = $('pay-status').value; payF.q = $('pay-q').value.trim(); renderPayAdminList(); };
  window.payRemind = function (mat) {
    if (currentRole !== 'admin') return;
    const s = allStudentsDB.find(x => x.matricule === mat); if (!s) return;
    const due = dueNow(s).due;
    const phone = digitsOf(s.phone);
    // Construire le numéro WhatsApp au format international (Sénégal = 221)
    const waPhone = phone.startsWith('221') ? phone : '221' + phone.replace(/^0+/, '');
    const school = (window.SCHOOL && window.SCHOOL.name) || 'SunuSchool';
    const msg = encodeURIComponent(
      `Bonjour ${s.parent},\n\nNous vous contactons de la part de ${school}.\n\nVotre enfant *${s.nom}* a un solde impayé de *${money(due)}* au titre de la scolarité.\n\nMerci de vous rapprocher de l'administration pour régulariser votre situation.\n\nCordialement,\n${school}`
    );
    const waUrl = `https://wa.me/${waPhone}?text=${msg}`;
    window.open(waUrl, '_blank');
    showToast(`💬 WhatsApp ouvert pour ${s.parent} (${s.phone}) — solde dû : ${money(due)}.`);
  };
  function renderPayAdmin(root) {
    const total = PAY.reduce((a, p) => a + p.amount, 0), by = m => PAY.filter(p => p.method === m).reduce((a, p) => a + p.amount, 0);
    const unpaid = allStudentsDB.filter(s => feeOf(s) && dueNow(s).due > 0).length;
    root.innerHTML = `<div class="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white p-6 rounded-3xl shadow-lg"><h1 class="text-2xl font-black tracking-tight">Paiements & Recouvrement</h1>
        <p class="text-slate-300 text-xs">Paiements en ligne (Wave, Orange Money) et espèces des parents, par élève et par mois.</p></div>
      <div class="grid grid-cols-2 md:grid-cols-5 gap-3">${kpi('Total encaissé', money(total), 'text-emerald-700')}${kpi('Wave', money(by('Wave')), 'text-sky-700')}${kpi('Orange Money', money(by('Orange Money')), 'text-orange-600')}${kpi('Espèces', money(by('Espèces')), 'text-slate-800')}${kpi('Élèves avec solde dû', unpaid, unpaid ? 'text-rose-700' : 'text-emerald-700')}</div>
      <div class="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-end gap-3 text-xs">
        <label class="flex flex-col gap-1 font-semibold text-slate-700">Classe<select id="pay-class" class="border border-slate-300 rounded-xl px-3 py-2 bg-white font-bold" onchange="payFilter()"><option value="">Toutes</option>${classesMgtData.map(c => `<option value="${E(c.name)}" ${c.name === payF.cls ? 'selected' : ''}>${E(c.name)}</option>`).join('')}</select></label>
        <label class="flex flex-col gap-1 font-semibold text-slate-700">Situation<select id="pay-status" class="border border-slate-300 rounded-xl px-3 py-2 bg-white font-bold" onchange="payFilter()"><option value="">Tous</option><option value="due" ${payF.status === 'due' ? 'selected' : ''}>Solde dû</option><option value="ok" ${payF.status === 'ok' ? 'selected' : ''}>À jour</option></select></label>
        <label class="flex flex-col gap-1 font-semibold text-slate-700 flex-1 min-w-[200px]">Élève (nom, matricule ou téléphone)<input id="pay-q" type="text" value="${E(payF.q)}" placeholder="Rechercher…" class="border border-slate-300 rounded-xl px-3 py-2 bg-white font-semibold" oninput="payFilter()"></label></div>
      <div id="pay-list" class="space-y-6"></div>`;
    renderPayAdminList();
  }
  function renderPayAdminList() {
    const box = $('pay-list'); if (!box) return;
    const q = payF.q.toLowerCase(), qa = alnum(payF.q), qd = digitsOf(payF.q);
    const list = allStudentsDB.filter(s => feeOf(s) && (!payF.cls || classKey(s.classe) === classKey(payF.cls))
      && (!payF.status || (payF.status === 'due') === (dueNow(s).due > 0))
      && (!q || s.nom.toLowerCase().includes(q) || (qa.length >= 3 && alnum(s.matricule).includes(qa)) || (qd.length >= 4 && digitsOf(s.phone).includes(qd))));
    const rows = list.map(s => { const d = dueNow(s), n = MONTHS.filter(m => isPaid(s, m)).length;
      return `<tr class="border-b border-slate-100 ${d.late ? 'bg-rose-50' : ''}"><td class="py-2 px-3 font-bold text-slate-900">${E(s.nom)}<span class="block font-mono text-[10px] text-slate-400">${E(s.matricule)} • ${E(s.classe)}</span></td>
        <td class="py-2 px-3 text-center">${money(feeOf(s))}</td><td class="py-2 px-3 text-center">${n} / ${MONTHS.length}</td>
        <td class="py-2 px-3 text-center font-extrabold ${d.due ? 'text-rose-700' : 'text-emerald-700'}">${money(d.due)}</td>
        <td class="py-2 px-3 text-center">${d.due ? `<button onclick="payRemind('${E(s.matricule)}')" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded-lg text-[10px]">💬 Relancer</button>` : '<span class="text-emerald-700 font-bold">✓ À jour</span>'}</td></tr>`; }).join('') || '<tr><td colspan="5" class="py-6 text-center text-slate-400">Aucun élève.</td></tr>';
    const last = PAY.slice().reverse().slice(0, 15).map(p => `<tr class="border-b border-slate-100"><td class="py-2 px-3 font-mono">${E(p.date)}</td><td class="py-2 px-3 font-semibold">${E(nameOfStu(p.mat))}</td><td class="py-2 px-3">Scolarité ${E(p.month)}</td>
      <td class="py-2 px-3"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${METHODS[p.method] || ''}">${E(p.method)}</span></td><td class="py-2 px-3 text-right font-bold">${money(p.amount)}</td><td class="py-2 px-3 font-mono text-slate-500">${E(p.rec)}</td></tr>`).join('') || '<tr><td colspan="6" class="py-6 text-center text-slate-400">Aucun paiement.</td></tr>';
    box.innerHTML = `<div class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"><div class="p-4 border-b border-slate-100 font-extrabold text-sm text-slate-900">Situation par élève (mois en cours : ${currentMonthIdx() >= 0 ? MONTHS[currentMonthIdx()] : 'hors année scolaire'})</div><div class="overflow-x-auto"><table class="w-full text-left text-xs"><thead class="bg-slate-100 text-slate-600 uppercase text-[10px]"><tr><th class="py-2 px-3">Élève</th><th class="py-2 px-3 text-center">Mensualité</th><th class="py-2 px-3 text-center">Mois payés</th><th class="py-2 px-3 text-center">Reste dû</th><th class="py-2 px-3 text-center">Action</th></tr></thead><tbody>${rows}</tbody></table></div></div>
      <div class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"><div class="p-4 border-b border-slate-100 font-extrabold text-sm text-slate-900">Derniers paiements</div><div class="overflow-x-auto"><table class="w-full text-left text-xs"><thead class="bg-slate-100 text-slate-600 uppercase text-[10px]"><tr><th class="py-2 px-3">Date</th><th class="py-2 px-3">Élève</th><th class="py-2 px-3">Motif</th><th class="py-2 px-3">Mode</th><th class="py-2 px-3 text-right">Montant</th><th class="py-2 px-3">Reçu</th></tr></thead><tbody>${last}</tbody></table></div></div>`;
  }
  const nameOfStu = mat => { const s = allStudentsDB.find(x => x.matricule === mat); return s ? s.nom : mat + ' (supprimé)'; };
  function renderPayments() {
    const root = $('pay-root'); if (!root) return;
    if (currentRole === 'student') renderPayStudent(root);
    else if (currentRole === 'admin') renderPayAdmin(root);
    else root.innerHTML = '';
  }

  // Encaissements espèces du guichet -> aussi dans le registre des paiements
  const origCash = window.handleCashPayment;
  if (typeof origCash === 'function') window.handleCashPayment = function (e) {
    const name = ($('cash-student-select') || {}).value, amount = parseInt(($('cash-amount-input') || {}).value) || 0, motif = ($('cash-month-select') || {}).value || '';
    const r = origCash.apply(this, arguments);
    safe(() => {
      const s = allStudentsDB.find(x => x.nom === name || (name && String(name).includes(x.nom))), m = MONTHS.find(mm => motif.toLowerCase().includes(mm.toLowerCase()));
      if (s && m && amount > 0) { PAY.push({ id: 'c' + Date.now(), rec: recNo(), mat: s.matricule, month: m, amount, method: 'Espèces', ref: newRef('Espèces'), date: todayISO(), by: 'Guichet' }); refreshStatut(s); saveAll(); renderPayments(); }
    });
    return r;
  };

  /* ---------- Données de démonstration ---------- */
  function seed() {
    GR = { S1: {}, S2: {} };
    studentsData.forEach(s => {
      const delta = ((s.id * 7) % 5 - 2) * 0.5;
      SUBJECTS.forEach(sub => {
        [['S1', 0], ['S2', delta]].forEach(([sem, d]) => {
          GR[sem][sub.key] = GR[sem][sub.key] || {};
          if (sub.key === 'maths') GR[sem][sub.key][s.matricule] = { d1: clamp(s.d1 + d), d2: clamp(s.d2 + d), compo: clamp(s.compo + d) };
          else if (s.others[sub.key] !== undefined) { const v = s.others[sub.key] + d; GR[sem][sub.key][s.matricule] = { d1: clamp(v - 0.5), d2: clamp(v + 0.5), compo: clamp(v) }; }
        });
      });
    });
    ATT = {};
    const put = (date, cls, mat, rec) => { const k = date + '|' + classKey(cls); ATT[k] = ATT[k] || {}; ATT[k][mat] = { cls, by: 'Démonstration', ...rec }; };
    put('2026-10-01', '3ème A', 'SN-2025-0899', { s: 'A', min: 0, motif: '' });
    put('2026-10-02', '3ème A', 'SN-2025-0899', { s: 'R', min: 15, motif: 'Transport' });
    put('2026-10-02', '3ème A', 'SN-2025-0104', { s: 'J', min: 0, motif: 'Certificat médical' });
    put('2026-10-03', '3ème A', 'SN-2025-0899', { s: 'A', min: 0, motif: '' });
    PAY = buildSeedPay();
  }
  seed();

  /* ---------- Absences & retards ---------- */
  const ST = { A: 'Absent', J: 'Absent justifié', R: 'Retard' };
  const STC = { A: 'bg-rose-100 text-rose-800', J: 'bg-sky-100 text-sky-800', R: 'bg-amber-100 text-amber-800' };
  const semOfDate = d => { const m = Number(String(d).slice(5, 7)); return (m >= 8 || m === 1) ? 'S1' : 'S2'; };
  function attRecords(filter) {
    const out = [];
    Object.entries(ATT).forEach(([k, o]) => { const date = k.split('|')[0]; Object.entries(o).forEach(([mat, r]) => out.push({ date, key: k, mat, ...r })); });
    return out.filter(filter || (() => true)).sort((a, b) => b.date.localeCompare(a.date));
  }
  function attStats(mat, sem) {
    const rs = attRecords(r => r.mat === mat && (!sem || semOfDate(r.date) === sem));
    return { abs: rs.filter(r => r.s === 'A').length, just: rs.filter(r => r.s === 'J').length, late: rs.filter(r => r.s === 'R').length, min: rs.filter(r => r.s === 'R').reduce((a, r) => a + (Number(r.min) || 0), 0) };
  }
  const nameOf = mat => { const s = allStudentsDB.find(x => x.matricule === mat); return s ? s.nom : mat + ' (supprimé)'; };

  function ensureAttCard() {
    if ($('att-card')) return;
    const anchor = $('tch-own-sched') || $('grades-table-card');
    const d = document.createElement('div');
    d.id = 'att-card'; d.className = 'bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 space-y-4';
    anchor.parentNode.insertBefore(d, anchor.nextSibling);
  }
  window.attSetClass = c => { attClass = c; renderAttendance(); };
  window.attSetDate = d => { if (d > todayISO()) { showToast('⚠️ La date ne peut pas être dans le futur.'); } else if (d) attDate = d; renderAttendance(); };
  window.attToggle = el => { const row = el.closest('tr'); const m = row && row.querySelector('.att-min'); if (m) m.style.visibility = el.value === 'R' ? 'visible' : 'hidden'; };
  function renderAttendance() {
    ensureAttCard();
    const card = $('att-card'), t = myTeacher();
    card.classList.toggle('hidden', !t);
    if (!t) return;
    const classes = classesOfTeacher(t);
    if (!classes.includes(attClass)) attClass = classes[0] || null;
    const list = attClass ? studentsOfClass(attClass) : [];
    const rec = (ATT[attDate + '|' + classKey(attClass || '')] || {});
    const rows = list.map(s => {
      const r = rec[s.matricule] || { s: 'P', min: '', motif: '' };
      const opt = (v, l) => `<option value="${v}" ${r.s === v ? 'selected' : ''}>${l}</option>`;
      return `<tr data-mat="${E(s.matricule)}" class="border-b border-slate-100">
        <td class="py-2 px-3 font-bold text-slate-900">${E(s.nom)}<span class="block font-mono text-[10px] text-slate-400">${E(s.matricule)}</span></td>
        <td class="py-2 px-3"><select class="att-s border border-slate-300 rounded-lg px-2 py-1.5 font-semibold bg-white" onchange="attToggle(this)">${opt('P', '✅ Présent')}${opt('A', '❌ Absent')}${opt('R', '⏱️ Retard')}${opt('J', '📄 Absent justifié')}</select></td>
        <td class="py-2 px-3"><input type="number" min="1" max="240" placeholder="min" value="${r.s === 'R' ? E(r.min) : ''}" style="visibility:${r.s === 'R' ? 'visible' : 'hidden'}" class="att-min w-20 text-center border border-slate-300 rounded-lg py-1.5"></td>
        <td class="py-2 px-3"><input type="text" maxlength="80" placeholder="Motif (facultatif)" value="${E(r.motif || '')}" class="att-motif w-full border border-slate-300 rounded-lg px-2 py-1.5"></td></tr>`;
    }).join('') || '<tr><td colspan="4" class="py-6 text-center text-slate-400">Aucun élève inscrit dans cette classe.</td></tr>';
    card.innerHTML = `<div class="flex flex-wrap items-end justify-between gap-3">
      <div><h3 class="font-extrabold text-slate-900 text-sm">📋 Appel : absences et retards</h3><p class="text-[11px] text-slate-500">Seuls les élèves de vos classes. Les parents des absents sont prévenus (simulation WhatsApp).</p></div>
      <div class="flex flex-wrap gap-3 text-xs">
        <label class="flex flex-col gap-1 font-semibold text-slate-700">Classe<select class="border border-slate-300 rounded-xl px-3 py-2 bg-white font-bold" onchange="attSetClass(this.value)">${classes.map(c => `<option value="${E(c)}" ${c === attClass ? 'selected' : ''}>${E(c)}</option>`).join('')}</select></label>
        <label class="flex flex-col gap-1 font-semibold text-slate-700">Date<input type="date" value="${E(attDate)}" max="${E(todayISO())}" class="border border-slate-300 rounded-xl px-3 py-2 bg-white font-bold" onchange="attSetDate(this.value)"></label></div></div>
      <div class="overflow-x-auto"><table class="w-full text-left text-xs"><thead class="bg-slate-100 text-slate-600 uppercase text-[10px]"><tr><th class="py-2 px-3">Élève</th><th class="py-2 px-3">Statut</th><th class="py-2 px-3">Retard (min)</th><th class="py-2 px-3">Motif</th></tr></thead><tbody>${rows}</tbody></table></div>
      <button onclick="saveAttendance()" class="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 py-2.5 rounded-xl shadow">💾 Enregistrer l'appel</button>`;
  }
  window.saveAttendance = async function () {
    const t = myTeacher();
    if (!t || !attClass || !classesOfTeacher(t).includes(attClass)) { showToast('🔒 Vous ne pouvez faire l\'appel que dans vos propres classes.'); return; }
    if (!attDate || attDate > todayISO()) { showToast('⚠️ Date invalide.'); return; }
    const key = attDate + '|' + classKey(attClass), valid = new Set(studentsOfClass(attClass).map(s => s.matricule));
    const prev = ATT[key] || {}, next = {}; let flagged = [];
    document.querySelectorAll('#att-card tr[data-mat]').forEach(row => {
      const mat = row.dataset.mat; if (!valid.has(mat)) return;
      const s = row.querySelector('.att-s').value; if (s === 'P') return;
      let min = 0;
      if (s === 'R') { min = Number(row.querySelector('.att-min').value); if (!(min >= 1 && min <= 240)) { flagged.push('minutes'); return; } }
      const old = prev[mat], notified = !!(old && old.notified && old.s === s);
      next[mat] = { s, min, motif: row.querySelector('.att-motif').value.trim().slice(0, 80), by: t.name, cls: attClass, notified: true };
      if (!notified && (s === 'A' || s === 'R')) flagged.push(mat);
    });
    if (flagged.includes('minutes')) { showToast('⚠️ Indiquez la durée du retard en minutes (1 à 240).'); return; }
    // essai : enregistrement dans Supabase ; en cas d'échec, l'écran revient à l'état du serveur
    const okSave = await window.sunuPersistAttendance({ day: attDate, cls: attClass, mats: [...valid],
      rows: Object.entries(next).map(([mat, v]) => ({ mat, s: v.s, min: v.min, motif: v.motif })) });
    if (!okSave) { await window.sunuReload(); return; }
    if (Object.keys(next).length) ATT[key] = next; else delete ATT[key];
    saveAll(); renderAttendance();
    const n = flagged.length;
    showToast(`📋 Appel du ${attDate} • ${attClass} enregistré.${n ? ` 💬 ${n} parent(s) prévenu(s) (simulation WhatsApp).` : ''}`);
  };

  function createAbsTab() {
    if ($('tab-absences') || !$('tab-reportcard')) return;
    const ref = $('btn-reportcard');
    if (ref) {
      const b = document.createElement('button');
      b.id = 'btn-absences'; b.className = ref.className + ' hidden'; b.textContent = '🗓️ Absences';
      b.setAttribute('onclick', "switchTab('absences')");
      ref.parentNode.insertBefore(b, ref.nextSibling);
    }
    const tab = document.createElement('div');
    tab.id = 'tab-absences'; tab.className = 'tab-content hidden space-y-6';
    tab.innerHTML = `<div class="bg-gradient-to-r from-rose-900 via-slate-900 to-slate-900 text-white p-6 rounded-3xl shadow-lg">
        <h1 class="text-2xl font-black tracking-tight">Absences & Retards</h1>
        <p class="text-slate-300 text-xs">Suivi de la présence des élèves, saisi par les professeurs lors de l'appel. Seuil d'alerte : 3 absences non justifiées.</p></div>
      <div class="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-end gap-3 text-xs">
        <label class="flex flex-col gap-1 font-semibold text-slate-700">Classe<select id="abs-class" class="border border-slate-300 rounded-xl px-3 py-2 bg-white font-bold" onchange="absFilter()"></select></label>
        <label class="flex flex-col gap-1 font-semibold text-slate-700">Du<input id="abs-from" type="date" class="border border-slate-300 rounded-xl px-3 py-2 bg-white font-bold" onchange="absFilter()"></label>
        <label class="flex flex-col gap-1 font-semibold text-slate-700">Au<input id="abs-to" type="date" class="border border-slate-300 rounded-xl px-3 py-2 bg-white font-bold" onchange="absFilter()"></label>
        <label class="flex flex-col gap-1 font-semibold text-slate-700 flex-1 min-w-[200px]">Élève (nom, matricule ou téléphone)<input id="abs-q" type="text" placeholder="Rechercher…" class="border border-slate-300 rounded-xl px-3 py-2 bg-white font-semibold" oninput="absFilter()"></label></div>
      <div id="abs-results" class="space-y-6"></div>`;
    $('tab-reportcard').parentNode.appendChild(tab);
    $('abs-from').value = absF.from; $('abs-to').value = absF.to;
  }
  window.absFilter = function () { absF.cls = $('abs-class').value; absF.from = $('abs-from').value; absF.to = $('abs-to').value; absF.q = $('abs-q').value.trim(); renderAbsAdmin(); };
  function renderAbsAdmin() {
    const box = $('abs-results'); if (!box) return;
    const sel = $('abs-class');
    if (sel) sel.innerHTML = `<option value="">Toutes les classes</option>` + classesMgtData.map(c => `<option value="${E(c.name)}" ${c.name === absF.cls ? 'selected' : ''}>${E(c.name)}</option>`).join('');
    if (currentRole !== 'admin') { box.innerHTML = ''; return; }
    const q = absF.q.toLowerCase(), qa = alnum(absF.q), qd = digitsOf(absF.q);
    const matchQ = mat => { if (!q) return true; const s = allStudentsDB.find(x => x.matricule === mat); if (!s) return false; return s.nom.toLowerCase().includes(q) || (qa.length >= 3 && alnum(s.matricule).includes(qa)) || (qd.length >= 4 && digitsOf(s.phone).includes(qd)); };
    const recs = attRecords(r => (!absF.cls || classKey(r.cls) === classKey(absF.cls)) && (!absF.from || r.date >= absF.from) && (!absF.to || r.date <= absF.to) && matchQ(r.mat));
    const by = {};
    recs.forEach(r => { const o = by[r.mat] = by[r.mat] || { mat: r.mat, cls: r.cls, a: 0, j: 0, r: 0, min: 0 }; if (r.s === 'A') o.a++; else if (r.s === 'J') o.j++; else { o.r++; o.min += Number(r.min) || 0; } });
    const sum = Object.values(by).sort((x, y) => y.a - x.a || y.r - x.r);
    const tot = { a: sum.reduce((n, o) => n + o.a, 0), j: sum.reduce((n, o) => n + o.j, 0), r: sum.reduce((n, o) => n + o.r, 0) };
    const sumRows = sum.map(o => `<tr class="border-b border-slate-100 ${o.a >= 3 ? 'bg-rose-50' : ''}">
      <td class="py-2 px-3 font-bold text-slate-900">${E(nameOf(o.mat))}<span class="block font-mono text-[10px] text-slate-400">${E(o.mat)} • ${E(o.cls)}</span></td>
      <td class="py-2 px-3 text-center font-extrabold text-rose-700">${o.a}${o.a >= 3 ? ' ⚠️' : ''}</td><td class="py-2 px-3 text-center">${o.j}</td><td class="py-2 px-3 text-center">${o.r} <span class="text-slate-400">(${o.min} min)</span></td>
      <td class="py-2 px-3 text-center"><button onclick="attNotify('${E(o.mat)}')" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded-lg text-[10px]">💬 Prévenir le parent</button></td></tr>`).join('') || '<tr><td colspan="5" class="py-6 text-center text-slate-400">Aucune absence ni retard sur cette période.</td></tr>';
    const detRows = recs.map(r => `<tr class="border-b border-slate-100"><td class="py-2 px-3 font-mono">${E(r.date)}</td><td class="py-2 px-3 font-semibold">${E(nameOf(r.mat))}<span class="text-slate-400"> • ${E(r.cls)}</span></td>
      <td class="py-2 px-3"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${STC[r.s]}">${ST[r.s]}${r.s === 'R' ? ' ' + E(r.min) + ' min' : ''}</span></td><td class="py-2 px-3 text-slate-600">${E(r.motif || '—')}</td><td class="py-2 px-3 text-slate-500">${E(r.by || '')}</td>
      <td class="py-2 px-3 text-center"><button onclick="attDelete('${E(r.key)}','${E(r.mat)}')" class="text-slate-400 hover:text-rose-600 font-bold">🗑️</button></td></tr>`).join('') || '<tr><td colspan="6" class="py-6 text-center text-slate-400">Aucun enregistrement.</td></tr>';
    box.innerHTML = `<div class="grid grid-cols-3 gap-3">${kpi('Absences non justifiées', tot.a, 'text-rose-700')}${kpi('Absences justifiées', tot.j, 'text-sky-700')}${kpi('Retards', tot.r, 'text-amber-700')}</div>
      <div class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"><div class="p-4 border-b border-slate-100 font-extrabold text-sm text-slate-900">Récapitulatif par élève</div><div class="overflow-x-auto"><table class="w-full text-left text-xs"><thead class="bg-slate-100 text-slate-600 uppercase text-[10px]"><tr><th class="py-2 px-3">Élève</th><th class="py-2 px-3 text-center">Absences</th><th class="py-2 px-3 text-center">Justifiées</th><th class="py-2 px-3 text-center">Retards</th><th class="py-2 px-3 text-center">Action</th></tr></thead><tbody>${sumRows}</tbody></table></div></div>
      <div class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"><div class="p-4 border-b border-slate-100 font-extrabold text-sm text-slate-900">Détail des enregistrements</div><div class="overflow-x-auto"><table class="w-full text-left text-xs"><thead class="bg-slate-100 text-slate-600 uppercase text-[10px]"><tr><th class="py-2 px-3">Date</th><th class="py-2 px-3">Élève</th><th class="py-2 px-3">Statut</th><th class="py-2 px-3">Motif</th><th class="py-2 px-3">Saisi par</th><th class="py-2 px-3"></th></tr></thead><tbody>${detRows}</tbody></table></div></div>`;
  }
  window.attNotify = function (mat) {
    if (currentRole !== 'admin') return;
    const s = allStudentsDB.find(x => x.matricule === mat); if (!s) return;
    const st = attStats(mat);
    showToast(`💬 Message WhatsApp (simulation) à ${s.parent} (${s.phone}) : ${s.nom} — ${st.abs} absence(s) non justifiée(s), ${st.late} retard(s).`);
  };
  window.attDelete = async function (key, mat) {
    if (currentRole !== 'admin' || !ATT[key] || !ATT[key][mat]) return;
    if (!confirm('Supprimer définitivement cet enregistrement ?')) return;
    if (!(await window.sunuDeleteAttendance(key.split('|')[0], mat))) return;
    delete ATT[key][mat]; if (!Object.keys(ATT[key]).length) delete ATT[key];
    saveAll(); renderAbsAdmin(); showToast('🗑️ Enregistrement supprimé.');
  };

  /* ---------- PERSISTANCE ---------- */
  const PREFIX = 'SUNUSCHOOL:';
  let lastSaved = '', storageOK = false;
  const okVer = o => o && [7, 8, 9].includes(o.v);
  const Store = {
    read() {
      return null; // essai : les données viennent de Supabase, jamais du navigateur
      const found = [];
      [SKEY, ...OLDKEYS].forEach(k => {
        safe(() => { const v = localStorage.getItem(k); if (v) found.push(['navigateur', v]); });
        safe(() => { const v = sessionStorage.getItem(k); if (v) found.push(['session', v]); });
      });
      safe(() => { if (typeof window.name === 'string' && window.name.startsWith(PREFIX)) found.push(['onglet', window.name.slice(PREFIX.length)]); });
      let best = null;
      found.forEach(([src, v]) => { try { const o = JSON.parse(v); if (okVer(o) && (!best || (o.ts || 0) > best.o.ts)) best = { src, o }; } catch (_) {} });
      return best;
    },
    write(str) {
      return []; // essai : rien n'est écrit dans le navigateur
      const ok = [];
      safe(() => { localStorage.setItem(SKEY, str); if (localStorage.getItem(SKEY) === str) ok.push('navigateur'); });
      safe(() => { sessionStorage.setItem(SKEY, str); ok.push('session'); });
      safe(() => { window.name = PREFIX + str; ok.push('onglet'); });
      return ok;
    }
  };
  const snapshot = () => JSON.stringify({
    v: 9, ts: Date.now(), GR, ATT, PAY, classes: classesMgtData, trash: classesTrash, teachersTrash: teachersTrash, students: allStudentsDB, teachers: teachersData,
    c: { nextMatriculeNum, nextClassId, nextTeacherId, nextTeacherNum, dailyCash }
  });
  const core = () => { const o = JSON.parse(snapshot()); delete o.ts; return JSON.stringify(o); };
  function updateBadge(msg, cls) {
    const b = $('save-badge'); if (!b) return;
    if (currentRole === 'teacher') { b.textContent = '☁️ Vos notes et vos appels sont enregistrés en ligne'; b.className = 'fixed bottom-4 left-4 z-40 text-[11px] font-bold px-3 py-1.5 rounded-xl shadow-lg print:hidden bg-emerald-600 text-white'; return; }
    if (currentRole === 'admin') { b.textContent = '☁️ Paiements à la caisse et suppression d’absences enregistrés en ligne • autres modifications : lecture seule'; b.className = 'fixed bottom-4 left-4 z-40 text-[11px] font-bold px-3 py-1.5 rounded-xl shadow-lg print:hidden bg-sky-700 text-white'; return; }
    b.textContent = '👁️ Lecture seule : les modifications faites à l’écran ne sont pas encore enregistrées'; b.className = 'fixed bottom-4 left-4 z-40 text-[11px] font-bold px-3 py-1.5 rounded-xl shadow-lg print:hidden bg-amber-500 text-white';
  }
  function saveAll(force) {
    safe(() => {
      const c = core();
      if (!force && c === lastSaved) return;
      const ok = Store.write(snapshot());
      lastSaved = c; storageOK = ok.includes('navigateur');
      const hh = new Date().toLocaleTimeString('fr-FR');
      if (storageOK) updateBadge(`💾 Enregistré à ${hh} • ${VERSION}`, 'bg-emerald-600 text-white');
      else if (ok.length) updateBadge(`⚠️ Stockage navigateur bloqué : sauvegarde temporaire (onglet). Utilisez « Exporter » • ${VERSION}`, 'bg-amber-500 text-white');
      else updateBadge(`❌ Aucun stockage disponible. Utilisez « Exporter » • ${VERSION}`, 'bg-rose-600 text-white');
    });
  }
  function applyState(sv) {
    const rep = (arr, src) => { if (Array.isArray(src)) arr.splice(0, arr.length, ...src); };
    rep(classesMgtData, sv.classes); rep(classesTrash, sv.trash); rep(teachersTrash, sv.teachersTrash); rep(allStudentsDB, sv.students); rep(teachersData, sv.teachers);
    if (sv.GR && sv.GR.S1 && sv.GR.S2) GR = sv.GR;
    ATT = sv.att || sv.ATT || {};
    PAY = Array.isArray(sv.PAY) ? sv.PAY : (Array.isArray(sv.pay) ? sv.pay : buildSeedPay());
    if (sv.c) { nextMatriculeNum = sv.c.nextMatriculeNum; nextClassId = sv.c.nextClassId; nextTeacherId = sv.c.nextTeacherId; nextTeacherNum = sv.c.nextTeacherNum; dailyCash = sv.c.dailyCash; }
    if (!teachersData.some(t => t.id === selectedTeacherId)) selectedTeacherId = teachersData.length ? teachersData[0].id : null;
  }
  function rerenderAll() {
    ['renderClassesMgtTable','renderRegistry','renderRegistryList','renderCashStudents','renderTeachers','renderSchedules','renderStudentSpace'].forEach(n => { if (typeof window[n] === 'function') safe(() => window[n]()); });
    safe(renderAbsAdmin); safe(renderPayments);
    const cash = $('total-cash-counter'); if (cash) cash.innerText = dailyCash.toLocaleString() + ' FCFA';
    if (window.cashKpis) safe(window.cashKpis);
    const mp = $('matricule-preview'); if (mp) mp.innerText = studentMatriculePrefix() + String(nextMatriculeNum).padStart(4, '0');
  }
  window.resetSunuSchoolData = function () {
    if (currentRole !== 'admin') return;
    if (!confirm('Effacer TOUTES les données enregistrées (classes, élèves, enseignants, notes, absences, paiements) et revenir aux données de démonstration ?')) return;
    [SKEY, ...OLDKEYS].forEach(k => { safe(() => localStorage.removeItem(k)); safe(() => sessionStorage.removeItem(k)); });
    safe(() => { window.name = ''; });
    location.reload();
  };
  window.exportSunuSchoolData = function () {
    const blob = new Blob([snapshot()], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'sunuschool-sauvegarde-' + todayISO() + '.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  window.importSunuSchoolData = function () {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const sv = JSON.parse(r.result); if (!okVer(sv)) throw new Error('format');
          applyState(sv); syncSubjects(); saveAll(true); rerenderAll(); window.refreshAccess(); showToast('✅ Sauvegarde importée.');
        } catch (_) { showToast('⚠️ Fichier de sauvegarde invalide.'); }
      };
      r.readAsText(f);
    };
    inp.click();
  };
  setInterval(saveAll, 1000);
  window.addEventListener('beforeunload', () => saveAll(true));
  window.addEventListener('pagehide', () => saveAll(true));
  document.addEventListener('visibilitychange', () => saveAll(true));
  ['handleCreateClass','handleEditClass','moveClassToTrash','restoreClass','purgeClass','handleEnrollStudent','handleEditStudent'].forEach(n => {
    const o = window[n]; if (typeof o !== 'function') return;
    window[n] = function (...a) { const r = o.apply(this, a); saveAll(); return r; };
  });

  /* ---------- Suppression d'un élève (admin) ---------- */
  window.deleteStudent = function (idx) {
    if (currentRole !== 'admin') return;
    const s = allStudentsDB[idx]; if (!s) return;
    if (!confirm(`Supprimer définitivement ${s.nom} (${s.matricule}) et toutes ses notes et absences ? (Les reçus de paiement sont conservés.)`)) return;
    allStudentsDB.splice(idx, 1);
    ['S1', 'S2'].forEach(sm => Object.values(GR[sm]).forEach(o => { delete o[s.matricule]; }));
    Object.keys(ATT).forEach(k => { delete ATT[k][s.matricule]; if (!Object.keys(ATT[k]).length) delete ATT[k]; });
    const c = classesMgtData.find(x => classKey(x.name) === classKey(s.classe)); if (c && c.effectif > 0) c.effectif--;
    saveAll(); rerenderAll(); showToast(`🗑️ ${s.nom} supprimé(e) définitivement.`);
  };
  const origRegList = window.renderRegistryList;
  window.renderRegistryList = function () {
    origRegList();
    if (currentRole !== 'admin') return;
    const tb = $('nominal-students-body'); if (!tb) return;
    tb.querySelectorAll('button').forEach(b => {
      const m = /openEditStudent\((\d+)/.exec(b.getAttribute('onclick') || ''); if (!m) return;
      const d = document.createElement('button');
      d.className = 'bg-white border border-slate-200 hover:border-rose-500 text-slate-700 hover:text-rose-700 font-bold px-2 py-1 rounded-lg text-[10px] shadow-xs';
      d.textContent = '🗑️ Supprimer'; d.setAttribute('onclick', `deleteStudent(${m[1]})`);
      b.parentNode.appendChild(d);
    });
  };

  /* ---------- Calculs ---------- */
  const myTeacher = () => currentRole === 'teacher' ? teachersData.find(t => t.id === currentTeacherId) : null;
  const classesOfTeacher = t => t ? [...new Set(t.slots.map(s => s.classe))] : [];
  const studentsOfClass = c => allStudentsDB.filter(s => classKey(s.classe) === classKey(c));
  const entry = (sem, key, mat) => (GR[sem][key] || {})[mat];
  const subjAvgSem = (sem, key, mat) => { const e = entry(sem, key, mat); return e && [e.d1, e.d2, e.compo].every(v => typeof v === 'number') ? (e.d1 + e.d2 + 2 * e.compo) / 4 : null; };
  function genAvg(sem, mat) {
    let tot = 0, co = 0;
    SUBJECTS.forEach(s => { const m = subjAvgSem(sem, s.key, mat); if (m !== null) { tot += m * s.coeff; co += s.coeff; } });
    return co ? tot / co : null;
  }
  function annualAvg(mat) { const a = genAvg('S1', mat), b = genAvg('S2', mat); if (a === null && b === null) return null; return a === null ? b : b === null ? a : (a + b) / 2; }
  function rankIn(sem, mat) {
    if (currentRole === 'student') { const r = (window.sunuRanks || {})[sem]; return r || null; }   // essai : rang calculé par Supabase
    const st = allStudentsDB.find(s => s.matricule === mat); if (!st) return null;
    const list = studentsOfClass(st.classe).map(s => ({ m: s.matricule, v: sem === 'AN' ? annualAvg(s.matricule) : genAvg(sem, s.matricule) })).filter(x => x.v !== null).sort((a, b) => b.v - a.v);
    const i = list.findIndex(x => x.m === mat); return i < 0 ? null : { rank: i + 1, total: list.length };
  }
  window.subjectAvg = (g, key) => { const m = subjAvgSem('S1', key, g.matricule); return m === null ? 0 : m; };
  window.overallAvg = g => { const a = annualAvg(g.matricule); return a === null ? 0 : a; };
  window.rankOf = g => { const r = rankIn('AN', g.matricule); return r ? r.rank : 1; };

  /* ---------- Saisie des notes + emploi du temps prof ---------- */
  function ensureControls() {
    if ($('gr-controls')) return;
    const card = $('grades-table-card');
    const d = document.createElement('div');
    d.id = 'gr-controls';
    d.className = 'bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-end gap-4 text-xs';
    d.innerHTML = `
      <label class="flex flex-col gap-1 font-semibold text-slate-700">Classe (vos classes uniquement)
        <select id="gr-class" class="border border-slate-300 rounded-xl px-3 py-2 bg-white font-bold" onchange="selectGradeClass(this.value)"></select></label>
      <label class="flex flex-col gap-1 font-semibold text-slate-700">Semestre
        <select id="gr-sem" class="border border-slate-300 rounded-xl px-3 py-2 bg-white font-bold" onchange="selectGradeSem(this.value)">
          <option value="S1">1er Semestre</option><option value="S2">2nd Semestre</option></select></label>
      <div id="gr-info" class="text-slate-500 font-semibold pb-2"></div>`;
    card.parentNode.insertBefore(d, card);
    const s = document.createElement('div');
    s.id = 'tch-own-sched'; s.className = 'bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 space-y-3';
    card.parentNode.insertBefore(s, card.nextSibling);
  }
  function renderOwnSched(t) {
    const box = $('tch-own-sched'); if (!box) return;
    box.classList.toggle('hidden', !t);
    if (!t) return;
    const cols = DAYS.map(d => {
      const items = t.slots.filter(s => s.day === d).sort((a, b) => toMin(a.start) - toMin(b.start));
      return `<div class="bg-slate-50 rounded-2xl border border-slate-200 p-2 space-y-1.5 min-h-[72px]"><p class="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">${d}</p>
        ${items.map(s => `<div class="bg-white rounded-xl border border-sky-200 px-2 py-1.5 text-[11px]"><p class="font-extrabold text-slate-900">${s.start} - ${s.end}</p><p class="text-violet-700 font-bold">${E(s.classe)}</p><p class="text-slate-500">${E(s.room)}</p></div>`).join('') || '<p class="text-[10px] text-slate-300">Libre</p>'}</div>`;
    }).join('');
    box.innerHTML = `<h3 class="font-extrabold text-slate-900 text-sm">📅 Mon emploi du temps • ${fmtHours(teacherHours(t))} par semaine</h3><div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">${cols}</div>`;
  }
  window.selectGradeClass = c => { selClass = c; renderGradesTable(); };
  window.selectGradeSem = s => { selSem = s; renderGradesTable(); };
  window.canEditGrades = () => { const t = myTeacher(); return !!t && !!selClass && classesOfTeacher(t).includes(selClass); };

  window.applyGradesAccess = function () {
    const banner = $('grades-access-banner'); if (!banner) return;
    const t = myTeacher(), edit = canEditGrades();
    let msg = '';
    if (currentRole !== 'teacher') msg = '🔒 Espace réservé aux enseignants.';
    else if (t && !classesOfTeacher(t).length) msg = 'Aucune classe ne vous est attribuée. Contactez l\'administration.';
    banner.textContent = msg; banner.classList.toggle('hidden', !msg);
    const hide = currentRole !== 'teacher' || !t || !classesOfTeacher(t).length;
    $('grades-table-card').classList.toggle('hidden', hide);
    const ctl = $('gr-controls'); if (ctl) ctl.classList.toggle('hidden', hide);
    const btn = $('grades-save-btn');
    btn.disabled = !edit; btn.classList.toggle('opacity-40', !edit); btn.classList.toggle('cursor-not-allowed', !edit);
    btn.title = edit ? '' : 'Réservé au professeur de la classe';
  };

  window.renderGradesTable = function () {
    ensureControls();
    const tbody = $('grades-table-body'), t = myTeacher();
    tbody.innerHTML = '';
    renderOwnSched(t);
    renderAttendance();
    const sub = document.querySelector('#tab-teacher h1 + p');
    if (!t) { if (sub) sub.textContent = 'Connectez-vous avec un matricule enseignant (ex : ENS-2025-002).'; applyGradesAccess(); return; }
    const classes = classesOfTeacher(t), key = subjKeyForTeacher(t);
    if (!classes.includes(selClass)) selClass = classes[0] || null;
    $('gr-class').innerHTML = classes.map(c => `<option value="${E(c)}" ${c === selClass ? 'selected' : ''}>${E(c)}</option>`).join('');
    $('gr-sem').value = selSem;
    const list = selClass ? studentsOfClass(selClass) : [];
    if (sub) sub.textContent = `${t.name} • ${t.subject} (coeff ${fmtC(coeffOf(t))}) • Vos classes : ${classes.join(', ')} • Moyenne = (Devoir 1 + Devoir 2 + 2 × Compo) / 4`;
    $('gr-info').textContent = `${SEM[selSem]} • ${list.length} élève(s) en ${selClass || '—'}`;
    const ok = canEditGrades();
    if (!list.length) tbody.innerHTML = '<tr><td colspan="5" class="py-6 text-center text-slate-400">Aucun élève inscrit dans cette classe.</td></tr>';
    list.forEach(s => {
      const e = entry(selSem, key, s.matricule) || {};
      const cell = f => `<td class="py-2 px-4 text-center"><input type="number" min="0" max="20" step="0.25" value="${typeof e[f] === 'number' ? e[f] : ''}" data-f="${f}" oninput="onGradeInput(this)" ${ok ? '' : 'disabled'}
        class="grade-input disabled:bg-slate-100 disabled:text-slate-500 w-20 text-center font-bold border border-slate-300 rounded-lg py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"></td>`;
      const m = subjAvgSem(selSem, key, s.matricule);
      const tr = document.createElement('tr'); tr.dataset.mat = s.matricule;
      tr.innerHTML = `<td class="py-3 px-4 font-bold text-slate-900">${E(s.nom)}<span class="block font-mono text-[10px] text-slate-400">${E(s.matricule)}</span></td>${cell('d1')}${cell('d2')}${cell('compo')}
        <td class="py-3 px-4 text-center font-extrabold text-emerald-700 bg-slate-50 grade-avg">${m === null ? '—' : m.toFixed(2)}</td>`;
      tbody.appendChild(tr);
    });
    applyGradesAccess();
  };

  window.onGradeInput = function (el) {
    const row = el.closest('tr'), inputs = [...row.querySelectorAll('.grade-input')];
    let valid = true, full = true;
    inputs.forEach(i => {
      const empty = i.value === '', bad = !empty && !isValidGrade(i.value);
      if (empty) full = false; if (bad) valid = false;
      i.classList.toggle('border-rose-500', bad); i.classList.toggle('bg-rose-50', bad); i.classList.toggle('border-slate-300', !bad);
    });
    const [a, b, c] = inputs.map(i => Number(i.value));
    row.querySelector('.grade-avg').textContent = valid && full ? ((a + b + 2 * c) / 4).toFixed(2) : '—';
  };

  window.saveGrades = async function () {
    const t = myTeacher();
    if (!canEditGrades()) { showToast('🔒 Vous ne pouvez saisir que les notes de vos propres classes.'); return; }
    const key = subjKeyForTeacher(t), rows = [...document.querySelectorAll('#grades-table-body tr[data-mat]')];
    for (const row of rows) for (const i of row.querySelectorAll('.grade-input')) if (i.value !== '' && !isValidGrade(i.value)) { showToast('⚠️ Une note est hors de 0–20. Corrigez les champs en rouge.'); return; }
    const sem = selSem, cls = selClass, subjName = (SUBJECTS.find(x => x.key === key) || {}).name;
    GR[sem][key] = GR[sem][key] || {};
    const payload = [];
    rows.forEach(row => {
      const mat = row.dataset.mat;
      if (!studentsOfClass(cls).some(s => s.matricule === mat)) return;
      const had = !!GR[sem][key][mat];
      const e = {}; let any = false;
      row.querySelectorAll('.grade-input').forEach(i => { if (i.value !== '') { e[i.dataset.f] = Number(i.value); any = true; } });
      if (any || had) payload.push({ mat, subject: subjName, sem, d1: e.d1 === undefined ? null : e.d1, d2: e.d2 === undefined ? null : e.d2, compo: e.compo === undefined ? null : e.compo });
      if (any) GR[sem][key][mat] = e; else delete GR[sem][key][mat];
    });
    // essai : enregistrement dans Supabase ; en cas d'échec, l'écran revient à l'état du serveur
    if (!(await window.sunuPersistGrades(payload))) { await window.sunuReload(); return; }
    gradesMeta.at = new Date(); saveAll();
    renderGradesTable(); renderReportCard(); renderStudentSpace();
    showToast(`💾 Notes de ${t.subject} • ${cls} • ${SEM[sem]} enregistrées.`);
  };

  /* ---------- Bulletins ---------- */
  function ensureRcForm() {
    if ($('rc-form')) return;
    const wrap = $('rc-select').parentElement; wrap.style.display = 'none';
    const f = document.createElement('form'); f.id = 'rc-form';
    f.className = 'max-w-4xl mx-auto no-print bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-end gap-3 text-xs';
    f.innerHTML = `<label class="flex flex-col gap-1 font-semibold text-slate-700 flex-1 min-w-[220px]"><span id="rc-label">Matricule de l'élève</span>
      <input id="rc-mat" type="text" placeholder="ex : SN-2025-0412" autocomplete="off" class="border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-sky-500"></label>
      <button type="submit" class="bg-sky-700 hover:bg-sky-800 text-white font-bold px-5 py-2.5 rounded-xl">🔍 Afficher les bulletins</button>`;
    f.addEventListener('submit', ev => { ev.preventDefault(); rcMat = $('rc-mat').value.trim(); renderReportCard(); });
    wrap.parentNode.insertBefore(f, wrap.nextSibling);
  }
  function findForReport(raw) {
    const a = alnum(raw);
    const exact = allStudentsDB.filter(s => alnum(s.matricule) === a);
    if (exact.length || currentRole !== 'admin') return exact;
    const q = raw.toLowerCase(), d = digitsOf(raw);
    const part = a.length >= 3 ? allStudentsDB.filter(s => alnum(s.matricule).includes(a)) : [];
    const ph = d.length >= 4 ? allStudentsDB.filter(s => digitsOf(s.phone).includes(d)) : [];
    const nm = q.length >= 3 ? allStudentsDB.filter(s => s.nom.toLowerCase().includes(q)) : [];
    return [...new Set([...part, ...ph, ...nm])];
  }
  function semSheet(st, sem) {
    const mat = st.matricule, g = genAvg(sem, mat), rk = rankIn(sem, mat), at = attStats(mat, sem);
    const gc = g === null ? '' : g >= 10 ? 'text-emerald-700' : 'text-rose-700';
    let tc = 0;
    const rows = SUBJECTS.map(x => {
      const e = entry(sem, x.key, mat) || {}, m = subjAvgSem(sem, x.key, mat);
      const f = v => typeof v === 'number' ? v.toFixed(2) : '—';
      if (m !== null) tc += x.coeff;
      return `<tr class="border-b border-slate-100"><td class="py-2 px-3 font-semibold">${E(x.name)}<span class="block text-[10px] font-normal text-slate-400">${E(x.teacher)}</span></td>
        <td class="py-2 px-3 text-center">${f(e.d1)}</td><td class="py-2 px-3 text-center">${f(e.d2)}</td><td class="py-2 px-3 text-center">${f(e.compo)}</td>
        <td class="py-2 px-3 text-center">${fmtC(x.coeff)}</td><td class="py-2 px-3 text-center font-bold ${m !== null && m < 10 ? 'text-rose-700' : ''}">${m === null ? '—' : m.toFixed(2)}</td>
        <td class="py-2 px-3 text-center">${m === null ? '—' : (m * x.coeff).toFixed(2)}</td></tr>`;
    }).join('');
    return `<section class="bg-white p-8 rounded-3xl border border-slate-300 shadow-lg max-w-4xl mx-auto text-slate-900 text-xs" style="page-break-after:always">
      <h2 class="font-extrabold text-center text-sm uppercase">Bulletin du ${SEM[sem]} - République du Sénégal</h2>
      <p class="text-center text-slate-500 text-[10px]">${(window.SCHOOL && window.SCHOOL.ia) || 'IA Diourbel'} • ${(window.SCHOOL && window.SCHOOL.ief) || 'IEF Touba'} • ${(window.SCHOOL && window.SCHOOL.name) || 'Groupe Scolaire Al-Amine'} • Année scolaire ${(window.SCHOOL && window.SCHOOL.schoolYear) || '2026 - 2027'}</p>
      <div class="bg-slate-50 p-3 rounded-xl my-4 flex flex-wrap justify-between gap-2 font-bold">
        <span>Élève : ${E(st.nom)} (${E(st.classe)})</span><span>N° Unique : ${E(mat)}</span>
        <span class="${gc}">Moyenne : ${g === null ? '—' : g.toFixed(2) + ' / 20'}${rk ? ` (${rankLabel(rk.rank)} sur ${rk.total})` : ''}</span></div>
      <div class="overflow-x-auto"><table class="w-full text-left"><thead class="bg-slate-100 text-slate-600 uppercase text-[10px] tracking-wider"><tr>
        <th class="py-2 px-3">Matière</th><th class="py-2 px-3 text-center">Dev. 1</th><th class="py-2 px-3 text-center">Dev. 2</th><th class="py-2 px-3 text-center">Compo</th>
        <th class="py-2 px-3 text-center">Coeff</th><th class="py-2 px-3 text-center">Moy. /20</th><th class="py-2 px-3 text-center">Points</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr class="bg-slate-50 font-extrabold"><td class="py-2 px-3" colspan="4">Total / Moyenne générale</td><td class="py-2 px-3 text-center">${fmtC(tc)}</td>
        <td class="py-2 px-3 text-center ${gc}">${g === null ? '—' : g.toFixed(2)}</td><td class="py-2 px-3 text-center">${g === null ? '—' : (g * tc).toFixed(2)}</td></tr></tfoot></table></div>
      <div class="mt-4 p-3 rounded-xl border border-slate-200 flex flex-wrap gap-x-6 gap-y-1"><span class="font-bold">Assiduité :</span>
        <span>Absences non justifiées : <b>${at.abs}</b></span><span>Absences justifiées : <b>${at.just}</b></span><span>Retards : <b>${at.late}</b>${at.late ? ` (${at.min} min)` : ''}</span></div>
      <div class="mt-3 p-3 rounded-xl border border-slate-200"><span class="font-bold">Appréciation du conseil de classe :</span> ${g === null ? 'Notes non encore saisies pour ce semestre.' : E(appreciation(g))}</div>
    </section>`;
  }
  window.renderReportCard = function () {
    ensureRcForm();
    const box = $('rc-sheet'), inp = $('rc-mat'), adm = currentRole === 'admin';
    box.className = 'space-y-6 text-xs';
    if ($('rc-label')) $('rc-label').textContent = adm ? 'Rechercher un bulletin : matricule, téléphone du parent ou nom' : 'Matricule de l\'élève';
    if (inp) inp.placeholder = adm ? 'SN-2025-0412 • +221 77 123 45 67 • DIOP' : 'ex : SN-2025-0412';
    if (currentRole === 'student' && !rcMat) rcMat = currentStudentMat;
    if (inp && document.activeElement !== inp) inp.value = rcMat;
    const msg = (m, c = 'text-slate-400') => { box.innerHTML = `<div class="bg-white p-8 rounded-3xl border border-slate-300 max-w-4xl mx-auto text-center ${c}">${m}</div>`; };
    if (currentRole === 'teacher') return msg('🔒 Les bulletins ne sont pas accessibles aux enseignants.', 'text-amber-700 font-bold');
    if (!rcMat) return msg(adm ? 'Saisissez un matricule, un numéro de téléphone ou un nom pour retrouver les bulletins d\'un élève.' : 'Entrez le matricule de l\'élève pour afficher ses bulletins du 1er et du 2nd semestre.');
    const found = findForReport(rcMat);
    if (!found.length) return msg(`⚠️ Aucun élève trouvé pour « ${E(rcMat)} ».`, 'text-rose-600 font-bold');
    if (found.length > 1) {
      box.innerHTML = `<div class="bg-white p-5 rounded-3xl border border-slate-300 max-w-4xl mx-auto space-y-2"><p class="font-extrabold text-slate-800">${found.length} élèves correspondent — choisissez :</p>
        ${found.slice(0, 10).map(s => `<button onclick="rcMatSet('${E(s.matricule)}')" class="w-full flex justify-between items-center text-left bg-slate-50 hover:bg-sky-50 border border-slate-200 rounded-xl px-4 py-2.5"><span class="font-bold">${E(s.nom)} <span class="font-normal text-slate-500">• ${E(s.classe)}</span></span><span class="font-mono text-sky-700 font-bold">${E(s.matricule)}</span></button>`).join('')}</div>`;
      return;
    }
    const st = found[0];
    if (currentRole === 'student' && st.matricule !== currentStudentMat) return msg('🔒 Un élève ne peut consulter que son propre bulletin.', 'text-amber-700 font-bold');
    const an = annualAvg(st.matricule), rk = rankIn('AN', st.matricule), a1 = genAvg('S1', st.matricule), a2 = genAvg('S2', st.matricule);
    const summary = `<section class="bg-slate-900 text-white p-5 rounded-3xl max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3">
      <div><p class="font-extrabold text-sm">${E(st.nom)}</p><p class="font-mono text-slate-300">${E(st.matricule)} • ${E(st.classe)}</p></div>
      <div class="flex gap-5 text-center"><div><p class="text-slate-400 text-[10px]">1er Semestre</p><p class="font-extrabold text-lg">${a1 === null ? '—' : a1.toFixed(2)}</p></div>
      <div><p class="text-slate-400 text-[10px]">2nd Semestre</p><p class="font-extrabold text-lg">${a2 === null ? '—' : a2.toFixed(2)}</p></div>
      <div><p class="text-slate-400 text-[10px]">Moyenne annuelle</p><p class="font-extrabold text-lg text-emerald-300">${an === null ? '—' : an.toFixed(2)}</p></div>
      <div><p class="text-slate-400 text-[10px]">Rang annuel</p><p class="font-extrabold text-lg">${rk ? rankLabel(rk.rank) + '/' + rk.total : '—'}</p></div></div></section>`;
    box.innerHTML = summary + semSheet(st, 'S1') + semSheet(st, 'S2');
  };
  window.openStudentReport = function (i) {
    const s = allStudentsDB[i]; if (!s) return;
    if (currentRole === 'student' && s.matricule !== currentStudentMat) { showToast('🔒 Notes confidentielles.'); return; }
    rcMatSet(s.matricule);
  };
  window.rcMatSet = m => { rcMat = m; switchTab('reportcard'); renderReportCard(); };

  /* ---------- Espace élève ---------- */
  const origStudentSpace = window.renderStudentSpace;
  window.renderStudentSpace = function () {
    safe(origStudentSpace);
    const s = currentStudent(); const box = $('my-grades'); if (!s || !box) return;
    const g1 = genAvg('S1', s.matricule), g2 = genAvg('S2', s.matricule), an = annualAvg(s.matricule), rk = rankIn('AN', s.matricule);
    const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
    set('stu-avg', an === null ? '—' : an.toFixed(2)); set('stu-rank', rk ? rankLabel(rk.rank) : '—'); set('stu-rank-total', rk ? rk.total : '—');
    const f = v => v === null ? '<span class="text-slate-300">—</span>' : v.toFixed(2);
    const rows = SUBJECTS.map(x => `<tr class="border-b border-slate-100"><td class="py-2.5 px-3 font-bold text-slate-900">${E(x.name)}<span class="block text-[10px] font-normal text-slate-400">${E(x.teacher)} • coeff ${fmtC(x.coeff)}</span></td>
      <td class="py-2.5 px-3 text-center font-bold">${f(subjAvgSem('S1', x.key, s.matricule))}</td><td class="py-2.5 px-3 text-center font-bold">${f(subjAvgSem('S2', x.key, s.matricule))}</td></tr>`).join('');
    box.innerHTML = `<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
      <div><h3 class="font-extrabold text-slate-900 text-base">📊 Mes Notes</h3><p class="text-xs text-slate-500">Moyennes par matière • 1er et 2nd semestre</p></div>
      <button onclick="rcMatSet('${E(s.matricule)}')" class="bg-slate-900 hover:bg-black text-white font-bold text-xs px-4 py-2 rounded-xl">📄 Voir mes bulletins</button></div>
      <div class="overflow-x-auto"><table class="w-full text-left text-xs"><thead class="bg-slate-100 text-slate-600 uppercase text-[10px]"><tr><th class="py-2 px-3">Matière</th><th class="py-2 px-3 text-center">Semestre 1</th><th class="py-2 px-3 text-center">Semestre 2</th></tr></thead>
      <tbody>${rows}</tbody><tfoot><tr class="bg-slate-50 font-extrabold"><td class="py-2 px-3">Moyenne générale</td><td class="py-2 px-3 text-center">${f(g1)}</td><td class="py-2 px-3 text-center">${f(g2)}</td></tr></tfoot></table></div>`;
    let ab = $('my-absences');
    if (!ab) { ab = document.createElement('div'); ab.id = 'my-absences'; ab.className = box.className || 'bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 space-y-4'; box.parentNode.insertBefore(ab, box.nextSibling); }
    const at = attStats(s.matricule), mine = attRecords(r => r.mat === s.matricule).slice(0, 10);
    ab.innerHTML = `<div class="border-b border-slate-100 pb-3"><h3 class="font-extrabold text-slate-900 text-base">🗓️ Mes absences et retards</h3>
      <p class="text-xs text-slate-500">Absences non justifiées : <b class="text-rose-700">${at.abs}</b> • Justifiées : <b>${at.just}</b> • Retards : <b class="text-amber-700">${at.late}</b>${at.late ? ` (${at.min} min)` : ''}</p></div>
      ${mine.length ? `<div class="space-y-1.5">${mine.map(r => `<div class="flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-50 rounded-xl px-3 py-2"><span class="font-mono text-slate-600">${E(r.date)}</span><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${STC[r.s]}">${ST[r.s]}${r.s === 'R' ? ' ' + E(r.min) + ' min' : ''}</span><span class="text-slate-500">${E(r.motif || '')}</span></div>`).join('')}</div>` : '<p class="text-xs text-slate-400 text-center py-3">Aucune absence ni retard enregistré. Bravo !</p>'}`;
  };

  const origRefresh = window.refreshAccess;
  window.refreshAccess = function () {
    rcMat = currentRole === 'student' ? currentStudentMat : ''; selClass = null; attClass = null; payMonths = new Set(); lastReceipt = null;
    ensureCoeffField(); syncSubjects(); createAbsTab(); createPayTab();
    origRefresh(); applyRoleUI(); renderTeachers(); renderAbsAdmin(); renderPayments();
    // Afficher/masquer les boutons "Créer Administrateur" selon is_director
    const btnAdm = document.getElementById('btn-create-admin');
    if (btnAdm) btnAdm.classList.toggle('hidden', !window.sunuIsDirector);
    const btnTop = document.getElementById('btn-create-admin-top');
    if (btnTop) btnTop.classList.toggle('hidden', !window.sunuIsDirector);
    // Mettre à jour le compteur corbeille enseignants
    const tc = document.getElementById('teacher-trash-count');
    if (tc) tc.textContent = (typeof teachersTrash !== 'undefined' ? teachersTrash.length : 0);
  };

  window.openCreateAdminModal = function() {
    if (!window.sunuIsDirector) {
      showToast('🔒 Seul le directeur créé dans Supabase peut créer un administrateur.');
      return;
    }
    const modal = document.getElementById('create-admin-modal');
    if (!modal) return;
    const res = document.getElementById('create-admin-result');
    const flds = document.getElementById('create-admin-form-fields');
    const inp = document.getElementById('new-admin-name');
    if (res) res.classList.add('hidden');
    if (flds) flds.classList.remove('hidden');
    if (inp) { inp.value = ''; setTimeout(() => inp.focus(), 100); }
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  };

  window.printReceipt = window.printReceiptDedicated;

  window.printCashReceipt = function() {
    const rcptNumber = (document.getElementById('rcpt-number') || {}).textContent || '';
    if (!rcptNumber || rcptNumber.includes('-')) {
      showToast("⚠️ Aucun reçu à imprimer. Effectuez d'abord un encaissement.");
      return;
    }
    const student = (document.getElementById('rcpt-student') || {}).textContent || '';
    const matricule = (document.getElementById('rcpt-account') || {}).textContent || '';
    const payer = (document.getElementById('rcpt-payer') || {}).textContent || '';
    const motif = (document.getElementById('rcpt-motif') || {}).textContent || '';
    const amount = (document.getElementById('rcpt-amount') || {}).textContent || '';
    const mode = (document.getElementById('rcpt-mode') || {}).textContent || '';
    const date = (document.getElementById('rcpt-date') || {}).textContent || '';
    
    const schoolName = (window.SCHOOL && window.SCHOOL.name) || 'SunuSchool';
    const schoolCity = (window.SCHOOL && window.SCHOOL.city) || '';
    const schoolPhone = (window.SCHOOL && window.SCHOOL.phone) || '';
    const schoolYear = (window.SCHOOL && window.SCHOOL.schoolYear) || '';

    const w = window.open('', '_blank', 'width=340,height=600,scrollbars=yes');
    if (!w) { showToast('⚠️ Autorisez les pop-ups pour imprimer le reçu.'); return; }
    w.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
      <title>${E(rcptNumber)}</title>
      <style>
        @page { size: 80mm auto; margin: 4mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Courier New', monospace; font-size: 10pt; width: 72mm; color: #000; padding: 2mm; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .big { font-size: 12pt; font-weight: bold; }
        .line { border-top: 1px dashed #000; margin: 5px 0; }
        .doubleline { border-top: 2px solid #000; margin: 5px 0; }
        .row { display: flex; justify-content: space-between; margin: 3px 0; font-size: 9pt; }
        .amount { font-size: 14pt; font-weight: bold; text-align: center; margin: 8px 0; }
        .footer { font-size: 8pt; text-align: center; margin-top: 8px; color: #444; }
        .signature { margin-top: 18px; display: flex; justify-content: space-between; font-size: 8pt; }
        @media print { body { width: 72mm; } button { display: none !important; } }
      </style>
    </head><body>
      <div class="center bold big">${E(schoolName)}</div>
      <div class="center" style="font-size:8.5pt">${E(schoolCity)}${schoolCity && schoolPhone ? ' — ' : ''}${E(schoolPhone)}</div>
      ${schoolYear ? `<div class="center" style="font-size:8.5pt">Année scolaire : ${E(schoolYear)}</div>` : ''}
      <div class="doubleline"></div>
      <div class="center bold" style="font-size:11pt">REÇU DE PAIEMENT CAISSE</div>
      <div class="center bold font-mono" style="font-size:9.5pt">${E(rcptNumber)}</div>
      <div class="center" style="font-size:8pt">${E(date)}</div>
      <div class="line"></div>
      <div class="row"><span>Élève :</span><span class="bold">${E(student)}</span></div>
      <div class="row"><span>Matricule :</span><span class="bold font-mono">${E(matricule)}</span></div>
      <div class="row"><span>Payeur :</span><span>${E(payer)}</span></div>
      <div class="line"></div>
      <div class="row"><span>Motif :</span><span>${E(motif)}</span></div>
      <div class="row"><span>Mode :</span><span>${E(mode)}</span></div>
      <div class="line"></div>
      <div class="amount">${E(amount)}</div>
      <div class="center bold">✓ Paiement reçu en caisse</div>
      <div class="line"></div>
      <div class="signature">
        <div>Tampon de l'école</div>
        <div>Signature Caissier</div>
      </div>
      <div class="footer">Conservez ce reçu officiel.<br>Merci de votre confiance.</div>
      <br>
      <div class="center"><button onclick="window.print();window.close()" style="background:#000;color:#fff;border:none;padding:8px 24px;border-radius:6px;cursor:pointer;font-size:11pt">🖨️ Imprimer</button></div>
    </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 350);
  };

  // ── Création de compte administrateur (directeur uniquement) ──
  let _lastAdminCreated = null;

  window.handleCreateAdmin = async function(e) {
    e.preventDefault();
    if (!window.sunuIsDirector) { showToast('🔒 Seul le directeur peut créer un administrateur.'); return; }
    const name = (document.getElementById('new-admin-name') || {}).value?.trim();
    if (!name || name.length < 3) { showToast('⚠️ Indiquez le nom complet (au moins 3 caractères).'); return; }
    const btn = document.getElementById('create-admin-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Création…'; }
    try {
      const { data: sess } = await window.sb.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) throw new Error('Non connecté');
      const res = await fetch('https://bmhdxzkuhueflnricgpx.supabase.co/functions/v1/create-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ role: 'admin', full_name: name })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Erreur inconnue');
      _lastAdminCreated = { name: data.full_name, mat: data.matricule, pwd: data.password };
      document.getElementById('new-admin-mat').textContent = data.matricule;
      document.getElementById('new-admin-pwd').textContent = data.password;
      document.getElementById('create-admin-result').classList.remove('hidden');
      document.getElementById('create-admin-form-fields').classList.add('hidden');
      showToast(`✅ Administrateur ${data.full_name} créé • Matricule : ${data.matricule}`);
    } catch(err) {
      showToast('⚠️ Échec : ' + (err.message || err));
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '✔ Créer le compte'; }
    }
  };

  window.copyAdminCredentials = function() {
    if (!_lastAdminCreated) return;
    const txt = `SunuSchool — Administrateur\nNom : ${_lastAdminCreated.name}\nMatricule : ${_lastAdminCreated.mat}\nMot de passe : ${_lastAdminCreated.pwd}`;
    navigator.clipboard?.writeText(txt).then(() => showToast('✅ Identifiants copiés.')).catch(() => showToast('⚠️ Copiez manuellement les identifiants.'));
  };

  window.printAdminCredentials = function() {
    if (!_lastAdminCreated) return;
    const w = window.open('', '_blank');
    if (!w) return;
    const school = (window.SCHOOL && window.SCHOOL.name) || 'SunuSchool';
    w.document.write(`<html><head><title>Identifiants Administrateur</title></head><body style="font-family:Arial;padding:30px">
      <h2>${school} — Identifiants Administrateur</h2>
      <p><b>Nom :</b> ${_lastAdminCreated.name}</p>
      <p><b>Matricule :</b> ${_lastAdminCreated.mat}</p>
      <p><b>Mot de passe :</b> <span style="font-family:monospace;font-size:16px;letter-spacing:3px">${_lastAdminCreated.pwd}</span></p>
      <p style="color:#b45309">⚠️ Conservez ces informations de manière confidentielle.</p>
    </body></html>`);
    w.document.close(); w.print();
  };


  /* ---------- Essai : remplace les données du prototype par celles de Supabase ---------- */
  window.sunuHydrate = function (R) {
    const keyOf = name => { const s = SUBJECTS.find(x => x.name === name); return s ? s.key : null; };
    const numOf = m => { const x = String(m).match(/(\d+)\s*$/); return x ? parseInt(x[1], 10) : 0; };
    const fmtFee = n => String(n || 0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA';
    const num = v => (v === null || v === undefined) ? null : Number(v);

    R.subjects.forEach(r => { const s = SUBJECTS.find(x => x.name === r.name); if (s) s.coeff = Number(r.coeff); });

    const stu = R.students.map(s => ({ nom: s.nom, matricule: s.matricule, sexe: s.sexe || '', classe: s.classe, parent: s.parent || '',
      phone: s.phone || '', fee: fmtFee(s.fee), statut: 'Non payé', statutClass: 'bg-amber-100 text-amber-800' }));
    const countBy = {}; stu.forEach(s => { countBy[s.classe] = (countBy[s.classe] || 0) + 1; });
    const clsObj = c => ({ id: c.id, name: c.name, level: c.level, effectif: countBy[c.name] || 0, pp: c.pp || '', room: c.room || '' });
    const cls = R.classes.filter(c => !c.deletedAt).map(clsObj);
    const trash = R.classes.filter(c => c.deletedAt).map(c => ({ cls: clsObj(c), deletedAt: c.deletedAt }));
    const tch = R.teachers.map(t => ({ id: t.id, matricule: t.matricule || '', name: t.name, subject: t.subject, phone: t.phone || '', slots: t.slots }));

    // Notes : GR[semestre][matière][matricule] = { d1, d2, compo }
    const gr = { S1: {}, S2: {} };
    R.grades.forEach(g => {
      const key = keyOf(g.subject); if (!key || !gr[g.sem]) return;
      let d1 = num(g.d1), d2 = num(g.d2), cp = num(g.compo); const av = num(g.average);
      if (d1 === null && d2 === null && cp === null && av !== null) { d1 = d2 = cp = av; }   // matière à moyenne seule
      const e = {}; if (d1 !== null) e.d1 = d1; if (d2 !== null) e.d2 = d2; if (cp !== null) e.compo = cp;
      if (!Object.keys(e).length) return;
      (gr[g.sem][key] = gr[g.sem][key] || {})[g.mat] = e;
    });

    // Anciennes structures du prototype (rang, moyenne générale) : élèves ayant des notes au S1
    const sd = []; let nid = 1;
    stu.forEach(s => {
      const full = e => e && ['d1', 'd2', 'compo'].every(f => typeof e[f] === 'number');
      const m = gr.S1.maths && gr.S1.maths[s.matricule]; if (!full(m)) return;
      const others = {};
      Object.keys(gr.S1).forEach(k => { if (k === 'maths') return; const e = gr.S1[k][s.matricule]; if (full(e)) others[k] = Math.round(((e.d1 + e.d2 + e.compo) / 3) * 100) / 100; });
      sd.push({ id: nid++, name: s.nom, matricule: s.matricule, d1: m.d1, d2: m.d2, compo: m.compo, others });
    });
    studentsData.splice(0, studentsData.length, ...sd);

    // Absences : ATT[date|classe][matricule]
    const att = {};
    R.attendance.forEach(a => { const k = a.day + '|' + classKey(a.cls); (att[k] = att[k] || {})[a.mat] = { cls: a.cls, by: '', s: a.s, min: a.min || 0, motif: a.motif || '' }; });

    // Paiements
    const pay = R.payments.map(p => ({ id: 'p' + p.id, rec: p.rec, mat: p.mat, month: p.month, amount: Number(p.amount), method: p.method, ref: p.ref || '', date: p.date, by: 'Caisse' }));

    applyState({ v: 9, classes: cls, trash, students: stu, teachers: tch, GR: gr, ATT: att, PAY: pay, c: {
      nextMatriculeNum: Math.max(468, ...stu.map(s => numOf(s.matricule))) + 1,
      nextClassId: Math.max(0, ...R.classes.map(c => c.id)) + 1,
      nextTeacherId: Math.max(0, ...tch.map(t => t.id)) + 1,
      nextTeacherNum: Math.max(7, ...tch.map(t => numOf(t.matricule))) + 1,
      dailyCash: pay.filter(p => p.date === todayISO() && p.method === 'Espèces').reduce((a, p) => a + p.amount, 0)
    } });
    syncSubjects();
    allStudentsDB.forEach(s => safe(() => { if (feeOf(s)) refreshStatut(s); }));
    rerenderAll();
    safe(renderGradesTable); safe(renderReportCard); safe(renderAttendance);
  };

  /* ---------- Essai : accès du bloc « caisse » aux paiements ---------- */
  window.sunuPayApi = {
    months: MONTHS,
    all: () => PAY.slice(),
    remaining: (mat, m) => { const s = allStudentsDB.find(x => x.matricule === mat); return s ? Math.max(0, feeOf(s) - paidFor(mat, m)) : 0; },
    add: rows => { PAY.push(...rows); rows.forEach(r => { const s = allStudentsDB.find(x => x.matricule === r.mat); if (s) safe(() => refreshStatut(s)); }); safe(renderPayments); }
  };

  const boot = () => {
    safe(() => {
      const badge = document.createElement('div'); badge.id = 'save-badge'; document.body.appendChild(badge);
      updateBadge('💾 Chargement… ' + VERSION, 'bg-slate-700 text-white');
      const tools = document.createElement('div');
      tools.id = 'admin-tools'; tools.className = 'hidden fixed bottom-4 right-4 z-40 flex gap-2 print:hidden';
      tools.innerHTML = `<button onclick="exportSunuSchoolData()" class="bg-white text-sky-700 border border-sky-200 hover:bg-sky-50 font-bold text-[11px] px-3 py-2 rounded-xl shadow-lg">⬇ Exporter</button>
        <button onclick="importSunuSchoolData()" class="bg-white text-sky-700 border border-sky-200 hover:bg-sky-50 font-bold text-[11px] px-3 py-2 rounded-xl shadow-lg">⬆ Importer</button>
        <button onclick="resetSunuSchoolData()" class="bg-white text-rose-700 border border-rose-200 hover:bg-rose-50 font-bold text-[11px] px-3 py-2 rounded-xl shadow-lg">↺ Réinitialiser</button>`;
    });
    const best = Store.read();
    if (best) safe(() => applyState(best.o));
    syncSubjects();
    allStudentsDB.forEach(s => safe(() => { if (feeOf(s)) refreshStatut(s); }));
    window.refreshAccess();
    if (best) rerenderAll();
    saveAll(true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

/* ===== SunuSchool v11 : mot de passe automatique, sur base v9 complète ===== */
(() => {
  const KEY = 'sunuschool-student-passwords-v11';
  const E = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $ = id => document.getElementById(id);
  const safe = fn => { try { return fn(); } catch (e) { console.error(e); } };
  const randomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let p = '';
    for (let i=0;i<8;i++) p += chars[Math.floor(Math.random()*chars.length)];
    return p;
  };
  let credentials = {};
  function load() { try { credentials = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (_) { credentials = {}; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(credentials)); } catch (_) {} }
  function ensure(mat, password) { if (!credentials[mat]) { credentials[mat] = password || randomPassword(); save(); } return credentials[mat]; }
  function initExisting() { allStudentsDB.forEach(s => ensure(s.matricule)); }
  function modalHtml() {
    if ($('student-password-modal')) return;
    const d=document.createElement('div'); d.id='student-password-modal'; d.className='hidden fixed inset-0 z-[100] bg-slate-950/60 p-4 items-center justify-center';
    d.innerHTML=`<div class="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 text-center space-y-4"><div class="text-4xl">🔐</div>
      <h2 class="font-black text-slate-900 text-lg">Compte élève créé</h2><p class="text-sm text-slate-500">Remettez ces identifiants au parent ou à l'élève. Conservez le mot de passe de façon confidentielle.</p>
      <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-2"><p><span class="text-slate-500">Élève :</span> <b id="pwd-stu-name"></b></p><p><span class="text-slate-500">Matricule :</span> <b id="pwd-stu-mat" class="font-mono text-sky-700"></b></p><p><span class="text-slate-500">Mot de passe :</span> <b id="pwd-stu-pass" class="font-mono text-emerald-700 text-lg tracking-widest"></b></p></div>
      <div class="flex gap-2"><button onclick="copyStudentCredentials()" class="flex-1 bg-sky-700 hover:bg-sky-800 text-white font-bold text-xs py-3 rounded-xl">📋 Copier</button><button onclick="printStudentCredentials()" class="flex-1 bg-slate-900 hover:bg-black text-white font-bold text-xs py-3 rounded-xl">🖨️ Imprimer</button></div>
      <button onclick="closeStudentPasswordModal()" class="w-full text-slate-500 hover:text-slate-900 font-bold text-xs py-2">J'ai noté les identifiants</button></div>`;
    document.body.appendChild(d);
  }
  let shown = null;
  window.showStudentCredentials = function(s) { if (!s) return; initExisting(); shown=s; modalHtml(); $('pwd-stu-name').textContent=s.nom; $('pwd-stu-mat').textContent=s.matricule; $('pwd-stu-pass').textContent=credentials[s.matricule]; $('student-password-modal').classList.remove('hidden'); $('student-password-modal').classList.add('flex'); };
  window.closeStudentPasswordModal = () => { const m=$('student-password-modal'); if(m){m.classList.add('hidden');m.classList.remove('flex');} };
  window.copyStudentCredentials = () => { if(!shown)return; const tx=`SunuSchool\nÉlève : ${shown.nom}\nMatricule : ${shown.matricule}\nMot de passe : ${credentials[shown.matricule]}`; navigator.clipboard?.writeText(tx).then(()=>showToast('✅ Identifiants copiés.')).catch(()=>showToast('⚠️ Copiez manuellement les identifiants affichés.')); };
  window.printStudentCredentials = () => { if(!shown)return; const w=window.open('','_blank'); if(!w)return; w.document.write(`<html><head><title>Identifiants SunuSchool</title></head><body style="font-family:Arial;padding:30px"><h2>SunuSchool — Identifiants élève</h2><p><b>Élève :</b> ${E(shown.nom)}</p><p><b>Matricule :</b> ${E(shown.matricule)}</p><p><b>Mot de passe :</b> ${E(credentials[shown.matricule])}</p><p>Conservez ces informations de manière confidentielle.</p></body></html>`); w.document.close(); w.print(); };
  window.resetStudentPassword = function(mat) { if(window.currentRole !== 'admin') return; credentials[mat]=randomPassword(); save(); const s=allStudentsDB.find(x=>x.matricule===mat); showStudentCredentials(s); showToast('✅ Nouveau mot de passe généré.'); };

  // Création : intercepte l'inscription existante v9 et ajoute le mot de passe au nouvel élève.
  const originalEnroll = window.handleEnrollStudent;
  window.handleEnrollStudent = function(e) {
    const before = new Set(allStudentsDB.map(s=>s.matricule));
    const r = originalEnroll.apply(this, arguments);
    const created = allStudentsDB.find(s=>!before.has(s.matricule));
    if(created) { ensure(created.matricule); setTimeout(()=>showStudentCredentials(created), 80); showToast(`🎓 ${created.nom} inscrit(e) • Matricule ${created.matricule} • Mot de passe créé.`); }
    return r;
  };
  // Connexion : élève = matricule + mot de passe.
  const originalLogin = window.handleLogin;
  window.handleLogin = function(e) {
    const role = window.pendingRole, id = $('login-id-input').value.trim(), pwd = $('login-pwd-input').value;
    if(role === 'student') { initExisting(); const s = allStudentsDB.find(x=>alnum(x.matricule)===alnum(id));
      if(!s) { showToast(`⚠️ Matricule élève inconnu : « ${id} ».`); return; }
      if(!pwd) { showToast('⚠️ Saisissez le mot de passe de l’élève.'); return; }
      if(pwd !== credentials[s.matricule]) { showToast('⚠️ Mot de passe incorrect.'); return; }
    }
    return originalLogin.apply(this, arguments);
  };
  const originalSetRole = window.setLoginRole;
  window.setLoginRole = function(role) { const r=originalSetRole.apply(this,arguments); const p=$('login-pwd-input'); if(p){p.required=true;p.placeholder='Votre mot de passe personnel';} return r; };
  // Administration : consulter et réinitialiser les identifiants depuis la liste nominative.
  const originalList=window.renderRegistryList;
  window.renderRegistryList=function(){originalList();if(window.currentRole!=='admin')return;const tb=$('nominal-students-body');if(!tb)return;tb.querySelectorAll('button').forEach(b=>{const m=/openEditStudent\((\d+)/.exec(b.getAttribute('onclick')||'');if(!m)return;const i=Number(m[1]),s=allStudentsDB[i];if(!s)return;const x=document.createElement('button');x.className='bg-white border border-slate-200 hover:border-emerald-500 text-slate-700 hover:text-emerald-700 font-bold px-2 py-1 rounded-lg text-[10px] shadow-xs';x.textContent='🔐 Identifiants';x.setAttribute('onclick',`showStudentCredentials(allStudentsDB[${i}])`);b.parentNode.appendChild(x);});};
  const boot=()=>{load();initExisting();modalHtml();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

/* ===== SunuSchool essai : blocs 1 et 2 = connexion + lecture des données Supabase ===== */
(() => {
  const CFG = window.SUNU_CONFIG || {};
  const sb = (window.supabase && CFG.supabaseUrl && CFG.supabaseKey)
    ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey) : null;
  window.sb = sb;
  const el = id => document.getElementById(id);
  const ERR = '⚠️ Identifiant ou mot de passe incorrect.';
  const toEmail = id => {
    const raw = String(id).trim().toLowerCase();
    if (raw.includes('@')) return raw;
    const cleanId = raw.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const slug = (window.SCHOOL && window.SCHOOL.slug) || 'al-amine-touba';
    return cleanId + '@' + slug + '.sunuschool.app';
  };
  const loginEmails = id => {
    const raw = String(id).trim();
    if (raw.includes('@')) return [raw.toLowerCase()];
    const matricule = raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const slug = (window.SCHOOL && window.SCHOOL.slug) || 'al-amine-touba';
    return [...new Set([
      matricule + '@' + slug + '.sunuschool.app',
      matricule + '@sunuschool.example.com',
      matricule + '@moustapha-edu.sunuschool.app',
      matricule + '@al-amine-touba.sunuschool.app',
      matricule + '@sunuschool.app'
    ])];
  };
  const HOME_TAB = { student: 'student', teacher: 'teacher', admin: 'classes-registry' };
  let lastError = '', sessionRole = null;
  const IDS = window.sunuIds = { student: {}, subject: {}, class: {} };

  // Aucune donnée de l'école ne doit rester dans le navigateur (ordinateurs partagés)
  function purgeLocal() {
    [localStorage, sessionStorage].forEach(st => {
      try { Object.keys(st).filter(k => /^sunuschool/i.test(k)).forEach(k => st.removeItem(k)); } catch (_) {}
    });
    try { if (String(window.name).startsWith('SUNUSCHOOL:')) window.name = ''; } catch (_) {}
  }

  // Lit toutes les lignes d'une table, par pages de 1000 (limite de Supabase)
  async function fetchAll(table) {
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from(table).select('*').order('id').range(from, from + 999);
      if (error) throw new Error(table + ' : ' + error.message);
      rows.push(...data);
      if (data.length < 1000) break;
    }
    return rows;
  }

  async function loadRemoteData(role) {
    const [classes, teachersFull, students, slots, subjects, grades, attendance, payments, dir] = await Promise.all([
      fetchAll('classes'), fetchAll('teachers'), fetchAll('students'), fetchAll('teacher_slots'),
      fetchAll('subjects'), fetchAll('grades'), fetchAll('attendance'), fetchAll('payments'),
      sb.rpc('teacher_directory')
    ]);
    if (dir.error && role !== 'admin') throw new Error('annuaire des enseignants indisponible (exécutez supabase-directory.sql) : ' + dir.error.message);
    const hm = t => String(t).slice(0, 5);
    const byId = rows => { const o = {}; rows.forEach(r => { o[r.id] = r; }); return o; };
    const classById = byId(classes), studById = byId(students), subjById = byId(subjects);

    const teacherById = {};
    ((dir.data) || []).forEach(t => { teacherById[t.id] = { id: t.id, matricule: '', name: t.full_name, subject: t.subject, phone: '', slots: [] }; });
    teachersFull.forEach(t => { teacherById[t.id] = { id: t.id, matricule: t.matricule, name: t.full_name, subject: t.subject, phone: t.phone || '', slots: [] }; });
    slots.forEach(s => {
      const t = teacherById[s.teacher_id], c = classById[s.class_id];
      if (t && c) t.slots.push({ day: s.day, start: hm(s.start_time), end: hm(s.end_time), classe: c.name, room: s.room || c.room || '' });
    });
    const matOf = id => (studById[id] || {}).matricule;
    IDS.student = {}; students.forEach(s => { IDS.student[s.matricule] = s.id; });
    IDS.subject = {}; subjects.forEach(s => { IDS.subject[s.name] = s.id; });
    IDS.class = {}; classes.forEach(c => { IDS.class[c.name] = c.id; });
    // Rang de l'élève : calculé par le serveur (un élève ne voit pas les notes de ses camarades)
    window.sunuRanks = {};
    if (role === 'student') {
      const rk = await sb.rpc('my_class_ranks');
      if (rk.error) console.warn('Rang indisponible (exécutez supabase-rank.sql) :', rk.error.message);
      else (rk.data || []).forEach(x => { window.sunuRanks[x.semester] = { rank: x.rank, total: x.total }; });
    }

    return {
      classes: classes.map(c => ({ id: c.id, name: c.name, level: c.level, room: c.room || '',
        pp: (teacherById[c.head_teacher_id] || {}).name || '', deletedAt: c.deleted_at ? new Date(c.deleted_at).getTime() : 0 })),
      teachers: Object.values(teacherById).sort((a, b) => a.id - b.id),
      students: students.map(s => ({ nom: s.full_name, matricule: s.matricule, sexe: s.sex, classe: (classById[s.class_id] || {}).name || '',
        parent: s.parent_name, phone: s.phone, fee: s.monthly_fee })),
      subjects: subjects.map(s => ({ name: s.name, coeff: s.coeff })),
      grades: grades.map(g => ({ mat: matOf(g.student_id), subject: (subjById[g.subject_id] || {}).name, sem: g.semester,
        d1: g.d1, d2: g.d2, compo: g.compo, average: g.average })).filter(g => g.mat && g.subject),
      attendance: attendance.map(a => ({ mat: matOf(a.student_id), cls: (classById[a.class_id] || {}).name || '', day: a.day,
        s: a.status, min: a.minutes_late, motif: a.reason || '' })).filter(a => a.mat),
      payments: payments.map(p => ({ id: p.id, rec: p.receipt_no, mat: matOf(p.student_id), month: p.month, amount: p.amount,
        method: p.method, ref: p.reference, date: p.paid_on })).filter(p => p.mat)
    };
  }

  // Entre dans le site avec le profil lu dans Supabase. Retourne 'ok' | 'noprofile' | 'role' | 'data'.
  async function enterSession(user, expectedRole) {
    let prof = null;
    const { data: p1, error: e1 } = await sb.from('profiles').select('role, matricule, full_name, school_id, is_director').eq('id', user.id).maybeSingle();
    if (!e1 && p1) {
      prof = p1;
    } else {
      const { data: p2, error: e2 } = await sb.from('profiles').select('role, matricule, full_name, school_id').eq('id', user.id).maybeSingle();
      if (e2 || !p2) return 'noprofile';
      prof = p2;
    }
    if (expectedRole && prof.role !== expectedRole) return 'role';

    // Seul l'administrateur avec is_director = true dans Supabase peut créer d'autres administrateurs
    window.sunuIsDirector = Boolean(prof.role === 'admin' && (prof.is_director === true || prof.is_director === 'true'));

    // Synchronisation automatique de l'école de l'utilisateur connecté depuis Supabase
    if (prof.school_id && sb) {
      try {
        const { data: userSchool } = await sb.from('schools').select('*').eq('id', prof.school_id).maybeSingle();
        if (userSchool && typeof window.applySchoolData === 'function') {
          window.applySchoolData(userSchool, { saveSlug: true });
        }
      } catch (errSch) {
        console.warn('Erreur chargement établissement :', errSch);
      }
    }

    try {
      purgeLocal();
      sessionRole = prof.role;
      window.sunuHydrate(await loadRemoteData(prof.role));
    } catch (e) {
      console.error(e); lastError = e.message || String(e); return 'data';
    }
    currentRole = prof.role;
    let label = window.sunuIsDirector ? '👑 Direction (Admin)' : '🧑‍💼 Administration';
    if (prof.role === 'student') {
      currentStudentMat = prof.matricule;
      const s = allStudentsDB.find(x => alnum(x.matricule) === alnum(prof.matricule));
      label = '🎓 ' + (s ? s.nom : prof.full_name);
    } else if (prof.role === 'teacher') {
      const t = teachersData.find(x => alnum(x.matricule) === alnum(prof.matricule));
      currentTeacherId = t ? t.id : null;
      label = '👨‍🏫 ' + (t ? t.name : prof.full_name);
    }
    el('session-label').textContent = label;
    el('login-pwd-input').value = '';
    document.body.classList.remove('locked');
    dismissLoginModal();
    refreshAccess();
    switchTab(HOME_TAB[prof.role]);
    return 'ok';
  }

  const userId = async () => { const { data } = await sb.auth.getSession(); return data && data.session ? data.session.user.id : null; };

  // Recharge les données depuis Supabase (après un échec d'enregistrement, par exemple)
  window.sunuReload = async function () {
    try { window.sunuHydrate(await loadRemoteData(sessionRole)); }
    catch (e) { console.error(e); showToast('⚠️ Rechargement impossible : ' + (e.message || e)); }
  };

  // Notes saisies par un enseignant : une ligne par élève, matière et semestre
  window.sunuPersistGrades = async function (rows) {
    try {
      if (!rows.length) return true;
      const uid = await userId(), now = new Date().toISOString();
      const schoolId = (window.SCHOOL && window.SCHOOL.id) || undefined;
      const payload = rows.map(r => {
        const item = { student_id: IDS.student[r.mat], subject_id: IDS.subject[r.subject], semester: r.sem,
          d1: r.d1, d2: r.d2, compo: r.compo, updated_by: uid, updated_at: now };
        if (schoolId) item.school_id = schoolId;
        return item;
      });
      if (payload.some(p => !p.student_id || !p.subject_id)) throw new Error('élève ou matière inconnu');
      const { error } = await sb.from('grades').upsert(payload, { onConflict: 'school_id,student_id,subject_id,semester' });
      if (error) throw new Error(error.message);
      return true;
    } catch (e) { console.error(e); showToast('⚠️ Notes non enregistrées : ' + (e.message || e)); return false; }
  };

  // Appel d'une classe pour un jour : remplace tout l'appel de ce jour (les présents n'ont pas de ligne)
  window.sunuPersistAttendance = async function ({ day, cls, rows, mats }) {
    try {
      const uid = await userId(), classId = IDS.class[cls];
      const schoolId = (window.SCHOOL && window.SCHOOL.id) || undefined;
      if (!classId) throw new Error('classe inconnue');
      if (rows.length) {
        const payload = rows.map(r => {
          const item = { student_id: IDS.student[r.mat], class_id: classId, day, status: r.s,
            minutes_late: r.s === 'R' ? r.min : 0, reason: r.motif || null, recorded_by: uid };
          if (schoolId) item.school_id = schoolId;
          return item;
        });
        if (payload.some(p => !p.student_id)) throw new Error('élève inconnu');
        const up = await sb.from('attendance').upsert(payload, { onConflict: 'school_id,student_id,day' });
        if (up.error) throw new Error(up.error.message);
      }
      const keep = new Set(rows.map(r => r.mat));
      const gone = mats.filter(m => !keep.has(m)).map(m => IDS.student[m]).filter(Boolean);
      if (gone.length) {
        const del = await sb.from('attendance').delete().eq('day', day).in('student_id', gone);
        if (del.error) throw new Error(del.error.message);
      }
      return true;
    } catch (e) { console.error(e); showToast('⚠️ Appel non enregistré : ' + (e.message || e)); return false; }
  };

  /* ===== Bloc 4a : caisse (l'administration enregistre les paiements) ===== */
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const dm = m => (/^[AEIOUÉ]/i.test(m) ? 'd’' : 'de ') + m;   // « d’Octobre », « de Novembre »
  const fcfa = n => Number(n || 0).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ') + ' FCFA';

  window.sunuDeleteAttendance = async function (day, mat) {
    try {
      const sid = IDS.student[mat]; if (!sid) throw new Error('élève inconnu');
      const del = await sb.from('attendance').delete().eq('day', day).in('student_id', [sid]);
      if (del.error) throw new Error(del.error.message);
      return true;
    } catch (e) { console.error(e); showToast('⚠️ Suppression non enregistrée : ' + (e.message || e)); return false; }
  };

  // Totaux du mois en cours, calculés à partir des paiements enregistrés
  window.cashKpis = function () {
    const api = window.sunuPayApi; if (!api) return;
    const month = today().slice(0, 7), pays = api.all().filter(p => String(p.date).slice(0, 7) === month);
    const sum = f => pays.filter(f).reduce((a, p) => a + Number(p.amount), 0);
    const set = (id, v) => { const x = el(id); if (x) x.textContent = v; };
    set('kpi-month-total', fcfa(sum(() => true)));
    set('kpi-mobile', fcfa(sum(p => p.method === 'Wave' || p.method === 'Orange Money')));
    set('box-cash-total', fcfa(sum(p => p.method === 'Espèces')));
    set('total-cash-counter', fcfa(api.all().filter(p => p.date === today() && p.method === 'Espèces').reduce((a, p) => a + Number(p.amount), 0)));
  };

  // Mois encore à payer pour l'élève choisi
  function cashRefreshMonths() {
    const api = window.sunuPayApi, sel = el('cash-month-select'), mat = (el('cash-student-select') || {}).value;
    if (!api || !sel) return;
    const due = api.months.filter(m => api.remaining(mat, m) > 0);
    sel.innerHTML = due.map(m => `<option value="${m}">Mensualité ${dm(m)} (reste ${fcfa(api.remaining(mat, m))})</option>`).join('')
      || '<option value="">Toutes les mensualités sont réglées</option>';
    cashRefreshAmount();
  }
  function cashRefreshAmount() {
    const api = window.sunuPayApi, mat = (el('cash-student-select') || {}).value, m = (el('cash-month-select') || {}).value;
    const a = el('cash-amount-input'); if (a) a.value = api && m ? api.remaining(mat, m) : '';
  }
  function cashResetReceipt() {
    ['rcpt-number', 'rcpt-date', 'rcpt-student', 'rcpt-account', 'rcpt-payer', 'rcpt-motif', 'rcpt-amount', 'rcpt-mode'].forEach(id => { const x = el(id); if (x) x.textContent = '—'; });
  }

  window.renderCashStudents = function () {
    const sel = el('cash-student-select'); if (!sel) return;
    const keep = sel.value;
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    sel.innerHTML = allStudentsDB.map(s => `<option value="${esc(s.matricule)}">${esc(s.nom)} • ${esc(s.classe)} (${esc(s.matricule)})</option>`).join('');
    if ([...sel.options].some(o => o.value === keep)) sel.value = keep;
    if (!sel.dataset.bound) {
      sel.dataset.bound = '1';
      sel.addEventListener('change', cashRefreshMonths);
      el('cash-month-select').addEventListener('change', cashRefreshAmount);
      cashResetReceipt();
    }
    cashRefreshMonths();
    window.cashKpis();
  };

  window.handleCashPayment = async function (e) {
    if (e && e.preventDefault) e.preventDefault();
    if (currentRole !== 'admin') { showToast('🔒 Seule l’administration enregistre les paiements.'); return; }
    const api = window.sunuPayApi;
    const mat = el('cash-student-select').value, month = el('cash-month-select').value;
    const amount = parseInt(el('cash-amount-input').value, 10) || 0, payer = el('cash-payer-name').value.trim();
    const mode = (document.querySelector('input[name="payment_mode"]:checked') || {}).value || 'Espèces';
    const sid = IDS.student[mat], st = allStudentsDB.find(x => x.matricule === mat);
    if (!sid || !st || !month) { showToast('⚠️ Choisissez un élève et un mois à régler.'); return; }
    if (amount <= 0) { showToast('⚠️ Saisissez un montant supérieur à 0.'); return; }
    const rest = api.remaining(mat, month);
    if (amount > rest) { showToast(`⚠️ Montant supérieur au reste dû pour ${month} (${fcfa(rest)}).`); return; }
    if (!payer) { showToast('⚠️ Indiquez le nom de la personne qui règle.'); return; }
    const prefix = window.sunuReceiptPrefix ? window.sunuReceiptPrefix() : `REC-${new Date().getFullYear()}-`;
    const nums = api.all().filter(p => String(p.rec || '').startsWith(prefix)).map(p => parseInt(String(p.rec).slice(prefix.length), 10)).filter(Number.isFinite);
    const rec = prefix + String(Math.max(0, ...nums) + 1).padStart(4, '0'), date = today();
    try {
      const uid = await userId();
      const schoolId = (window.SCHOOL && window.SCHOOL.id) || undefined;
      const payload = { receipt_no: rec, student_id: sid, month, amount, method: mode, reference: payer.slice(0, 80), paid_on: date, recorded_by: uid };
      if (schoolId) payload.school_id = schoolId;
      const ins = await sb.from('payments').insert(payload);
      if (ins.error) throw new Error(ins.error.message);
    } catch (err) { console.error(err); showToast('⚠️ Paiement non enregistré : ' + (err.message || err)); return; }
    api.add([{ id: 'p' + Date.now(), rec, mat, month, amount, method: mode, ref: payer, date, by: 'Caisse' }]);
    if (mode === 'Espèces') dailyCash += amount;
    const set = (id, v) => { const x = el(id); if (x) x.textContent = v; };
    set('rcpt-number', 'REÇU N° ' + rec); set('rcpt-date', 'Date : ' + new Date().toLocaleString('fr-FR'));
    set('rcpt-student', st.nom + ' (' + st.classe + ')'); set('rcpt-account', st.matricule); set('rcpt-payer', payer);
    set('rcpt-motif', 'Mensualité ' + dm(month)); set('rcpt-amount', fcfa(amount));
    set('rcpt-mode', mode === 'Espèces' ? '💵 ESPÈCES / LIQUIDE' : mode === 'Wave' ? '💙 WAVE' : '🟠 ORANGE MONEY');
    el('cash-payer-name').value = '';
    cashRefreshMonths(); window.cashKpis();
    showToast(`💵 Paiement de ${fcfa(amount)} enregistré • Reçu ${rec}.`);
  };

  // Paiement en ligne des parents : pas encore branché à Wave / Orange Money
  window.payNow = function () { showToast('ℹ️ Le paiement en ligne n’est pas encore activé. Merci de régler à la caisse de l’école.'); };

  const MSG = {
    role: '⚠️ Ce compte n’appartient pas au profil choisi (Élève, Prof ou Admin).',
    noprofile: '⚠️ Compte non activé : contactez l’administration.'
  };

  function authErrorMessage(error) {
    const message = String((error && error.message) || '');
    if (/invalid login credentials/i.test(message)) {
      const school = (window.SCHOOL && window.SCHOOL.name) || 'cet établissement';
      return '⚠️ Identifiant ou mot de passe incorrect pour ' + school + '. Vérifiez aussi l’établissement sélectionné.';
    }
    if (/email not confirmed/i.test(message)) return '⚠️ Ce compte n’est pas activé. Contactez l’administration.';
    if (/too many requests|rate limit/i.test(message)) return '⚠️ Trop de tentatives. Attendez un moment avant de réessayer.';
    return '⚠️ Connexion impossible : ' + (message || 'erreur du service d’authentification.');
  }

  function isDemoAccount(id) {
    const clean = String(id || '').trim().toUpperCase();
    if (!clean) return false;
    if (['ADM-001', 'ALA-ADM-001', 'ADMIN', 'DIRECTEUR'].includes(clean)) return true;
    if (typeof teachersData !== 'undefined' && teachersData.some(t => alnum(t.matricule) === alnum(clean))) return true;
    if (typeof allStudentsDB !== 'undefined' && allStudentsDB.some(s => alnum(s.matricule) === alnum(clean))) return true;
    if (/^(ADM|ALA|ENS|SN)-/i.test(clean)) return true;
    return false;
  }

  window.enterDemoSession = function(id, forceRole) {
    const rawId = String(id || '').trim();
    const clean = rawId.toUpperCase().replace(/\s+/g, '');
    let role = forceRole || pendingRole || 'admin';

    if (/^(ADM|ALA|DIR)/i.test(clean)) role = 'admin';
    else if (/^ENS/i.test(clean)) role = 'teacher';
    else if (/^SN/i.test(clean)) role = 'student';

    currentRole = role;
    let label = '🧑‍💼 Administration';

    if (role === 'admin') {
      window.sunuIsDirector = true;
      label = '👑 Direction (Mode Démo)';
    } else if (role === 'teacher') {
      const t = (typeof teachersData !== 'undefined' && teachersData.find(x => alnum(x.matricule) === alnum(rawId))) || (teachersData && teachersData[0]);
      currentTeacherId = t ? t.id : 1;
      label = '👨‍🏫 ' + (t ? t.name : 'Enseignant (Démo)');
    } else if (role === 'student') {
      const s = (typeof allStudentsDB !== 'undefined' && allStudentsDB.find(x => alnum(x.matricule) === alnum(rawId))) || (allStudentsDB && allStudentsDB[0]);
      currentStudentMat = s ? s.matricule : 'SN-2025-0412';
      label = '🎓 ' + (s ? s.nom : 'Élève (Démo)');
    }

    const sLabel = el('session-label');
    if (sLabel) sLabel.textContent = label;
    const pwdInput = el('login-pwd-input');
    if (pwdInput) pwdInput.value = '';
    document.body.classList.remove('locked');
    dismissLoginModal();
    refreshAccess();
    switchTab(HOME_TAB[role] || 'classes-registry');
    showToast(`✨ Connecté en tant que ${label} • Données de démonstration prêtes`);
    return 'ok';
  };

  window.quickLoginDemo = function(mat, role) {
    if (el('login-id-input')) el('login-id-input').value = mat;
    if (el('login-pwd-input')) el('login-pwd-input').value = '';
    if (typeof setLoginRole === 'function') setLoginRole(role);
    window.enterDemoSession(mat, role);
  };

  window.handleLogin = async function (e) {
    if (e && e.preventDefault) e.preventDefault();
    try { await window.sunuSchoolReady; } catch (err) { console.warn('Chargement de l’établissement impossible :', err); }
    const id = el('login-id-input').value.trim(), pwd = el('login-pwd-input').value;
    if (!id) { showToast('⚠️ Saisissez votre identifiant ou matricule.'); return; }

    // 1. Tenter la connexion Supabase si mot de passe saisi et sb actif
    if (sb && pwd && pwd.trim().length >= 4) {
      let data, error;
      for (const email of loginEmails(id)) {
        ({ data, error } = await sb.auth.signInWithPassword({ email, password: pwd }));
        if (!error && data && data.user) {
          showToast('⏳ Connexion Supabase en cours…');
          const r = await enterSession(data.user, pendingRole);
          if (r === 'ok') return;
          await sb.auth.signOut();
          if (r === 'data') { showToast('⚠️ Données non chargées : ' + lastError); return; }
          break;
        }
      }
    }

    // 2. Si connexion Supabase non réussie ou mot de passe démo / compte fictif : basculer immédiatement en session démo
    if (isDemoAccount(id) || !pwd || ['demo', 'admin', 'passer', '123456', 'pass123', 'demo1234'].includes(pwd.toLowerCase())) {
      window.enterDemoSession(id, pendingRole);
      return;
    }

    showToast('⚠️ Identifiant ou mot de passe Supabase incorrect. Utilisez un compte démo (ADM-001, ALA-ADM-001, ENS-2025-002, SN-2025-0412) ou les boutons d’accès démo en bas.');
  };

  window.logout = async function () {
    if (sb) { try { await sb.auth.signOut(); } catch (_) {} }
    purgeLocal();
    location.reload();   // vide aussi la mémoire de la page
  };

  // Reprise automatique de la session après un rechargement de la page
  const restore = async () => {
    if (!sb) return;
    const { data } = await sb.auth.getSession();
    if (data && data.session) {
      const r = await enterSession(data.session.user, null);
      if (r !== 'ok') { await sb.auth.signOut(); if (r === 'data') showToast('⚠️ Données non chargées : ' + lastError); }
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', restore); else restore();
})();
