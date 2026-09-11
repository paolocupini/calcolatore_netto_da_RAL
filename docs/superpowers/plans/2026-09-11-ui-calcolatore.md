# Calcolatore RAL → Netto — UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the UI layer so a user picks a profile, enters inputs, clicks "Calcola" and sees the net figure plus every deduction, each traceable to its source.

**Architecture:** The calculation engine and the tax data already exist and are correct; this plan moves them into the tree `SPEC.md` §3 describes, then adds three UI modules on top. `formato.js` holds pure it-IT formatters. `render.js` holds pure functions that turn an engine result into HTML strings — no DOM reads, no fetch, no state. `app.js` owns everything impure: loading the three JSON files, holding state, wiring events, calling `calcola()`, mounting what `render.js` produces. The UI never knows a tax rule; it reads `profili.json` and renders whatever the engine returns.

**Tech Stack:** Vanilla ES modules, HTML, CSS. Zero dependencies, no build step. Tests run on Node's built-in `node --test` (no test framework to install).

**Spec:** `docs/superpowers/specs/2026-09-11-ui-calcolatore-design.md` (design decisions) and `SPEC.md` (requirements, verified test cases §7, acceptance criteria §8). Read both.

---

## Global Constraints

- **Node ≥ 18** required for `node --test`. Verified working on v20.11.1.
- **Zero runtime dependencies. No build step. No package manager install.** `package.json` exists only to declare `{"type": "module"}` — it must never gain a `dependencies` block.
- **No tax rate, threshold, or formula literals in `src/ui/` or `stile/`.** Every fiscal number reaches the UI through the engine result or the JSON files. This is `SPEC.md` §3's non-negotiable rule and is mechanically checked in Task 8.
- **All fetch paths relative** (`data/regole-fiscali-2026.json`, never `/data/...`) — GitHub Pages serves project sites from `/<repo>/`.
- **All UI copy in Italian.** All numbers formatted with `Intl.NumberFormat("it-IT")`. No raw unformatted number reaches the screen.
- **Design tokens exactly as specified** in design doc §3.1: `--carta #FBFBF9`, `--inchiostro #16181C`, `--inchiostro-tenue #5C626B`, `--riga #D8D6D0`, `--trattenuta #8C2F1E`, `--credito #1F5A3D`.
- **`font-variant-numeric: tabular-nums`** on every element containing a figure. The shared decimal axis is load-bearing, not decorative.
- **Accessibility:** visible custom focus ring (never `outline: none`), AA contrast in both themes, `prefers-reduced-motion` honored, semantic `<table>`/`<fieldset>`/`<details>`, results region `aria-live="polite"`.
- **No entry animations.** Design doc §3.4 removed them deliberately.
- Work happens on branch `feat/ui`, already created from `master`.

### One refinement to the design doc

Design doc §4 says `render.js` holds "funzioni da stato a DOM". This plan implements those functions as **pure `stato → HTML string`** functions, mounted by `app.js` via `innerHTML`. Reason: it makes `render.js` testable under `node --test` with zero dependencies — there is no DOM in Node and no jsdom is permitted. The module boundary the design doc cares about (no fetch, no state, no fiscal knowledge in `render.js`) is unchanged and in fact stricter.

Consequence: every interpolated value passes through a local `esc()` helper. The values come from our own JSON and from numeric inputs, so this is defence in depth rather than a live XSS path, but it is not optional — `note` and `riferimentoNormativo` fields in `fonti.json` are free text.

---

## File Structure

| File | Responsibility |
|---|---|
| `package.json` | Declares `{"type": "module"}` so Node treats `src/motore/*.js` as ES modules. Nothing else. |
| `data/*.json` | Moved from `data/fonti_tassazione/`. Unchanged content. |
| `src/motore/*.js` | Moved from `data/fonti_tassazione/`. Unchanged content. |
| `verifica.mjs` | Moved to root. Unchanged content. Manual inspection script. |
| `test/regressione.test.mjs` | Asserts the four `SPEC.md` §7 cases. Turns the manual script's numbers into a gate. |
| `src/ui/formato.js` | it-IT formatters. Pure, no DOM, no fiscal knowledge. |
| `src/ui/render.js` | Engine result → HTML string. Pure, no fetch, no state. |
| `src/ui/app.js` | Loading, state, events, mounting, error handling. The only impure module. |
| `test/formato.test.mjs` | Unit tests for the formatters. |
| `test/render-campi.test.mjs` | Tests for profile picker and dynamic field generation. |
| `test/render-catena.test.mjs` | Tests for the deduction chain, both engines. |
| `test/render-dettagli.test.mjs` | Tests for brackets detail, sources, simplifications, errors. |
| `stile/main.css` | Tokens, ledger layout, dark theme. |
| `index.html` | Skeleton. Form container empty — filled by `renderCampi`. |
| `README.md` | What it is, how to run, demo link, architecture note, simplifications. |

---

## Task 1: Move the backend into the SPEC tree and lock its numbers with tests

The engine is correct but unreachable: `verifica.mjs` imports `./src/motore/index.js` and `./data/*.json`, paths that do not exist yet. Moving the files makes those imports resolve. A second, separate defect: without a `package.json` declaring `{"type": "module"}`, Node resolves `.js` files as CommonJS and the import fails with `SyntaxError: Named export 'calcola' not found`. Both are fixed here, before a line of UI exists.

**Files:**
- Create: `package.json`
- Create: `test/regressione.test.mjs`
- Move (content unchanged): `data/fonti_tassazione/{regole-fiscali-2026,fonti,profili}.json` → `data/`
- Move (content unchanged): `data/fonti_tassazione/{primitive,dipendente,forfettario,index}.js` → `src/motore/`
- Move (content unchanged): `data/fonti_tassazione/verifica.mjs` → `verifica.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `import { calcola } from "./src/motore/index.js"` resolvable from the repo root; `calcola({profiloId, input, regole, profili, fonti})` returning the shape documented in `SPEC.md` §4.5.

- [ ] **Step 1: Move the files with `git mv`**

Run from the repo root. `git mv` preserves history; a delete-and-add would not.

```bash
mkdir -p src/motore
git mv data/fonti_tassazione/regole-fiscali-2026.json data/regole-fiscali-2026.json
git mv data/fonti_tassazione/fonti.json data/fonti.json
git mv data/fonti_tassazione/profili.json data/profili.json
git mv data/fonti_tassazione/primitive.js src/motore/primitive.js
git mv data/fonti_tassazione/dipendente.js src/motore/dipendente.js
git mv data/fonti_tassazione/forfettario.js src/motore/forfettario.js
git mv data/fonti_tassazione/index.js src/motore/index.js
git mv data/fonti_tassazione/verifica.mjs verifica.mjs
rmdir data/fonti_tassazione
```

Do not edit the contents of any moved file in this task.

- [ ] **Step 2: Run the verification script and watch it fail for the expected reason**

Run: `node verifica.mjs`

Expected: FAIL with `SyntaxError: Named export 'calcola' not found. The requested module './src/motore/index.js' is a CommonJS module`.

This failure is the point — it proves the module-format defect is real and not imagined.

- [ ] **Step 3: Add `package.json`**

```json
{
  "name": "calcolatore-netto-da-ral",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "description": "Calcolatore RAL lordo → netto, anno d'imposta 2026, ambito Milano (Lombardia).",
  "scripts": {
    "test": "node --test test/",
    "verifica": "node verifica.mjs",
    "avvia": "python3 -m http.server 8000"
  }
}
```

No `dependencies` key. No `devDependencies` key. `node --test` ships with Node.

- [ ] **Step 4: Run the verification script and confirm it passes**

Run: `node verifica.mjs`

Expected: PASS. Output ends with a `=== FONTI RACCOLTE ===` block. Confirm these four figures appear, which are `SPEC.md` §7:

```
=== Dipendente indeterminato — RAL 35.000 ===  NETTO ANNUO: 25.967,21
=== Dipendente indeterminato — RAL 22.000 ===  NETTO ANNUO: 17.764,35
=== Apprendista — RAL 24.000 ===               NETTO ANNUO: 20.500,67
=== Forfettario — 40.000 ===                   NETTO ANNUO: 28.406,24
```

- [ ] **Step 5: Write the regression test**

`verifica.mjs` prints numbers for a human to read. This asserts them, so a later change that breaks the engine fails loudly. Create `test/regressione.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calcola } from "../src/motore/index.js";

const leggi = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const regole = leggi("../data/regole-fiscali-2026.json");
const profili = leggi("../data/profili.json");
const fonti = leggi("../data/fonti.json");

const esegui = (profiloId, input) =>
  calcola({ profiloId, input, regole, profili, fonti });

test("dipendente indeterminato, RAL 35.000, 13 mensilita'", () => {
  const e = esegui("dipendente-indeterminato", { lordoAnnuo: 35000, mensilita: 13 });

  assert.equal(e.voci.contributi.importo, 3216.5);
  assert.equal(e.voci.imponibileFiscale, 31783.5);
  assert.equal(e.voci.irpefLorda.importo, 7688.56);
  assert.equal(e.voci.detrazioni[0].importo, 1581.52);
  assert.equal(e.voci.detrazioni[1].importo, 1000);
  assert.equal(e.voci.irpefNetta, 5107.04);
  assert.equal(e.voci.addizionali[0].importo, 454.98);
  assert.equal(e.voci.addizionali[1].importo, 254.27);
  assert.equal(e.risultato.totaleTrattenute, 9032.79);
  assert.equal(e.risultato.nettoAnnuo, 25967.21);
  assert.equal(e.risultato.nettoMensile, 1997.48);
  assert.equal(e.risultato.aliquotaMediaEffettiva, 25.81);
});

test("il cuneo fiscale sotto i 32.000 e' un importo fisso, non la formula decrescente", () => {
  // Imponibile 31.783,50: applicare la formula decrescente darebbe 1.027 invece di 1.000.
  const e = esegui("dipendente-indeterminato", { lordoAnnuo: 35000, mensilita: 13 });
  assert.equal(e.voci.detrazioni[1].importo, 1000);
});

test("dipendente indeterminato, RAL 22.000: addizionale comunale esente", () => {
  const e = esegui("dipendente-indeterminato", { lordoAnnuo: 22000, mensilita: 13 });

  assert.equal(e.voci.contributi.importo, 2021.8);
  assert.equal(e.voci.imponibileFiscale, 19978.2);
  assert.equal(e.voci.irpefLorda.importo, 4594.99);
  assert.equal(e.voci.detrazioni[0].importo, 2644.3);
  assert.equal(e.voci.detrazioni[1].importo, 0);
  assert.equal(e.voci.irpefNetta, 1950.69);
  assert.equal(e.voci.addizionali[0].importo, 263.16);

  const comunale = e.voci.addizionali[1];
  assert.equal(comunale.importo, 0);
  assert.equal(comunale.esente, true);
  assert.equal(comunale.sogliaEsenzione, 23000);

  assert.equal(e.risultato.nettoAnnuo, 17764.35);
  assert.equal(e.risultato.nettoMensile, 1366.49);
});

