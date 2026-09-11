import { readFileSync } from "fs";
import { calcola } from "./src/motore/index.js";

const leggi = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const regole = leggi("./data/regole-fiscali-2026.json");
const profili = leggi("./data/profili.json");
const fonti = leggi("./data/fonti.json");

const eur = (n) => n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function stampa(titolo, r) {
  console.log(`\n=== ${titolo} ===`);
  console.log(`Lordo annuo:        ${eur(r.risultato.lordoAnnuo)}`);
  console.log(`Contributi:       - ${eur(r.risultato.totaleContributi)}`);
  if (r.voci.imponibileFiscale !== undefined)
    console.log(`Imponibile fiscale: ${eur(r.voci.imponibileFiscale)}`);
  if (r.voci.irpefLorda) {
    console.log(`IRPEF lorda:      - ${eur(r.voci.irpefLorda.importo)}`);
    r.voci.detrazioni.forEach((d) => console.log(`  detrazione ${d.id}: + ${eur(d.importo)}`));
    console.log(`IRPEF netta:      - ${eur(r.voci.irpefNetta)}`);
    r.voci.addizionali.forEach((a) =>
      console.log(`  ${a.id}: - ${eur(a.importo)}${a.esente ? " (esente)" : ""}`)
    );
  }
  if (r.voci.impostaSostitutiva) {
    console.log(`Reddito forfett.:   ${eur(r.voci.coefficienteRedditivita.redditoForfettario)}`);
    console.log(`Imponibile imposta: ${eur(r.voci.imponibileImposta)}`);
    console.log(`Imposta sostit.:  - ${eur(r.voci.impostaSostitutiva.importo)}`);
  }
  console.log(`TOT trattenute:   - ${eur(r.risultato.totaleTrattenute)}`);
  console.log(`NETTO ANNUO:        ${eur(r.risultato.nettoAnnuo)}`);
  console.log(`NETTO MENSILE:      ${eur(r.risultato.nettoMensile)} (x${r.risultato.mensilita})`);
  console.log(`Aliquota media:     ${r.risultato.aliquotaMediaEffettiva}%`);
}

stampa("Dipendente indeterminato — RAL 35.000", calcola({
  profiloId: "dipendente-indeterminato",
  input: { lordoAnnuo: 35000, mensilita: 13 },
  regole, profili, fonti,
}));

stampa("Dipendente indeterminato — RAL 22.000 (sotto soglia comunale)", calcola({
  profiloId: "dipendente-indeterminato",
  input: { lordoAnnuo: 22000, mensilita: 13 },
  regole, profili, fonti,
}));

stampa("Apprendista — RAL 24.000", calcola({
  profiloId: "apprendista",
  input: { lordoAnnuo: 24000, mensilita: 13 },
  regole, profili, fonti,
}));

stampa("Forfettario — 40.000, coeff. 78%, aliquota 15%", calcola({
  profiloId: "forfettario",
  input: { lordoAnnuo: 40000, coefficiente: "professionale-78", aliquotaSostitutiva: "ordinaria" },
  regole, profili, fonti,
}));

// --- controlli a mano ---
console.log("\n\n=== CONTROLLI ===");
const r35 = calcola({ profiloId: "dipendente-indeterminato", input: { lordoAnnuo: 35000, mensilita: 13 }, regole, profili, fonti });

const inpsAttesa = 35000 * 0.0919;
const imponibileAtteso = 35000 - inpsAttesa;
const irpefAttesa = 28000 * 0.23 + (imponibileAtteso - 28000) * 0.33;
const detrAtteso = 1910 * ((50000 - imponibileAtteso) / 22000);
// imponibile 31.783,50 -> fascia 20.000-32.000 -> importo fisso, non decrescente
const cuneoAtteso = imponibileAtteso <= 32000
  ? 1000
  : 1000 * ((40000 - imponibileAtteso) / 8000);

console.log(`INPS atteso ${eur(inpsAttesa)} | calcolato ${eur(r35.voci.contributi.importo)}`);
console.log(`Imponibile atteso ${eur(imponibileAtteso)} | calcolato ${eur(r35.voci.imponibileFiscale)}`);
console.log(`IRPEF lorda attesa ${eur(irpefAttesa)} | calcolata ${eur(r35.voci.irpefLorda.importo)}`);
console.log(`Detr. art13 attesa ${eur(detrAtteso)} | calcolata ${eur(r35.voci.detrazioni[0].importo)}`);
console.log(`Cuneo atteso ${eur(cuneoAtteso)} | calcolato ${eur(r35.voci.detrazioni[1].importo)}`);

console.log("\n=== FONTI RACCOLTE ===");
r35.meta.fontiUtilizzate.forEach((f) =>
  console.log(`- [${f.affidabilita}] ${f.titolo} | verificata ${f.dataVerifica} | scade ${f.dataScadenzaVerifica} | da riverificare: ${f.daRiverificare}`)
);
