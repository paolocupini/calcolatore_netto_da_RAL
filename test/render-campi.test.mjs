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