test("l'esenzione comunale non e' una franchigia: il salto sopra soglia e' discontinuo", () => {
  // Sotto soglia si paga zero; appena sopra si paga lo 0,8% sull'INTERO imponibile,
  // non sull'eccedenza. Il salto dev'essere di oltre 180 euro, non di pochi centesimi.
  const sotto = esegui("dipendente-indeterminato", { lordoAnnuo: 25300, mensilita: 13 });
  const sopra = esegui("dipendente-indeterminato", { lordoAnnuo: 25400, mensilita: 13 });

  assert.equal(sotto.voci.addizionali[1].importo, 0);
  assert.ok(sopra.voci.addizionali[1].importo > 180);
});

test("apprendista, RAL 24.000: cambia solo l'aliquota contributiva", () => {
  const e = esegui("apprendista", { lordoAnnuo: 24000, mensilita: 13 });

  assert.equal(e.voci.contributi.aliquota, 0.0584);
  assert.equal(e.voci.contributi.importo, 1401.6);
  assert.equal(e.voci.imponibileFiscale, 22598.4);
  assert.equal(e.voci.irpefLorda.importo, 5197.63);
  assert.equal(e.voci.totaleDetrazioni, 3404.45);
  assert.equal(e.voci.irpefNetta, 1793.18);
  assert.equal(e.voci.addizionali[0].importo, 304.55);
  assert.equal(e.voci.addizionali[1].esente, true);
  assert.equal(e.risultato.nettoAnnuo, 20500.67);
  assert.equal(e.risultato.nettoMensile, 1576.97);
});

test("forfettario, compensi 40.000, coefficiente 78%, aliquota 15%", () => {
  const e = esegui("forfettario", {
    lordoAnnuo: 40000,
    coefficiente: "professionale-78",
    aliquotaSostitutiva: "ordinaria",
  });

  assert.equal(e.voci.coefficienteRedditivita.redditoForfettario, 31200);
  assert.equal(e.voci.contributi.importo, 8133.84);
  assert.equal(e.voci.imponibileImposta, 23066.16);
  assert.equal(e.voci.impostaSostitutiva.importo, 3459.92);
  assert.equal(e.risultato.nettoAnnuo, 28406.24);
  assert.equal(e.risultato.aliquotaMediaEffettiva, 28.98);
});

test("forfettario oltre la soglia: il motore segnala ma calcola comunque", () => {
  const e = esegui("forfettario", {
    lordoAnnuo: 90000,
    coefficiente: "professionale-78",
    aliquotaSostitutiva: "ordinaria",
  });

  assert.equal(e.voci.supera.superata, true);
  assert.equal(e.voci.supera.sogliaRicavi, 85000);
  assert.ok(e.risultato.nettoAnnuo > 0);
});

test("lordo a zero e' un risultato valido, non un errore", () => {
  const e = esegui("dipendente-indeterminato", { lordoAnnuo: 0, mensilita: 13 });

  assert.equal(e.risultato.nettoAnnuo, 0);
  assert.equal(e.risultato.totaleTrattenute, 0);
  assert.equal(e.risultato.aliquotaMediaEffettiva, 0);
});

test("ogni voce del risultato risale a una fonte risolta", () => {
  const e = esegui("dipendente-indeterminato", { lordoAnnuo: 35000, mensilita: 13 });

  assert.ok(e.meta.fontiUtilizzate.length >= 6);
  for (const fonte of e.meta.fontiUtilizzate) {
    assert.equal(fonte.mancante, undefined, `fonte non risolta: ${fonte.id}`);
    assert.ok(fonte.ente, `fonte senza ente: ${fonte.id}`);
    assert.ok(["primaria", "secondaria"].includes(fonte.affidabilita));
    assert.match(fonte.dataScadenzaVerifica, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(typeof fonte.daRiverificare, "boolean");
  }
});
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `node --test test/`

Expected: PASS, 9 tests. If the discontinuity test fails, the RAL values bracketing 23.000 of taxable income may need adjusting for the contribution rate — recompute rather than weakening the assertion.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Move engine and data into the SPEC tree, lock the numbers with tests

The engine was correct but unreachable: verifica.mjs imports
./src/motore/index.js and ./data/*.json, neither of which existed.
Moving the files makes those imports resolve.

Separately, Node resolved src/motore/*.js as CommonJS because no
package.json declared the module type, so the import failed with
'Named export calcola not found'. package.json now declares
type: module. It carries no dependencies and never should.

test/regressione.test.mjs asserts the four cases from SPEC.md section 7
plus the two discontinuities that generate silent bugs: the fixed cuneo
amount below 32.000 and the non-franchise municipal exemption."
```

---

## Task 2: `formato.js` — it-IT formatters

**Files:**
- Create: `src/ui/formato.js`
- Test: `test/formato.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `euro(n: number) => string` — `25967.21` → `"25.967,21 €"`
  - `percentuale(n: number) => string` — takes a percentage number, `25.81` → `"25,81%"`
  - `aliquota(frazione: number) => string` — takes a fraction, `0.0919` → `"9,19%"`
  - `numero(n: number) => string` — `23000` → `"23.000"`
  - All four return `"—"` for non-finite input.

Note for the implementer: `Intl` currency formatting in it-IT puts a **non-breaking space** before the `€`. The tests normalise it rather than asserting a plain space, because the non-breaking space is correct and must not be "fixed".

- [ ] **Step 1: Write the failing test**

Create `test/formato.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { euro, percentuale, aliquota, numero } from "../src/ui/formato.js";

// Intl usa uno spazio unificatore (U+00A0 o U+202F) prima del simbolo di valuta.
// E' corretto: lo normalizziamo per poter scrivere asserzioni leggibili.
const norm = (s) => s.replace(/ | /g, " ");

test("euro formatta in stile italiano con due decimali", () => {
  assert.equal(norm(euro(25967.21)), "25.967,21 €");
  assert.equal(norm(euro(1997.48)), "1.997,48 €");
  assert.equal(norm(euro(0)), "0,00 €");
  assert.equal(norm(euro(254.27)), "254,27 €");
});

test("euro mantiene i due decimali anche sui valori tondi", () => {
  assert.equal(norm(euro(1000)), "1.000,00 €");
});

test("percentuale prende un numero gia' in percentuale", () => {
  assert.equal(percentuale(25.81), "25,81%");
  assert.equal(percentuale(0), "0,00%");
});

test("aliquota prende una frazione e la porta a percentuale", () => {
  assert.equal(aliquota(0.0919), "9,19%");
  assert.equal(aliquota(0.0584), "5,84%");
  assert.equal(aliquota(0.008), "0,80%");
  assert.equal(aliquota(0.23), "23,00%");
});

test("numero formatta gli interi con il separatore delle migliaia", () => {
  assert.equal(numero(23000), "23.000");
  assert.equal(numero(85000), "85.000");
  assert.equal(numero(0), "0");
});

test("i formattatori restituiscono un trattino sui valori non finiti", () => {
  for (const f of [euro, percentuale, aliquota, numero]) {
    assert.equal(f(NaN), "—");
    assert.equal(f(Infinity), "—");
    assert.equal(f(undefined), "—");
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/formato.test.mjs`

Expected: FAIL with `Cannot find module ... src/ui/formato.js`.

- [ ] **Step 3: Write the implementation**

Create `src/ui/formato.js`:

```js
/**
 * Formattazione dei valori per la lettura umana, in italiano.
 *
 * Nessuna conoscenza fiscale qui dentro: queste funzioni sanno formattare
 * numeri, non sanno cosa quei numeri rappresentino.
 */

const VALUTA = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DECIMALE = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const INTERO = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 });

/** Importo in euro: 25967.21 -> "25.967,21 €" */
export function euro(valore) {
  if (!Number.isFinite(valore)) return "—";
  return VALUTA.format(valore);
}

/** Percentuale gia' espressa in punti: 25.81 -> "25,81%" */
export function percentuale(valore) {
  if (!Number.isFinite(valore)) return "—";
  return `${DECIMALE.format(valore)}%`;
}

/** Aliquota espressa come frazione: 0.0919 -> "9,19%" */
export function aliquota(frazione) {
  if (!Number.isFinite(frazione)) return "—";
  return percentuale(frazione * 100);
}

