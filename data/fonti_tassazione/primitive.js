/**
 * Primitive di calcolo.
 *
 * Nessuna aliquota e nessuna soglia sono scritte qui dentro: ogni funzione riceve
 * la regola letta da regole-fiscali-2026.json e si limita a interpretarla.
 * Aggiungere una regione o cambiare un'aliquota non richiede di toccare questo file.
 */

/** Arrotonda a 2 decimali evitando gli errori di rappresentazione in virgola mobile. */
export function arrotonda(valore) {
  return Math.round((valore + Number.EPSILON) * 100) / 100;
}

/**
 * Applica un'imposta progressiva per scaglioni.
 * Ogni aliquota colpisce solo la porzione di reddito che ricade nel proprio scaglione.
 *
 * @returns {{ totale: number, dettaglio: Array }} totale e contributo di ogni scaglione,
 *          utile per mostrare in UI il "perche'" del risultato.
 */
export function applicaScaglioni(imponibile, regola) {
  const base = Math.max(0, imponibile);
  const dettaglio = [];
  let totale = 0;

  for (const scaglione of regola.scaglioni) {
    const limiteSuperiore = scaglione.a === null ? Infinity : scaglione.a;
    if (base <= scaglione.da) continue;

    const quotaTassata = Math.min(base, limiteSuperiore) - scaglione.da;
    const imposta = quotaTassata * scaglione.aliquota;
    totale += imposta;

    dettaglio.push({
      da: scaglione.da,
      a: scaglione.a,
      aliquota: scaglione.aliquota,
      quotaTassata: arrotonda(quotaTassata),
      imposta: arrotonda(imposta),
    });
  }

  return { totale: arrotonda(totale), dettaglio };
}

/** Applica un'aliquota proporzionale sull'intero imponibile. */
export function applicaAliquotaPiatta(imponibile, aliquota) {
  return arrotonda(Math.max(0, imponibile) * aliquota);
}

/**
 * Aliquota piatta con soglia di esenzione (caso addizionale comunale di Milano).
 * La soglia e' un'esenzione, non una franchigia: superata, si tassa l'intero imponibile.
 */
export function applicaAliquotaConEsenzione(imponibile, regola) {
  const base = Math.max(0, imponibile);
  if (base <= regola.sogliaEsenzione) {
    return { totale: 0, esente: true, sogliaEsenzione: regola.sogliaEsenzione };
  }
  const imponibileTassato = regola.esenzioneEFranchigia
    ? base - regola.sogliaEsenzione
    : base;
  return {
    totale: applicaAliquotaPiatta(imponibileTassato, regola.aliquota),
    esente: false,
    sogliaEsenzione: regola.sogliaEsenzione,
  };
}

/**
 * Calcola una detrazione definita a fasce di reddito.
 * Le tre formule dichiarabili nel JSON sono:
 *  - "costante"                    -> importo fisso
 *  - "base-piu-quota-decrescente"  -> base + quotaVariabile * (riferimento - reddito) / divisore
 *  - "base-decrescente"            -> base * (riferimento - reddito) / divisore
 */
export function calcolaDetrazione(reddito, regola, opzioni = {}) {
  const base = Math.max(0, reddito);
  const fascia = regola.fasce.find(
    (f) => base > f.da && (f.a === null || base <= f.a)
  );

  // Reddito pari a 0 o nessuna fascia applicabile.
  if (!fascia) return { importo: 0, fasciaApplicata: null, formula: null };

  let importo;
  switch (fascia.formula) {
    case "costante":
      importo = fascia.importo;
      break;

    case "base-piu-quota-decrescente":
      importo =
        fascia.base +
        (fascia.quotaVariabile * (fascia.redditoRiferimento - base)) / fascia.divisore;
      break;

    case "base-decrescente":
      importo = (fascia.base * (fascia.redditoRiferimento - base)) / fascia.divisore;
      break;

    default:
      throw new Error(`Formula detrazione non riconosciuta: ${fascia.formula}`);
  }

  // Importo minimo garantito (solo se la fascia lo prevede).
  const minimo = opzioni.tempoDeterminato
    ? fascia.importoMinimoTempoDeterminato
    : fascia.importoMinimo;
  if (typeof minimo === "number") {
    importo = Math.max(importo, minimo);
  }

  return {
    importo: arrotonda(Math.max(0, importo)),
    fasciaApplicata: { da: fascia.da, a: fascia.a },
    formula: fascia.formula,
  };
}
