/* SunuSchool - extensions_loader.js
   Injecte dynamiquement extensions.js dans la page HTML de manière totalement transparente.
   Évite d'avoir à modifier manuellement index.html. */
(function() {
  if (!document.querySelector('script[src*="extensions.js"]')) {
    const s = document.createElement('script');
    s.src = 'extensions.js';
    s.defer = true;
    document.head.appendChild(s);
  }
})();
