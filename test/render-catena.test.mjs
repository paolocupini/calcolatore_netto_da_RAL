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
const norm = (s) => s.replace(/[\u00A0\u202F]/g, " ");

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

test("il risultato non porta una propria live region", () => {
  // La live region vive sul contenitore persistente #esito in app.js, creato una
  // sola volta in montaForm() prima che il calcolo la riempia: e' quello a rendere
  // affidabile l'annuncio per gli screen reader. Una sezione ricreata a ogni
  // calcolo non deve dichiarare aria-live in proprio (altrimenti nascerebbe insieme
  // al suo contenuto, che e' esattamente il difetto che questo test impedisce).
  // Questo non puo' essere verificato da un test unitario su una funzione pura:
  // qui controlliamo solo che renderRisultato non se ne appropri.
  const html = renderRisultato(dipendente());
  assert.doesNotMatch(html, /aria-live="polite"/);
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