/** Intero con separatore delle migliaia: 23000 -> "23.000" */
export function numero(valore) {
  if (!Number.isFinite(valore)) return "—";
  return INTERO.format(valore);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/formato.test.mjs`

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ui/formato.js test/formato.test.mjs
git commit -m "Add it-IT value formatters

Four pure functions, no DOM and no fiscal knowledge. euro and numero
wrap Intl.NumberFormat; percentuale takes points and aliquota takes a
fraction, because the engine returns both shapes and conflating them
is an easy factor-of-100 bug.

Non-finite input returns an em dash rather than NaN, which is what the
zero-income case needs for the effective rate."
```

---

## Task 3: `render.js` — profile picker and dynamic fields

The fields must be generated from `profilo.input`. Adding a profile with different inputs must not require touching the UI — that is `SPEC.md` §5.1 and acceptance criterion 2.

Four field types are declared in `profili.json`: `valuta`, `scelta`, `scelta-da-parametro` (options live in `regole.parametri[x].opzioni`), `scelta-da-imposta` (options live in `regole.imposte[x].opzioni`). Reading an options list out of a data file is not knowing a rule: the UI never learns what a coefficient *means*.

**A decision the implementer must not reverse:** bounds from `campo.min` / `campo.max` are rendered as a hint and as `data-` attributes, **not** as validating `min`/`max` attributes, and the form carries `novalidate`. Reason: the forfettario field declares `max: 85000`, but design doc §5 requires that exceeding the threshold produce a *warning with the calculation shown*, not a blocked submit. Native validation would block it.

**Files:**
- Create: `src/ui/render.js`
- Test: `test/render-campi.test.mjs`

**Interfaces:**
- Consumes: `euro`, `numero` from `src/ui/formato.js`.
- Produces:
  - `renderSceltaProfilo(profili: object, attivo: string) => string` — `profili` is the parsed `profili.json` (the whole object, with its `.profili` array).
  - `renderCampi(profilo: object, regole: object) => string` — `profilo` is one entry of `profili.profili`; `regole` is the parsed `regole-fiscali-2026.json`.
  - Internal only, not exported: `esc(testo) => string`.

- [ ] **Step 1: Write the failing test**

Create `test/render-campi.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderSceltaProfilo, renderCampi } from "../src/ui/render.js";

const leggi = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const regole = leggi("../data/regole-fiscali-2026.json");
const profili = leggi("../data/profili.json");

const profilo = (id) => profili.profili.find((p) => p.id === id);

test("la scelta del profilo e' un fieldset di radio nativi", () => {
  const html = renderSceltaProfilo(profili, "dipendente-indeterminato");

  assert.match(html, /<fieldset/);
  assert.match(html, /<legend>/);
  assert.equal((html.match(/type="radio"/g) ?? []).length, 3);
  assert.match(html, /value="dipendente-indeterminato"[^>]* checked/);
  assert.match(html, /value="apprendista"/);
  assert.match(html, /value="forfettario"/);
});

test("la scelta del profilo marca come selezionato solo il profilo attivo", () => {
  const html = renderSceltaProfilo(profili, "forfettario");
  assert.equal((html.match(/ checked/g) ?? []).length, 1);
  assert.match(html, /value="forfettario"[^>]* checked/);
});

test("i campi del dipendente escono da profili.json, non dall'HTML", () => {
  const html = renderCampi(profilo("dipendente-indeterminato"), regole);

  assert.match(html, /name="lordoAnnuo"/);
  assert.match(html, /name="mensilita"/);
  assert.match(html, /RAL \(Retribuzione Annua Lorda\)/);
  // mensilita' e' una scelta fra 12, 13, 14 con 13 predefinito
  assert.match(html, /<option value="13" selected>13<\/option>/);
  assert.match(html, /<option value="12">12<\/option>/);
  assert.match(html, /<option value="14">14<\/option>/);
});

test("il campo valuta non porta attributi di validazione bloccanti", () => {
  // La soglia del forfettario deve poter essere superata: l'avviso lo da' il motore.
  const html = renderCampi(profilo("forfettario"), regole);
  const campo = html.match(/<input[^>]*name="lordoAnnuo"[^>]*>/)[0];

  assert.doesNotMatch(campo, / max=/);
  assert.match(campo, /data-max="85000"/);
  assert.match(campo, /type="number"/);
});

test("scelta-da-parametro legge le opzioni da regole.parametri", () => {
  const html = renderCampi(profilo("forfettario"), regole);

  assert.match(html, /name="coefficiente"/);
  assert.match(html, /value="professionale-78"[^>]* selected/);
  assert.match(html, /Attivita' professionali \/ intellettuali/);
  assert.match(html, /value="commercio-40"/);
  assert.match(html, /value="intermediari-62"/);
});

test("scelta-da-imposta legge le opzioni da regole.imposte", () => {
  const html = renderCampi(profilo("forfettario"), regole);

  assert.match(html, /name="aliquotaSostitutiva"/);
  assert.match(html, /value="ordinaria"[^>]* selected/);
  assert.match(html, /value="startup"/);
  assert.match(html, /Nuova attivita' - primi 5 anni \(5%\)/);
});

test("ogni campo ha un'etichetta collegata e un contenitore per l'errore", () => {
  const html = renderCampi(profilo("dipendente-indeterminato"), regole);

  assert.match(html, /<label for="campo-lordoAnnuo">/);
  assert.match(html, /id="campo-lordoAnnuo"/);
  assert.match(html, /aria-describedby="campo-lordoAnnuo-errore"/);
  assert.match(html, /id="campo-lordoAnnuo-errore"[^>]* hidden/);
});

test("un tipo di campo non gestito e' un errore rumoroso, non un campo muto", () => {
  const finto = { id: "x", nome: "x", input: [{ id: "y", etichetta: "Y", tipo: "inventato" }] };
  assert.throws(() => renderCampi(finto, regole), /tipo di campo non gestito/i);
});

test("il testo proveniente dai dati viene messo in escape", () => {
  const finto = {
    id: "x",
    nome: "x",
    input: [{ id: "y", etichetta: '<img src=x onerror="alert(1)">', tipo: "valuta", min: 0, max: 1, predefinito: 0 }],
  };
  const html = renderCampi(finto, regole);

  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/render-campi.test.mjs`

Expected: FAIL with `Cannot find module ... src/ui/render.js`.

- [ ] **Step 3: Write the implementation**

Create `src/ui/render.js`:

```js
/**
 * Dal risultato del motore all'HTML.
 *
 * Ogni funzione qui dentro e' pura: riceve dati, restituisce una stringa.
 * Nessuna fetch, nessuno stato, nessun accesso al DOM — e' cio' che rende
 * questo modulo testabile con `node --test` senza dipendenze.
 *
 * Nessuna aliquota, soglia o formula e' scritta qui: se un numero fiscale
 * serve a schermo, arriva dal risultato del motore o dai file JSON.
 */

import { euro, percentuale, aliquota, numero } from "./formato.js";

/** Escape del testo che proviene dai file dati (i campi note e riferimentoNormativo sono liberi). */
function esc(testo) {
  return String(testo ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ---------------------------------------------------------------- profilo */

export function renderSceltaProfilo(profili, attivo) {
  const voci = profili.profili
    .map(
      (p) => `
      <label class="profilo">
        <input type="radio" name="profilo" value="${esc(p.id)}"${p.id === attivo ? " checked" : ""}>
        <span class="profilo__nome">${esc(p.nome)}</span>
        <span class="profilo__descrizione">${esc(p.descrizione)}</span>
      </label>`
    )
    .join("");

  return `<fieldset class="profili">
    <legend>Profilo</legend>
    ${voci}
  </fieldset>`;
}

/* ----------------------------------------------------------------- campi */

export function renderCampi(profilo, regole) {
  return profilo.input.map((campo) => renderCampo(campo, regole)).join("");
}

function renderCampo(campo, regole) {
  const id = `campo-${esc(campo.id)}`;
  return `<div class="campo" data-campo="${esc(campo.id)}">
    <label for="${id}">${esc(campo.etichetta)}</label>
    ${controllo(campo, regole, id)}
    ${suggerimento(campo)}
    <p class="campo__errore" id="${id}-errore" role="alert" hidden></p>
  </div>`;
}

function suggerimento(campo) {
  if (campo.tipo !== "valuta") return "";
  return `<p class="campo__aiuto">Da ${numero(campo.min)} a ${numero(campo.max)} €</p>`;
}

function controllo(campo, regole, id) {
  switch (campo.tipo) {
    case "valuta":
      // min/max vanno in data-*, non negli attributi nativi: il forfettario deve
      // poter superare la soglia e ricevere un avviso, non un submit bloccato.
      return `<input type="number" id="${id}" name="${esc(campo.id)}"
        inputmode="decimal" step="100"
        data-min="${esc(campo.min)}" data-max="${esc(campo.max)}"
        value="${esc(campo.predefinito)}"
        aria-describedby="${id}-errore">`;

    case "scelta":
      return select(
        id,
        campo,
        campo.opzioni.map((o) => ({ valore: o, etichetta: String(o) })),
        campo.predefinito
      );

    case "scelta-da-parametro": {
      const parametro = regole.parametri[campo.parametro];
      return select(id, campo, opzioniDaNodo(parametro.opzioni), parametro.predefinita);
    }

    case "scelta-da-imposta": {
      const imposta = regole.imposte[campo.imposta];
      return select(id, campo, opzioniDaNodo(imposta.opzioni), imposta.predefinita);
    }

    default:
      throw new Error(`Tipo di campo non gestito: ${campo.tipo}`);
  }
}

function opzioniDaNodo(opzioni) {
  return Object.entries(opzioni).map(([valore, o]) => ({ valore, etichetta: o.etichetta }));
}

function select(id, campo, opzioni, predefinito) {
  const voci = opzioni
    .map(
      (o) =>
        `<option value="${esc(o.valore)}"${
          String(o.valore) === String(predefinito) ? " selected" : ""
        }>${esc(o.etichetta)}</option>`
    )
    .join("");

  return `<select id="${id}" name="${esc(campo.id)}" aria-describedby="${id}-errore">${voci}</select>`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/render-campi.test.mjs`

Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ui/render.js test/render-campi.test.mjs
git commit -m "Generate the profile picker and input fields from the data files

Fields come from profilo.input, options for the two indirect types come
from regole.parametri and regole.imposte. Adding a profile with new
inputs needs no UI change, which is the point of SPEC.md section 5.1.

Bounds render as data attributes and a hint, not as validating min/max:
the forfettario threshold must be crossable so the engine can warn while
still showing the calculation."
```

---

## Task 4: `render.js` — the deduction chain

This is the heart of the design: a ledger, not a list. Labels left, figures right on one shared decimal axis; intermediate results are subtotals with a rule above, not list items; deductions carry `−` and detrazioni carry `+` in the same column so the arithmetic reads down the page.

Two chain shapes: `voci.irpefLorda` present → employee; `voci.impostaSostitutiva` present → flat-rate. Totals and headline are identical for both (`SPEC.md` §4.5).

**Files:**
- Modify: `src/ui/render.js` (append)
- Test: `test/render-catena.test.mjs`

**Interfaces:**
- Consumes: `esc` and the formatters already in the module; `renderScaglioni` is called here but implemented in Task 5 — add the temporary stub shown in Step 3 and replace it there.
- Produces:
  - `renderRisultato(esito: object) => string` where `esito` is the return of `calcola()`.

- [ ] **Step 1: Write the failing test**

Create `test/render-catena.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calcola } from "../src/motore/index.js";
import { renderRisultato } from "../src/ui/render.js";

const leggi = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const regole = leggi("../data/regole-fiscali-2026.json");
const profili = leggi("../data/profili.json");
const fonti = leggi("../data/fonti.json");

const esegui = (profiloId, input) => calcola({ profiloId, input, regole, profili, fonti });
const norm = (s) => s.replace(/ | /g, " ");

const dipendente = () => esegui("dipendente-indeterminato", { lordoAnnuo: 35000, mensilita: 13 });
const sottoSoglia = () => esegui("dipendente-indeterminato", { lordoAnnuo: 22000, mensilita: 13 });
const forfettario = (lordo) =>
  esegui("forfettario", {
    lordoAnnuo: lordo,
    coefficiente: "professionale-78",
    aliquotaSostitutiva: "ordinaria",
  });

test("i numeri di testa sono il netto annuo e il netto mensile", () => {
  const html = norm(renderRisultato(dipendente()));

  assert.match(html, /25\.967,21 €/);
  assert.match(html, /1\.997,48 €/);
  assert.match(html, /25,81%/);
});

test("il risultato e' una regione annunciata agli screen reader", () => {
  const html = renderRisultato(dipendente());
  assert.match(html, /aria-live="polite"/);
});

test("la catena e' una tabella con intestazioni di riga vere", () => {
  const html = renderRisultato(dipendente());

  assert.match(html, /<table[^>]*class="[^"]*catena/);
  assert.match(html, /<th scope="row">/);
});

