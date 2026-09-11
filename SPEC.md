# Calcolatore RAL → Netto — Specifica di implementazione

Documento operativo per completare il prototipo. Il backend (dati + motore di calcolo) è già scritto e verificato: resta da costruire la UI e mettere online la demo.

---

## 1. Contesto

Esercizio di product building per Jet HR. Va consegnata una pagina web in cui l'utente inserisce degli input, clicca "Calcola" e vede a schermo:

- il netto annuale
- il netto mensile
- tutte le voci trattenute dal lordo, con l'importo di ciascuna

Il dominio è volutamente semplificato. Quello che viene valutato è la capacità di reperire le informazioni corrette, strutturarle in una soluzione e costruire un prototipo funzionante **di cui si è in controllo**. Non conta la quantità di feature: conta che ogni numero mostrato sia spiegabile.

Anno d'imposta modellato: **2026**. Ambito territoriale: **Milano (Lombardia)**.

### Vincolo di consegna

Va inviato un **link** (no allegati). Scelta: repo GitHub pubblico + GitHub Pages attivo sullo stesso repo. Il repo dimostra il controllo sulla logica, Pages dà la demo cliccabile senza installare nulla.

---

## 2. Stack

Vanilla JavaScript (ES modules), HTML, CSS. Nessun framework, nessun build step, nessuna dipendenza.

La ragione è deliberata e va detta in interview: il calcolo è interamente client-side (input numerico → funzione pura → output), quindi un bundler aggiungerebbe superficie senza aggiungere valore. Senza build step il repo si deploya su GitHub Pages così com'è, e il codice che si legge su GitHub è esattamente quello che gira in produzione.

I dati vengono caricati con `fetch()` dai file JSON. Conseguenza pratica: **la pagina non funziona aprendo `index.html` con doppio click** (`file://` blocca le fetch). Serve un server locale: `python3 -m http.server 8000`.

---

## 3. Struttura del repo

```
/
├── index.html
├── README.md
├── SPEC.md                        ← questo documento
├── data/
│   ├── regole-fiscali-2026.json   ✅ fatto
│   ├── fonti.json                 ✅ fatto
│   └── profili.json               ✅ fatto
├── src/
│   ├── motore/
│   │   ├── primitive.js           ✅ fatto
│   │   ├── dipendente.js          ✅ fatto
│   │   ├── forfettario.js         ✅ fatto
│   │   └── index.js               ✅ fatto
│   └── ui/
│       ├── app.js                 ← da fare
│       ├── render.js              ← da fare
│       └── formato.js             ← da fare
├── stile/
│   └── main.css                   ← da fare
└── verifica.mjs                   ✅ fatto (script di controllo, gira con node)
```

**Regola architetturale da non violare:** la UI non conosce le regole fiscali. Nessuna aliquota, soglia o formula deve comparire in `src/ui/` o in `stile/`. La UI chiama `calcola()` e renderizza quello che riceve. Se per mostrare qualcosa in pagina serve un dato fiscale, quel dato va aggiunto al JSON e restituito dal motore, non scritto nel template.

---

## 4. Il backend, già pronto

### 4.1 Separazione in tre livelli

**`data/`** — dati dichiarativi, zero logica.

