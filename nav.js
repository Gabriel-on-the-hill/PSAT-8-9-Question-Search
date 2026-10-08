// nav.js — auto-injects a "← Hub" link on every page that includes it.
//
// Behaviour:
//   • On any page except index.html, ensures a link back to index.html exists.
//   • If the page already has an <a href="index.html"> anywhere (manual or
//     screen-specific link), this script does nothing — no duplicates.
//   • Otherwise it picks the best spot it can find:
//       1. .header-btns inside a .site-header / .header-row  → appends there
//       2. .header-row / header / .site-header               → appends there
//       3. nowhere found                                     → pins a fixed
//                                                              button top-left
//   • Uses the .back-link class if the page's CSS defines one (matches existing
//     visual language); falls back to inline styles otherwise.
//
// To use on a new page, add ONE line before </body>:
//   <script src="nav.js" defer></script>

(function () {
  const file = (location.pathname.split('/').pop() || '').toLowerCase();
  // Skip the hub itself (and bare "/" which serves index.html)
  if (file === '' || file === 'index.html') return;

  function alreadyHasHubLink() {
    return Array.from(document.querySelectorAll('a[href]')).some(a => {
      const href = (a.getAttribute('href') || '').toLowerCase();
      return href === 'index.html' || href === './index.html'
          || href === '/index.html' || href === '/';
    });
  }

  function build() {
    const a = document.createElement('a');
    a.href = 'index.html';
    a.innerHTML = '&larr; Hub';
    a.title = 'Back to Hub';
    a.setAttribute('data-auto-hub', '');
    return a;
  }

  function inject() {
    if (alreadyHasHubLink()) return;

    const link = build();

    const headerBtns = document.querySelector(
      '.site-header .header-btns, .header-row .header-btns, header .header-btns'
    );
    const headerRow = document.querySelector(
      '.site-header .header-row, header .header-row'
    );
    const anyHeader = document.querySelector('header, .site-header');

    if (headerBtns) {
      link.className = 'back-link';
      headerBtns.appendChild(link);
    } else if (headerRow) {
      link.className = 'back-link';
      link.style.marginLeft = 'auto';
      headerRow.appendChild(link);
    } else if (anyHeader) {
      link.style.cssText =
        'margin-left:auto;font-size:0.78rem;font-weight:600;' +
        'color:#64748b;text-decoration:none;padding:0.35rem 0.7rem;' +
        'border:1px solid #e5e7eb;border-radius:0.4rem;background:#f8fafc;' +
        'white-space:nowrap;display:inline-flex;align-items:center;';
      anyHeader.appendChild(link);
    } else {
      // No header at all — pin as a floating corner button
      link.style.cssText =
        'position:fixed;top:max(12px,env(safe-area-inset-top));' +
        'left:max(12px,env(safe-area-inset-left));z-index:9999;' +
        'font-size:0.85rem;font-weight:600;color:#0f172a;text-decoration:none;' +
        'padding:0.45rem 0.85rem;border:1px solid #cbd5e1;border-radius:0.5rem;' +
        'background:#fff;box-shadow:0 2px 6px rgba(0,0,0,0.08);';
      document.body.appendChild(link);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
