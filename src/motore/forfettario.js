/**
 * Motore di calcolo per la partita IVA in regime forfettario.
 *
 * E' un regime strutturalmente diverso da quello del dipendente, ed e' il motivo
 * per cui esiste come motore separato invece che come variante di parametri:
 *   - il reddito imponibile e' forfettizzato tramite coefficiente ATECO, non calcolato sui costi reali;
 *   - l'imposta sostitutiva rimpiazza IRPEF, addizionale regionale e addizionale comunale;
 *   - non esistono detrazioni per lavoro dipendente ne' mensilita'.
 *
 * Catena di calcolo (art. 1 co. 64 L. 190/2014):
 *   compensi lordi
 *   x coefficiente di redditivita'              -> reddito lordo forfettario
 *   - contributi previdenziali versati          -> base imponibile dell'imposta
 *   x aliquota sostitutiva (5% o 15%)           -> imposta dovuta
 *   netto = compensi - contributi - imposta
 */

import { applicaAliquotaPiatta, arrotonda } from "./primitive.js";

export function calcolaForfettario({ profilo, input, regole }) {
  const lordoAnnuo = Number(input.lordoAnnuo) || 0;
  const rif = profilo.regole;

  // 1. Reddito imponibile lordo: percentuale forfettaria dei compensi.
  const parametroCoeff = regole.parametri.coefficientiRedditivita;
  const chiaveCoeff = input.coefficiente || parametroCoeff.predefinita;
  const opzioneCoeff = parametroCoeff.opzioni[chiaveCoeff];
  const redditoForfettario = arrotonda(lordoAnnuo * opzioneCoeff.coefficiente);

  // 2. Contributi previdenziali, calcolati sul reddito forfettario (non sul fatturato).
  const regolaContributi = regole.contributi[rif.contributi];
  const contributi = applicaAliquotaPiatta(redditoForfettario, regolaContributi.aliquota);

  // 3. Base imponibile dell'imposta sostitutiva: i contributi sono deducibili.
  //    Il risultato non puo' essere negativo.
  const imponibileImposta = arrotonda(Math.max(0, redditoForfettario - contributi));

  // 4. Imposta sostitutiva.
  const regolaImposta = regole.imposte[rif.impostaPrincipale];
  const chiaveAliquota = input.aliquotaSostitutiva || regolaImposta.predefinita;
  const opzioneAliquota = regolaImposta.opzioni[chiaveAliquota];
  const imposta = applicaAliquotaPiatta(imponibileImposta, opzioneAliquota.aliquota);

  // 5. Totali.
  const totaleTrattenute = arrotonda(contributi + imposta);
  const nettoAnnuo = arrotonda(lordoAnnuo - totaleTrattenute);

  return {
    profiloId: profilo.id,
    input: { lordoAnnuo, coefficiente: chiaveCoeff, aliquotaSostitutiva: chiaveAliquota },

    voci: {
      coefficienteRedditivita: {
        etichetta: opzioneCoeff.etichetta,
        coefficiente: opzioneCoeff.coefficiente,
        redditoForfettario,
        quotaEsclusa: arrotonda(lordoAnnuo - redditoForfettario),
        fonteId: parametroCoeff.fonteId,
      },
      contributi: {
        etichetta: regolaContributi.etichetta,
        aliquota: regolaContributi.aliquota,
        importo: contributi,
        fonteId: regolaContributi.fonteId,
      },
      imponibileImposta,
      impostaSostitutiva: {
        etichetta: `${regolaImposta.etichetta} — ${opzioneAliquota.etichetta}`,
        aliquota: opzioneAliquota.aliquota,
        importo: imposta,
        sostituisce: regolaImposta.sostituisce,
        fonteId: regolaImposta.fonteId,
      },
      supera: {
        sogliaRicavi: regole.parametri.sogliaRicaviForfettario.valore,
        superata: lordoAnnuo > regole.parametri.sogliaRicaviForfettario.valore,
      },
    },

    risultato: {
      lordoAnnuo,
      totaleContributi: contributi,
      totaleImposte: imposta,
      totaleTrattenute,
      nettoAnnuo,
      nettoMensile: arrotonda(nettoAnnuo / 12),
      mensilita: 12,
      aliquotaMediaEffettiva: lordoAnnuo > 0
        ? arrotonda((totaleTrattenute / lordoAnnuo) * 100)
        : 0,
    },
  };
}