- `regole-fiscali-2026.json`: aliquote, scaglioni, formule delle detrazioni, coefficienti. Ogni regola ha un `tipo` che il motore sa interpretare (`scaglioni`, `aliquota-piatta`, `aliquota-piatta-con-esenzione`, `fasce-con-formula`) e un `fonteId`.
- `fonti.json`: registro delle fonti. Per ciascuna: ente, riferimento normativo, URL, `dataVerifica`, e `affidabilita` (`primaria` = sito istituzionale dell'ente che emana la norma, `secondaria` = fonte derivata, da riverificare prima di un uso reale).
- `profili.json`: i tre casi d'uso. Ogni profilo dichiara quale motore usare, quali input chiedere, quali regole applicare e le semplificazioni fatte.

**`src/motore/`** — funzioni pure, nessuna aliquota hardcoded.

- `primitive.js`: `applicaScaglioni`, `applicaAliquotaPiatta`, `applicaAliquotaConEsenzione`, `calcolaDetrazione`, `arrotonda`.
- `dipendente.js`: catena di calcolo per lavoro dipendente.
- `forfettario.js`: catena di calcolo per regime forfettario.
- `index.js`: `calcola({profiloId, input, regole, profili, fonti})` — fa dispatch sul motore giusto e risolve i `fonteId` in schede complete.

### 4.2 I tre profili

| Profilo | Motore | Cosa cambia |
|---|---|---|
| `dipendente-indeterminato` | `dipendente` | Caso base |
| `apprendista` | `dipendente` | **Un solo parametro**: INPS 5,84% invece di 9,19% |
| `forfettario` | `forfettario` | **Regime diverso**: imposta sostitutiva al posto di IRPEF + addizionali |

Questa progressione è il punto da raccontare in interview: stesso motore con parametro diverso → motore diverso con stessa interfaccia. Dimostra sia riuso sia capacità di astrazione.

### 4.3 Catene di calcolo

**Dipendente:**
```
RAL
 − contributi INPS (aliquota × RAL)        → imponibile fiscale
 − IRPEF netta:
     IRPEF lorda per scaglioni sull'imponibile
     − detrazione lavoro dipendente (art. 13 TUIR)
     − ulteriore detrazione (cuneo fiscale)
     = max(0, risultato)
 − addizionale regionale Lombardia (a scaglioni, sull'imponibile)
 − addizionale comunale Milano (0,8% sull'imponibile, se > 23.000)
 = netto annuo
netto mensile = netto annuo / mensilità
```

**Forfettario:**
```
compensi lordi
 × coefficiente di redditività              → reddito forfettario
 − contributi INPS Gestione Separata (26,07% del reddito forfettario)
 = base imponibile
 × aliquota sostitutiva (5% o 15%)          → imposta dovuta
netto = compensi − contributi − imposta
```

### 4.4 Due dettagli che generano bug silenziosi

**L'esenzione comunale di Milano non è una franchigia.** Fino a 23.000€ di imponibile non si paga nulla; superata la soglia si paga lo 0,8% sull'**intero** imponibile, non sull'eccedenza. Il salto a 23.001€ è discontinuo e va mostrato correttamente. Il flag `esente: true` nel risultato serve proprio a renderlo esplicito in UI.

**La detrazione cuneo ha fasce miste.** Tra 20.000 e 32.000 è un importo fisso di 1.000€; tra 32.000 e 40.000 decresce linearmente fino a zero. Applicare la formula decrescente sotto i 32.000 è l'errore facile: dà 1.027€ invece di 1.000€ su un imponibile di 31.783€.

**Le addizionali regionali usano ancora i vecchi 4 scaglioni** (0/15k/28k/50k), non i 3 nazionali. La L. 199/2025 ha prorogato al 2028 la facoltà delle Regioni di mantenere lo schema pre-riforma. Non è un errore nel JSON: è la norma.

### 4.5 Forma del risultato

`calcola()` restituisce:

```js
{
  profiloId, input,
  voci: {
    contributi: { etichetta, aliquota, importo, fonteId },
    imponibileFiscale,
    irpefLorda: { etichetta, importo, dettaglioScaglioni[], fonteId },
    detrazioni: [{ id, etichetta, importo, fonteId, formula }],
    totaleDetrazioni, detrazioniEffettive, irpefNetta,
    addizionali: [{ id, etichetta, importo, fonteId, esente?, sogliaEsenzione?, dettaglio? }],
    totaleAddizionali
  },
  risultato: {
    lordoAnnuo, totaleContributi, totaleImposte, totaleTrattenute,
    nettoAnnuo, nettoMensile, mensilita, aliquotaMediaEffettiva
  },
  profilo: { id, nome, descrizione, semplificazioni[] },
  meta: {
    annoImposta, dataUltimaVerifica, ambitoTerritoriale,
    fontiUtilizzate: [{ id, titolo, ente, riferimentoNormativo, url,
                        affidabilita, dataVerifica, dataScadenzaVerifica,
                        daRiverificare, giorniDallaVerifica, note }]
  }
}
```

Il forfettario ha una forma di `voci` diversa (`coefficienteRedditivita`, `imponibileImposta`, `impostaSostitutiva`, `supera`) ma **`risultato` e `meta` hanno la stessa forma per tutti i profili**. La UI può renderizzare il blocco dei totali in modo uniforme e ramificare solo sul dettaglio delle voci.

---

## 5. Cosa resta da costruire

### 5.1 Flusso utente

```
1. Scelta profilo        → 3 opzioni, selezione singola
2. Input dinamici        → generati da profilo.input, non hardcoded
3. "Calcola"             → chiama calcola(), mostra i risultati
4. Risultati in pagina   → netto + scomposizione voce per voce
```

Gli input sono dichiarati nel JSON (`tipo: "valuta" | "scelta" | "scelta-da-parametro" | "scelta-da-imposta"`). La UI deve generarli leggendo `profilo.input`. Aggiungere un profilo con input diversi non deve richiedere di toccare la UI.

### 5.2 Cosa mostrare nei risultati

**In evidenza:** netto annuo e netto mensile. Sono la risposta alla domanda dell'utente.

**Scomposizione:** ogni voce trattenuta, in ordine di applicazione, con il suo importo. Per il dipendente: contributi INPS → imponibile fiscale → IRPEF lorda → detrazioni (in segno opposto, sono uno sconto) → IRPEF netta → addizionale regionale → addizionale comunale. Deve essere leggibile come una catena, non come una lista piatta: l'imponibile fiscale è un passaggio intermedio, non una trattenuta.

**Dettagli espandibili:** `dettaglioScaglioni` permette di mostrare quanto reddito è stato tassato a ciascuna aliquota. È il modo per rendere evidente che l'IRPEF è progressiva e non si paga il 33% su tutto — un fraintendimento molto comune.

**Fonti:** ogni voce deve poter risalire alla sua fonte. Il badge mostra ente + `dataVerifica`; `affidabilita: "secondaria"` va segnalato visivamente; `daRiverificare: true` è un avviso attivo. Questo è un requisito esplicito, non un extra: serve a capire quando il dato diventa obsoleto.

**Semplificazioni:** `profilo.semplificazioni` va mostrato in pagina, non nascosto nel README. Dichiarare i limiti del modello fa parte del lavoro.

### 5.3 Requisiti di formato

- Importi in euro, formato italiano: `formato.js` con `Intl.NumberFormat("it-IT", {style:"currency", currency:"EUR"})`
- Percentuali con 2 decimali, separatore decimale virgola
- Nessun numero grezzo non formattato a schermo

### 5.4 Gestione errori e stati vuoti

- Input vuoto o non numerico: messaggio che dice cosa inserire, non "errore"
- Lordo a 0: risultato valido (tutto zero), non un errore
- Forfettario sopra 85.000€: il motore restituisce `voci.supera.superata = true`. Va mostrato come avviso — il regime non sarebbe applicabile — ma il calcolo si mostra comunque
- `fetch` dei JSON fallita: messaggio che spiega che serve un server locale, con il comando da eseguire

---

## 6. Direzione visiva

Prima di scrivere CSS, fai un passaggio di pianificazione: definisci palette (4–6 valori esadecimali nominati), scelta tipografica con i ruoli, concetto di layout. Poi rileggi il piano e chiediti se ogni scelta è motivata da *questo* progetto o se è il default che produrresti per qualsiasi pagina simile. Se è il default, cambialo e annota perché.

Punto di partenza suggerito, da valutare criticamente e non da eseguire alla lettera: il soggetto qui è un **documento fiscale** — una busta paga è una catena di sottrazioni verificabili, ed è un oggetto che le persone leggono con diffidenza, cercando di capire dove sono finiti i soldi. La qualità che la pagina deve avere è la **verificabilità**: ogni numero deve sembrare controllabile, non asserito. Questo suggerisce allineamento numerico curato, gerarchia tra passaggi intermedi e trattenute effettive, e un trattamento che renda leggibile la progressione dall'alto verso il basso.

Da evitare perché generico: card arrotondate tutte uguali con la stessa ombra grigia, eyebrow in maiuscoletto spaziato sopra ogni titolo, gradiente come decorazione, fondo crema con accento terracotta, animazioni di entrata su ogni sezione.

Qualità minima non negoziabile: responsive fino a mobile, focus da tastiera visibile, `prefers-reduced-motion` rispettato, contrasto accessibile.

---

## 7. Casi di test

Numeri prodotti dal motore e verificati a mano. Vanno usati come regressione: se dopo una modifica non tornano, la modifica è sbagliata.

### Dipendente indeterminato — RAL 35.000, 13 mensilità

| Voce | Importo |
|---|---|
| Contributi INPS (9,19%) | 3.216,50 |
| Imponibile fiscale | 31.783,50 |
| IRPEF lorda | 7.688,56 |
| Detrazione art. 13 TUIR | 1.581,52 |
| Ulteriore detrazione (cuneo) | 1.000,00 |
| IRPEF netta | 5.107,04 |
| Addizionale regionale | 454,98 |
| Addizionale comunale | 254,27 |
| **Totale trattenute** | **9.032,79** |
| **Netto annuo** | **25.967,21** |
| **Netto mensile** | **1.997,48** |
| Aliquota media effettiva | 25,81% |

### Dipendente indeterminato — RAL 22.000, 13 mensilità (caso limite: esenzione comunale)

| Voce | Importo |
|---|---|
| Contributi INPS | 2.021,80 |
| Imponibile fiscale | 19.978,20 |
| IRPEF lorda | 4.594,99 |
| Detrazione art. 13 TUIR | 2.644,30 |
| Ulteriore detrazione (cuneo) | 0,00 |
| IRPEF netta | 1.950,69 |
| Addizionale regionale | 263,16 |
| Addizionale comunale | **0,00 — esente** |
| **Netto annuo** | **17.764,35** |
| **Netto mensile** | **1.366,49** |

### Apprendista — RAL 24.000, 13 mensilità

| Voce | Importo |
|---|---|
| Contributi INPS (5,84%) | 1.401,60 |
| Imponibile fiscale | 22.598,40 |
| IRPEF lorda | 5.197,63 |
| Detrazioni totali | 3.404,45 |
| IRPEF netta | 1.793,18 |
| Addizionale regionale | 304,55 |
| Addizionale comunale | 0,00 — esente |
| **Netto annuo** | **20.500,67** |
| **Netto mensile** | **1.576,97** |

### Forfettario — 40.000, coefficiente 78%, aliquota 15%

| Voce | Importo |
|---|---|
| Reddito forfettario (78%) | 31.200,00 |
| Contributi Gestione Separata (26,07%) | 8.133,84 |
| Imponibile imposta | 23.066,16 |
| Imposta sostitutiva (15%) | 3.459,92 |
| **Netto annuo** | **28.406,24** |
| Aliquota media effettiva | 28,98% |

Comando di verifica: `node verifica.mjs`

---

## 8. Criteri di accettazione

- [ ] I tre profili sono selezionabili e producono i numeri della sezione 7
- [ ] Gli input sono generati da `profili.json`, non scritti nell'HTML
- [ ] Nessuna aliquota, soglia o formula compare in `src/ui/` o `stile/`
- [ ] Ogni voce trattenuta è visibile con il suo importo
- [ ] Ogni voce è riconducibile alla sua fonte, con ente e data di verifica
- [ ] Le fonti `secondaria` sono distinguibili dalle `primaria`
- [ ] Il caso RAL 22.000 mostra l'addizionale comunale come esente, non come zero generico
- [ ] Il dettaglio degli scaglioni IRPEF è consultabile
- [ ] Le semplificazioni del profilo sono in pagina
- [ ] Importi formattati in euro, formato italiano
- [ ] Funziona da mobile, focus da tastiera visibile
- [ ] `node verifica.mjs` passa
- [ ] Demo online raggiungibile via GitHub Pages

---

## 9. Deploy

1. Repo GitHub pubblico, tutto alla root
2. Settings → Pages → Source: `Deploy from a branch`, branch `main`, cartella `/ (root)`
3. Verificare che la demo carichi i JSON senza errori 404 (i path in `fetch` devono essere relativi, non assoluti)
4. Nell'email: link alla demo Pages, con il link al repo nel README

---

## 10. Da tenere pronto per l'interview

Il prototipo copre il caso standard. Le domande prevedibili riguardano quello che non copre — vale la pena avere una risposta pronta, non una scusa.

**Semplificazioni consapevoli**, oltre a quelle già dichiarate in `profili.json`:

- Nessun carico familiare, nessuna detrazione per oneri
- Rapporto di lavoro per l'anno intero: le detrazioni non sono ragguagliate ai giorni lavorati
- Non modellato il contributo aggiuntivo IVS dell'1% oltre il massimale
- Non modellata la somma non imponibile per redditi sotto i 20.000€ (non è una detrazione ma un abbattimento della base imponibile: richiederebbe un passaggio in più nella catena)
- TFR escluso dal netto: viene accantonato, non erogato
- Nessun CCNL specifico, nessuna voce variabile, nessun conguaglio
- Le addizionali sono calcolate per competenza sull'anno corrente; nella realtà il meccanismo è sfasato di un anno (saldo dell'anno precedente in 11 rate + acconto a novembre)

**Come si estende il modello:**

- Nuova regione → una voce in `regole-fiscali-2026.json`, zero codice
- Nuovo comune → idem, il tipo `aliquota-piatta-con-esenzione` copre già il caso con e senza franchigia
- Nuovo anno d'imposta → si duplica il file dati, il motore non cambia
- Nuovo tipo di contratto che riusa la catena del dipendente → un profilo in `profili.json`, zero codice
- Nuovo regime fiscale strutturalmente diverso → un nuovo motore che espone la stessa interfaccia e si registra in `MOTORI`

**Cosa servirebbe per andare in produzione:**

- Verifica di tutte le fonti `secondaria` sui siti istituzionali (in particolare le circolari INPS annuali, che sono il parametro più volatile)
- Test automatici sui casi limite, non solo lo script di verifica manuale
- Un processo di aggiornamento annuale dei dati, con owner e scadenza — il campo `dataScadenzaVerifica` esiste per innescarlo
