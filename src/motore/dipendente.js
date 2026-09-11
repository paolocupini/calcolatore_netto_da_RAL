/**
 * Motore di calcolo per il lavoro dipendente.
 * Serve sia il profilo "dipendente-indeterminato" sia "apprendista": l'unica
 * differenza tra i due e' quale regola contributiva il profilo dichiara nel JSON.
 *
 * Catena di calcolo:
 *   RAL
 *   - contributi INPS a carico del lavoratore   -> imponibile fiscale
 *   - IRPEF netta (lorda per scaglioni, meno detrazioni, mai sotto zero)
 *   - addizionale regionale
 *   - addizionale comunale
 *   = netto annuo
 */

import {
  applicaScaglioni,
  applicaAliquotaPiatta,
  applicaAliquotaConEsenzione,
  calcolaDetrazione,
  arrotonda,
} from "./primitive.js";

export function calcolaDipendente({ profilo, input, regole }) {
  const lordoAnnuo = Number(input.lordoAnnuo) || 0;
  const mensilita = Number(input.mensilita) || regole.parametri.mensilitaPredefinita;
  const rif = profilo.regole;

  // 1. Contributi previdenziali a carico del lavoratore.
  const regolaContributi = regole.contributi[rif.contributi];
  const contributi = applicaAliquotaPiatta(lordoAnnuo, regolaContributi.aliquota);

  // 2. Imponibile fiscale: i contributi obbligatori sono deducibili.
  const imponibileFiscale = arrotonda(lordoAnnuo - contributi);

  // 3. IRPEF lorda per scaglioni.
  const regolaIrpef = regole.imposte[rif.impostaPrincipale];
  const irpef = applicaScaglioni(imponibileFiscale, regolaIrpef);

  // 4. Detrazioni: si sommano e si scontano dall'IRPEF lorda.
  //    L'IRPEF netta non puo' essere negativa (l'eccedenza non e' rimborsabile qui).
  const detrazioni = rif.detrazioni.map((id) => {
    const regola = regole.detrazioni[id];
    const esito = calcolaDetrazione(imponibileFiscale, regola);
    return {
      id,
      etichetta: regola.etichetta,
      importo: esito.importo,
      fonteId: regola.fonteId,
      formula: esito.formula,
    };
  });

  const totaleDetrazioni = arrotonda(
    detrazioni.reduce((somma, d) => somma + d.importo, 0)
  );
  const irpefNetta = arrotonda(Math.max(0, irpef.totale - totaleDetrazioni));
  const detrazioniEffettive = arrotonda(Math.min(totaleDetrazioni, irpef.totale));

  // 5. Addizionali locali: si calcolano sull'imponibile fiscale, non sull'IRPEF.
  const addizionali = rif.addizionali.map((id) => {
    const regola = regole.imposte[id];

    if (regola.tipo === "scaglioni") {
      const esito = applicaScaglioni(imponibileFiscale, regola);
      return {
        id,
        etichetta: regola.etichetta,
        importo: esito.totale,
        dettaglio: esito.dettaglio,
        fonteId: regola.fonteId,
      };
    }

    const esito = applicaAliquotaConEsenzione(imponibileFiscale, regola);
    return {
      id,
      etichetta: regola.etichetta,
      importo: esito.totale,
      esente: esito.esente,
      sogliaEsenzione: esito.sogliaEsenzione,
      fonteId: regola.fonteId,
    };
  });

  const totaleAddizionali = arrotonda(
    addizionali.reduce((somma, a) => somma + a.importo, 0)
  );

  // 6. Totali.
  const totaleImposte = arrotonda(irpefNetta + totaleAddizionali);
  const totaleTrattenute = arrotonda(contributi + totaleImposte);
  const nettoAnnuo = arrotonda(lordoAnnuo - totaleTrattenute);

  return {
    profiloId: profilo.id,
    input: { lordoAnnuo, mensilita },

    voci: {
      contributi: {
        etichetta: regolaContributi.etichetta,
        aliquota: regolaContributi.aliquota,
        importo: contributi,
        fonteId: regolaContributi.fonteId,
      },
      imponibileFiscale,
      irpefLorda: {
        etichetta: regolaIrpef.etichetta,
        importo: irpef.totale,
        dettaglioScaglioni: irpef.dettaglio,
        fonteId: regolaIrpef.fonteId,
      },
      detrazioni,
      totaleDetrazioni,
      detrazioniEffettive,
      irpefNetta,
      addizionali,
      totaleAddizionali,
    },

    risultato: {
      lordoAnnuo,
      totaleContributi: contributi,
      totaleImposte,
      totaleTrattenute,
      nettoAnnuo,
      nettoMensile: arrotonda(nettoAnnuo / mensilita),
      mensilita,
      aliquotaMediaEffettiva: lordoAnnuo > 0
        ? arrotonda((totaleTrattenute / lordoAnnuo) * 100)
        : 0,
    },
  };
}
