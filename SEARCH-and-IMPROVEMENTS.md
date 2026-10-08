# PSAT 8/9 R&W — Standalone Question Search + real-time improvement audit

## What I built

A self-contained **search page** over the entire question bank (683 questions
across all 11 skills and 3 difficulty levels). It is **standalone** — it does not
modify the practice app or hook into it in any way.

**The page:** `search.html` (plus copies of the app files it reads to run on its
own: `style.css`, `gate.js`, `anti-cheat.js`, `nav.js`, the four `data-*.js`
banks, and `assets/`). Open `search.html` directly to use it.

### What the search does
- Live, as-you-type search across **question stem, passage/figure text, every
  answer choice, the explanation, the skill name, the canonical question ID,
  and every retired alias ID**.
- Multi-word search is AND-matched (all words must appear).
- Filter by **skill** (with per-skill counts), calibrated **PSAT difficulty**
  (Easy/Medium/Hard), and **trusted/provisional** status.
- Sort by **relevance**, **difficulty**, or **skill**.
- Each result expands in place to show the passage/figure (image included), all
  choices with the **correct answer marked**, and the full explanation.
- Keyboard: `/` focuses the box, `Esc` clears; results are debounced (110 ms).
- Quote/dash/space **normalization** so a typed `speaker's` matches the bank's
  curly `speaker's` (the content has 3,083 curly apostrophes and 1,710 curly quotes).

### Not wired into the app
The practice app is untouched: `index.html` is byte-identical to the original and
nothing in the app references this page. Delete this folder any time — the app is
unaffected.

### Verified
- All 683 questions load and are searchable; IDs are unique and retired IDs resolve through aliases.
- Text, multi-word, skill-filter, difficulty-filter, ID, sort, empty, and
  no-result queries all return correct results.
- Correct-answer highlighting: **0 mismatches** across the whole bank.
- All JavaScript passes `node --check`.
---

## Where the app can improve — effectiveness, accuracy, speed (real-time use)

Prioritized, with the evidence behind each point.

### Speed / real-time responsiveness

1. **~1 MB of question data loads on every page, synchronously.**
   The four `data-*.js` files total about **1,484 KB** and load as blocking `<script>`
   tags with no `defer`. Even the Hub — which never touches the bank — pays this
   cost. *Fix:* add `defer` to the data scripts now (quick win); longer term,
   convert the banks to a single JSON file fetched only on Practice/Search.

2. **No offline cache / Service Worker.** The app uses `?v=` cache-busting and
   `no-store` headers, so every visit re-downloads everything. Adding a Service
   Worker (PWA) would make repeat loads near-instant **and let a timed session
   survive a dropped connection** — important during a mock exam. This is the
   single highest-impact change for perceived speed and reliability.

3. **Images: 2.6 MB of PNG figures.** Only 58 questions have figures, but they're
   PNGs. Converting to WebP typically cuts ~60–70% with no visible quality loss.
   (The new search page already lazy-loads figure images.)

4. **Repeated full-bank scans.** `questionBank.filter/map/new Set(...)` appears in
   ~13 spots in `app.js`. At 683 items this is still quick, but as the bank grows,
   precomputing a few indexes once (an `id → question` map, and pools grouped by
   skill and difficulty) avoids repeated O(n) passes on the hot path.

### Accuracy

5. **OCR artifacts in the extracted content.** Spot checks show stray marks from
   the PDF extraction: empty `“”` quote pairs (34 occurrences), fragments like
   `is’ incorrect` (15), doubled spaces, and orphaned apostrophes. These don't
   break anything but hurt readability and tutor trust. *Fix:* a one-time
   text-cleanup script over the four data files — I can write and run it.

6. **Guard the answer-key invariant.** Correct-answer detection relies on each
   option starting with `A.`/`B.`/`C.`/`D.`. It's clean today (0 mismatches), but
   a tiny validation script in your build/commit flow would catch any future
   question that breaks the pattern before it ships.

7. **Search-match normalization (now handled for Search).** The same curly-quote
   issue affects any future text matching in the app — worth centralizing the
   `normalize()` helper if you add search elsewhere (e.g. Notes).

### Effectiveness (learning value)

8. **Let Search use the student's own history.** You already store a per-question
   ledger locally. A "show only questions I've missed" toggle on Search, plus a
   "practice these results as a set" button, would turn Search into a targeted
   review tool, not just a lookup.

9. **Real-time feedback is already local and fast** — the only network call is a
   fire-and-forget end-of-session sync to your Google Sheet (`keepalive`), which
   is the right design and not on the answer hot path. No change needed there.

### Suggested order
`defer` the data scripts → add a Service Worker (offline + speed) → run the
content cleanup pass → WebP the figures → add the history-aware Search toggles.

I can implement any of these next — say the word.
