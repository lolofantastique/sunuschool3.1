/* SunuSchool - chargement des extensions et identite de l'etablissement. */
(function () {
  'use strict';
  if (!document.querySelector('script[src*="extensions.js"]')) {
    const script = document.createElement('script');
    script.src = 'extensions.js';
    script.defer = true;
    document.head.appendChild(script);
  }
  const $ = id => document.getElementById(id);
  const school = () => window.SCHOOL || {};
  let mountedSchool = null, busy = false, loading = false, previewUrl = '';
  const note = (text, error = false) => {
    const el = $('school-identity-status');
    if (el) { el.textContent = text; el.style.color = error ? '#b91c1c' : '#047857'; }
  };
  function numbers(value) {
    return [...new Map((Array.isArray(value) ? value : [value]).map(String).map(s => s.trim()).filter(Boolean).map(s => [s.replace(/\D/g, ''), s])).values()];
  }
  function row(value = '') {
    const line = document.createElement('div');
    line.style.cssText = 'display:flex;gap:8px;margin:8px 0';
    const input = document.createElement('input');
    input.type = 'tel'; input.value = value; input.autocomplete = 'tel';
    input.placeholder = '+221 77 123 45 67'; input.setAttribute('aria-label', 'Numero de telephone de l’ecole');
    input.style.cssText = 'flex:1;min-width:0;border:1px solid #cbd5e1;border-radius:12px;padding:10px;background:#f8fafc';
    const remove = document.createElement('button');
    remove.type = 'button'; remove.textContent = 'Retirer';
    remove.style.cssText = 'padding:8px;color:#b91c1c';
    remove.onclick = () => { line.remove(); if (!$('school-phone-list').children.length) row(); };
    line.append(input, remove); $('school-phone-list').append(line);
  }
  function preview(url) {
    const img = $('school-image-preview');
    if (img) { img.hidden = !url; if (url) img.src = url; else img.removeAttribute('src'); }
  }
  async function director(id) {
    if (!window.sb) throw new Error('Connexion Supabase indisponible.');
    const { data: auth, error: ae } = await window.sb.auth.getUser();
    if (ae || !auth.user) throw new Error('Connectez-vous avec le compte directeur.');
    const { data, error } = await window.sb.from('profiles').select('school_id, role, is_director').eq('id', auth.user.id).single();
    if (error || !data || !data.is_director || data.role !== 'admin' || String(data.school_id) !== String(id)) throw new Error('Modification reservee au directeur de cet etablissement.');
  }
  function reflect(data) {
    if (String(school().id) !== String(data.id)) return;
    Object.assign(window.SCHOOL, { phones: numbers(data.phones || data.phone || ''), phone: data.phone || '', logo: data.logo || data.logo_url || '' });
    const nav = $('nav-logo');
    if (nav && school().logo) {
      const img = document.createElement('img'); img.src = school().logo; img.alt = 'Logo de l’etablissement';
      img.style.cssText = 'width:100%;height:100%;object-fit:contain;background:white'; nav.replaceChildren(img);
    }
    const receipt = $('rcpt-school-city');
    if (receipt) receipt.textContent = [school().city, school().phones.join(' / ')].filter(Boolean).join(' • ');
    const tab = $('tab-school-settings');
    if (tab) tab.querySelectorAll('label').forEach(label => {
      const text = label.textContent.toLowerCase();
      const input = (label.htmlFor && $(label.htmlFor)) || label.parentElement.querySelector('input');
      if (!input || input.closest('#school-identity-panel')) return;
      if (text.includes('url du logo')) input.value = school().logo;
      if (text.trim() === 'téléphone') input.value = school().phone;
    });
  }
  async function refresh() {
    if (busy || loading || !school().id || !$('school-identity-panel')) return;
    loading = true;
    const id = school().id;
    try {
      await director(id);
      const { data, error } = await window.sb.from('schools').select('id, phones, phone, logo, logo_url').eq('id', id).single();
      if (error) throw error;
      if (String(school().id) !== String(id)) return;
      reflect(data); mountedSchool = String(id);
      $('school-phone-list').replaceChildren();
      const list = school().phones.length ? school().phones : ['']; list.forEach(row);
      $('school-image-file').value = ''; preview(school().logo);
      $('school-identity-save').disabled = false; note('Le premier numero sera le contact principal.');
    } catch (e) { $('school-identity-save').disabled = true; note(e.message || String(e), true); }
    finally { loading = false; }
  }
  async function save() {
    if (busy) return;
    const id = school().id;
    if (!id || String(id) !== mountedSchool) return note('Rechargez les informations de cet etablissement.', true);
    const phones = numbers([...$('school-phone-list').querySelectorAll('input')].map(i => i.value));
    if (phones.some(p => !/^\+?[\d\s().-]+$/.test(p) || p.replace(/\D/g, '').length < 8 || p.replace(/\D/g, '').length > 15)) return note('Verifiez les numeros : 8 a 15 chiffres, indicatif conseille.', true);
    const file = $('school-image-file').files[0];
    if (file && (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 1048576)) return note('Choisissez un PNG, JPG ou WebP de 1 Mo maximum.', true);
    busy = true; $('school-identity-save').disabled = true; note('Enregistrement en cours…');
    let uploaded = '';
    try {
      await director(id);
      const patch = { phones, phone: phones[0] || null };
      if (file) {
        const bitmap = await createImageBitmap(file); bitmap.close();
        const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[file.type];
        uploaded = `${id}/logo_${crypto.randomUUID()}.${ext}`;
        const { error } = await window.sb.storage.from('school-logos').upload(uploaded, file, { contentType: file.type, upsert: false });
        if (error) { uploaded = ''; throw error; }
        const { data } = window.sb.storage.from('school-logos').getPublicUrl(uploaded);
        patch.logo = data.publicUrl; patch.logo_url = data.publicUrl;
      }
      if (String(school().id) !== String(id)) throw new Error('L’etablissement actif a change. Recommencez.');
      const { data, error } = await window.sb.from('schools').update(patch).eq('id', id).select('id, phones, phone, logo, logo_url').single();
      if (error || !data) throw error || new Error('Aucune modification autorisee.');
      uploaded = ''; reflect(data); $('school-image-file').value = ''; preview(school().logo);
      if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = ''; }
      note('Numeros et logo enregistres en ligne.');
    } catch (e) {
      if (uploaded) { try { await window.sb.storage.from('school-logos').remove([uploaded]); } catch (_) {} }
      note('Echec de l’enregistrement : ' + (e.message || String(e)), true);
    } finally { busy = false; $('school-identity-save').disabled = false; }
  }
  function mount() {
    const tab = $('tab-school-settings');
    if (!tab || $('school-identity-panel')) return;
    const panel = document.createElement('section'); panel.id = 'school-identity-panel';
    panel.style.cssText = 'background:white;border:1px solid #e2e8f0;border-radius:24px;padding:24px;margin:20px 0;font-size:13px';
    panel.innerHTML = `<h3 style="font-weight:800;font-size:17px;margin-bottom:12px">Telephones et logo des documents</h3><p>Ajoutez les numeros de l’ecole. Le premier est le contact principal.</p><div id="school-phone-list"></div><button type="button" id="school-phone-add" style="padding:10px;color:#047857;font-weight:700">+ Ajouter un numero</button><hr style="margin:16px 0"><label for="school-image-file" style="display:block;font-weight:700;margin-bottom:8px">Importer le logo depuis votre appareil</label><input id="school-image-file" type="file" accept="image/png,image/jpeg,image/webp"><p style="color:#64748b;margin:8px 0">PNG, JPG ou WebP • 1 Mo maximum. Le logo sera utilise dans les en-tetes imprimes.</p><img id="school-image-preview" alt="Apercu du logo" hidden style="width:96px;height:96px;object-fit:contain;border:1px solid #e2e8f0;border-radius:12px;margin:12px 0"><button id="school-identity-save" type="button" disabled style="background:#047857;color:white;font-weight:700;border-radius:12px;padding:12px 20px;margin-top:12px">Enregistrer les numeros et le logo</button><p id="school-identity-status" role="status" aria-live="polite" style="margin-top:12px">Ouvrez Parametres avec le compte directeur pour charger les informations.</p>`;
    tab.prepend(panel); row();
    $('school-phone-add').onclick = () => row();
    $('school-identity-save').onclick = save;
    $('school-image-file').onchange = e => {
      const file = e.target.files[0]; if (!file) return preview(school().logo);
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 1048576) { e.target.value = ''; preview(school().logo); return note('Format PNG, JPG ou WebP, 1 Mo maximum.', true); }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(file); preview(previewUrl); note('Apercu uniquement : cliquez sur Enregistrer pour sauvegarder.');
    };
    refresh();
  }
  function brandDocument(doc) {
    const sc = school(); if (!sc.id || !doc.body) return;
    let head = doc.querySelector('.header-col.center, #receipt-preview-card > div:first-child, .header');
    if (!head) {
      const name = [...doc.querySelectorAll('h1,h2,h3,h4,strong,div,p,span')].find(el => !el.children.length && el.textContent.trim().toLocaleUpperCase() === String(sc.name || '').toLocaleUpperCase());
      head = name && name.parentElement !== doc.body ? name.parentElement : null;
    }
    if (!head) {
      head = doc.createElement('div'); head.style.cssText = 'text-align:center;border-bottom:1px solid #cbd5e1;padding:8px;margin-bottom:12px';
      const name = doc.createElement('strong'); name.textContent = sc.name || ''; head.append(name); doc.body.prepend(head);
    }
    if (sc.logo && !head.querySelector('[data-school-document-logo], #rcpt-school-logo')) {
      const img = doc.createElement('img'); img.src = sc.logo; img.alt = 'Logo de l’etablissement'; img.dataset.schoolDocumentLogo = 'true';
      img.style.cssText = 'display:block;width:58px;height:58px;object-fit:contain;margin:0 auto 6px'; head.prepend(img);
    }
    const list = numbers(sc.phones && sc.phones.length ? sc.phones : sc.phone || '');
    if (list.length) {
      let contact = head.querySelector('[data-school-document-phones]');
      if (!contact) { contact = doc.createElement('div'); contact.dataset.schoolDocumentPhones = 'true'; contact.style.cssText = 'font-size:10px;line-height:1.4;overflow-wrap:anywhere'; head.append(contact); }
      contact.textContent = 'Tel. : ' + list.join(' / ');
    }
  }
  function preparePopup(win) {
    if (!win) return;
    try {
      const nativePrint = win.print.bind(win);
      win.print = async function () {
        brandDocument(win.document);
        const images = [...win.document.querySelectorAll('[data-school-document-logo], #rcpt-school-logo')];
        try { await Promise.all(images.map(img => Promise.race([img.decode(), new Promise((_, reject) => setTimeout(() => reject(new Error('Logo non charge')), 8000))]))); }
        catch (_) { alert('Le logo n’a pas pu etre charge. Verifiez la connexion puis relancez l’impression.'); return; }
        nativePrint();
      };
      win.addEventListener('beforeprint', () => brandDocument(win.document));
    } catch (e) { console.warn('En-tete du document indisponible', e); }
  }
  function hookPrints() {
    Object.keys(window).filter(key => key !== 'print' && /^(print|imprimer)/i.test(key)).forEach(key => {
      const original = window[key]; if (typeof original !== 'function' || original.schoolIdentityWrapped) return;
      const wrapped = function (...args) {
        const open = window.open;
        window.open = function (...params) {
          const win = open.apply(window, params);
          if (!params[0] || params[0] === 'about:blank') preparePopup(win);
          return win;
        };
        try { return original.apply(this, args); } finally { window.open = open; }
      };
      wrapped.schoolIdentityWrapped = true;
      try { window[key] = wrapped; } catch (_) {}
    });
  }
  function start() {
    mount(); hookPrints();
    new MutationObserver(() => mount()).observe(document.body, { childList: true, subtree: true });
    document.addEventListener('click', e => {
      const button = e.target.closest('button');
      if (button && (button.id === 'btn-school-settings' || /paramètres/i.test(button.textContent))) { mount(); refresh(); }
      hookPrints();
    }, true);
    window.addEventListener('beforeprint', () => {
      const receipt = $('receipt-preview-card');
      if (receipt && receipt.getClientRects().length) brandDocument(document);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
