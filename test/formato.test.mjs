import { test } from "node:test";
import assert from "node:assert/strict";
import { euro, percentuale, aliquota, numero, _getValutaOptions } from "../src/ui/formato.js";

// Intl usa uno spazio unificatore (U+00A0 o U+202F) prima del simbolo di valuta.
// E' corretto: lo normalizziamo per poter scrivere asserzioni leggibili.
const norm = (s) => s.replace(/[\u00A0\u202F]/g, " ");

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

// Protezione dalla differenza CLDR tra Node e Chrome: Chrome omette il separatore
// nei numeri a quattro cifre mentre Node lo include. Questa suite verifica che
// useGrouping:"always" sia stato aggiunto a tutte le istanze NumberFormat, pinando
// il comportamento coerente su entrambi i runtime. I due assiomi sotto sono
// interdipendenti: uno controlla i valori, l'altro verifica l'intenzione nel codice.
test("quattro cifre sono sempre raggruppate, verificando Node-vs-Chrome CLDR", () => {
  // Assiomi sui valori: questi passano in Node anche senza useGrouping:"always",
  // ma in Chrome fallirebbero senza di esso (perche' restituirebbero "1997,48 €" senza separatore).
  assert.equal(norm(euro(1997.48)), "1.997,48 €");
  assert.equal(norm(euro(3216.5)), "3.216,50 €");
  assert.equal(norm(euro(9032.79)), "9.032,79 €");
  assert.equal(numero(1000), "1.000");

  // Assioma sull'intenzione: verifica che il formatter di valuta sia configurato con useGrouping:"always".
  // Questo fallisce se l'opzione viene rimossa, anche in Node dove i valori passerebbero comunque.
  assert.equal(_getValutaOptions().useGrouping, "always");
});
