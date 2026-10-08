// ─────────────────────────────────────────────────────────────────
// anti-cheat.js  —  Friction layer to discourage casual copy/paste
//                   and screenshot-and-share of question content.
//
// Load this AFTER gate.js on every protected page:
//   <script src="gate.js"></script>
//   <script src="anti-cheat.js"></script>
//
// What it does:
//   • Disables text selection on page content (form fields stay editable).
//   • Blocks right-click context menu.
//   • Blocks copy / cut / Ctrl+A / Ctrl+P / Ctrl+S / Ctrl+U / F12 /
//     Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C keyboard shortcuts.
//   • Tiles a faint diagonal watermark with the current user's name
//     (read from sessionStorage 'psat89_user', set by gate.js) — any
//     leaked screenshot is traceable to whoever was logged in.
//   • Logs every focus-loss / focus-regain to sessionStorage so the tutor
//     can spot tab-switches during a session.
//
// Honest scope:
//   This is FRICTION, not security. A user with dev tools open can disable
//   any of this in seconds, and screenshots cannot be blocked on the web
//   under any circumstances (a phone camera defeats every web-side defense).
//   The point is to make casual cheating annoying enough that actually
//   attempting the question is faster.
// ─────────────────────────────────────────────────────────────────

(function () {
    if (window.__antiCheatLoaded) return;
    window.__antiCheatLoaded = true;

    const USER_KEY      = 'psat89_user';   // matches gate.js / storage.js
    const BLUR_LOG_KEY  = 'mastery_focus_log';
    const BLUR_CNT_KEY  = 'mastery_blur_count';

    function userLabel() {
        try { return sessionStorage.getItem(USER_KEY) || 'SAT Mastery'; }
        catch (e) { return 'SAT Mastery'; }
    }

    // ── Selection / drag block ────────────────────────────────────
    function injectStyles() {
        const css = `
          html, body, .card, .passage-text, .options-list, .option-btn,
          #hwPassage, #hwQuestion, #hwOptions,
          .hw-card, .hw-results-card, .rq-body, .rq-explanation,
          .vocab-card, .transition-card, .rs-card, .sec-card,
          h1, h2, h3, h4, h5, h6, p, span, div, li, td, th, a, summary {
            -webkit-user-select: none !important;
            -moz-user-select:    none !important;
            -ms-user-select:     none !important;
            user-select:         none !important;
            -webkit-touch-callout: none !important;
          }
          /* Editable form controls must remain selectable / typeable */
          input, textarea, [contenteditable="true"] {
            -webkit-user-select: text !important;
            user-select:         text !important;
          }
          img, svg { -webkit-user-drag: none; user-drag: none; pointer-events: auto; }
        `;
        const s = document.createElement('style');
        s.id = '__antiCheatStyle';
        s.textContent = css;
        (document.head || document.documentElement).appendChild(s);
    }

    // ── Watermark ─────────────────────────────────────────────────
    function svgWatermark(text) {
        const safe = String(text).replace(/[<>&"']/g, '');
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='420' height='220' viewBox='0 0 420 220'>
          <text x='210' y='115' fill='rgba(15,23,42,0.07)'
                font-family='Inter,system-ui,sans-serif' font-size='22'
                font-weight='700' text-anchor='middle'
                transform='rotate(-25 210 115)'>${safe}</text>
        </svg>`;
        return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    }

    function injectWatermark() {
        if (document.getElementById('__watermark')) return;
        const label = userLabel() + ' · ' + new Date().toISOString().slice(0, 10);
        const wm = document.createElement('div');
        wm.id = '__watermark';
        wm.setAttribute('aria-hidden', 'true');
        wm.style.cssText = [
            'position:fixed', 'inset:0', 'z-index:99998',
            'pointer-events:none',
            'background-image:url("' + svgWatermark(label) + '")',
            'background-repeat:repeat',
            'background-position:0 0',
            'mix-blend-mode:multiply',
            'user-select:none',
        ].join(';');
        document.body.appendChild(wm);
    }

    // ── Context menu (right-click) block ──────────────────────────
    function blockContextMenu() {
        document.addEventListener('contextmenu', e => {
            // Allow on editable inputs for accessibility (paste, undo, etc.)
            if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
            e.preventDefault();
        });
    }

    // ── Copy / cut block ──────────────────────────────────────────
    function blockClipboard() {
        const handler = e => {
            if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
            e.preventDefault();
            if (e.clipboardData) e.clipboardData.setData('text/plain', '');
        };
        document.addEventListener('copy', handler);
        document.addEventListener('cut',  handler);
    }

    // ── Keyboard shortcut block ───────────────────────────────────
    function blockShortcuts() {
        document.addEventListener('keydown', e => {
            const tag = e.target && e.target.tagName;
            const inField = tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable;
            const k = (e.key || '').toLowerCase();
            const ctrl = e.ctrlKey || e.metaKey;

            // F12 — dev tools
            if (e.key === 'F12') { e.preventDefault(); return; }

            // Ctrl+Shift+I / J / C — dev tools / inspector
            if (ctrl && e.shiftKey && ['i', 'j', 'c'].includes(k)) {
                e.preventDefault(); return;
            }

            // Form-field-safe shortcuts: allow inside inputs
            if (inField) return;

            // Ctrl-letter clipboard / save / print / view-source
            if (ctrl && ['c', 'x', 'a', 'p', 's', 'u'].includes(k)) {
                e.preventDefault();
            }
        });
    }

    // ── Tab-switch / focus-loss logging ───────────────────────────
    function appendFocusEvent(event) {
        try {
            const log = JSON.parse(sessionStorage.getItem(BLUR_LOG_KEY) || '[]');
            log.push({ t: Date.now(), e: event, p: location.pathname });
            // Cap log length so sessionStorage doesn't bloat
            const trimmed = log.length > 200 ? log.slice(-200) : log;
            sessionStorage.setItem(BLUR_LOG_KEY, JSON.stringify(trimmed));
        } catch (e) { /* ignore */ }
    }

    function incrementBlurCount() {
        try {
            const n = parseInt(sessionStorage.getItem(BLUR_CNT_KEY) || '0', 10) + 1;
            sessionStorage.setItem(BLUR_CNT_KEY, String(n));
        } catch (e) { /* ignore */ }
    }

    function showFocusToast() {
        // Quiet, non-blocking notice the student sees when returning to the tab
        const existing = document.getElementById('__focusToast');
        if (existing) existing.remove();
        const t = document.createElement('div');
        t.id = '__focusToast';
        t.textContent = 'Session interrupted — focus loss logged';
        t.style.cssText = [
            'position:fixed', 'top:1rem', 'left:50%',
            'transform:translateX(-50%)',
            'background:#fef3c7', 'color:#92400e',
            'border:1px solid #fcd34d', 'border-radius:0.5rem',
            'padding:0.55rem 0.9rem', 'font-size:0.82rem',
            'font-weight:600', 'z-index:99999',
            'box-shadow:0 8px 24px rgba(0,0,0,0.18)',
            'font-family:Inter,system-ui,sans-serif',
            'pointer-events:none',
        ].join(';');
        document.body.appendChild(t);
        setTimeout(() => { t.style.transition = 'opacity 0.4s'; t.style.opacity = '0'; }, 2200);
        setTimeout(() => t.remove(), 2700);
    }

    function trackFocus() {
        window.addEventListener('blur', () => {
            incrementBlurCount();
            appendFocusEvent('blur');
        });
        window.addEventListener('focus', () => {
            appendFocusEvent('focus');
            showFocusToast();
        });
        // visibilitychange catches mobile-foreground swaps that blur doesn't
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                incrementBlurCount();
                appendFocusEvent('hidden');
            } else {
                appendFocusEvent('visible');
                showFocusToast();
            }
        });
    }

    // ── Public helpers for homework results screens ───────────────
    window.getFocusLog = function () {
        try { return JSON.parse(sessionStorage.getItem(BLUR_LOG_KEY) || '[]'); }
        catch (e) { return []; }
    };
    window.getBlurCount = function () {
        try { return parseInt(sessionStorage.getItem(BLUR_CNT_KEY) || '0', 10); }
        catch (e) { return 0; }
    };
    window.resetFocusLog = function () {
        try {
            sessionStorage.removeItem(BLUR_LOG_KEY);
            sessionStorage.removeItem(BLUR_CNT_KEY);
        } catch (e) {}
    };

    // Tutor can relax the friction (text selection / shortcuts) for students
    // using assistive tech or for open-book review. Read the flag directly so
    // this file has no dependency on config.js load order. Watermark + focus
    // logging stay on regardless, so the tutor keeps their integrity signal.
    function isRelaxed() {
        try { return localStorage.getItem('psat89_cfg_relax') === '1'; }
        catch (e) { return false; }
    }

    // ── Init ──────────────────────────────────────────────────────
    function init() {
        if (document.body) injectWatermark();
        trackFocus();
        if (isRelaxed()) return;   // skip the blocking friction
        injectStyles();
        blockContextMenu();
        blockClipboard();
        blockShortcuts();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
