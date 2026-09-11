# Design della UI — Calcolatore RAL → Netto

Data: 2026-09-11
Stato: approvato, pronto per il piano di implementazione

Questo documento non sostituisce `SPEC.md`. `SPEC.md` definisce requisiti, vincoli
e casi di test; resta la fonte di verità su cosa il prototipo deve fare. Qui si
decide **come** costruire il livello che manca — la UI — e si motivano le scelte
che `SPEC.md` lascia aperte: trattamento visivo, confini tra i moduli, stati di
errore, ordine di lavoro.

---

## 1. Stato di partenza

Il motore di calcolo e i dati esistono e sono verificati. Sono però tutti
raccolti in `data/fonti_tassazione/`, mentre `verifica.mjs` importa
`./src/motore/index.js` e `./data/*.json`: dalla posizione attuale non gira.

Il riordino secondo l'albero di `SPEC.md` §3 risolve il problema senza toccare
una riga di codice — gli import sono già scritti per il layout di destinazione.
È uno spostamento di file, non un refactor.

```
data/fonti_tassazione/regole-fiscali-2026.json   →  data/regole-fiscali-2026.json
data/fonti_tassazione/fonti.json                 →  data/fonti.json
data/fonti_tassazione/profili.json               →  data/profili.json
data/fonti_tassazione/primitive.js               →  src/motore/primitive.js
data/fonti_tassazione/dipendente.js              →  src/motore/dipendente.js
data/fonti_tassazione/forfettario.js             →  src/motore/forfettario.js
data/fonti_tassazione/index.js                   →  src/motore/index.js
data/fonti_tassazione/verifica.mjs               →  verifica.mjs
```

Il ramo `master` non ha commit. Non si può creare un branch da un ramo senza
commit: serve prima un commit iniziale su `master`.

---

## 2. Presentazione del risultato

### 2.1 Scelta: impaginazione a cedolino

Il risultato è una colonna verticale di righe, una per passaggio della catena di
calcolo. Le etichette sono allineate a sinistra, gli importi a destra su **un
unico asse decimale condiviso da tutte le righe**, subtotali inclusi.

- Le trattenute portano il segno `−`, le detrazioni il segno `+`, nella stessa
  colonna: l'aritmetica si legge scorrendo il dito.
- I passaggi intermedi (imponibile fiscale, IRPEF netta) sono **subtotali** —
  peso tipografico maggiore, filetto sopra — non voci di elenco. Non sono
  trattenute e non devono sembrarlo.
- Il netto annuo chiude con un doppio filetto.
- Un solo livello di rientro, usato per il dettaglio degli scaglioni e per le
  detrazioni.

La qualità che la pagina deve avere è la **verificabilità**: ogni numero deve
sembrare controllabile, non asserito. L'asse decimale condiviso e i filetti di
subtotale sono ciò che la produce.

### 2.2 Alternative scartate

**Waterfall a barre** (lordo che si assottiglia fino al netto). Scartata: con RAL
35.000 l'addizionale comunale vale 254 € — lo 0,7% della larghezza, invisibile.
Nasconde la progressività invece di mostrarla, e la barra fa un lavoro che il
numero fa già meglio.

**Due colonne lordo/netto con le trattenute in mezzo.** Scartata: la catena è
sequenziale, non bilaterale. Inoltre si rompe sul forfettario, che ha una forma
di `voci` diversa.

**Griglia di card.** Esclusa da `SPEC.md` §6 come trattamento generico.

### 2.3 Unico elemento grafico ammesso

Sotto i numeri di testa, una striscia di proporzione a tre segmenti — netto /
contributi / imposte. Risponde a colpo d'occhio alla domanda "dove sono finiti i
soldi", che una colonna di numeri non risponde. Se in revisione legge come
decorazione, si toglie: non porta informazione che non sia già nel testo.

---

## 3. Direzione visiva

### 3.1 Palette

Sei valori nominati, base chiara:

| Token | Valore | Ruolo |
|---|---|---|
| `--carta` | `#FBFBF9` | fondo pagina — carta, bianco caldo appena percettibile |
| `--inchiostro` | `#16181C` | testo primario, tutti gli importi |
| `--inchiostro-tenue` | `#5C626B` | etichette, testo secondario, metadati delle fonti |
| `--riga` | `#D8D6D0` | filetti — le righe del registro |
| `--trattenuta` | `#8C2F1E` | importi trattenuti — rosso ossido scuro |
| `--credito` | `#1F5A3D` | detrazioni e netto — verde scuro |