test("ogni voce trattenuta compare con il suo importo", () => {
  const html = norm(renderRisultato(dipendente()));

  assert.match(html, /3\.216,50 €/); // contributi INPS
  assert.match(html, /31\.783,50 €/); // imponibile fiscale
  assert.match(html, /7\.688,56 €/); // IRPEF lorda
  assert.match(html, /1\.581,52 €/); // detrazione art. 13
  assert.match(html, /1\.000,00 €/); // cuneo
  assert.match(html, /5\.107,04 €/); // IRPEF netta
  assert.match(html, /454,98 €/); // addizionale regionale
  assert.match(html, /254,27 €/); // addizionale comunale
  assert.match(html, /9\.032,79 €/); // totale trattenute
});

test("l'aliquota contributiva e' mostrata accanto alla voce", () => {
  const html = renderRisultato(dipendente());
  assert.match(html, /9,19%/);
});

test("i passaggi intermedi sono subtotali, non trattenute", () => {
  const html = renderRisultato(dipendente());

  assert.match(html, /riga--subtotale[^>]*>\s*<th scope="row">Imponibile fiscale/);
  assert.match(html, /riga--subtotale[^>]*>\s*<th scope="row">IRPEF netta/);
});

test("le detrazioni portano il segno opposto alle trattenute", () => {
  const html = norm(renderRisultato(dipendente()));

  assert.match(html, /\+ 1\.581,52 €/);
  assert.match(html, /− 3\.216,50 €/);
});

test("l'addizionale comunale esente si spiega, non mostra uno zero nudo", () => {
  const html = norm(renderRisultato(sottoSoglia()));

  assert.match(html, /esente/i);
  assert.match(html, /23\.000/);
  assert.doesNotMatch(html, /− 0,00 €/);
});

test("la soglia dell'esenzione arriva dal risultato, non e' scritta nel template", () => {
  // Se fosse hardcoded, cambiare il JSON non cambierebbe la pagina.
  const modificate = JSON.parse(JSON.stringify(regole));
  modificate.imposte["addizionale-comunale-milano"].sogliaEsenzione = 19000;
  const html = norm(
    renderRisultato(
      calcola({
        profiloId: "dipendente-indeterminato",
        input: { lordoAnnuo: 20000, mensilita: 13 },
        regole: modificate,
        profili,
        fonti,
      })
    )
  );

  assert.match(html, /19\.000/);
});

test("la catena del forfettario mostra le sue voci specifiche", () => {
  const html = norm(renderRisultato(forfettario(40000)));

  assert.match(html, /31\.200,00 €/); // reddito forfettario
  assert.match(html, /8\.133,84 €/); // contributi gestione separata
  assert.match(html, /23\.066,16 €/); // imponibile imposta
  assert.match(html, /3\.459,92 €/); // imposta sostitutiva
  assert.match(html, /28\.406,24 €/); // netto annuo
  assert.match(html, /78,00%/); // coefficiente
});

test("il forfettario non mostra voci da dipendente", () => {
  const html = renderRisultato(forfettario(40000));

  assert.doesNotMatch(html, /IRPEF/);
  assert.doesNotMatch(html, /Addizionale/i);
});

test("oltre soglia il forfettario avvisa ma mostra il calcolo", () => {
  const html = norm(renderRisultato(forfettario(90000)));

  assert.match(html, /85\.000/);
  assert.match(html, /non sarebbe applicabile/i);
  assert.match(html, /role="status"/);
});

test("sotto soglia il forfettario non mostra alcun avviso", () => {
  const html = renderRisultato(forfettario(40000));
  assert.doesNotMatch(html, /non sarebbe applicabile/i);
});

test("con lordo a zero l'aliquota media e' un trattino, non 0,00%", () => {
  const html = renderRisultato(esegui("dipendente-indeterminato", { lordoAnnuo: 0, mensilita: 13 }));

  assert.match(html, /—/);
  assert.doesNotMatch(html, /0,00%/);
});

test("con lordo a zero non si disegna la striscia di proporzione", () => {
  const html = renderRisultato(esegui("dipendente-indeterminato", { lordoAnnuo: 0, mensilita: 13 }));
  assert.doesNotMatch(html, /class="striscia"/);
});

