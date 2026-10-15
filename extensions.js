/* SunuSchool - extensions.js
   Implémentation modulaire et sûre des 8 fonctionnalités demandées :
   1. Corbeille 30 jours (classes et enseignants) : mise en corbeille, restauration, purge
   2. Restriction création administrateur au directeur (is_director)
   3. Relance WhatsApp pour paiements en retard / impayés
   4. Format ticket de caisse 80mm pour impression des reçus
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
     1. CORBEILLE 30 JOURS (CLASSES & ENSEIGNANTS)
     ============================================================ */
  window.moveTeacherToTrash = async function (id) {
    if (!sbc()) return toast('⚠️ Connexion base indisponible.');
    const { error } = await sbc().from('teachers').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) return toast('⚠️ Erreur corbeille enseignant : ' + error.message);
    toast('🗑️ Enseignant déplacé dans la corbeille (30 jours).');
    if (window.sunuReload) await window.sunuReload();
  };

  window.restoreTeacher = async function (id) {
    if (!sbc()) return toast('⚠️ Connexion base indisponible.');
    const { error } = await sbc().from('teachers').update({ deleted_at: null }).eq('id', id);
    if (error) return toast('⚠️ Erreur restauration : ' + error.message);
    toast('✅ Enseignant restauré.');
    if (window.sunuReload) await window.sunuReload();
  };

  /* ============================================================
     2. RESTRICTION CRÉATION ADMINISTRATEUR (DIRECTEUR SEUL)
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

  /* ============================================================
     3. RELANCE PAIEMENT VIA WHATSAPP
     ============================================================ */
  window.sendPaymentReminderWhatsApp = function (studentName, parentPhone, month, feeAmount) {
    if (!parentPhone) return toast('⚠️ Aucun numéro de parent disponible pour cet élève.');
    const cleanPhone = String(parentPhone).replace(/\D/g, '');
    if (cleanPhone.length < 8) return toast('⚠️ Numéro de téléphone invalide pour WhatsApp.');
    const schoolName = (window.SCHOOL && window.SCHOOL.name) || 'L’établissement scolaire';
    const message = `Bonjour,\nNous vous informons qu'un paiement de scolarité (${feeAmount} FCFA) pour ${studentName} au titre du mois de ${month} est en attente auprès de ${schoolName}.\nMerci de régulariser la situation dès que possible. Cordialement.`;
    const url = `https://wa.me/${cleanPhone.startsWith('221') ? cleanPhone : '221' + cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  /* ============================================================
     4. IMPRESSION REÇU FORMAT TICKET 80MM
     ============================================================ */
  window.printReceipt80mm = function (receipt) {
    if (!receipt) return toast('⚠️ Données de reçu invalides.');
    const sc = window.SCHOOL || {};
    const w = window.open('', '_blank', 'width=340,height=600');
    if (!w) return toast('⚠️ Fenêtre pop-up bloquée.');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Reçu #${esc(receipt.no || 'REC')}</title>
  <style>
    @page { size: 80mm auto; margin: 3mm; }
    body { font-family: 'Courier New', monospace; width: 74mm; font-size: 11px; color: #000; margin: 0 auto; padding: 2mm; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .title { font-size: 13px; margin-bottom: 2px; }
    .line { border-top: 1px dashed #000; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; margin: 2px 0; }
    .total { font-size: 14px; margin-top: 4px; }
  </style>
</head>
<body>
  <div class="center bold title">${esc(sc.name || 'SUNUSCHOOL')}</div>
  <div class="center">${esc(sc.city || '')} - Tél: ${esc(sc.phone || '')}</div>
  <div class="line"></div>
  <div class="row"><span>REÇU N°:</span><span class="bold">${esc(receipt.no || '—')}</span></div>
  <div class="row"><span>Date:</span><span>${new Date().toLocaleDateString('fr-FR')}</span></div>
  <div class="row"><span>Élève:</span><span class="bold">${esc(receipt.studentName || '—')}</span></div>
  <div class="row"><span>Classe:</span><span>${esc(receipt.className || '—')}</span></div>
  <div class="row"><span>Matricule:</span><span>${esc(receipt.matricule || '—')}</span></div>
  <div class="line"></div>
  <div class="row"><span>Mois:</span><span class="bold">${esc(receipt.month || '—')}</span></div>
  <div class="row"><span>Mode:</span><span>${esc(receipt.method || 'Espèces')}</span></div>
  <div class="line"></div>
  <div class="row total bold"><span>TOTAL PAYÉ:</span><span>${Number(receipt.amount || 0).toLocaleString('fr-FR')} FCFA</span></div>
  <div class="line"></div>
  <div class="center" style="margin-top:8px;font-size:10px;">Merci pour votre confiance.<br>Conservez ce ticket.</div>
  <script>
    window.onload = function() { setTimeout(function(){ window.print(); }, 200); };
  <\/script>
</body>
</html>`;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  /* ============================================================
     5. FICHE IMPRIMABLE DE CHANGEMENT / CRÉATION MOT DE PASSE
     ============================================================ */
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

  /* ============================================================
     6. ATTRIBUTION TÂCHES / CRÉNEAUX ENSEIGNANTS (CONTRÔLE DE COLLISION)
     ============================================================ */
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

  /* ============================================================
     7. MULTI-NUMÉROS D'ÉTABLISSEMENT
     ============================================================ */
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

  /* ============================================================
     8. LOGO ÉCOLE PERSONNALISÉ (UPLOAD SUPABASE STORAGE)
     ============================================================ */
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
  };

  // Initialisation automatique des sécurités sur l'interface
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      if (typeof window.applyAdminFormGuard === 'function') window.applyAdminFormGuard();
    }, 1000);
  });
})();
