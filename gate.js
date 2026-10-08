// ─────────────────────────────────────────────────────────────────
// gate.js  —  Session-only password gate for the SAT Mastery app
//
// Load this as the FIRST script in <head> on every protected page:
//   <script src="gate.js"></script>
//
// Behaviour:
//   • If the session is already unlocked, does nothing — page renders normally.
//   • Otherwise, hides the page, shows a centered prompt overlay, and only
//     reveals the page after a correct password is entered.
//   • Unlock state lives in sessionStorage, so closing the tab re-locks the app.
//   • Case-insensitive: input is lowercased before hashing.
//
// Adding a new password later:
//   1. Compute its SHA-256 (lowercased) — e.g. in a terminal:
//        node -e "const c=require('crypto'); console.log(
//          c.createHash('sha256').update('newpassword').digest('hex'))"
//      or in a browser console:
//        crypto.subtle.digest('SHA-256', new TextEncoder().encode('newpassword'))
//          .then(b => console.log([...new Uint8Array(b)]
//            .map(x => x.toString(16).padStart(2,'0')).join('')));
//   2. Add an entry to ACCEPTED_HASHES below as: 'thehex': 'Firstname'.
//      Use ONLY the first name (Title-Cased version of the password) as the
//      display label — the watermark uses this label, and we keep watermarks
//      to first names by convention so they read cleanly across the page.
//      No other code change needed.
//
// The hashes here are for: "gabe", "maysa", "faith".
// ─────────────────────────────────────────────────────────────────

(function () {
    // Hash → display label. The label is stored in sessionStorage on
    // successful unlock so the watermark (anti-cheat.js) can personalize
    // itself for whoever is using the app this session.
    const ACCEPTED_HASHES = {
        '72831924521887e6638e686d6d004cd6cefe48168d2d4e2c40d29115b9c611b9': 'Gabe',
        'e47c0980d3fb546a933d172c8ff1ce7ae2abbc93f5cfc883330e28f350c6b262': 'Maysa',
        '2b93b177b55445f513d73ff1f0f30376d6ec181bcc1bd5cd19cccb970f4ee0d2': 'Faith',
    };
    const STORAGE_KEY  = 'mastery_unlocked';
    const USER_KEY     = 'psat89_user';
    const SESSION_FLAG = '1';

    // Expose a global lock function so the hub can offer a "Lock" button.
    // Defined unconditionally so it works whether or not the gate fired.
    window.lockMastery = function () {
        sessionStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(USER_KEY);
        location.reload();
    };

    // Already unlocked? Render normally.
    try {
        if (sessionStorage.getItem(STORAGE_KEY) === SESSION_FLAG) return;
    } catch (e) { /* sessionStorage unavailable — fall through to gate */ }

    // Inject a stylesheet that hides the page until either the overlay is
    // mounted or the gate is dismissed. Done inline so it applies before
    // any layout/paint happens.
    const hideStyle = document.createElement('style');
    hideStyle.id = '__gateHideStyle';
    hideStyle.textContent = 'html{visibility:hidden!important}';
    (document.head || document.documentElement).appendChild(hideStyle);

    function onReady(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn, { once: true });
        } else {
            fn();
        }
    }

    async function sha256Hex(text) {
        const buf  = new TextEncoder().encode(text);
        const hash = await crypto.subtle.digest('SHA-256', buf);
        return [...new Uint8Array(hash)]
            .map(b => b.toString(16).padStart(2, '0')).join('');
    }

    onReady(() => {
        const overlay = document.createElement('div');
        overlay.id = '__gateOverlay';
        overlay.style.cssText = [
            'position:fixed', 'inset:0', 'z-index:2147483647',
            'background:#0f172a',
            'display:flex', 'align-items:center', 'justify-content:center',
            'padding:1.5rem',
            'font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
        ].join(';');

        overlay.innerHTML = `
          <div style="background:#fff;border-radius:1rem;padding:2rem 1.75rem;
                      max-width:380px;width:100%;
                      box-shadow:0 20px 50px rgba(0,0,0,0.35)">
            <div style="display:flex;align-items:center;gap:0.5rem;
                        font-size:0.78rem;font-weight:700;color:#2563eb;
                        margin-bottom:1.25rem;letter-spacing:0.04em;
                        text-transform:uppercase">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2.5">
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              SAT Mastery
            </div>
            <h2 style="margin:0 0 0.4rem;font-size:1.25rem;font-weight:700;
                       color:#0f172a">Password required</h2>
            <p style="margin:0 0 1.25rem;color:#64748b;font-size:0.88rem;
                      line-height:1.45">
              Enter your password to unlock the app for this browser session.
            </p>
            <input id="__gateInput" type="password" autocomplete="off"
                   spellcheck="false" autocapitalize="off"
                   placeholder="Password"
                   style="width:100%;padding:0.7rem 0.85rem;border:1.5px solid #e2e8f0;
                          border-radius:0.55rem;font-size:1rem;outline:none;
                          box-sizing:border-box;font-family:inherit;
                          transition:border-color 0.15s"/>
            <div id="__gateError"
                 style="color:#dc2626;font-size:0.8rem;margin-top:0.5rem;
                        min-height:1.2rem;font-weight:600"></div>
            <button id="__gateBtn"
                    style="margin-top:0.5rem;width:100%;padding:0.75rem;
                           background:#2563eb;color:#fff;border:none;
                           border-radius:0.55rem;font-size:0.95rem;font-weight:600;
                           cursor:pointer;font-family:inherit;
                           transition:background 0.15s">
              Unlock
            </button>
          </div>
        `;
        document.body.appendChild(overlay);

        // Reveal html now that the overlay is in place — the overlay covers
        // the underlying page until unlock succeeds.
        hideStyle.remove();

        const input = document.getElementById('__gateInput');
        const errEl = document.getElementById('__gateError');
        const btn   = document.getElementById('__gateBtn');

        input.focus();
        input.addEventListener('focus', () => { input.style.borderColor = '#2563eb'; });
        input.addEventListener('blur',  () => { input.style.borderColor = '#e2e8f0'; });
        btn.addEventListener('mouseenter', () => { btn.style.background = '#1d4ed8'; });
        btn.addEventListener('mouseleave', () => { btn.style.background = '#2563eb'; });

        async function tryUnlock() {
            const pwd = (input.value || '').trim().toLowerCase();
            if (!pwd) return;
            btn.disabled = true;
            let hash;
            try {
                hash = await sha256Hex(pwd);
            } catch (e) {
                errEl.textContent = 'Browser does not support SHA-256';
                btn.disabled = false;
                return;
            }
            if (ACCEPTED_HASHES[hash]) {
                try {
                    sessionStorage.setItem(STORAGE_KEY, SESSION_FLAG);
                    sessionStorage.setItem(USER_KEY, ACCEPTED_HASHES[hash]);
                } catch (e) {}
                overlay.remove();
            } else {
                errEl.textContent = 'Incorrect password';
                input.value = '';
                input.focus();
                btn.disabled = false;
            }
        }

        btn.addEventListener('click', tryUnlock);
        input.addEventListener('input',   () => { errEl.textContent = ''; });
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); tryUnlock(); }
        });
    });
})();
