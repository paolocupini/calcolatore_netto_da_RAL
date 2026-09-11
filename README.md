# Dalla RAL al netto

Calcolatore da retribuzione lorda a netto. Anno d'imposta **2026**, ambito
**Milano (Lombardia)**. Ogni trattenuta è mostrata con il suo importo e con la
fonte da cui il dato proviene.

**Demo:** <https://paolocupini.github.io/calcolatore_netto_da_RAL/>

## Come farlo girare in locale

Il calcolo è interamente client-side e non c'è build step, ma i dati fiscali
sono caricati con `fetch()` dai file JSON: il browser blocca le fetch sulle
pagine aperte da disco. Serve un server locale.

```bash
python3 -m http.server 8000
```

Poi apri <http://localhost:8000>.

## Verifica

```bash
node --test test/   # asserisce i casi di SPEC.md §7 e il livello UI
node verifica.mjs   # stampa le catene di calcolo per ispezione a occhio
```

Richiede Node ≥ 18. Nessuna dipendenza da installare: `package.json` esiste solo
per dichiarare `"type": "module"`.

## Com'è fatto

Tre livelli, con una regola che non viene violata: **la UI non conosce le regole
fiscali**.

- `data/` — dati dichiarativi, zero logica. Aliquote, scaglioni, formule delle
  detrazioni, registro delle fonti, definizione dei profili. Aggiungere una
  regione o un anno d'imposta si fa qui, senza toccare codice.
- `src/motore/` — funzioni pure. Nessuna aliquota scritta nel codice: ogni
  funzione riceve la regola letta dal JSON e si limita a interpretarla.
- `src/ui/` — `formato.js` (formattazione it-IT), `render.js` (dal risultato
  all'HTML, funzioni pure), `app.js` (caricamento, stato, eventi).

La UI chiama `calcola()` e renderizza quello che riceve. Se per mostrare qualcosa
in pagina serve un dato fiscale, quel dato va aggiunto al JSON e restituito dal
motore, non scritto nel template.

## Cosa questo calcolo non considera

Le semplificazioni sono dichiarate in pagina, profilo per profilo, non nascoste
qui. In sintesi: nessun carico familiare e nessuna detrazione per oneri; rapporto
di lavoro per l'anno intero; TFR escluso perché accantonato e non erogato;
nessun CCNL specifico e nessun conguaglio. Le addizionali sono calcolate per
competenza sull'anno corrente, mentre nella realtà il meccanismo è sfasato di un
anno.

Le fonti marcate `secondaria` vanno riverificate sui siti istituzionali prima di
qualunque uso reale. Il campo `dataScadenzaVerifica` in `data/fonti.json` serve a
innescare l'aggiornamento annuale.

## Pubblicazione

La demo è pubblicata con GitHub Pages: Settings → Pages → Source *Deploy from a
branch*, branch `master`, cartella `/ (root)`. Ogni push su `master` aggiorna il
sito.

Non c'è build step: i file vengono serviti così come sono nel repo, quindi il
codice che si legge su GitHub è esattamente quello che gira nella demo. I
percorsi nelle `fetch` sono relativi, ed è la ragione per cui il sito funziona
servito da `/<repo>/` invece che dalla radice del dominio.
