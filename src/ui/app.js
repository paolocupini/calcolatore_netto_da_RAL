/**
 * Orchestrazione della pagina.
 *
 * E' l'unico modulo impuro del livello UI: carica i dati, tiene lo stato,
 * ascolta gli eventi e monta l'HTML prodotto da render.js.
 * Non conosce nessuna regola fiscale: chiama calcola() e mostra il risultato.
 */

import { calcola } from "../motore/index.js";
import {
  renderSceltaProfilo,
  renderCampi,
  renderRisultato,
  renderSemplificazioni,
  renderFonti,
  renderErrore,
} from "./render.js";
import { numero } from "./formato.js";

// Percorsi relativi: su GitHub Pages il sito e' servito da /<repo>/, non dalla radice.
const PERCORSI = [
  "data/regole-fiscali-2026.json",
  "data/profili.json",
  "data/fonti.json",
];

const stato = {
  regole: null,
  profili: null,
  fonti: null,
  profiloId: null,
};

const el = {};

document.addEventListener("DOMContentLoaded", avvia);

async function avvia() {
  el.app = document.querySelector("#app");

  try {
    [stato.regole, stato.profili, stato.fonti] = await Promise.all(PERCORSI.map(carica));
  } catch (errore) {
    el.app.innerHTML = renderErrore(errore.tipo ?? "generico", errore.dettaglio ?? {
      messaggio: errore.message,
    });
    return;
  }

  const predefinito =
    stato.profili.profili.find((p) => p.predefinito) ?? stato.profili.profili[0];
  stato.profiloId = predefinito.id;

  montaForm();
}

async function carica(percorso) {
  if (location.protocol === "file:") {
    throw Object.assign(new Error("fetch bloccata dal protocollo file"), { tipo: "protocollo" });
  }

  const risposta = await fetch(percorso);
  if (!risposta.ok) {
    throw Object.assign(new Error("risorsa non raggiungibile"), {
      tipo: "risorsa",
      dettaglio: { file: percorso, stato: risposta.status },
    });
  }
  return risposta.json();
}

function montaForm() {
  el.app.innerHTML = `
    <form id="calcolo" novalidate>
      <div id="scelta-profilo"></div>
      <div id="campi" class="campi"></div>
      <button type="submit" class="calcola">Calcola</button>
    </form>
    <div id="esito" aria-live="polite"></div>`;

  el.form = document.querySelector("#calcolo");
  el.profili = document.querySelector("#scelta-profilo");
  el.campi = document.querySelector("#campi");
  el.esito = document.querySelector("#esito");

  el.profili.innerHTML = renderSceltaProfilo(stato.profili, stato.profiloId);
  montaCampi();

  el.profili.addEventListener("change", (evento) => {
    if (evento.target.name !== "profilo") return;
    stato.profiloId = evento.target.value;
    montaCampi();
    el.esito.innerHTML = "";
  });

  el.form.addEventListener("submit", (evento) => {
    evento.preventDefault();
    esegui();
  });
}

function profiloCorrente() {
  return stato.profili.profili.find((p) => p.id === stato.profiloId);
}

function montaCampi() {
  el.campi.innerHTML = renderCampi(profiloCorrente(), stato.regole);
}

function esegui() {
  const profilo = profiloCorrente();
  const valori = {};
  let primoNonValido = null;

  for (const campo of profilo.input) {
    const controllo = el.campi.querySelector(`[name="${campo.id}"]`);
    const messaggio = document.querySelector(`#campo-${campo.id}-errore`);

    if (campo.tipo !== "valuta") {
      pulisciErrore(controllo, messaggio);
      // Le mensilita' sono numeriche, le altre scelte sono chiavi testuali.
      valori[campo.id] = campo.tipo === "scelta" ? Number(controllo.value) : controllo.value;
      continue;
    }

    // input type="number": il browser azzera .value a "" se l'utente digita una
    // virgola, quindi qui non arriva mai testo con virgola decimale da convertire.
    const grezzo = controllo.value.trim();
    const numerico = Number(grezzo);

    // min/max/superabile vengono letti dagli attributi data-*, mai scritti qui:
    // e' render.js, leggendo profili.json, a decidere quali sono i limiti di un
    // campo. Un campo "superabile" dichiara che il suo max e' una soglia che
    // l'utente puo' scegliere consapevolmente di superare (e' il motore, non il
    // form, a segnalarne la conseguenza) — il forfettario deve poter ricevere
    // 90.000 e mostrare comunque il calcolo con l'avviso.
    const min = Number(controllo.dataset.min);
    const max = Number(controllo.dataset.max);
    const superabile = controllo.dataset.superabile === "true";
    const fuoriRange =
      !Number.isFinite(numerico) || numerico < min || (numerico > max && !superabile);

    if (grezzo === "" || fuoriRange) {
      mostraErrore(
        controllo,
        messaggio,
        `Inserisci ${campo.etichetta}: un numero tra ${numero(min)} e ${numero(max)}.`
      );
      primoNonValido = primoNonValido ?? controllo;
      continue;
    }

    pulisciErrore(controllo, messaggio);
    valori[campo.id] = numerico;
  }

  if (primoNonValido) {
    primoNonValido.focus();
    return;
  }

  const esito = calcola({
    profiloId: stato.profiloId,
    input: valori,
    regole: stato.regole,
    profili: stato.profili,
    fonti: stato.fonti,
  });

  el.esito.innerHTML =
    renderRisultato(esito) + renderSemplificazioni(esito.profilo) + renderFonti(esito.meta);
}

function mostraErrore(controllo, messaggio, testo) {
  controllo.setAttribute("aria-invalid", "true");
  messaggio.textContent = testo;
  messaggio.hidden = false;
}

function pulisciErrore(controllo, messaggio) {
  controllo.removeAttribute("aria-invalid");
  if (!messaggio) return;
  messaggio.textContent = "";
  messaggio.hidden = true;
}
