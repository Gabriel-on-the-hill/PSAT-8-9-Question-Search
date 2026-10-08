// Smoke-test the standalone PSAT question search against its copied banks.
'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const DIR = __dirname;
const html = fs.readFileSync(path.join(DIR, 'search.html'), 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.test/search.html' });
const { window } = dom;
window.scrollTo = () => {};

const bankFiles = [
  'data-craft-structure.js', 'data-expression-of-ideas.js',
  'data-info-ideas.js', 'data-conventions.js',
];
const banks = bankFiles.map(file => fs.readFileSync(path.join(DIR, file), 'utf8'));
const inline = [...window.document.querySelectorAll('script:not([src])')].pop().textContent;
const probe = `window.__banks = [questionBank_CS, questionBank_EOI, questionBank_II, questionBank_CON];`;
window.eval(banks.join('\n;\n') + '\n;\n' + probe + '\n;\n' + inline);

const ALL = window.__banks.flat();
// Expected counts come from the banks themselves, so a bank import never needs a test edit.
const N = ALL.length;
const PROVISIONAL = ALL.filter(q => q.difficultyStatus === 'provisional').length;
let failures = 0;
function ok(label, condition, detail) {
  console.log(`${condition ? '  ok  ' : '  FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!condition) failures++;
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const countText = () => window.document.getElementById('resultMeta').textContent.replace(/\s+/g, ' ').trim();

async function main() {
  ok(`all ${N} questions load`, N > 0 && N === new Set(ALL.map(q => q.id)).size, `got ${N}`);
  ok('all canonical ids are unique', new Set(ALL.map(q => q.id)).size === ALL.length);
  ok(`header reports all ${N} questions`, new RegExp(`${N} questions`).test(countText()), countText());
  ok('all records carry the merged provenance schema', ALL.every(q =>
    ['cb-psat89', 'cb-sat', 'book-ugsg'].includes(q.origin) &&
    ['native', 'mapped-from-sat'].includes(q.psatDifficultyFrom) &&
    [undefined, 'official', 'provisional'].includes(q.difficultyStatus)));

  const input = window.document.getElementById('searchInput');
  const aliasQuestion = ALL.find(q => q.altIds && q.altIds.length);
  input.value = aliasQuestion.altIds[0];
  input.dispatchEvent(new window.Event('input'));
  await wait(150);
  ok('a retired id finds its canonical question', new RegExp(`^1 of ${N} questions`).test(countText()), countText());
  ok('the result displays the canonical id',
    window.document.querySelector('.badge-id').textContent.includes(aliasQuestion.id));

  // Only SAT/book records ever had a mapped difficulty; once they are all retired there is none to test.
  const shifted = ALL.find(q => q.difficulty !== q.psatDifficulty) || null;
  if (!shifted) console.log('  skip  no question with a mapped difficulty remains');
  if (shifted) {
  input.value = shifted.id;
  window.document.querySelectorAll('.diff-chip').forEach(chip => chip.dataset.on =
    chip.dataset.diff === shifted.psatDifficulty ? '1' : '0');
  window.document.getElementById('skillFilter').dispatchEvent(new window.Event('change'));
  ok('difficulty filtering uses calibrated PSAT difficulty', new RegExp(`^1 of ${N} questions`).test(countText()), countText());
  window.document.querySelectorAll('.diff-chip').forEach(chip => chip.dataset.on =
    chip.dataset.diff === shifted.difficulty ? '1' : '0');
  window.document.getElementById('skillFilter').dispatchEvent(new window.Event('change'));
  ok('native SAT difficulty does not leak into the PSAT filter', new RegExp(`^0 of ${N} questions`).test(countText()), countText());
  }

  input.value = '';
  window.document.querySelectorAll('.diff-chip').forEach(chip => chip.dataset.on = '1');
  const trust = window.document.getElementById('trustFilter');
  trust.value = 'provisional';
  trust.dispatchEvent(new window.Event('change'));
  ok(`provisional filter yields ${PROVISIONAL}`, new RegExp(`^${PROVISIONAL} of ${N} questions`).test(countText()), countText());
  trust.value = 'trusted';
  trust.dispatchEvent(new window.Event('change'));
  ok(`trusted filter yields ${N - PROVISIONAL}`, new RegExp(`^${N - PROVISIONAL} of ${N} questions`).test(countText()), countText());

  ok('every referenced image exists', ALL.filter(q => q.image).every(q =>
    fs.existsSync(path.join(DIR, q.image))));
  ok('every correct answer resolves to one option', ALL.every(q =>
    (q.options || []).filter(opt => new RegExp(`^${q.answer}[.．]`).test(opt)).length === 1));

  console.log(failures ? `\n${failures} FAILED` : '\nall passed');
  process.exit(failures ? 1 : 0);
}

main().catch(error => { console.error(error); process.exit(1); });
