/* SunuSchool - Bloc 4 : écritures de l'administration (classes, enseignants, élèves, comptes, admins)
   Chargé APRÈS script.js. Chaque action est enregistrée dans Supabase, puis l'écran est rechargé depuis la base.
   Tous les administrateurs authentifiés de l'école ont les pleins pouvoirs de gestion. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const sbc = () => window.sb;
  const IDS = () => window.sunuIds || { student: {}, subject: {}, class: {} };
  const isAdmin = () => typeof currentRole !== 'undefined' && currentRole === 'admin';
  const getSchoolId = () => (window.SCHOOL && window.SCHOOL.id) || undefined;
  const toast = m => { try { showToast(m); } catch (_) { alert(m); } };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const key = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '').replace('terminale', 'tle');

  function human(err) {
    const m = String((err && err.message) || err || 'Erreur inconnue');
    if (/duplicate key|unique/i.test(m)) return 'Cet élément existe déjà (nom ou matricule en double).';
    if (/foreign key|violates/i.test(m)) return 'Impossible : cet élément est lié à d’autres données (élèves, cours, notes ou paiements).';
    if (/row-level security|permission/i.test(m)) return 'Action refusée : réservée à l’administration.';
    return m;
  }

  async function reload(msg) {
    try { if (window.sunuReload) await window.sunuReload(); } catch (e) { console.error(e); }
    if (msg) toast(msg);
  }

  async function callFn(body) {
    if (!sbc()) throw new Error('Connexion à la base de données indisponible.');
    const { data: { session }, error: sessionError } = await sbc().auth.getSession();
    if (sessionError || !session || !session.access_token) {
      throw new Error('Session expirée : reconnectez-vous avant de continuer.');
    }
    const { data, error } = await sbc().functions.invoke('create-account', {
      body,
      headers: { Authorization: 'Bearer ' + session.access_token }
    });
    if (error) {
      let detail = error.message;
      try { const j = await error.context.json(); if (j && j.error) detail = j.error; } catch (_) {}
      throw new Error(detail);
    }
    if (data && data.error) throw new Error(data.error);
    return data;
  }

  const guard = () => {
    if (!isAdmin()) {
      toast('🔒 Réservé à l’administration.');
      return false;
    }
    return true;
  };

  const teacherIdByName = n => { const t = teachersData.find(x => x.name === n); return t ? t.id : null; };
  const ppValue = v => { v = String(v || '').trim(); return !v || /^pas encore/i.test(v) ? null : teacherIdByName(v); };
  const digits = s => String(s || '').replace(/\D/g, '');
  async function ensureSubject(name, coeff) {
    const payload = { school_id: getSchoolId(), name: name.trim(), coeff };
    const { error } = await sbc().from('subjects').upsert(payload, {
      onConflict: 'school_id,name',
      ignoreDuplicates: true
    });
    if (error) throw error;
  }

  /* ── Modale universelle d'identifiants (élèves, enseignants, administrateurs) ── */
  function credModal() {
    let m = $('b4-cred');
    if (m) return m;
    m = document.createElement('div');
    m.id = 'b4-cred';
    m.className = 'hidden fixed inset-0 z-[120] bg-slate-950/60 p-4 items-center justify-center';
    m.innerHTML = '<div class="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 text-center space-y-4"><div class="text-4xl">🔐</div>' +
      '<h2 id="b4-title" class="font-black text-slate-900 text-lg"></h2><p id="b4-note" class="text-sm text-slate-500"></p>' +
      '<div id="b4-box" class="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-2 text-sm"></div>' +
      '<div id="b4-actions" class="flex gap-2"></div>' +
      '<button type="button" onclick="b4CloseCred()" class="w-full text-slate-500 hover:text-slate-900 font-bold text-xs py-2">Fermer</button></div>';
    document.body.appendChild(m);
    return m;
  }

  let lastCred = null;
  window.b4CloseCred = () => { const m = $('b4-cred'); if (m) { m.classList.add('hidden'); m.classList.remove('flex'); } };

  function showCred(c) {
    lastCred = c;
    const m = credModal();
    $('b4-title').textContent = c.title;
    $('b4-note').textContent = c.note;
    $('b4-box').innerHTML = '<p><span class="text-slate-500">Nom :</span> <b>' + esc(c.name) + '</b></p>' +
      '<p><span class="text-slate-500">Matricule :</span> <b class="font-mono text-sky-700">' + esc(c.matricule) + '</b></p>' +
      (c.password ? '<p><span class="text-slate-500">Mot de passe :</span> <b class="font-mono text-emerald-700 text-lg tracking-widest">' + esc(c.password) + '</b></p>' : '');
    $('b4-actions').innerHTML = c.password
      ? '<button type="button" onclick="b4Copy()" class="flex-1 bg-sky-700 hover:bg-sky-800 text-white font-bold text-xs py-3 rounded-xl">📋 Copier</button>' +
        '<button type="button" onclick="b4Print()" class="flex-1 bg-slate-900 hover:bg-black text-white font-bold text-xs py-3 rounded-xl">🖨️ Imprimer</button>'
      : '<button type="button" onclick="b4Reset()" class="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs py-3 rounded-xl">🔄 Générer un nouveau mot de passe</button>';
    m.classList.remove('hidden');
    m.classList.add('flex');
  }

  window.b4Copy = () => {
    if (!lastCred) return;
    const tx = 'SunuSchool\nNom : ' + lastCred.name + '\nMatricule : ' + lastCred.matricule + '\nMot de passe : ' + lastCred.password;
    (navigator.clipboard ? navigator.clipboard.writeText(tx) : Promise.reject())
      .then(() => toast('✅ Identifiants copiés.'))
      .catch(() => toast('⚠️ Copiez les identifiants affichés.'));
  };

  window.b4Print = () => {
    if (!lastCred) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write('<html><head><title>Identifiants SunuSchool</title></head><body style="font-family:Arial;padding:30px"><h2>SunuSchool — Identifiants de connexion</h2><p><b>Nom :</b> ' + esc(lastCred.name) + '</p><p><b>Matricule :</b> ' + esc(lastCred.matricule) + '</p><p><b>Mot de passe :</b> ' + esc(lastCred.password) + '</p><p style="color:#666;font-size:12px;margin-top:20px">Conservez ces informations de manière confidentielle. Le mot de passe ne sera plus affiché.</p></body></html>');
    w.document.close();
    w.print();
  };

  window.b4Reset = async () => {
    if (!lastCred || !guard()) return;
    if (!confirm('Générer un nouveau mot de passe pour ' + lastCred.name + ' ? L’ancien ne fonctionnera plus.')) return;
    try {
      const r = await callFn({ action: 'reset', matricule: lastCred.matricule });
      showCred({ title: 'Nouveau mot de passe', note: 'Remettez-le à la personne concernée. Il ne sera plus affiché ensuite.', name: r.full_name || lastCred.name, matricule: r.matricule, password: r.password });
    } catch (e) { toast('⚠️ ' + human(e)); }
  };

  window.showStudentCredentials = s => {
    if (!s || !guard()) return;
    showCred({ title: 'Identifiants de l’élève', note: 'Le mot de passe est chiffré et ne peut pas être relu. Vous pouvez en générer un nouveau.', name: s.nom, matricule: s.matricule });
  };
  window.b4CreateStudentAccount = async fields => {
    if (!isAdmin()) throw new Error('Réservé à l’administration.');
    return callFn({ ...fields, action: 'create', role: 'student' });
  };
  let lastCredList = [];
  window.b4ShowCredentialsList = credentials => {
    if (!isAdmin() || !Array.isArray(credentials) || !credentials.length) return;
    lastCredList = credentials;
    const modal = credModal();
    $('b4-title').textContent = 'Comptes élèves créés';
    $('b4-note').textContent = 'Transmettez ces accès aux familles et conservez-les de façon confidentielle. Les mots de passe ne pourront pas être relus ensuite.';
    $('b4-box').className = 'bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-2 text-sm max-h-72 overflow-y-auto';
    $('b4-box').innerHTML = credentials.map(c =>
      '<div class="border-b border-slate-200 pb-2"><b>' + esc(c.name) + '</b>' +
      '<div>Matricule : <span class="font-mono text-sky-700">' + esc(c.matricule) + '</span></div>' +
      '<div>Mot de passe : <span class="font-mono text-emerald-700">' + esc(c.password) + '</span></div></div>'
    ).join('');
    $('b4-actions').innerHTML = '<button type="button" onclick="b4CopyAllCredentials()" class="flex-1 bg-sky-700 hover:bg-sky-800 text-white font-bold text-xs py-3 rounded-xl">📋 Copier tous les accès</button>';
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  };
  window.b4CopyAllCredentials = () => {
    const text = lastCredList.map(c => `${c.name}\t${c.matricule}\t${c.password}`).join('\n');
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
      .then(() => toast('✅ Tous les accès ont été copiés.'))
      .catch(() => toast('⚠️ Sélectionnez et copiez les accès affichés.'));
  };
  window.resetStudentPassword = mat => { const s = allStudentsDB.find(x => x.matricule === mat); if (s) window.showStudentCredentials(s); };
  window.findStudentPassword = () => {};

  /* ============================================================
     1. GESTION DES CLASSES (pour TOUS les administrateurs)
     ============================================================ */
  window.handleCreateClass = async function (e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!guard()) return;
    const name = $('cls-name').value.trim(), level = $('cls-level').value, room = $('cls-room').value.trim();
    if (!name) return toast('⚠️ Nom de la classe obligatoire.');

    const schoolId = getSchoolId();
    const payload = {
      name,
      level,
      room: room || null,
      head_teacher_id: ppValue($('cls-pp').value)
    };
    if (schoolId) payload.school_id = schoolId;

    const { error } = await sbc().from('classes').insert(payload);
    if (error) return toast('⚠️ ' + human(error));

    ['cls-name', 'cls-room', 'cls-pp'].forEach(i => { if ($(i)) $(i).value = ''; });
    await reload('✅ Classe ' + name + ' créée avec succès.');
  };

  window.handleEditClass = async function (e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!guard()) return;
    const id = Number($('edit-cls-id').value), name = $('edit-cls-name').value.trim();
    if (!id || !name) return toast('⚠️ Nom de la classe obligatoire.');

    const { error } = await sbc().from('classes').update({
      name,
      level: $('edit-cls-level').value,
      room: $('edit-cls-room').value.trim() || null,
      head_teacher_id: ppValue($('edit-cls-pp').value)
    }).eq('id', id);

    if (error) return toast('⚠️ ' + human(error));
    if (typeof closeModal === 'function') closeModal('class-edit-modal');
    await reload('✅ Classe ' + name + ' modifiée.');
  };

  window.moveClassToTrash = async function (id) {
    if (!guard()) return;
    const { error } = await sbc().from('classes').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) return toast('⚠️ ' + human(error));
    await reload('🗑️ Classe déplacée dans la corbeille (30 jours).');
  };

  window.restoreClass = async function (id) {
    if (!guard()) return;
    const { error } = await sbc().from('classes').update({ deleted_at: null }).eq('id', id);
    if (error) return toast('⚠️ ' + human(error));
    await reload('✅ Classe restaurée.');
    if (typeof renderTrash === 'function') renderTrash();
  };

  window.purgeClass = async function (btn, id) {
    if (!guard()) return;
    if (!btn.dataset.armed) {
      btn.dataset.armed = '1'; btn.textContent = 'Confirmer ?'; btn.classList.add('bg-rose-600', 'text-white');
      setTimeout(() => { if (!btn.isConnected) return; delete btn.dataset.armed; btn.textContent = 'Supprimer'; btn.classList.remove('bg-rose-600', 'text-white'); }, 3000);
      return;
    }
    const { error } = await sbc().from('classes').delete().eq('id', id);
    if (error) return toast('⚠️ ' + human(error));
    await reload('✅ Classe supprimée définitivement.');
    if (typeof renderTrash === 'function') renderTrash();
  };

  /* ============================================================
     2. GESTION DES ENSEIGNANTS (pour TOUS les administrateurs)
     ============================================================ */
  window.handleTeacherSubmit = async function (e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!guard()) return;
    const id = Number($('t-id').value) || 0, name = $('t-name').value.trim(), subject = $('t-subject').value.trim();
    const phone = $('t-phone').value.trim(), coeff = Number($('t-coeff') ? $('t-coeff').value : 1);
    const matInput = $('t-matricule') ? $('t-matricule').value.trim().toUpperCase() : '';

    if (!name || !subject) return toast('⚠️ Nom et matière obligatoires.');
    if (digits(phone).length < 9) return toast('⚠️ Numéro de téléphone invalide.');
    if (!(coeff >= 0.5 && coeff <= 10)) return toast('⚠️ Coefficient invalide (0,5 à 10).');

    const btn = e && e.submitter;
    if (btn) btn.disabled = true;

    try {
      if (id) {
        // Modification fiche enseignant existant
        const t = teachersData.find(x => x.id === id);
        if (t && matInput && matInput !== t.matricule) {
          return toast('⚠️ Le matricule ne peut pas être modifié : il identifie le compte.');
        }
        const { error } = await sbc().from('teachers').update({ full_name: name, subject, phone, coeff }).eq('id', id);
        if (error) throw error;
        await ensureSubject(subject, coeff);
        if (typeof resetTeacherForm === 'function') resetTeacherForm();
        return await reload('✅ Fiche de ' + name + ' corrigée.');
      }

      // Nouvel enseignant : appel Edge Function (crée Auth + Profile + table Teachers)
      const reqBody = {
        action: 'create',
        role: 'teacher',
        full_name: name,
        subject,
        phone,
        coeff
      };
      const r = await callFn(reqBody);

      // Garantie côté client : upsert direct dans la table 'teachers'
      const schoolId = getSchoolId();
      const tRow = {
        matricule: r.matricule,
        full_name: name,
        subject,
        phone,
        coeff
      };
      if (schoolId) tRow.school_id = schoolId;
      await sbc().from('teachers').upsert(tRow, { onConflict: 'school_id,matricule' });

      if (typeof resetTeacherForm === 'function') resetTeacherForm();
      await reload('✅ ' + name + ' enregistré(e). Matricule ' + r.matricule);
      showCred({
        title: 'Compte enseignant créé',
        note: 'Remettez ces identifiants à l’enseignant. Le mot de passe ne sera plus affiché.',
        name: r.full_name || name,
        matricule: r.matricule,
        password: r.password
      });
    } catch (err) {
      toast('⚠️ ' + human(err));
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  window.deleteTeacher = async function (btn, id) {
    if (!guard()) return;
    if (!btn.dataset.armed) {
      btn.dataset.armed = '1'; btn.textContent = 'Confirmer ?'; btn.classList.add('bg-rose-600', 'text-white');
      setTimeout(() => { if (!btn.isConnected) return; delete btn.dataset.armed; btn.textContent = '🗑️ Corbeille'; btn.classList.remove('bg-rose-600', 'text-white'); }, 3000);
      return;
    }
    const t = teachersData.find(x => x.id === id);
    if (!t) return;

    // Déplacement dans la corbeille enseignants (30 jours)
    const i = teachersData.findIndex(x => x.id === id);
    if (i >= 0) teachersData.splice(i, 1);
    if (typeof teachersTrash !== 'undefined') {
      teachersTrash.push({ teacher: t, deletedAt: Date.now() });
    }
    if (typeof selectedTeacherId !== 'undefined') {
      selectedTeacherId = teachersData.length ? teachersData[0].id : null;
    }
    if (typeof resetTeacherForm === 'function') resetTeacherForm();
    if (typeof renderTeachers === 'function') renderTeachers();
    const countEl = $('teacher-trash-count');
    if (countEl && typeof teachersTrash !== 'undefined') countEl.textContent = teachersTrash.length;
    toast(`🗑️ ${t.name} déplacé(e) dans la corbeille (conservé 30 jours).`);
  };

  window.purgeTeacher = async function (btn, id) {
    if (!guard()) return;
    if (!btn.dataset.armed) {
      btn.dataset.armed = '1'; btn.textContent = 'Confirmer ?'; btn.classList.add('bg-rose-600', 'text-white');
      setTimeout(() => { if (!btn.isConnected) return; delete btn.dataset.armed; btn.textContent = 'Supprimer'; btn.classList.remove('bg-rose-600', 'text-white'); }, 3000);
      return;
    }
    const i = typeof teachersTrash !== 'undefined' ? teachersTrash.findIndex(t => t.teacher.id === id) : -1;
    const t = i >= 0 ? teachersTrash[i].teacher : null;
    if (i >= 0) teachersTrash.splice(i, 1);
    if (typeof renderTeacherTrash === 'function') renderTeacherTrash();
    const countEl = $('teacher-trash-count');
    if (countEl && typeof teachersTrash !== 'undefined') countEl.textContent = teachersTrash.length;

    if (t && sbc()) {
      try {
        await sbc().from('teachers').delete().eq('id', id);
        try {
          await callFn({ action: 'delete', role: 'teacher', matricule: t.matricule });
        } catch (_) {}
      } catch (err) {
        console.warn('Erreur suppression Supabase:', err);
      }
    }
    toast(`❌ ${t ? t.name : 'Enseignant'} supprimé(e) définitivement.`);
  };

  window.handleAddSlot = async function (e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!guard()) return;
    const t = teachersData.find(x => x.id === selectedTeacherId); if (!t) return;
    const r = addSlot(t, $('sl-day').value, $('sl-start').value, $('sl-end').value, $('sl-class').value.trim(), $('sl-room').value.trim());
    if (!r.ok) return toast('⚠️ ' + r.msg);
    const classId = IDS().class[r.cls.name] || r.cls.id;
    const payload = { teacher_id: t.id, class_id: classId, day: r.slot.day, start_time: r.slot.start, end_time: r.slot.end, room: r.slot.room || null };
    const schoolId = getSchoolId();
    if (schoolId) payload.school_id = schoolId;

    const { error } = await sbc().from('teacher_slots').insert(payload);
    if (error) { await reload(); return toast('⚠️ ' + human(error)); }
    await reload('✅ Créneau ajouté : ' + r.slot.day + ' ' + r.slot.start + '-' + r.slot.end + ' ' + r.cls.name + '.');
  };

  window.removeSlot = async function (idx) {
    if (!guard()) return;
    const t = teachersData.find(x => x.id === selectedTeacherId); if (!t || !t.slots[idx]) return;
    const s = t.slots[idx], classId = IDS().class[s.classe];
    if (!classId) return toast('⚠️ Classe inconnue.');
    const { error } = await sbc().from('teacher_slots').delete().eq('teacher_id', t.id).eq('class_id', classId).eq('day', s.day).eq('start_time', s.start).eq('end_time', s.end);
    if (error) return toast('⚠️ ' + human(error));
    await reload('✅ Créneau retiré.');
  };

  /* ============================================================
     3. INSCRIPTION DES ÉLÈVES (pour TOUS les administrateurs)
     ============================================================ */
  window.handleEnrollStudent = async function (e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!guard()) return;
    const nom = $('stu-nom').value.trim().toUpperCase(), prenom = $('stu-prenom').value.trim();
    const typed = $('stu-class').value.trim(), cls = classesMgtData.find(c => key(c.name) === key(typed));
    if (!cls) return toast(classesMgtData.length ? '⚠️ La classe « ' + typed + ' » n’existe pas.' : '⚠️ Aucune classe : créez-en une d’abord.');
    const parent = $('stu-parent').value.trim(), phone = $('stu-phone').value.trim();
    if (!nom || !prenom) return toast('⚠️ Nom et prénom obligatoires.');
    if (phone && digits(phone).length < 9) return toast('⚠️ Numéro de téléphone invalide.');

    const btn = e && e.submitter;
    if (btn) btn.disabled = true;

    try {
      const classId = IDS().class[cls.name] || cls.id;
      const previewMat = $('matricule-preview') ? $('matricule-preview').textContent.trim() : '';
      const reqBody = {
        action: 'create',
        role: 'student',
        full_name: nom + ' ' + prenom,
        sex: $('stu-sexe').value,
        class_id: classId,
        parent_name: parent,
        phone,
        monthly_fee: parseInt($('stu-fee').value, 10) || 0
      };
      if (/^SN-\d{4}-\d+$/i.test(previewMat)) reqBody.matricule = previewMat;
      const r = await callFn(reqBody);

      // Garantie côté client : upsert direct dans la table 'students'
      const schoolId = getSchoolId();
      const sRow = {
        matricule: r.matricule,
        full_name: nom + ' ' + prenom,
        sex: $('stu-sexe').value,
        class_id: classId,
        parent_name: parent || null,
        phone: phone || null,
        monthly_fee: parseInt($('stu-fee').value, 10) || 0
      };
      if (schoolId) sRow.school_id = schoolId;
      await sbc().from('students').upsert(sRow, { onConflict: 'school_id,matricule' });

      ['stu-nom', 'stu-prenom', 'stu-parent', 'stu-phone'].forEach(i => { if ($(i)) $(i).value = ''; });
      await reload('🎓 ' + nom + ' ' + prenom + ' inscrit(e) en ' + cls.name + '. Matricule ' + r.matricule);
      showCred({
        title: 'Compte élève créé',
        note: 'Remettez ces identifiants à l’élève ou au parent. Le mot de passe ne sera plus affiché.',
        name: r.full_name || (nom + ' ' + prenom),
        matricule: r.matricule,
        password: r.password
      });
    } catch (err) {
      toast('⚠️ ' + human(err));
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  window.handleEditStudent = async function (e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!guard()) return;
    const i = Number($('se-index').value), s = allStudentsDB[i]; if (!s) return;
    const nom = $('se-nom').value.trim(), cls = classesMgtData.find(c => key(c.name) === key($('se-class').value.trim()));
    if (!nom) return toast('⚠️ Le nom est obligatoire.');
    if ($('se-matricule').value.trim() && $('se-matricule').value.trim() !== s.matricule) return toast('⚠️ Le matricule ne peut pas être modifié : il identifie le compte.');
    if (!cls) return toast('⚠️ La classe « ' + $('se-class').value.trim() + ' » n’existe pas.');
    if (digits($('se-phone').value).length < 9) return toast('⚠️ Numéro de téléphone invalide.');

    const sid = IDS().student[s.matricule];
    if (!sid) return toast('⚠️ Élève inconnu.');

    const { error } = await sbc().from('students').update({
      full_name: nom,
      sex: $('se-sexe').value,
      class_id: cls.id,
      parent_name: $('se-parent').value.trim() || null,
      phone: $('se-phone').value.trim(),
      monthly_fee: parseInt($('se-fee').value, 10) || 0
    }).eq('id', sid);

    if (error) return toast('⚠️ ' + human(error));

    const back = typeof editStudentFromDossier !== 'undefined' && editStudentFromDossier;
    if (typeof closeModal === 'function') closeModal('student-edit-modal');
    await reload('✅ Informations de ' + nom + ' corrigées.');
    if (back && typeof openDossier === 'function') {
      const j = allStudentsDB.findIndex(x => x.matricule === s.matricule);
      if (j >= 0) openDossier(j);
    }
  };

  window.deleteStudent = async function (idx) {
    if (!guard()) return;
    const s = allStudentsDB[idx];
    if (!s) return;
    if (!confirm('Supprimer définitivement ' + s.nom + ' (' + s.matricule + ') et son compte ? Impossible si des notes, absences ou paiements sont enregistrés.')) return;

    try {
      await callFn({ action: 'delete', role: 'student', matricule: s.matricule });
      await reload('✅ ' + s.nom + ' supprimé(e).');
    } catch (err) {
      toast('⚠️ ' + human(err));
    }
  };

  /* ============================================================
     4. CRÉATION & GESTION DES ADMINISTRATEURS (multi-admin)
     ============================================================ */
  window.handleCreateAdmin = async function (e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!guard()) return;
    if (!window.sunuIsDirector) {
      toast('🔒 Seul le directeur créé dans Supabase peut créer d’autres administrateurs.');
      return;
    }

    const nom = ($('adm-nom') && $('adm-nom').value.trim()) || ($('new-admin-name') && $('new-admin-name').value.trim()) || '';
    const mat = ($('adm-mat') && $('adm-mat').value.trim().toUpperCase()) || '';
    const pwd = ($('adm-pwd') && $('adm-pwd').value.trim()) || '';

    if (!nom || nom.length < 3) return toast('⚠️ Nom complet de l’administrateur obligatoire (au moins 3 caractères).');
    if (pwd && pwd.length < 8) return toast('⚠️ Le mot de passe doit comporter au moins 8 caractères.');

    const btn = (e && e.submitter) || $('create-admin-btn');
    if (btn) { btn.disabled = true; if (btn.tagName === 'BUTTON') btn.dataset.origText = btn.textContent; }

    try {
      const reqBody = { action: 'create', role: 'admin', full_name: nom };
      if (mat) reqBody.matricule = mat;
      if (pwd) reqBody.password = pwd;

      const r = await callFn(reqBody);

      ['adm-nom', 'adm-mat', 'adm-pwd', 'new-admin-name'].forEach(i => { if ($(i)) $(i).value = ''; });

      // Si le formulaire modale est présent, afficher le résultat dans la modale
      if ($('create-admin-result')) {
        if ($('new-admin-mat')) $('new-admin-mat').textContent = r.matricule;
        if ($('new-admin-pwd')) $('new-admin-pwd').textContent = r.password;
        $('create-admin-result').classList.remove('hidden');
        if ($('create-admin-form-fields')) $('create-admin-form-fields').classList.add('hidden');
        window._lastAdminCreated = { name: r.full_name || nom, mat: r.matricule, pwd: r.password };
      }

      await reload('🧑‍💼 Compte administrateur créé pour ' + nom + '.');
      showCred({
        title: 'Nouveau compte Administrateur',
        note: 'Remettez ces identifiants au nouvel administrateur. Il aura les pleins droits d’administration sur l’établissement.',
        name: r.full_name || nom,
        matricule: r.matricule,
        password: r.password
      });

      if (typeof window.loadAdminsList === 'function') {
        window.loadAdminsList();
      }
    } catch (err) {
      toast('⚠️ ' + human(err));
    } finally {
      if (btn) {
        btn.disabled = false;
        if (btn.dataset.origText) btn.textContent = btn.dataset.origText;
      }
    }
  };

  window.loadAdminsList = async function () {
    const tbody = $('admins-table-body');
    if (!tbody || !sbc() || !isAdmin()) return;

    try {
      const schoolId = getSchoolId();
      let query = sbc().from('profiles').select('id, matricule, full_name, created_at, role').eq('role', 'admin');
      if (schoolId) query = query.eq('school_id', schoolId);
      const { data, error } = await query.order('created_at', { ascending: true });

      if (error) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400">Impossible de charger la liste : ${esc(error.message)}</td></tr>`;
        return;
      }

      if (!data || !data.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400">Aucun administrateur trouvé.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.map(adm => `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100 text-xs">
          <td class="py-3 px-4 font-bold text-slate-900">${esc(adm.full_name)}</td>
          <td class="py-3 px-4 font-mono font-bold text-sky-700">${esc(adm.matricule)}</td>
          <td class="py-3 px-4 text-slate-500">${adm.created_at ? new Date(adm.created_at).toLocaleDateString('fr-FR') : '—'}</td>
          <td class="py-3 px-4 text-right space-x-1">
            <button type="button" onclick="b5ResetMat('${esc(adm.matricule)}')" class="bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 font-bold px-2 py-1 rounded-lg text-[11px] shadow-xs">
              🔄 Mot de passe
            </button>
          </td>
        </tr>
      `).join('');
    } catch (e) {
      console.warn('loadAdminsList error:', e);
    }
  };

  window.b5ResetMat = function (mat) {
    if (typeof window.b4Reset === 'function') {
      lastCred = { name: mat, matricule: mat };
      window.b4Reset();
    }
  };

  function fixBadge() {
    const b = $('save-badge');
    if (!b || !isAdmin()) return;
    const txt = '☁️ Toutes vos modifications sont enregistrées en ligne';
    if (b.textContent !== txt) {
      b.textContent = txt;
      b.className = 'fixed bottom-4 left-4 z-40 text-[11px] font-bold px-3 py-1.5 rounded-xl shadow-lg print:hidden bg-emerald-600 text-white';
    }
  }

  const startBadge = () => { setInterval(fixBadge, 800); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startBadge); else startBadge();
})();
