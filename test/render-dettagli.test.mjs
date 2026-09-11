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
const norm = (s) => s.replace(/[  ]/g, " ");

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
