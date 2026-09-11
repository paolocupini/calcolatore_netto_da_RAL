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
