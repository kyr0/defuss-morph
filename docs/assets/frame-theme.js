// The colour theme of the website's frames (router.html, bench.html), loaded in their <head> before any style applies.
// Embedded in the website, a frame follows the page's theme: site.js sets the class "dark" on the page's <html>, and
// a MutationObserver mirrors every change. VERIFIED: in Chrome on 2026-11-01, a frame that judged the theme on its own,
// from the saved choice or prefers-color-scheme, stayed light in a dark page when it loaded inside a hidden tab
// panel, and turned dark only after a reload. Opened on its own, a frame uses the saved theme, else the system's.
(() => {
  const root = document.documentElement;
  const setDark = (dark) => {
    root.classList.toggle('dark', dark);
    root.style.colorScheme = dark ? 'dark' : 'light';
  };

  let host = null;
  try {
    if (window.parent !== window) host = window.parent.document.documentElement;
  } catch {
    // another origin embeds this page: no access to its theme
  }
  if (host) {
    const follow = () => setDark(host.classList.contains('dark'));
    follow();
    new MutationObserver(follow).observe(host, { attributes: true, attributeFilter: ['class'] });
    return;
  }

  const system = matchMedia('(prefers-color-scheme: dark)');
  const apply = () => {
    let saved = '';
    try {
      const raw = JSON.parse(localStorage.getItem('defuss-shadcn-theme'));
      saved = raw && raw.format === 'defuss-store' ? raw.value : raw;
    } catch {
      // no storage (private mode, blocked): the system's theme
    }
    setDark(saved === 'dark' || (!saved && system.matches));
  };
  apply();
  system.addEventListener('change', apply);
  addEventListener('storage', apply);
})();
