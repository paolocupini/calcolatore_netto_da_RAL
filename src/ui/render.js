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

// Task 4 allarga questo import a { euro, percentuale, aliquota, numero }.
import { numero } from "./formato.js";

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