test("la striscia di proporzione somma al 100 per cento", () => {
  const html = renderRisultato(dipendente());
  const larghezze = [...html.matchAll(/--quota:\s*([\d.]+)%/g)].map((m) => Number(m[1]));

  assert.equal(larghezze.length, 3);
  assert.ok(Math.abs(larghezze.reduce((a, b) => a + b, 0) - 100) < 0.01);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/render-catena.test.mjs`

Expected: FAIL with `renderRisultato is not a function` (the export does not exist yet).

- [ ] **Step 3: Write the implementation**

Append to `src/ui/render.js`:

```js
/* ------------------------------------------------------------- risultato */

export function renderRisultato(esito) {
  return `<section class="risultato" aria-live="polite">
    ${renderTesta(esito)}
    ${renderStriscia(esito)}
    ${avvisoSoglia(esito)}
    ${renderCatena(esito)}
  </section>`;
}

function renderTesta(esito) {
  const r = esito.risultato;
  const media = r.lordoAnnuo > 0 ? percentuale(r.aliquotaMediaEffettiva) : "—";

  return `<div class="testa">
    <p class="testa__voce">
      <span class="testa__etichetta">Netto annuo</span>
      <strong class="testa__cifra">${euro(r.nettoAnnuo)}</strong>
    </p>
    <p class="testa__voce">
      <span class="testa__etichetta">Netto mensile <small>su ${esc(r.mensilita)} mensilità</small></span>
      <strong class="testa__cifra">${euro(r.nettoMensile)}</strong>
    </p>
    <p class="testa__media">Aliquota media effettiva ${media}</p>
  </div>`;
}

function renderStriscia(esito) {
  const r = esito.risultato;
  if (!(r.lordoAnnuo > 0)) return "";

  const quota = (valore) => ((valore / r.lordoAnnuo) * 100).toFixed(2);
  const segmenti = [
    { classe: "striscia__netto", etichetta: "Netto", valore: r.nettoAnnuo },
    { classe: "striscia__contributi", etichetta: "Contributi", valore: r.totaleContributi },
    { classe: "striscia__imposte", etichetta: "Imposte", valore: r.totaleImposte },
  ];

  const barre = segmenti
    .map(
      (s) =>
        `<span class="striscia__segmento ${s.classe}" style="--quota: ${quota(s.valore)}%"
           title="${esc(s.etichetta)}: ${euro(s.valore)}"></span>`
    )
    .join("");

  const legenda = segmenti
    .map(
      (s) =>
        `<li class="striscia__voce"><span class="striscia__pallino ${s.classe}"></span>
          ${esc(s.etichetta)} ${euro(s.valore)} <span class="striscia__quota">(${percentuale(
          Number(quota(s.valore))
        )})</span></li>`
    )
    .join("");

  return `<div class="striscia-blocco">
    <div class="striscia" role="img" aria-label="Composizione del lordo: ${segmenti
      .map((s) => `${esc(s.etichetta)} ${euro(s.valore)}`)
      .join(", ")}">${barre}</div>
    <ul class="striscia__legenda">${legenda}</ul>
  </div>`;
}

function avvisoSoglia(esito) {
  const supera = esito.voci.supera;
  if (!supera || !supera.superata) return "";

  return `<p class="avviso" role="status">
    I compensi superano la soglia di ${euro(supera.sogliaRicavi)}:
    il regime forfettario non sarebbe applicabile.
    Il calcolo è mostrato comunque, come riferimento.
  </p>`;
}

/* ---------------------------------------------------------------- catena */

function renderCatena(esito) {
  const righe = esito.voci.irpefLorda ? righeDipendente(esito) : righeForfettario(esito);

  return `<table class="catena">
    <caption>Dal lordo al netto, voce per voce</caption>
    <tbody>${righe.join("")}</tbody>
  </table>`;
}

function riga({ etichetta, importo, segno = "", classe = "", nota = "", dettaglio = "" }) {
  return `<tr class="riga ${classe}">
    <th scope="row">${esc(etichetta)}${
    nota ? `<span class="riga__nota">${esc(nota)}</span>` : ""
  }${dettaglio}</th>
    <td class="riga__importo">${segno}${euro(importo)}</td>
  </tr>`;
}

function righeDipendente(esito) {
  const v = esito.voci;
  const r = esito.risultato;
  const righe = [];

  righe.push(riga({ etichetta: "Retribuzione annua lorda", importo: r.lordoAnnuo, classe: "riga--lordo" }));

  righe.push(
    riga({
      etichetta: `${v.contributi.etichetta} (${aliquota(v.contributi.aliquota)})`,
      importo: v.contributi.importo,
      segno: "− ",
      classe: "riga--trattenuta",
    })
  );

  righe.push(riga({ etichetta: "Imponibile fiscale", importo: v.imponibileFiscale, classe: "riga--subtotale" }));

  righe.push(
    riga({
      etichetta: v.irpefLorda.etichetta,
      importo: v.irpefLorda.importo,
      segno: "− ",
      classe: "riga--trattenuta",
      dettaglio: renderScaglioni(v.irpefLorda.dettaglioScaglioni),
    })
  );

  // Le detrazioni sono uno sconto sull'IRPEF lorda: segno opposto, un livello di rientro.
  for (const d of v.detrazioni) {
    righe.push(
      riga({
        etichetta: d.etichetta,
        importo: d.importo,
        segno: "+ ",
        classe: "riga--credito riga--rientro",
      })
    );
  }

  righe.push(riga({ etichetta: "IRPEF netta", importo: v.irpefNetta, classe: "riga--subtotale" }));

  for (const a of v.addizionali) {
    righe.push(
      riga({
        etichetta: a.etichetta,
        importo: a.importo,
        segno: a.esente ? "" : "− ",
        classe: a.esente ? "riga--esente" : "riga--trattenuta",
        nota: a.esente
          ? `esente — imponibile sotto la soglia di ${euro(a.sogliaEsenzione)}`
          : "",
        dettaglio: a.dettaglio ? renderScaglioni(a.dettaglio) : "",
      })
    );
  }

  righe.push(
    riga({ etichetta: "Totale trattenute", importo: r.totaleTrattenute, segno: "− ", classe: "riga--subtotale" })
  );
  righe.push(riga({ etichetta: "Netto annuo", importo: r.nettoAnnuo, classe: "riga--totale" }));

  return righe;
}

function righeForfettario(esito) {
  const v = esito.voci;
  const r = esito.risultato;
  const righe = [];

  righe.push(riga({ etichetta: "Compensi annui lordi", importo: r.lordoAnnuo, classe: "riga--lordo" }));

  righe.push(
    riga({
      etichetta: `${v.coefficienteRedditivita.etichetta} — coefficiente ${aliquota(
        v.coefficienteRedditivita.coefficiente
      )}`,
      importo: v.coefficienteRedditivita.quotaEsclusa,
      segno: "− ",
      classe: "riga--trattenuta",
      nota: "quota di compensi esclusa forfettariamente dal reddito imponibile",
    })
  );

  righe.push(
    riga({
      etichetta: "Reddito forfettario",
      importo: v.coefficienteRedditivita.redditoForfettario,
      classe: "riga--subtotale",
    })
  );

  righe.push(
    riga({
      etichetta: `${v.contributi.etichetta} (${aliquota(v.contributi.aliquota)})`,
      importo: v.contributi.importo,
      segno: "− ",
      classe: "riga--trattenuta",
    })
  );

  righe.push(riga({ etichetta: "Imponibile dell'imposta", importo: v.imponibileImposta, classe: "riga--subtotale" }));

  righe.push(
    riga({
      etichetta: v.impostaSostitutiva.etichetta,
      importo: v.impostaSostitutiva.importo,
      segno: "− ",
      classe: "riga--trattenuta",
    })
  );

  righe.push(
    riga({ etichetta: "Totale trattenute", importo: r.totaleTrattenute, segno: "− ", classe: "riga--subtotale" })
  );
  righe.push(riga({ etichetta: "Netto annuo", importo: r.nettoAnnuo, classe: "riga--totale" }));

  return righe;
}

// Sostituita dall'implementazione reale nel Task 5.
function renderScaglioni() {
  return "";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/render-catena.test.mjs`

Expected: PASS, 15 tests.

If "il forfettario non mostra voci da dipendente" fails, check that the `sostituisce` array from the tax rule is not being rendered — it contains the strings `irpef-nazionale` and `addizionale-regionale-lombardia`.

- [ ] **Step 5: Commit**

```bash
git add src/ui/render.js test/render-catena.test.mjs
git commit -m "Render the deduction chain as a ledger

One table, labels left and figures right on a shared decimal axis.
Intermediate results (taxable base, net IRPEF) are subtotals rather than
list items, because they are not deductions and must not read as such.
Deductions carry a minus and detrazioni a plus in the same column so the
arithmetic can be followed down the page.

The municipal exemption renders as an explained zero with its threshold
read from the result, never as a bare 0,00 — the discontinuity at the
threshold is the thing most worth showing correctly.

Above the forfettario threshold the page warns and still shows the
calculation, which is what the engine's supera flag is for."
```

---

## Task 5: `render.js` — brackets, sources, simplifications, errors

Everything that makes the numbers checkable rather than asserted: the per-bracket breakdown (so progressivity is visible), the source badges with their reliability and verification date, the declared simplifications, and the error states.

**Files:**
- Modify: `src/ui/render.js` (replace the `renderScaglioni` stub, append the rest)
- Test: `test/render-dettagli.test.mjs`

**Interfaces:**
- Consumes: `esc`, formatters, all already in the module.
- Produces:
  - `renderScaglioni(dettaglio: Array) => string` — replaces the Task 4 stub; exported.
  - `renderFonti(meta: object) => string` — `meta` is `esito.meta`.
  - `renderSemplificazioni(profilo: object) => string` — `profilo` is `esito.profilo`.
  - `renderErrore(tipo: "protocollo"|"risorsa"|"generico", dettaglio?: object) => string`.

- [ ] **Step 1: Write the failing test**

Create `test/render-dettagli.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calcola } from "../src/motore/index.js";
import { renderScaglioni, renderFonti, renderSemplificazioni, renderErrore } from "../src/ui/render.js";

const leggi = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const regole = leggi("../data/regole-fiscali-2026.json");
const profili = leggi("../data/profili.json");
const fonti = leggi("../data/fonti.json");

const esito = calcola({
  profiloId: "dipendente-indeterminato",
  input: { lordoAnnuo: 35000, mensilita: 13 },
  regole,
  profili,
  fonti,
});
const norm = (s) => s.replace(/ | /g, " ");

test("il dettaglio degli scaglioni e' consultabile da tastiera senza JavaScript", () => {
  const html = renderScaglioni(esito.voci.irpefLorda.dettaglioScaglioni);

  assert.match(html, /<details/);
  assert.match(html, /<summary>/);
});

test("il dettaglio mostra quanto reddito e' tassato a ciascuna aliquota", () => {
  const html = norm(renderScaglioni(esito.voci.irpefLorda.dettaglioScaglioni));

  assert.match(html, /23,00%/);
  assert.match(html, /33,00%/);
  assert.match(html, /fino a 28\.000/);
  assert.match(html, /28\.000 a 50\.000/);
});

test("il dettaglio ha intestazioni di colonna vere", () => {
  const html = renderScaglioni(esito.voci.irpefLorda.dettaglioScaglioni);
  assert.equal((html.match(/<th scope="col">/g) ?? []).length, 4);
});

test("un dettaglio vuoto non produce un accordion vuoto", () => {
  assert.equal(renderScaglioni([]), "");
  assert.equal(renderScaglioni(undefined), "");
});

test("ogni fonte mostra ente, riferimento normativo e data di verifica", () => {
  const html = renderFonti(esito.meta);

  assert.match(html, /Ministero del Lavoro/);
  assert.match(html, /2026-09-11/);
  assert.match(html, /TUIR/);
  assert.match(html, /href="https:\/\//);
});

test("le fonti secondarie sono distinguibili non solo per colore", () => {
  const html = renderFonti(esito.meta);

  assert.match(html, /fonte secondaria/i);
  assert.match(html, /fonte primaria/i);
});

test("una fonte scaduta diventa un avviso attivo", () => {
  const scaduto = JSON.parse(JSON.stringify(esito.meta));
  scaduto.fontiUtilizzate[0].daRiverificare = true;
  scaduto.fontiUtilizzate[0].giorniDallaVerifica = 500;

  const html = renderFonti(scaduto);

  assert.match(html, /role="status"/);
  assert.match(html, /500/);
});

test("senza fonti scadute non compare alcun avviso", () => {
  const html = renderFonti(esito.meta);
  assert.doesNotMatch(html, /role="status"/);
});

test("una fonte non risolta si degrada, non manda in errore", () => {
  const rotto = { ...esito.meta, fontiUtilizzate: [{ id: "inventata", mancante: true }] };
  const html = renderFonti(rotto);

  assert.match(html, /non trovata/i);
  assert.match(html, /inventata/);
});

test("l'anno d'imposta e l'ambito territoriale sono dichiarati", () => {
  const html = renderFonti(esito.meta);

  assert.match(html, /2026/);
  assert.match(html, /Milano \(Lombardia\)/);
});

test("le semplificazioni del profilo sono in pagina", () => {
  const html = renderSemplificazioni(esito.profilo);

  assert.match(html, /Nessun carico familiare/);
  assert.match(html, /TFR/);
  assert.equal((html.match(/<li>/g) ?? []).length, esito.profilo.semplificazioni.length);
});

test("l'errore di protocollo spiega che serve un server locale", () => {
  const html = renderErrore("protocollo");

  assert.match(html, /python3 -m http\.server 8000/);
  assert.match(html, /file:\/\//);
  assert.match(html, /role="alert"/);
  assert.doesNotMatch(html, /^Errore$/m);
});

test("l'errore di risorsa nomina il file mancante e il codice HTTP", () => {
  const html = renderErrore("risorsa", { file: "data/profili.json", stato: 404 });

  assert.match(html, /data\/profili\.json/);
  assert.match(html, /404/);
});

test("l'errore generico riporta il messaggio senza inventare una causa", () => {
  const html = renderErrore("generico", { messaggio: "Unexpected token < in JSON" });
  assert.match(html, /Unexpected token &lt; in JSON/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/render-dettagli.test.mjs`

Expected: FAIL — `renderFonti is not a function`, and the brackets tests fail because the Task 4 stub returns `""`.

- [ ] **Step 3: Write the implementation**

In `src/ui/render.js`, **delete the `renderScaglioni` stub** added at the end of Task 4 and append:

```js
/* ------------------------------------------------------------- scaglioni */

export function renderScaglioni(dettaglio) {
  if (!Array.isArray(dettaglio) || dettaglio.length === 0) return "";

  const righe = dettaglio
    .map(
      (s) => `<tr>
        <td>${esc(fasciaTestuale(s))}</td>
        <td class="cifra">${aliquota(s.aliquota)}</td>
        <td class="cifra">${euro(s.quotaTassata)}</td>
        <td class="cifra">${euro(s.imposta)}</td>
      </tr>`
    )
    .join("");

  return `<details class="scaglioni">
    <summary>Dettaglio per scaglione</summary>
    <table>
      <thead>
        <tr>
          <th scope="col">Fascia di reddito</th>
          <th scope="col">Aliquota</th>
          <th scope="col">Quota tassata</th>
          <th scope="col">Imposta</th>
        </tr>
      </thead>
      <tbody>${righe}</tbody>
    </table>
  </details>`;
}

function fasciaTestuale(scaglione) {
  if (scaglione.a === null) return `oltre ${numero(scaglione.da)} €`;
  if (scaglione.da === 0) return `fino a ${numero(scaglione.a)} €`;
  return `da ${numero(scaglione.da)} a ${numero(scaglione.a)} €`;
}

/* ----------------------------------------------------------------- fonti */

export function renderFonti(meta) {
  const scadute = meta.fontiUtilizzate.filter((f) => f.daRiverificare);

  const avviso = scadute.length
    ? `<p class="avviso" role="status">
        ${scadute.length === 1 ? "Una fonte non è verificata" : `${scadute.length} fonti non sono verificate`}
        da più di un anno: ${esc(
          scadute.map((f) => `${f.titolo} (${f.giorniDallaVerifica} giorni)`).join("; ")
        )}. I valori corrispondenti vanno ricontrollati prima di farci affidamento.
      </p>`
    : "";

  return `<section class="fonti">
    <h2>Fonti</h2>
    <p class="fonti__meta">
      Anno d'imposta ${esc(meta.annoImposta)} — ambito ${esc(meta.ambitoTerritoriale)}.
      Ultima verifica dei dati: ${esc(meta.dataUltimaVerifica)}.
    </p>
    ${avviso}
    <ul class="fonti__elenco">${meta.fontiUtilizzate.map(renderFonte).join("")}</ul>
  </section>`;
}

function renderFonte(fonte) {
  if (fonte.mancante) {
    return `<li class="fonte fonte--mancante">Fonte non trovata nel registro: ${esc(fonte.id)}</li>`;
  }

  const secondaria = fonte.affidabilita === "secondaria";
  const badge = secondaria
    ? "◆ fonte secondaria — da riverificare prima di un uso reale"
    : "● fonte primaria";

  return `<li class="fonte${secondaria ? " fonte--secondaria" : ""}${
    fonte.daRiverificare ? " fonte--scaduta" : ""
  }">
    <a class="fonte__titolo" href="${esc(fonte.url)}" target="_blank" rel="noopener noreferrer">${esc(
    fonte.titolo
  )}</a>
    <span class="fonte__ente">${esc(fonte.ente)}</span>
    <span class="fonte__norma">${esc(fonte.riferimentoNormativo)}</span>
    <span class="fonte__badge">${badge} — verificata il ${esc(fonte.dataVerifica)}, scade il ${esc(
    fonte.dataScadenzaVerifica
  )}${fonte.daRiverificare ? " (scaduta)" : ""}</span>
    ${fonte.note ? `<span class="fonte__note">${esc(fonte.note)}</span>` : ""}
  </li>`;
}

/* -------------------------------------------------------- semplificazioni */

export function renderSemplificazioni(profilo) {
  return `<section class="semplificazioni">
    <h2>Che cosa questo calcolo non considera</h2>
    <p>${esc(profilo.descrizione)}</p>
    <ul>${profilo.semplificazioni.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
  </section>`;
}

/* ---------------------------------------------------------------- errori */

export function renderErrore(tipo, dettaglio = {}) {
  if (tipo === "protocollo") {
    return `<section class="errore" role="alert">
      <h2>Non riesco a caricare i dati fiscali</h2>
      <p>
        La pagina legge le regole fiscali da file JSON con <code>fetch()</code>,
        che il browser blocca quando la pagina è aperta direttamente da disco
        (indirizzo <code>file://</code>).
      </p>
      <p>Avvia un server locale nella cartella del progetto:</p>
      <pre><code>python3 -m http.server 8000</code></pre>
      <p>Poi apri <code>http://localhost:8000</code>.</p>
    </section>`;
  }

  if (tipo === "risorsa") {
    return `<section class="errore" role="alert">
      <h2>Dati fiscali non raggiungibili</h2>
      <p>
        Il file <code>${esc(dettaglio.file ?? "sconosciuto")}</code> ha risposto
        con HTTP ${esc(dettaglio.stato ?? "?")}. Controlla che la cartella
        <code>data/</code> sia stata pubblicata e che i percorsi in
        <code>app.js</code> siano relativi, non assoluti.
      </p>
    </section>`;
  }

  return `<section class="errore" role="alert">
    <h2>Errore imprevisto</h2>
    <p>${esc(dettaglio.messaggio ?? "Nessun dettaglio disponibile.")}</p>
  </section>`;
}
```

- [ ] **Step 4: Run the whole suite to verify everything passes**

Run: `node --test test/`

Expected: PASS, all files. The brackets assertions in `test/render-catena.test.mjs` now exercise the real implementation rather than the stub, so a regression there would show up here.

- [ ] **Step 5: Commit**

```bash
git add src/ui/render.js test/render-dettagli.test.mjs
git commit -m "Render brackets detail, sources, simplifications and error states

The per-bracket table is what makes progressivity visible: it shows how
much income was taxed at each rate, against the common belief that the
top rate applies to the whole income. It uses details/summary so it
works from the keyboard with no JavaScript.

Source badges carry reliability as a glyph plus words, never colour
alone, and an expired verification becomes an active warning with the
day count. An unresolved source degrades to a message instead of
throwing on undefined.

The file:// failure is the likely first-run experience, so it gets the
command to fix it rather than the word 'error'."
```

---

## Task 6: `app.js` and `index.html` — wiring

The only impure module. Loads the three JSON files with relative paths, holds `{profiloId, valori}`, wires the profile radios and the submit, calls `calcola()`, mounts the strings from `render.js`.

Validation rule, from design doc §5: reject empty and non-numeric and negative. Do **not** reject above `data-max` — the forfettario threshold must be crossable so the engine can warn.

**Files:**
- Create: `src/ui/app.js`
- Create: `index.html`

**Interfaces:**
- Consumes: `calcola` from `../motore/index.js`; `renderSceltaProfilo`, `renderCampi`, `renderRisultato`, `renderSemplificazioni`, `renderFonti`, `renderErrore` from `./render.js`.
- Produces: a working page. No exports.

- [ ] **Step 1: Write `index.html`**

```html
<!doctype html>
<html lang="it">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Dalla RAL al netto — calcolatore 2026</title>
    <meta name="description" content="Calcolatore da retribuzione lorda a netto, anno d'imposta 2026, ambito Milano (Lombardia). Ogni trattenuta è mostrata con la sua fonte.">
    <link rel="stylesheet" href="stile/main.css">
  </head>
  <body>
    <header class="intestazione">
      <h1>Dalla RAL al netto</h1>
      <p class="intestazione__sottotitolo">
        Anno d'imposta 2026 — Milano (Lombardia).
        Ogni trattenuta è mostrata con il suo importo e la sua fonte.
      </p>
    </header>

    <main id="app">
      <p class="caricamento">Caricamento dei dati fiscali…</p>
    </main>

    <footer class="pie">
      <p>
        Prototipo a scopo dimostrativo. I valori non sostituiscono un cedolino
        né una consulenza fiscale: le semplificazioni applicate sono dichiarate
        sopra, voce per voce.
      </p>
    </footer>

    <script type="module" src="src/ui/app.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Write `app.js`**

```js
/**
 * Orchestrazione della pagina.
 *
 * E' l'unico modulo impuro del livello UI: carica i dati, tiene lo stato,
 * ascolta gli eventi e monta l'HTML prodotto da render.js.
 * Non conosce nessuna regola fiscale: chiama calcola() e mostra il risultato.
 */

import { calcola } from "../motore/index.js";
import {
  renderSceltaProfilo,
  renderCampi,
  renderRisultato,
  renderSemplificazioni,
  renderFonti,
  renderErrore,
} from "./render.js";

// Percorsi relativi: su GitHub Pages il sito e' servito da /<repo>/, non dalla radice.
const PERCORSI = [
  "data/regole-fiscali-2026.json",
  "data/profili.json",
  "data/fonti.json",
];

const stato = {
  regole: null,
  profili: null,
  fonti: null,
  profiloId: null,
};

const el = {};

document.addEventListener("DOMContentLoaded", avvia);

async function avvia() {
  el.app = document.querySelector("#app");

  try {
    [stato.regole, stato.profili, stato.fonti] = await Promise.all(PERCORSI.map(carica));
  } catch (errore) {
    el.app.innerHTML = renderErrore(errore.tipo ?? "generico", errore.dettaglio ?? {
      messaggio: errore.message,
    });
    return;
  }

  const predefinito =
    stato.profili.profili.find((p) => p.predefinito) ?? stato.profili.profili[0];
  stato.profiloId = predefinito.id;

  montaForm();
}

async function carica(percorso) {
  if (location.protocol === "file:") {
    throw Object.assign(new Error("fetch bloccata dal protocollo file"), { tipo: "protocollo" });
  }

  const risposta = await fetch(percorso);
  if (!risposta.ok) {
    throw Object.assign(new Error("risorsa non raggiungibile"), {
      tipo: "risorsa",
      dettaglio: { file: percorso, stato: risposta.status },
    });
  }
  return risposta.json();
}

function montaForm() {
  el.app.innerHTML = `
    <form id="calcolo" novalidate>
      <div id="scelta-profilo"></div>
      <div id="campi" class="campi"></div>
      <button type="submit" class="calcola">Calcola</button>
    </form>
    <div id="esito"></div>`;

  el.form = document.querySelector("#calcolo");
  el.profili = document.querySelector("#scelta-profilo");
  el.campi = document.querySelector("#campi");
  el.esito = document.querySelector("#esito");

  el.profili.innerHTML = renderSceltaProfilo(stato.profili, stato.profiloId);
  montaCampi();

  el.profili.addEventListener("change", (evento) => {
    if (evento.target.name !== "profilo") return;
    stato.profiloId = evento.target.value;
    montaCampi();
    el.esito.innerHTML = "";
  });

  el.form.addEventListener("submit", (evento) => {
    evento.preventDefault();
    esegui();
  });
}

function profiloCorrente() {
  return stato.profili.profili.find((p) => p.id === stato.profiloId);
}

function montaCampi() {
  el.campi.innerHTML = renderCampi(profiloCorrente(), stato.regole);
}

function esegui() {
  const profilo = profiloCorrente();
  const valori = {};
  let primoNonValido = null;

  for (const campo of profilo.input) {
    const controllo = el.campi.querySelector(`[name="${campo.id}"]`);
    const messaggio = document.querySelector(`#campo-${campo.id}-errore`);

    if (campo.tipo !== "valuta") {
      pulisciErrore(controllo, messaggio);
      // Le mensilita' sono numeriche, le altre scelte sono chiavi testuali.
      valori[campo.id] = campo.tipo === "scelta" ? Number(controllo.value) : controllo.value;
      continue;
    }

    const grezzo = controllo.value.trim();
    const numerico = Number(grezzo.replace(",", "."));

    if (grezzo === "" || !Number.isFinite(numerico) || numerico < 0) {
      mostraErrore(
        controllo,
        messaggio,
        `Inserisci ${campo.etichetta.toLowerCase()}: un numero maggiore o uguale a zero.`
      );
      primoNonValido = primoNonValido ?? controllo;
      continue;
    }

    pulisciErrore(controllo, messaggio);
    valori[campo.id] = numerico;
  }

  if (primoNonValido) {
    primoNonValido.focus();
    return;
  }

  const esito = calcola({
    profiloId: stato.profiloId,
    input: valori,
    regole: stato.regole,
    profili: stato.profili,
    fonti: stato.fonti,
  });

  el.esito.innerHTML =
    renderRisultato(esito) + renderSemplificazioni(esito.profilo) + renderFonti(esito.meta);
}

function mostraErrore(controllo, messaggio, testo) {
  controllo.setAttribute("aria-invalid", "true");
  messaggio.textContent = testo;
  messaggio.hidden = false;
}

function pulisciErrore(controllo, messaggio) {
  controllo.removeAttribute("aria-invalid");
  if (!messaggio) return;
  messaggio.textContent = "";
  messaggio.hidden = true;
}
```

- [ ] **Step 3: Confirm the unit tests still pass**

Run: `node --test test/`

Expected: PASS. `app.js` has no unit tests — it is the impure boundary and is verified in the browser at Step 4 and again in Task 8.

- [ ] **Step 4: Verify in the browser**

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000` and confirm, with the browser console open and empty of errors:

1. The page loads with the employee profile selected and RAL prefilled at 35000.
2. Clicking **Calcola** shows **25.967,21 €** annual and **1.997,48 €** monthly.
3. Switching to **Apprendista** swaps the fields and clears the previous result; RAL 24000 gives **20.500,67 €**.
4. Switching to **Forfettario** shows three fields — compensi, tipo di attività, aliquota. 40000 / professionale-78 / ordinaria gives **28.406,24 €**.
5. Compensi at 90000 shows the threshold warning *and* the calculation.
6. RAL 22000 on the employee profile shows the municipal surcharge as exempt with its threshold, not as `− 0,00 €`.
7. Emptying the RAL field and submitting shows the inline message and moves focus to the field; no result is rendered.
8. RAL 0 renders a full chain of zeros and an em dash for the effective rate.

Then open `index.html` directly from the file manager (a `file://` URL) and confirm the local-server message with the `python3 -m http.server 8000` command appears instead of a blank page.

- [ ] **Step 5: Commit**

```bash
git add src/ui/app.js index.html
git commit -m "Wire the page: loading, state, events, mounting

app.js is the only impure module. It loads the three JSON files with
relative paths so GitHub Pages project sites resolve, holds the selected
profile, and hands results to render.js.

Validation rejects empty, non-numeric and negative input and moves focus
to the first bad field. It deliberately does not reject amounts above the
declared maximum: crossing the forfettario threshold must produce the
engine's warning with the calculation shown, not a blocked submit.

The file:// case is detected before fetch is attempted, because the
thrown TypeError there says nothing a reader could act on."
```

---

## Task 7: `stile/main.css` — the ledger

Design doc §3. Six tokens, one family, tabular figures, no boxes and no shadows: structure comes from rules and whitespace.

**Files:**
- Create: `stile/main.css`

**Interfaces:**
- Consumes: the class names emitted by `render.js` and `index.html`.
- Produces: nothing importable.

- [ ] **Step 1: Write the stylesheet**

```css
/*
 * Il soggetto e' un documento fiscale: una catena di sottrazioni verificabili.
 * La qualita' che la pagina deve avere e' la verificabilita' — ogni numero deve
 * sembrare controllabile, non asserito.
 *
 * Da qui discendono le scelte: nessun box e nessuna ombra, la struttura e' fatta
 * di filetti e spazio bianco; tutti gli importi su un unico asse decimale con
 * cifre tabulari; i subtotali separati dalle trattenute da un filetto, perche'
 * un passaggio intermedio non e' una trattenuta.
 */

:root {
  --carta: #fbfbf9;
  --inchiostro: #16181c;
  --inchiostro-tenue: #5c626b;
  --riga: #d8d6d0;
  --trattenuta: #8c2f1e;
  --credito: #1f5a3d;

  --colonna: 52rem;
  --passo: 0.75rem;

  --testo: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

@media (prefers-color-scheme: dark) {
  :root {
    --carta: #16181c;
    --inchiostro: #f2f1ee;
    --inchiostro-tenue: #9aa0a8;
    --riga: #343841;
    --trattenuta: #e2836f;
    --credito: #6fbd92;
  }
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  color-scheme: light dark;
}

body {
  margin: 0;
  padding: calc(var(--passo) * 4) var(--passo) calc(var(--passo) * 8);
  background: var(--carta);
  color: var(--inchiostro);
  font-family: var(--testo);
  font-size: 1rem;
  line-height: 1.5;
}

:where(header, main, footer) {
  max-width: var(--colonna);
  margin-inline: auto;
}

:focus-visible {
  outline: 2px solid var(--inchiostro);
  outline-offset: 2px;
}

/* --------------------------------------------------------- intestazione */

.intestazione h1 {
  margin: 0 0 calc(var(--passo) * 0.5);
  font-size: clamp(1.6rem, 4vw, 2.1rem);
  font-weight: 600;
  letter-spacing: -0.01em;
}

.intestazione__sottotitolo {
  margin: 0 0 calc(var(--passo) * 3);
  color: var(--inchiostro-tenue);
  max-width: 46ch;
}

/* ---------------------------------------------------------------- form */

.profili {
  border: 0;
  border-top: 1px solid var(--riga);
  margin: 0 0 calc(var(--passo) * 2);
  padding: calc(var(--passo) * 1.5) 0 0;
}

.profili legend {
  padding: 0 0.6em 0 0;
  font-size: 0.85rem;
  color: var(--inchiostro-tenue);
}

.profilo {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0 0.7em;
  align-items: baseline;
  padding: calc(var(--passo) * 0.6) 0;
  cursor: pointer;
}

.profilo__nome {
  font-weight: 550;
}

.profilo__descrizione {
  grid-column: 2;
  color: var(--inchiostro-tenue);
  font-size: 0.88rem;
}

.campi {
  display: grid;
  gap: calc(var(--passo) * 1.5);
  margin-bottom: calc(var(--passo) * 2);
}

.campo label {
  display: block;
  font-size: 0.88rem;
  color: var(--inchiostro-tenue);
  margin-bottom: 0.3em;
}

.campo input,
.campo select {
  width: 100%;
  max-width: 22rem;
  padding: 0.5em 0.6em;
  border: 1px solid var(--riga);
  border-radius: 2px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-variant-numeric: tabular-nums;
}

.campo__aiuto {
  margin: 0.3em 0 0;
  font-size: 0.8rem;
  color: var(--inchiostro-tenue);
}

.campo__errore {
  margin: 0.3em 0 0;
  font-size: 0.85rem;
  color: var(--trattenuta);
}

.campo [aria-invalid="true"] {
  border-color: var(--trattenuta);
}

.calcola {
  padding: 0.6em 1.6em;
  border: 1px solid var(--inchiostro);
  border-radius: 2px;
  background: var(--inchiostro);
  color: var(--carta);
  font: inherit;
  font-weight: 550;
  cursor: pointer;
}

.calcola:hover {
  background: transparent;
  color: var(--inchiostro);
}

/* ------------------------------------------------------------ risultato */

.risultato {
  margin-top: calc(var(--passo) * 4);
  border-top: 1px solid var(--riga);
  padding-top: calc(var(--passo) * 2);
}

.testa {
  display: flex;
  flex-wrap: wrap;
  gap: calc(var(--passo) * 3);
  align-items: flex-end;
}

.testa__voce {
  margin: 0;
  display: grid;
}

.testa__etichetta {
  font-size: 0.85rem;
  color: var(--inchiostro-tenue);
}

.testa__cifra {
  font-size: clamp(1.8rem, 6vw, 2.6rem);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  color: var(--credito);
}

.testa__voce:nth-child(2) .testa__cifra {
  font-size: clamp(1.2rem, 3.5vw, 1.5rem);
  color: var(--inchiostro);
}

.testa__media {
  flex-basis: 100%;
  margin: 0;
  font-size: 0.85rem;
  color: var(--inchiostro-tenue);
  font-variant-numeric: tabular-nums;
}

/* --------------------------------------------------------- striscia */

.striscia-blocco {
  margin: calc(var(--passo) * 2) 0;
}

.striscia {
  display: flex;
  height: 0.5rem;
  overflow: hidden;
  border-radius: 1px;
}

.striscia__segmento {
  width: var(--quota);
}

.striscia__netto,
.striscia__pallino.striscia__netto {
  background: var(--credito);
}

.striscia__contributi,
.striscia__pallino.striscia__contributi {
  background: var(--inchiostro-tenue);
}

.striscia__imposte,
.striscia__pallino.striscia__imposte {
  background: var(--trattenuta);
}

.striscia__legenda {
  display: flex;
  flex-wrap: wrap;
  gap: 0 calc(var(--passo) * 2);
  margin: calc(var(--passo) * 0.75) 0 0;
  padding: 0;
  list-style: none;
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
}

.striscia__pallino {
  display: inline-block;
  width: 0.6em;
  height: 0.6em;
  margin-right: 0.4em;
  border-radius: 50%;
}

.striscia__quota {
  color: var(--inchiostro-tenue);
}

/* ----------------------------------------------------------- la catena */

.catena {
  width: 100%;
  margin-top: calc(var(--passo) * 2);
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}

.catena caption {
  text-align: left;
  font-size: 0.85rem;
  color: var(--inchiostro-tenue);
  padding-bottom: calc(var(--passo) * 0.75);
}

.riga th {
  text-align: left;
  font-weight: 400;
  padding: 0.42em 0;
  vertical-align: top;
}

.riga__importo {
  text-align: right;
  padding: 0.42em 0;
  white-space: nowrap;
  vertical-align: top;
}

.riga__nota {
  display: block;
  font-size: 0.82rem;
  color: var(--inchiostro-tenue);
}

.riga--trattenuta .riga__importo {
  color: var(--trattenuta);
}

.riga--credito .riga__importo {
  color: var(--credito);
}

.riga--rientro th {
  padding-left: 1.5em;
  color: var(--inchiostro-tenue);
}

.riga--esente .riga__importo {
  color: var(--inchiostro-tenue);
}

/* Un subtotale non e' una trattenuta: il filetto lo separa da cio' che lo precede. */
.riga--subtotale th,
.riga--subtotale .riga__importo {
  border-top: 1px solid var(--riga);
  font-weight: 550;
}

.riga--totale th,
.riga--totale .riga__importo {
  border-top: 3px double var(--riga);
  padding-top: 0.6em;
  font-weight: 650;
  font-size: 1.05rem;
}

.riga--lordo th,
.riga--lordo .riga__importo {
  font-weight: 550;
}

/* --------------------------------------------------------- scaglioni */

.scaglioni {
  margin-top: 0.4em;
  font-size: 0.85rem;
}

.scaglioni summary {
  color: var(--inchiostro-tenue);
  cursor: pointer;
}

.scaglioni table {
  width: 100%;
  margin-top: 0.5em;
  border-collapse: collapse;
}

.scaglioni th,
.scaglioni td {
  padding: 0.3em 0.8em 0.3em 0;
  text-align: left;
  font-weight: 400;
  color: var(--inchiostro-tenue);
  border-bottom: 1px solid var(--riga);
}

.scaglioni th {
  font-size: 0.78rem;
}

.scaglioni .cifra {
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* ------------------------------------------------ avvisi, errori, fonti */

.avviso {
  margin: calc(var(--passo) * 1.5) 0;
  padding-left: 0.8em;
  border-left: 3px solid var(--trattenuta);
  color: var(--inchiostro-tenue);
  font-size: 0.9rem;
}

.errore {
  border-top: 1px solid var(--riga);
  padding-top: calc(var(--passo) * 2);
}

.errore h2 {
  font-size: 1.1rem;
  margin-top: 0;
}

.errore code,
.errore pre {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.88em;
}

.errore pre {
  padding: 0.8em;
  border: 1px solid var(--riga);
  border-radius: 2px;
  overflow-x: auto;
}

.semplificazioni,
.fonti {
  margin-top: calc(var(--passo) * 4);
  border-top: 1px solid var(--riga);
  padding-top: calc(var(--passo) * 1.5);
}

.semplificazioni h2,
.fonti h2 {
  font-size: 0.85rem;
  font-weight: 550;
  color: var(--inchiostro-tenue);
  margin: 0 0 calc(var(--passo) * 0.75);
}

.semplificazioni ul {
  margin: 0;
  padding-left: 1.1em;
  color: var(--inchiostro-tenue);
  font-size: 0.9rem;
}

.semplificazioni li {
  margin-bottom: 0.35em;
}

.fonti__meta {
  margin: 0 0 calc(var(--passo));
  font-size: 0.85rem;
  color: var(--inchiostro-tenue);
}

.fonti__elenco {
  margin: 0;
  padding: 0;
  list-style: none;
}

.fonte {
  display: grid;
  gap: 0.15em;
  padding: calc(var(--passo)) 0;
  border-top: 1px solid var(--riga);
  font-size: 0.85rem;
}

.fonte__titolo {
  color: inherit;
  font-weight: 550;
}

.fonte__ente,
.fonte__norma,
.fonte__badge,
.fonte__note {
  color: var(--inchiostro-tenue);
}

.fonte__norma,
.fonte__note {
  font-size: 0.95em;
}

.fonte--secondaria .fonte__badge,
.fonte--mancante {
  color: var(--trattenuta);
}

/* ------------------------------------------------------------- footer */

.pie {
  margin-top: calc(var(--passo) * 5);
  border-top: 1px solid var(--riga);
  padding-top: calc(var(--passo) * 1.5);
  font-size: 0.82rem;
  color: var(--inchiostro-tenue);
}

.caricamento {
  color: var(--inchiostro-tenue);
}

/* ------------------------------------------------------------- mobile */

@media (max-width: 34rem) {
  .testa {
    gap: calc(var(--passo) * 1.5);
  }

  .riga th {
    padding-right: 0.6em;
  }

  .scaglioni table {
    display: block;
    overflow-x: auto;
  }
}

/* Nessuna animazione di entrata per scelta: resta la sola transizione della striscia. */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 2: Verify in the browser**

Serve with `python3 -m http.server 8000` and check:

1. Every figure in the chain shares one right edge, subtotals and total included.
2. `Imponibile fiscale` and `IRPEF netta` have a hairline above; `Netto annuo` has a double rule.
3. Detrazioni are indented one level and green; deductions are red.
4. No card, no drop shadow, no radius above 2px anywhere.
5. At 360px wide nothing overflows horizontally and the brackets table scrolls inside itself.
6. Tab through the whole page: the focus ring is visible on radios, inputs, select, button, `<summary>`, and every source link.
7. Toggle the OS to dark mode and confirm text stays legible and the two accents stay distinguishable.

- [ ] **Step 3: Commit**

```bash
git add stile/main.css
git commit -m "Style the result as a ledger

Six named tokens, one type family, tabular figures throughout. No boxes
and no shadows: the structure is hairlines and whitespace, as on a
payslip. Subtotals carry a rule above and the net total a double rule,
so an intermediate step never reads as a deduction.

Red and green here are accounting signs rather than sentiment, so the
values are dark and desaturated instead of the reflexive alert/success
pair, and both hold AA on the paper ground in either theme.

No entry animations at all, per the design doc's self-critique."
```

---

## Task 8: README, full acceptance verification, merge

**Files:**
- Create: `README.md`
- Merge: `feat/ui` → `master`

**Interfaces:**
- Consumes: everything above.
- Produces: a repo ready to publish.

- [ ] **Step 1: Write `README.md`**

```markdown
# Dalla RAL al netto

Calcolatore da retribuzione lorda a netto. Anno d'imposta **2026**, ambito
**Milano (Lombardia)**. Ogni trattenuta è mostrata con il suo importo e con la
fonte da cui il dato proviene.

**Demo:** <!-- inserire qui l'URL di GitHub Pages dopo l'attivazione -->

## Come farlo girare in locale

Il calcolo è interamente client-side e non c'è build step, ma i dati fiscali
sono caricati con `fetch()` dai file JSON: il browser blocca le fetch sulle
pagine aperte da disco. Serve un server locale.

```bash
python3 -m http.server 8000
```

Poi apri <http://localhost:8000>.

## Verifica

```bash
node --test test/   # asserisce i casi di SPEC.md §7 e il livello UI
node verifica.mjs   # stampa le catene di calcolo per ispezione a occhio
```

Richiede Node ≥ 18. Nessuna dipendenza da installare: `package.json` esiste solo
per dichiarare `"type": "module"`.

## Com'è fatto

Tre livelli, con una regola che non viene violata: **la UI non conosce le regole
fiscali**.

- `data/` — dati dichiarativi, zero logica. Aliquote, scaglioni, formule delle
  detrazioni, registro delle fonti, definizione dei profili. Aggiungere una
  regione o un anno d'imposta si fa qui, senza toccare codice.
- `src/motore/` — funzioni pure. Nessuna aliquota scritta nel codice: ogni
  funzione riceve la regola letta dal JSON e si limita a interpretarla.
- `src/ui/` — `formato.js` (formattazione it-IT), `render.js` (dal risultato
  all'HTML, funzioni pure), `app.js` (caricamento, stato, eventi).

La UI chiama `calcola()` e renderizza quello che riceve. Se per mostrare qualcosa
in pagina serve un dato fiscale, quel dato va aggiunto al JSON e restituito dal
motore, non scritto nel template.

## Cosa questo calcolo non considera

Le semplificazioni sono dichiarate in pagina, profilo per profilo, non nascoste
qui. In sintesi: nessun carico familiare e nessuna detrazione per oneri; rapporto
di lavoro per l'anno intero; TFR escluso perché accantonato e non erogato;
nessun CCNL specifico e nessun conguaglio. Le addizionali sono calcolate per
competenza sull'anno corrente, mentre nella realtà il meccanismo è sfasato di un
anno.

Le fonti marcate `secondaria` vanno riverificate sui siti istituzionali prima di
qualunque uso reale. Il campo `dataScadenzaVerifica` in `data/fonti.json` serve a
innescare l'aggiornamento annuale.

## Pubblicazione

Settings → Pages → Source: *Deploy from a branch*, branch `master`, cartella
`/ (root)`. I percorsi nelle `fetch` sono relativi, quindi funzionano anche
quando il sito è servito da `/<repo>/`.
```

- [ ] **Step 2: Run the full test suite**

Run: `node --test test/` and `node verifica.mjs`

Expected: both PASS. Record the test count.

- [ ] **Step 3: Prove the architectural constraint mechanically**

Run:

```bash
grep -rE '0\.0919|0\.0584|0\.2607|23000|85000|28000|1955|1000|0\.78|0\.15' src/ui/ stile/
```

Expected: no match that is a tax value. Matches must be read, not counted — `1000` can legitimately appear in a CSS length or a rounding helper. Any genuine rate, threshold or formula found here is a violation of `SPEC.md` §3 and must be moved into the JSON and returned by the engine.

- [ ] **Step 4: Walk the acceptance criteria**

Serve the site and confirm each box of `SPEC.md` §8 in the browser. Every one must be checked before the merge:

- [ ] All three profiles selectable, each producing the `SPEC.md` §7 figures
- [ ] Inputs generated from `profili.json`, not written in the HTML
- [ ] No rate, threshold or formula in `src/ui/` or `stile/` (Step 3)
- [ ] Every deduction visible with its amount
- [ ] Every item traceable to its source, with issuing body and verification date
- [ ] `secondaria` sources visually distinct from `primaria`, by more than colour
- [ ] RAL 22.000 shows the municipal surcharge as exempt, not as a generic zero
- [ ] Bracket detail consultable
- [ ] Profile simplifications on the page
- [ ] Amounts in euro, Italian format
- [ ] Works on mobile, keyboard focus visible
- [ ] `node verifica.mjs` passes

- [ ] **Step 5: Commit the README**

```bash
git add README.md
git commit -m "Add README

How to run it locally and why a local server is needed, how to verify,
and the three-layer structure with the rule that holds it together: the
UI knows no tax rules.

Simplifications are summarised but not relocated here — they belong on
the page, profile by profile, where someone reading a number can see
what it leaves out."
```

- [ ] **Step 6: Merge into `master`**

```bash
git checkout master
git merge --no-ff feat/ui -m "Merge feat/ui: the UI layer

Moves the engine and data into the tree SPEC.md describes, then builds
the three UI modules on top: it-IT formatters, pure result-to-HTML
rendering, and the impure orchestration module.

The result is a ledger rather than a list of cards: one shared decimal
axis, subtotals separated from deductions by a rule, every item carrying
its source and its verification date."
git log --oneline --graph -12
```

Do not push. Publishing to GitHub and enabling Pages is the repo owner's call.

---

## Self-Review

**Spec coverage** — every `SPEC.md` §8 acceptance criterion maps to a task:

| Criterion | Task |
|---|---|
| Three profiles produce the §7 figures | 1 (engine), 4 (rendering), 8 (browser) |
| Inputs generated from `profili.json` | 3 |
| No fiscal literal in `src/ui/` or `stile/` | 8, Step 3 |
| Every deduction visible with its amount | 4 |
| Every item traceable to a source | 5 |
| `secondaria` distinguishable from `primaria` | 5 |
| RAL 22.000 exempt, not a generic zero | 4 |
| Bracket detail consultable | 5 |
| Simplifications on the page | 5 |
| Italian currency formatting | 2 |
| Mobile, visible keyboard focus | 7 |
| `node verifica.mjs` passes | 1 |
| Pages demo reachable | 8 (documented; enabling it is the owner's) |

Design-doc coverage: §1 move → Task 1; §2 ledger → Task 4; §3 visual → Task 7; §4 modules → Tasks 2–6; §5 error states → Tasks 4, 5, 6; §6 accessibility → Tasks 3, 5, 7; §7 work order → task order; §8 verification → Task 8.

**Type consistency** — `renderScaglioni` is called in Task 4 and implemented in Task 5; Task 4 ships an explicit stub and Task 5 says to delete it, so neither task is left referring to something undefined. `esc` is defined once in Task 3 and used by Tasks 4 and 5, all in the same module. `renderSceltaProfilo` takes the whole parsed `profili.json` (with its `.profili` array) while `renderCampi` and `renderSemplificazioni` take a single profile object — this asymmetry is intentional and is stated in each Interfaces block.

**Known gap, deliberate:** `app.js` has no automated tests. It is the impure boundary — fetch, DOM, events — and testing it would need a DOM implementation, which the zero-dependency constraint forbids. It is covered by the scripted browser walkthrough in Task 6 Step 4 and Task 8 Step 4. Everything testable without a DOM was pushed out of it into `render.js` precisely so this gap stays small.
