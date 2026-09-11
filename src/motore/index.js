/**
 * Entry point del motore di calcolo.
 *
 * La UI non conosce le regole fiscali: passa un profiloId e degli input,
 * e riceve un risultato gia' arricchito con le fonti di ogni voce.
 */

import { calcolaDipendente } from "./dipendente.js";
import { calcolaForfettario } from "./forfettario.js";

const MOTORI = {
  dipendente: calcolaDipendente,
  forfettario: calcolaForfettario,
};

/**
 * @param {object} args
 * @param {string} args.profiloId    id definito in profili.json
 * @param {object} args.input        valori inseriti dall'utente
 * @param {object} args.regole       contenuto di regole-fiscali-2026.json
 * @param {object} args.profili      contenuto di profili.json
 * @param {object} args.fonti        contenuto di fonti.json
 */
export function calcola({ profiloId, input, regole, profili, fonti }) {
  const profilo = profili.profili.find((p) => p.id === profiloId);
  if (!profilo) {
    throw new Error(`Profilo non trovato: ${profiloId}`);
  }

  const motore = MOTORI[profilo.motore];
  if (!motore) {
    throw new Error(`Motore non implementato: ${profilo.motore}`);
  }

  const esito = motore({ profilo, input, regole });

  return {
    ...esito,
    profilo: {
      id: profilo.id,
      nome: profilo.nome,
      descrizione: profilo.descrizione,
      semplificazioni: profilo.semplificazioni,
    },
    meta: {
      ...regole.meta,
      fontiUtilizzate: raccogliFonti(esito, fonti),
    },
  };
}

/**
 * Raccoglie tutti i fonteId citati nel risultato e li risolve in schede complete,
 * segnalando quelle la cui verifica e' piu' vecchia della scadenza configurata.
 * E' quello che permette alla UI di mostrare "quando questo dato diventa obsoleto".
 */
function raccogliFonti(esito, fonti) {
  const ids = new Set();

  const scansiona = (nodo) => {
    if (!nodo || typeof nodo !== "object") return;
    if (Array.isArray(nodo)) return nodo.forEach(scansiona);
    if (typeof nodo.fonteId === "string") ids.add(nodo.fonteId);
    Object.values(nodo).forEach(scansiona);
  };
  scansiona(esito.voci);

  const mesiScadenza = fonti._scadenzaDefaultMesi ?? 12;

  return [...ids].map((id) => {
    const fonte = fonti[id];
    if (!fonte) return { id, mancante: true };

    const verificata = new Date(fonte.dataVerifica);
    const scadenza = new Date(verificata);
    scadenza.setMonth(scadenza.getMonth() + mesiScadenza);

    return {
      id,
      ...fonte,
      dataScadenzaVerifica: scadenza.toISOString().slice(0, 10),
      daRiverificare: new Date() > scadenza,
      giorniDallaVerifica: Math.floor((Date.now() - verificata) / 86400000),
    };
  });
}

export { MOTORI };