Rosso e verde qui sono **semantica contabile, non sentimento**: una trattenuta ha
un segno. Per questo i valori sono scuri e desaturati, non la coppia riflessa
`#e53935` / `#22c55e` che legge come allarme/successo. Entrambi superano AA su
`--carta`. `--riga` è un token a sé perché i filetti fanno lavoro strutturale,
non decorativo.

Tema scuro: fondo a `#16181C`, i due accenti alzati di circa il 15% di
luminosità. Stessi sei ruoli, nessun token in più. Gestito con
`prefers-color-scheme`.

### 3.2 Tipografia

Una sola famiglia, stack di sistema. Due ruoli:

- **Cifre**: `font-variant-numeric: tabular-nums`. Non è una scelta estetica —
  senza cifre tabulari l'asse decimale non esiste e l'impaginazione a cedolino
  non funziona.
- **Prosa ed etichette**: stessa famiglia, corpo minore, `--inchiostro-tenue`.

Nessun carattere display per i titoli: sarebbe esattamente la mossa decorativa
che `SPEC.md` §6 mette in guardia.

### 3.3 Impaginazione

Colonna singola, larghezza massima ~52rem. Nessun box, nessuna ombra, nessun
raggio superiore a 2px: la struttura è fatta di filetti e spazio bianco, come in
un cedolino reale.

Ordine verticale: scelta del profilo → campi → pulsante Calcola → numeri di testa
(netto annuo, netto mensile, aliquota media effettiva come didascalia) → striscia
di proporzione → catena delle voci → semplificazioni → fonti.

### 3.4 Autocritica

`SPEC.md` §6 chiede di rileggere il piano e distinguere le scelte motivate da
*questo* progetto dai default.

- Bianco caldo + sans di sistema + filetti è vicino a un default "editorial
  minimal". Ciò che rende la scelta specifica è l'assenza totale di card, l'asse
  decimale condiviso e il doppio filetto sul totale: vengono dal dominio. Si
  tiene.
- La coppia rosso/verde è quasi un default. Si tiene, ma con i valori scuri e
  con la giustificazione contabile — se il segno non fosse informazione, il
  colore andrebbe tolto.
- **Cambiato rispetto al default**: il risultato non va in un pannello bordato
  per separarlo dal form. Il confine è un filetto e un titolo, perché un cedolino
  non ha pannelli. Ed è tolta del tutto l'animazione di entrata, non solo
  disattivata sotto `prefers-reduced-motion`.

---

## 4. Moduli

Tre file, come da `SPEC.md` §3. Il vincolo architetturale non negoziabile resta:
nessuna aliquota, soglia o formula in `src/ui/` o `stile/`.

**`src/ui/formato.js`** — funzioni pure, nessun DOM, nessuna conoscenza fiscale.
`euro(n)`, `percentuale(n)`, `aliquota(frazione)`, `numero(n)`. Tutte su
`Intl.NumberFormat("it-IT")`.

**`src/ui/render.js`** — funzioni da stato a DOM. Nessuna `fetch`, nessuno stato
proprio.

- `renderCampi(profilo, regole)` — genera i campi leggendo `profilo.input`, con
  uno `switch` sui quattro `tipo` dichiarati: `valuta`, `scelta`,
  `scelta-da-parametro`, `scelta-da-imposta`.
- `renderRisultato(esito)`, `renderScaglioni`, `renderFonti`,
  `renderSemplificazioni`, `renderErrore`.

**`src/ui/app.js`** — carica i tre JSON con `Promise.all`, tiene lo stato
(`{ profiloId, valori }`), collega gli eventi, chiama `calcola()`, passa il
risultato a `render`. Tutta la gestione degli errori vive qui.

### 4.1 Nota sul vincolo architetturale

`scelta-da-parametro` e `scelta-da-imposta` risolvono le opzioni leggendo
`regole.parametri[x].opzioni` e `regole.imposte[x].opzioni`. È lettura di un file
dati, non conoscenza di una regola: la UI non sa cosa significhi un coefficiente
di redditività, sa solo che quel nodo espone `opzioni` con `etichetta`.
Il vincolo regge.

---

## 5. Stati di errore e casi limite

**`fetch` fallita.** Sostituzione dell'intera area di contenuto, non un avviso
marginale. Si distingue il caso `file://` (controllando `location.protocol`) dal
404 su percorso sbagliato, che nomina il file mancante. Nel primo caso il testo
spiega che il browser blocca le fetch sui file aperti da disco e riporta il
comando `python3 -m http.server 8000` in un `<code>` selezionabile.

