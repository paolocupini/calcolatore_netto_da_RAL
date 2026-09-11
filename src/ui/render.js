/**
 * Dal risultato del motore all'HTML.
 *
 * Ogni funzione qui dentro e' pura: riceve dati, restituisce una stringa.
 * Nessuna fetch, nessuno stato, nessun accesso al DOM — e' cio' che rende
 * questo modulo testabile con `node --test` senza dipendenze.
 *
 * Nessuna aliquota, soglia o formula e' scritta qui: se un numero fiscale
 * serve a schermo, arriva dal risultato del motore o dai file JSON.
 */

import { euro, percentuale, aliquota, numero } from "./formato.js";

/** Escape del testo che proviene dai file dati (i campi note e riferimentoNormativo sono liberi). */
function esc(testo) {
  return String(testo ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ---------------------------------------------------------------- profilo */

export function renderSceltaProfilo(profili, attivo) {
  const voci = profili.profili
    .map(
      (p) => `
      <label class="profilo">
        <input type="radio" name="profilo" value="${esc(p.id)}"${p.id === attivo ? " checked" : ""}>
        <span class="profilo__nome">${esc(p.nome)}</span>
        <span class="profilo__descrizione">${esc(p.descrizione)}</span>
      </label>`
    )
    .join("");

  return `<fieldset class="profili">
    <legend>Profilo</legend>
    ${voci}
  </fieldset>`;
}

/* ----------------------------------------------------------------- campi */

export function renderCampi(profilo, regole) {
  return profilo.input.map((campo) => renderCampo(campo, regole)).join("");
}

function renderCampo(campo, regole) {
  const id = `campo-${esc(campo.id)}`;
  return `<div class="campo" data-campo="${esc(campo.id)}">
    <label for="${id}">${esc(campo.etichetta)}</label>
    ${controllo(campo, regole, id)}
    ${suggerimento(campo)}
    <p class="campo__errore" id="${id}-errore" role="alert" hidden></p>
  </div>`;
}

function suggerimento(campo) {
  if (campo.tipo !== "valuta") return "";
  return `<p class="campo__aiuto">Da ${numero(campo.min)} a ${numero(campo.max)} €</p>`;
}

function controllo(campo, regole, id) {
  switch (campo.tipo) {
    case "valuta":
      // min/max vanno in data-*, non negli attributi nativi: il forfettario deve
      // poter superare la soglia e ricevere un avviso, non un submit bloccato.
      return `<input type="number" id="${id}" name="${esc(campo.id)}"
        inputmode="decimal" step="100"
        data-min="${esc(campo.min)}" data-max="${esc(campo.max)}"
        value="${esc(campo.predefinito)}"
        aria-describedby="${id}-errore">`;

    case "scelta":
      return select(
        id,
        campo,
        campo.opzioni.map((o) => ({ valore: o, etichetta: String(o) })),
        campo.predefinito
      );

    case "scelta-da-parametro": {
      const parametro = regole.parametri[campo.parametro];
      return select(id, campo, opzioniDaNodo(parametro.opzioni), parametro.predefinita);
    }

    case "scelta-da-imposta": {
      const imposta = regole.imposte[campo.imposta];
      return select(id, campo, opzioniDaNodo(imposta.opzioni), imposta.predefinita);
    }

    default:
      throw new Error(`Tipo di campo non gestito: ${campo.tipo}`);
  }
}

function opzioniDaNodo(opzioni) {
  return Object.entries(opzioni).map(([valore, o]) => ({ valore, etichetta: o.etichetta }));
}

function select(id, campo, opzioni, predefinito) {
  const voci = opzioni
    .map(
      (o) =>
        `<option value="${esc(o.valore)}"${
          String(o.valore) === String(predefinito) ? " selected" : ""
        }>${esc(o.etichetta)}</option>`
    )
    .join("");

  return `<select id="${id}" name="${esc(campo.id)}" aria-describedby="${id}-errore">${voci}</select>`;
}

/* ------------------------------------------------------------- risultato */

export function renderRisultato(esito) {
  return `<section class="risultato" aria-live="polite">
    ${renderTesta(esito)}
    ${renderStriscia(esito)}
    ${avvisoSoglia(esito)}
    ${renderCatena(esito)}
  </section>`;
}

function renderTesta(esito) {
  const r = esito.risultato;
  const media = r.lordoAnnuo > 0 ? percentuale(r.aliquotaMediaEffettiva) : "—";

  return `<div class="testa">
    <p class="testa__voce">
      <span class="testa__etichetta">Netto annuo</span>
      <strong class="testa__cifra">${euro(r.nettoAnnuo)}</strong>
    </p>
    <p class="testa__voce">
      <span class="testa__etichetta">Netto mensile <small>su ${esc(r.mensilita)} mensilità</small></span>
      <strong class="testa__cifra">${euro(r.nettoMensile)}</strong>
    </p>
    <p class="testa__media">Aliquota media effettiva ${media}</p>
  </div>`;
}

function renderStriscia(esito) {
  const r = esito.risultato;
  if (!(r.lordoAnnuo > 0)) return "";

  const quota = (valore) => ((valore / r.lordoAnnuo) * 100).toFixed(2);
  const segmenti = [
    { classe: "striscia__netto", etichetta: "Netto", valore: r.nettoAnnuo },
    { classe: "striscia__contributi", etichetta: "Contributi", valore: r.totaleContributi },
    { classe: "striscia__imposte", etichetta: "Imposte", valore: r.totaleImposte },
  ];

  const barre = segmenti
    .map(
      (s) =>
        `<span class="striscia__segmento ${s.classe}" style="--quota: ${quota(s.valore)}%"
           title="${esc(s.etichetta)}: ${euro(s.valore)}"></span>`
    )
    .join("");

  const legenda = segmenti
    .map(
      (s) =>
        `<li class="striscia__voce"><span class="striscia__pallino ${s.classe}"></span>
          ${esc(s.etichetta)} ${euro(s.valore)} <span class="striscia__quota">(${percentuale(
          Number(quota(s.valore))
        )})</span></li>`
    )
    .join("");

  return `<div class="striscia-blocco">
    <div class="striscia" role="img" aria-label="Composizione del lordo: ${segmenti
      .map((s) => `${esc(s.etichetta)} ${euro(s.valore)}`)
      .join(", ")}">${barre}</div>
    <ul class="striscia__legenda">${legenda}</ul>
  </div>`;
}

function avvisoSoglia(esito) {
  const supera = esito.voci.supera;
  if (!supera || !supera.superata) return "";

  return `<p class="avviso" role="status">
    I compensi superano la soglia di ${euro(supera.sogliaRicavi)}:
    il regime forfettario non sarebbe applicabile.
    Il calcolo è mostrato comunque, come riferimento.
  </p>`;
}

/* ---------------------------------------------------------------- catena */

function renderCatena(esito) {
  const righe = esito.voci.irpefLorda ? righeDipendente(esito) : righeForfettario(esito);

  return `<table class="catena">
    <caption>Dal lordo al netto, voce per voce</caption>
    <tbody>${righe.join("")}</tbody>
  </table>`;
}

function riga({ etichetta, importo, segno = "", classe = "", nota = "", dettaglio = "" }) {
  return `<tr class="riga ${classe}">
    <th scope="row">${esc(etichetta)}${
    nota ? `<span class="riga__nota">${esc(nota)}</span>` : ""
  }${dettaglio}</th>
    <td class="riga__importo">${segno}${euro(importo)}</td>
  </tr>`;
}

function righeDipendente(esito) {
  const v = esito.voci;
  const r = esito.risultato;
  const righe = [];

  righe.push(riga({ etichetta: "Retribuzione annua lorda", importo: r.lordoAnnuo, classe: "riga--lordo" }));

  righe.push(
    riga({
      etichetta: `${v.contributi.etichetta} (${aliquota(v.contributi.aliquota)})`,
      importo: v.contributi.importo,
      segno: "− ",
      classe: "riga--trattenuta",
    })
  );

  righe.push(riga({ etichetta: "Imponibile fiscale", importo: v.imponibileFiscale, classe: "riga--subtotale" }));

  righe.push(
    riga({
      etichetta: v.irpefLorda.etichetta,
      importo: v.irpefLorda.importo,
      segno: "− ",
      classe: "riga--trattenuta",
      dettaglio: renderScaglioni(v.irpefLorda.dettaglioScaglioni),
    })
  );

  // Le detrazioni sono uno sconto sull'IRPEF lorda: segno opposto, un livello di rientro.
  for (const d of v.detrazioni) {
    righe.push(
      riga({
        etichetta: d.etichetta,
        importo: d.importo,
        segno: "+ ",
        classe: "riga--credito riga--rientro",
      })
    );
  }

  righe.push(riga({ etichetta: "IRPEF netta", importo: v.irpefNetta, classe: "riga--subtotale" }));

  for (const a of v.addizionali) {
    righe.push(
      riga({
        etichetta: a.etichetta,
        importo: a.importo,
        segno: a.esente ? "" : "− ",
        classe: a.esente ? "riga--esente" : "riga--trattenuta",
        nota: a.esente
          ? `esente — imponibile sotto la soglia di ${euro(a.sogliaEsenzione)}`
          : "",
        dettaglio: a.dettaglio ? renderScaglioni(a.dettaglio) : "",
      })
    );
  }

  righe.push(
    riga({ etichetta: "Totale trattenute", importo: r.totaleTrattenute, segno: "− ", classe: "riga--subtotale" })
  );
  righe.push(riga({ etichetta: "Netto annuo", importo: r.nettoAnnuo, classe: "riga--totale" }));

  return righe;
}

function righeForfettario(esito) {
  const v = esito.voci;
  const r = esito.risultato;
  const righe = [];

  righe.push(riga({ etichetta: "Compensi annui lordi", importo: r.lordoAnnuo, classe: "riga--lordo" }));

  righe.push(
    riga({
      etichetta: `${v.coefficienteRedditivita.etichetta} — coefficiente ${aliquota(
        v.coefficienteRedditivita.coefficiente
      )}`,
      importo: v.coefficienteRedditivita.quotaEsclusa,
      segno: "− ",
      classe: "riga--trattenuta",
      nota: "quota di compensi esclusa forfettariamente dal reddito imponibile",
    })
  );

  righe.push(
    riga({
      etichetta: "Reddito forfettario",
      importo: v.coefficienteRedditivita.redditoForfettario,
      classe: "riga--subtotale",
    })
  );

  righe.push(
    riga({
      etichetta: `${v.contributi.etichetta} (${aliquota(v.contributi.aliquota)})`,
      importo: v.contributi.importo,
      segno: "− ",
      classe: "riga--trattenuta",
    })
  );

  righe.push(riga({ etichetta: "Imponibile dell'imposta", importo: v.imponibileImposta, classe: "riga--subtotale" }));

  righe.push(
    riga({
      etichetta: v.impostaSostitutiva.etichetta,
      importo: v.impostaSostitutiva.importo,
      segno: "− ",
      classe: "riga--trattenuta",
    })
  );

  righe.push(
    riga({ etichetta: "Totale trattenute", importo: r.totaleTrattenute, segno: "− ", classe: "riga--subtotale" })
  );
  righe.push(riga({ etichetta: "Netto annuo", importo: r.nettoAnnuo, classe: "riga--totale" }));

  return righe;
}

// Sostituita dall'implementazione reale nel Task 5.
function renderScaglioni() {
  return "";
}
