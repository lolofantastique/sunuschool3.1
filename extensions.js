/* SunuSchool - extensions.js
   Implémentation modulaire et sûre des 8 fonctionnalités demandées :
   1. Corbeille 30 jours (classes, enseignants ET élèves) intégrée dans la modale de corbeille
   2. Restriction création administrateur au directeur (is_director)
   3. Relance WhatsApp pour paiements en retard / impayés
   4. Format ticket de caisse 80mm pour impression des reçus (ET isolation de la zone imprimable #receipt-preview-card)
   5. Fiche imprimable lors d'une réinitialisation ou création de mot de passe
   6. Contrôle et affectation des créneaux enseignants (salle, classe, horaire) sans collision
   7. Support multi-numéros pour l'établissement
   8. Gestion et affichage du logo d'école personnalisé
*/
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const sbc = () => window.sb;
  const toast = m => { try { if (typeof showToast === 'function') showToast(m); else alert(m); } catch (_) { alert(m); } };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ============================================================
     1. GESTION UNIFIÉE DE LA CORBEILLE 30 JOURS (CLASSES, ENSEIGNANTS, ÉLÈVES)
     ============================================================ */
  window.moveTeacherToTrash = async function (id) {
    if (!sbc()) return toast('⚠️ Connexion base indisponible.');
    const { error } = await sbc().from('teachers').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) return toast('⚠️ Erreur corbeille enseignant : ' + error.message);
    toast('🗑️ Enseignant déplacé dans la corbeille (30 jours).');
    if (window.sunuReload) await window.sunuReload();
    if (typeof window.updateTrashUI === 'function') window.updateTrashUI();
  };

  window.restoreTeacher = async function (id) {
    if (!sbc()) return toast('⚠️ Connexion base indisponible.');
    const { error } = await sbc().from('teachers').update({ deleted_at: null }).eq('id', id);
    if (error) return toast('⚠️ Erreur restauration : ' + error.message);
    toast('✅ Enseignant restauré.');
    if (window.sunuReload) await window.sunuReload();
    if (typeof window.updateTrashUI === 'function') window.updateTrashUI();
  };

  window.moveStudentToTrash = async function (id) {
    if (!sbc()) return toast('⚠️ Connexion base indisponible.');
    const { error } = await sbc().from('students').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) return toast('⚠️ Erreur corbeille élève : ' + error.message);
    toast('🗑️ Élève déplacé dans la corbeille (30 jours).');
    if (window.sunuReload) await window.sunuReload();
    if (typeof window.updateTrashUI === 'function') window.updateTrashUI();
  };

  window.restoreStudent = async function (id) {
    if (!sbc()) return toast('⚠️ Connexion base indisponible.');
    const { error } = await sbc().from('students').update({ deleted_at: null }).eq('id', id);
    if (error) return toast('⚠️ Erreur restauration : ' + error.message);
    toast('✅ Élève restauré.');
    if (window.sunuReload) await window.sunuReload();
    if (typeof window.updateTrashUI === 'function') window.updateTrashUI();
  };

  // Interception de l'affichage de la Corbeille pour afficher Classes, Enseignants et Élèves
  window.updateTrashUI = async function () {
    const trashBody = $('trash-body');
    if (!trashBody || !sbc()) return;

    try {
      const [resCls, resTch, resStu] = await Promise.all([
        sbc().from('classes').select('*').not('deleted_at', 'is', null),
        sbc().from('teachers').select('*').not('deleted_at', 'is', null),
        sbc().from('students').select('*').not('deleted_at', 'is', null)
      ]);

      const classes = resCls.data || [];
      const teachers = resTch.data || [];
      const students = resStu.data || [];

      const totalItems = classes.length + teachers.length + students.length;
      const countBadge = $('trash-count');
      if (countBadge) countBadge.textContent = totalItems;

      if (!totalItems) {
        trashBody.innerHTML = '<div class="p-10 text-center text-slate-400 text-sm"><div class="text-3xl mb-2">🗑️</div>La corbeille est vide.</div>';
        return;
      }

      let html = '';

      // Section Classes
      if (classes.length) {
        html += '<div class="p-3 bg-slate-100 text-xs font-bold text-slate-700 uppercase">Classes en corbeille (' + classes.length + ')</div>';
        html += classes.map(c => `
          <div class="px-5 py-3.5 flex items-center justify-between gap-3 text-xs">
            <div>
              <p class="font-extrabold text-slate-900">${esc(c.name)} <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-800">${esc(c.level || '—')}</span></p>
              <p class="text-slate-500 text-[11px]">Supprimée le ${new Date(c.deleted_at).toLocaleDateString('fr-FR')}</p>
            </div>
            <div class="flex gap-1.5 shrink-0">
              <button type="button" onclick="restoreClass(${c.id})" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-[11px]">Restaurer</button>
            </div>
          </div>
        `).join('');
      }

      // Section Enseignants
      if (teachers.length) {
        html += '<div class="p-3 bg-slate-100 text-xs font-bold text-slate-700 uppercase">Enseignants en corbeille (' + teachers.length + ')</div>';
        html += teachers.map(t => `
          <div class="px-5 py-3.5 flex items-center justify-between gap-3 text-xs">
            <div>
              <p class="font-extrabold text-slate-900">${esc(t.full_name)} <span class="font-mono text-sky-700 font-bold text-[10px]">${esc(t.matricule)}</span></p>
              <p class="text-slate-500 text-[11px]">${esc(t.subject)} • Tél: ${esc(t.phone || '—')}</p>
            </div>
            <div class="flex gap-1.5 shrink-0">
              <button type="button" onclick="restoreTeacher(${t.id})" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-[11px]">Restaurer</button>
            </div>
          </div>
        `).join('');
      }

      // Section Élèves
      if (students.length) {
        html += '<div class="p-3 bg-slate-100 text-xs font-bold text-slate-700 uppercase">Élèves en corbeille (' + students.length + ')</div>';
        html += students.map(s => `
          <div class="px-5 py-3.5 flex items-center justify-between gap-3 text-xs">
            <div>
              <p class="font-extrabold text-slate-900">${esc(s.full_name)} <span class="font-mono text-emerald-700 font-bold text-[10px]">${esc(s.matricule)}</span></p>
              <p class="text-slate-500 text-[11px]">Tuteur: ${esc(s.parent_name || '—')} • Tél: ${esc(s.phone || '—')}</p>
            </div>
            <div class="flex gap-1.5 shrink-0">
              <button type="button" onclick="restoreStudent(${s.id})" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-[11px]">Restaurer</button>
            </div>
          </div>
        `).join('');
      }

      trashBody.innerHTML = html;
    } catch (err) {
      console.warn('updateTrashUI error:', err);
    }
  };

  // Brancher l'ouverture de la corbeille sur notre fonction mise à jour
  const origOpenTrash = window.openTrash;
  window.openTrash = function () {
    if (typeof origOpenTrash === 'function') origOpenTrash();
    window.updateTrashUI();
  };

  /* ============================================================
     2. LOGO D'ÉCOLE DANS LE REÇU DE CAISSE
     ============================================================ */
  function injectLogoIntoReceiptCard() {
    const card = $('receipt-preview-card');
    if (!card) return;
    const sc = window.SCHOOL || {};
    const logoUrl = sc.logo || sc.logo_url;
    if (!logoUrl) return;

    let logoImg = card.querySelector('#rcpt-school-logo');
    if (!logoImg) {
      const headerBox = card.firstElementChild;
      if (headerBox) {
        const logoDiv = document.createElement('div');
        logoDiv.className = 'w-12 h-12 rounded-xl overflow-hidden mr-3 shrink-0 bg-white border border-amber-200 p-0.5 flex items-center justify-center';
        logoDiv.innerHTML = `<img id="rcpt-school-logo" src="${esc(logoUrl)}" alt="Logo" class="w-full h-full object-contain">`;
        headerBox.classList.add('flex', 'items-center');
        headerBox.insertBefore(logoDiv, headerBox.firstChild);
      }
    } else if (logoImg.src !== logoUrl) {
      logoImg.src = logoUrl;
    }
  }

  /* ============================================================
     3. IMPRESSION REÇU 80MM
     ============================================================ */
  window.printReceiptOnly = function () {
    injectLogoIntoReceiptCard();
    const card = $('receipt-preview-card');
    if (!card) {
      window.print();
      return;
    }

    const printWin = window.open('', '_blank', 'width=380,height=650');
    if (!printWin) {
      toast('⚠️ Fenêtre pop-up bloquée. Autorisez les pop-ups pour imprimer le reçu.');
      return;
    }

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Reçu de Paiement</title>
  <style>
    @page { size: 80mm auto; margin: 3mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 6px; color: #0f172a; background: #fff; font-size: 11px; width: 74mm; box-sizing: border-box; }
    #receipt-preview-card { border: 1px dashed #d97706 !important; border-radius: 12px; padding: 12px; background: #fffbeb; box-sizing: border-box; }
    #rcpt-school-logo { max-width: 48px; max-height: 48px; object-fit: contain; }
    button, .no-print { display: none !important; }
  </style>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  ${card.outerHTML}
  <script>window.onload = function() { setTimeout(function() { window.print(); }, 350); };<\/script>
</body>
</html>`;

    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
  };

  function bindReceiptPrintButton() {
    injectLogoIntoReceiptCard();
    const btns = document.querySelectorAll('button');
    btns.forEach(b => {
      if (b.textContent && b.textContent.includes('Imprimer le Reçu')) {
        b.onclick = function (e) {
          if (e && e.preventDefault) e.preventDefault();
          window.printReceiptOnly();
        };
      }
    });
  }

  /* ============================================================
     4. AUTRES FONCTIONNALITÉS (DIRECTEUR, WHATSAPP, CRENEAUX, LOGO, PHONES)
     ============================================================ */
  async function checkDirectorPermission() {
    if (!sbc()) return false;
    const { data: { user } } = await sbc().auth.getUser();
    if (!user) return false;
    const { data } = await sbc().from('profiles').select('is_director, role').eq('id', user.id).maybeSingle();
    return data && data.role === 'admin' && data.is_director === true;
  }

  window.applyAdminFormGuard = async function () {
    const isDir = await checkDirectorPermission();
    const adminBox = $('admin-creation-container') || $('sec-admin-create');
    if (adminBox && !isDir) {
      adminBox.style.display = 'none';
      const warning = document.createElement('div');
      warning.className = 'p-3 bg-amber-50 text-amber-800 text-xs rounded-xl border border-amber-200 mt-2';
      warning.textContent = '🔒 Seul l’administrateur principal (directeur) peut créer d’autres administrateurs.';
      adminBox.parentNode.insertBefore(warning, adminBox);
    }
  };

  window.sendPaymentReminderWhatsApp = function (studentName, parentPhone, month, feeAmount) {
    if (!parentPhone) return toast('⚠️ Aucun numéro de parent disponible pour cet élève.');
    const cleanPhone = String(parentPhone).replace(/\D/g, '');
    if (cleanPhone.length < 8) return toast('⚠️ Numéro de téléphone invalide pour WhatsApp.');
    const schoolName = (window.SCHOOL && window.SCHOOL.name) || 'L’établissement scolaire';
    const message = `Bonjour,\nNous vous informons qu'un paiement de scolarité (${feeAmount} FCFA) pour ${studentName} au titre du mois de ${month} est en attente auprès de ${schoolName}.\nMerci de régulariser la situation dès que possible. Cordialement.`;
    const url = `https://wa.me/${cleanPhone.startsWith('221') ? cleanPhone : '221' + cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  window.printPasswordSlip = function (user) {
    if (!user || !user.name || !user.password) return toast('⚠️ Informations utilisateur incomplètes.');
    const sc = window.SCHOOL || {};
    const w = window.open('', '_blank', 'width=500,height=400');
    if (!w) return toast('⚠️ Autorisez les pop-ups pour imprimer la fiche.');
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Fiche d'accès - ${esc(user.name)}</title>
  <style>
    @page { size: A5 landscape; margin: 10mm; }
    body { font-family: Arial, sans-serif; padding: 20px; color: #1e293b; }
    .card { border: 2px solid #0f172a; border-radius: 12px; padding: 24px; max-width: 450px; margin: auto; }
    .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px; }
    .title { font-size: 16px; font-weight: bold; text-transform: uppercase; color: #0284c7; }
    .row { margin: 10px 0; font-size: 13px; }
    .pwd { font-family: monospace; font-size: 18px; font-weight: bold; color: #047857; background: #ecfdf5; padding: 4px 8px; border-radius: 6px; }
    .footer { font-size: 10px; color: #64748b; margin-top: 20px; border-top: 1px dashed #cbd5e1; padding-top: 10px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="title">${esc(sc.name || 'SunuSchool')}</div>
      <div style="font-size:11px;color:#64748b;">Fiche de sécurité - Identifiants d'accès</div>
    </div>
    <div class="row"><b>Bénéficiaire :</b> ${esc(user.name)}</div>
    <div class="row"><b>Identifiant / Matricule :</b> <span style="font-family:monospace;font-weight:bold;">${esc(user.matricule || '—')}</span></div>
    <div class="row"><b>Nouveau mot de passe :</b> <span class="pwd">${esc(user.password)}</span></div>
    <div class="footer">Ce mot de passe est confidentiel. Veuillez le conserver en lieu sûr. Modifiez-le si nécessaire dès votre première connexion.</div>
  </div>
  <script>window.onload = function() { setTimeout(function(){ window.print(); }, 250); };<\/script>
</body>
</html>`;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  window.validateTeacherSlot = function (slots, newSlot) {
    if (!Array.isArray(slots)) return { valid: true };
    for (const s of slots) {
      if (s.day === newSlot.day) {
        const overlap = !(newSlot.end <= s.start || newSlot.start >= s.end);
        if (overlap) {
          return { valid: false, message: `Conflit d'horaire avec le créneau ${s.day} de ${s.start} à ${s.end} en ${s.classe || 'salle'}.` };
        }
      }
    }
    return { valid: true };
  };

  window.saveSchoolPhones = async function (phoneList) {
    if (!sbc()) return toast('⚠️ Supabase indisponible.');
    const isDir = await checkDirectorPermission();
    if (!isDir) return toast('🔒 Réservé au directeur de l’école.');
    const scId = window.SCHOOL && window.SCHOOL.id;
    if (!scId) return toast('⚠️ Établissement non identifié.');

    const cleanList = Array.isArray(phoneList) ? phoneList.map(p => String(p).trim()).filter(Boolean) : [];
    const { error } = await sbc().from('schools').update({
      phones: cleanList,
      phone: cleanList[0] || null
    }).eq('id', scId);

    if (error) return toast('⚠️ Erreur enregistrement numéros : ' + error.message);
    toast('✅ Numéros de l’établissement mis à jour.');
    if (window.SCHOOL) {
      window.SCHOOL.phones = cleanList;
      window.SCHOOL.phone = cleanList[0] || '';
    }
  };

  window.uploadSchoolLogo = async function (file) {
    if (!file) return toast('⚠️ Aucun fichier sélectionné.');
    if (!sbc()) return toast('⚠️ Connexion base indisponible.');
    const isDir = await checkDirectorPermission();
    if (!isDir) return toast('🔒 Seul le directeur peut modifier le logo.');
    const scId = window.SCHOOL && window.SCHOOL.id;
    if (!scId) return toast('⚠️ Établissement introuvable.');

    if (file.size > 1048576) return toast('⚠️ Le fichier ne doit pas dépasser 1 Mo.');
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
      return toast('⚠️ Format supporté : PNG, JPG, JPEG ou WEBP.');
    }

    const filePath = `${scId}/logo_${Date.now()}.${ext}`;
    const { error: uploadError } = await sbc().storage.from('school-logos').upload(filePath, file, { upsert: true });
    if (uploadError) return toast('⚠️ Échec du téléversement : ' + uploadError.message);

    const { data: publicUrlData } = sbc().storage.from('school-logos').getPublicUrl(filePath);
    const logoUrl = publicUrlData.publicUrl;

    const { error: updateError } = await sbc().from('schools').update({ logo: logoUrl, logo_url: logoUrl }).eq('id', scId);
    if (updateError) return toast('⚠️ Échec de mise à jour du profil école : ' + updateError.message);

    if (window.SCHOOL) {
      window.SCHOOL.logo = logoUrl;
    }
    toast('✅ Logo de l’école mis à jour avec succès.');
    const logoEl = $('nav-logo');
    if (logoEl) logoEl.innerHTML = `<img src="${esc(logoUrl)}" alt="Logo" class="w-full h-full object-cover">`;
    injectLogoIntoReceiptCard();
  };

  // Initialisation automatique au chargement
  document.addEventListener('DOMContentLoaded', () => {
    setInterval(bindReceiptPrintButton, 1000);
    setTimeout(() => {
      injectLogoIntoReceiptCard();
      if (typeof window.applyAdminFormGuard === 'function') window.applyAdminFormGuard();
      if (typeof window.updateTrashUI === 'function') window.updateTrashUI();
    }, 1000);
  });
})();