**Input vuoto o non numerico.** Messaggio in linea sotto il campo, collegato con
`aria-describedby`, campo con `aria-invalid="true"`. Validazione al submit, non a
ogni tasto. Il testo dice cosa inserire — "Inserisci la RAL, un numero tra 0 e
500.000" — non "errore".

**Lordo a 0.** Risultato valido, catena completa con tutti zeri. Non è un errore.
L'aliquota media effettiva mostra `—` invece di `0,00%`: la divisione non è
definita a zero. Il motore non cambia, è la UI a rendere il trattino.

**Forfettario oltre 85.000.** `voci.supera.superata === true` produce un avviso
in `role="status"` sopra il risultato: il regime non sarebbe applicabile, ma il
calcolo si mostra comunque. L'input **non** blocca l'inserimento oltre soglia —
il motore calcola oltre la soglia di proposito, e l'avviso è il punto.

**Esenzione comunale.** La riga mostra `0,00` accompagnato dalla nota "esente —
imponibile sotto la soglia di 23.000 €", mai uno zero nudo. La soglia viene da
`a.sogliaEsenzione` nel risultato, non è scritta nel template.

**Fonte secondaria.** Glifo più testo "fonte secondaria, da riverificare"
accanto al badge: mai colore da solo. Con `daRiverificare: true` diventa un
avviso attivo che elenca le fonti scadute e i `giorniDallaVerifica`.

**Fonte mancante.** `raccogliFonti` può restituire `{ id, mancante: true }`. Va
reso come "fonte non trovata: {id}" invece di andare in errore su `undefined.ente`.

---

## 6. Accessibilità

Requisiti minimi, non opzionali:

- `<form>` reale con pulsante di submit; scelta del profilo come `<fieldset>` di
  radio nativi, non `div` stilizzati.
- Area del risultato in `aria-live="polite"`: il ricalcolo va annunciato.
- Dettaglio degli scaglioni in `<details>`/`<summary>` — semantica e tastiera
  native, zero JavaScript.
- Focus visibile e disegnato (2px, offset, `--inchiostro`). Mai `outline: none`.
- La catena delle voci è una `<table>` con veri `<th>` di riga, perché è una
  tabella.
- `prefers-reduced-motion` rispettato. Tolte le animazioni di entrata, resta da
  coprire la sola transizione della striscia di proporzione.
- Responsive fino a mobile, contrasto AA su entrambi i temi.

---

## 7. Ordine di lavoro

1. Commit iniziale su `master` con il backend esistente e `SPEC.md` (il ramo non
   ha commit: senza questo non si può creare un branch).
2. Branch `feat/ui`.
3. Riordino dei file secondo §1, con `git mv`, in un commit isolato senza
   modifiche di contenuto. Subito dopo `node verifica.mjs` deve passare: dimostra
   che lo spostamento non ha rotto gli import prima che esista una riga di UI.
4. `formato.js` → `render.js` → `app.js` → `stile/main.css` → `index.html`.
5. `README.md`.
6. Verifica (§8).
7. Merge `--no-ff` di `feat/ui` in `master`.

L'attivazione di GitHub Pages in Settings resta a carico dell'autore del repo; la
procedura è documentata in `SPEC.md` §9 e va richiamata nel README.

---

## 8. Verifica prima di dire "fatto"

- `node verifica.mjs` passa.
- I quattro casi di `SPEC.md` §7 sono riprodotti **nel browser** e confrontati
  con le tabelle, compreso RAL 22.000 che deve mostrare l'addizionale comunale
  come esente e non come zero generico.
- `grep -rE '0\.0919|0\.0584|0\.2607|23000|85000|28000|1955|1000' src/ui/ stile/`
  non trova nulla: è la prova meccanica che il vincolo di §4 ha retto. Sono
  escluse dal pattern le aliquote in forma breve (`0.23`, `0.8`) perché in CSS
  darebbero falsi positivi su opacità e `rgba()`; le corrispondenze vanno
  comunque lette, non contate.
- Passaggio da sola tastiera: tab sui campi, calcolo, apertura del dettaglio
  scaglioni, raggiungibilità di ogni link alle fonti.
- Controllo su viewport mobile.
- Tutte le caselle di `SPEC.md` §8 spuntate.
