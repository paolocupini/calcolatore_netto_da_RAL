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
