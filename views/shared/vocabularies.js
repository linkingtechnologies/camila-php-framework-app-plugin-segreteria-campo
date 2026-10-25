// views/shared/vocabularies.js
//
// Vocabolari di `categoria` e `tipologia` letti dalla configurazione della
// colonna, invece che copiati in ogni vista.
//
// La fonte e' `describe()`: il framework e' stato esteso perche' il describe
// fonda nella colonna la sua configurazione Camila — fra cui `options`, i
// valori ammessi. Vedi specs/api/describe/design.md.
//
// Divergenza dal contratto dei moduli condivisi (AGENTS.md §Moduli condivisi):
// qui non si compone markup, quindi niente fabbrica con `html` e `rerender`.
// Sono funzioni di dati, e la cache vive nel modulo.

// Cache per tabella: la promessa, non il risultato, cosi' due viste che
// partono insieme fanno una sola chiamata. Contiene il describe intero, non i
// soli vocabolari: ordine delle colonne e vocabolari vengono dalla stessa
// chiamata.
const cache = new Map();

// Accetta sia la stringa CSV della copia di riserva sia l'array che arriva
// dal describe.
export function parseCsvOptions(s) {
  const parti = Array.isArray(s) ? s : String(s || "").split(",");
  return parti.map(x => String(x).trim()).filter(Boolean);
}

/**
 * Costruisce il catalogo da un CSV di tipologie con le categorie marcate `--Nome`.
 *
 * L'etichetta dopo `--` deve coincidere **carattere per carattere** con quella
 * in `categorieCsv`: l'associazione tipologia→categoria e' una Map esatta.
 *
 * @param {string} tipologieCsv  elenco tipologie, con marcatori `--Categoria`
 * @param {string} [categorieCsv] elenco categorie; se assente si ricava dai marcatori
 * @returns {{categories: string[], byCat: Object, all: string[], itemToGroup: Map}}
 */
export function buildCatalog(tipologieCsv, categorieCsv) {
  const byCat = {};
  const all = [];
  const itemToGroup = new Map();
  const dalleMarcature = [];
  let corrente = null;

  for (const p of parseCsvOptions(tipologieCsv)) {
    if (p.startsWith("--")) {
      corrente = p.slice(2).trim();
      if (!byCat[corrente]) byCat[corrente] = [];
      if (!dalleMarcature.includes(corrente)) dalleMarcature.push(corrente);
      continue;
    }
    all.push(p);
    if (corrente) {
      byCat[corrente].push(p);
      itemToGroup.set(p, corrente);
    }
  }

  const categories = categorieCsv
    ? parseCsvOptions(categorieCsv)
    : ["Non assegnata", ...dalleMarcature];

  return { categories, byCat, all, itemToGroup };
}

// Copia di riserva: scatta se il describe non risponde, o se risponde senza la
// configurazione Camila (framework non esteso). Senza, le tendine resterebbero
// vuote e l'operatore non potrebbe classificare nulla. E' l'unica copia rimasta
// nel plugin — prima erano quattro.
export const FALLBACK = {
  mezzi: {
    categoria: "Non assegnata,VEICOLI",
    tipologia: "Non assegnata,--VEICOLI,AUTOCARRO,AUTOCARRO CON GRU / RAGNO,CAMPER,FURGONE ATTREZZATO,FURGONE TRASPORTO MATERIALI,QUAD / MOTOCICLO,TRATTORE STRADALE,VEICOLO 4X4,VEICOLO 4X4 ATTREZZATO,VEICOLO 4X4 CON MODULO AIB FISSO,VEICOLO TRASPORTO PERSONE (PULMINO/AUTOBUS)"
  },
  "mov-consumabili": {
    tipologia: "CARICO,SCARICO,TRASFERIMENTO",
    articolo: "Sacco sabbia vuoto,Sacco sabbia pieno,Sacco juta vuoto,Sacco juta pieno,Sacco PTT vuoto,Sacco PTT pieno,Big Bag vuoto,Big Bag pieno,Pasto,Acqua",
    "unita-di-misura": "pezzo,bancale,bottiglia,Kg,l,confezione"
  },
  "squadre-dichiarate": {
    "mansione-principale": "OPERATORE LOGISTICO,OPERATORE IDROGEOLOGICO,OPERATORE MOVIMENTO TERRA,OPERATORE INSACCHETTAMENTO,OPERATORE MOTOSEGA,OPERATORE SUB,OPERATORE CINOFILO,OPERATORE SEGRETERIA,OPERATORE SALA OPERATIVA,OPERATORE RADIO,OPERATORE NAUTICO,ELETTRICISTA,MURATORE,IDRAULICO,OPERATORE SANITARIO,OPERATORE CUCINA,OPERATORE ANTINCENDIO,OPERATORE A CAVALLO,OPERATORE SUBACQUEO"
  },
  volontari: {
    mansione: "OPERATORE LOGISTICO,OPERATORE IDROGEOLOGICO,OPERATORE MOVIMENTO TERRA,OPERATORE INSACCHETTAMENTO,OPERATORE MOTOSEGA,OPERATORE SUB,OPERATORE CINOFILO,OPERATORE SEGRETERIA,OPERATORE SALA OPERATIVA,OPERATORE RADIO,OPERATORE NAUTICO,ELETTRICISTA,MURATORE,IDRAULICO,OPERATORE SANITARIO,OPERATORE CUCINA,OPERATORE ANTINCENDIO,OPERATORE A CAVALLO,OPERATORE SUBACQUEO"
  },
  servizi: {
    // la colonna dichiara un primo valore vuoto: "nessuno stato scelto"
    stato: ",Segnalato,In corso,Concluso"
  },
  richieste: {
    stato: "A - Presa in carico,B - In valutazione,C1 - In lavorazione,C2 - In attesa di lavorazione,D1 - Eseguita,D2 - Respinta",
    "tipo-richiesta": "Interna,Esterna",
    priorita: "1 - Urgente,2 - Alta,3 - Normale,4 - Bassa,5 - Molto bassa"
  },
  materiali: {
    categoria: "Non assegnata,CISTERNE,CONTAINER,CUCINE,MATERIALE ANTINCENDIO,MATERIALE IDROGEOLOGICO,MATERIALE LOGISTICO,CARRELLI / RIMORCHI,MEZZI D'OPERA,VEICOLI",
    tipologia: "Non assegnata,--CISTERNE,CISTERNA ACQUA,CISTERNA CARBURANTE,--CONTAINER,CONTAINER ATTREZZATO,CONTAINER DA TRASPORTO,--CUCINE,MODULO CUCINA,ATTREZZATURA DA CUCINA,--MATERIALE ANTINCENDIO,ESTINTORE,MODULO AIB SCARRABILE,VASCA COMPONIBILE AIB,--MATERIALE IDROGEOLOGICO,IMBARCAZIONE,ACCESSORI IMBARCAZIONE,IDROVORA / MOTOPOMPA,ELETTROPOMPA,TUBAZIONI HCP,MANICHETTE,INSACCHETTATRICE,MOTOSEGA,--MATERIALE LOGISTICO,QUADRI ELETTRICI,MATERIALE ELETTRICO (CAVI),GENERATORI,SISTEMI DI ILLUMINAZIONE,ATTREZZATURA PER CLIMATIZZAZIONE,TENDE - TENSOSTRUTTURE,ACCESSORI TENDE,MATERIALE LOGISTICO PER TENDE (CESTELLI / CASSE),GAZEBO,--CARRELLI / RIMORCHI,CARRELLO,CARRELLO ATTREZZATO,RIMORCHIO,ROULOTTE,--MEZZI D'OPERA,CARRELLO ELEVATORE,DUMPER,CIPPATRICE,ESCAVATORE / MINIESCAVATORE,MOTOCARRIOLA,PALA / MINIPALA,SOLLEVATORE IDRAULICO,TERNA,--VEICOLI,ACCESSORI AUTOCARRO"
  }
};

/**
 * Vocabolari grezzi di una worktable, come mappa {colonna: csv}.
 * I nomi di colonna sono quelli pubblici: il describe esteso espone quelli,
 * non i nomi fisici.
 * In caso di errore ritorna il fallback della tabella, o {} se non ne ha uno.
 */
/**
 * Column configuration of a worktable, as {column: meta}, where meta is the
 * `config` block the extended describe merges into each column: label, type,
 * sequence, required, readonly, unique, visible, maxlength, options.
 *
 * Returns { columns, extended }. `extended` is false when the framework does
 * not merge the configuration: the caller then knows the absence of data means
 * "unknown", not "none".
 *
 * The cache holds the describe for the whole table, so asking for vocabularies
 * and asking for the column order costs one call, not two.
 */
export function loadColumns(client, table) {
  if (cache.has(table)) return cache.get(table);

  const p = client
    .table(table)
    .describe()
    .then(desc => {
      const cols = Array.isArray(desc) ? desc : (desc && desc.columns) || [];

      // `label` is on every column of a worktable: if it never shows up, this
      // is not the extended describe.
      const extended = cols.some(c => c && c.label);

      const columns = {};
      for (const c of cols) {
        const nome = String((c && c.name) || "").trim();
        if (nome) columns[nome] = c;
      }
      return { columns, extended };
    })
    .catch(() => ({ columns: {}, extended: false }));

  cache.set(table, p);
  return p;
}

/**
 * Vocabolari grezzi di una worktable, come mappa {colonna: elenco}.
 * I nomi di colonna sono quelli pubblici: il describe esteso espone quelli,
 * non i nomi fisici.
 * Se il describe non porta la configurazione ritorna il fallback della tabella,
 * o {} se non ne ha uno.
 */
export async function loadVocabularies(client, table) {
  const { columns, extended } = await loadColumns(client, table);
  if (!extended) return { ...(FALLBACK[table] || {}) };

  const out = {};
  for (const [nome, c] of Object.entries(columns)) {
    // `options` e' gia' un array; la riserva e' una stringa CSV.
    // `parseCsvOptions` accetta entrambe le forme.
    if (Array.isArray(c.options) && c.options.length) out[nome] = c.options;
  }
  return out;
}

/**
 * Catalogo categoria/tipologia di una tabella, gia' pronto per le tendine.
 * I nomi delle colonne sono quelli dell'API: `categoria` e `tipologia`.
 */
export async function loadCatalog(client, table) {
  const voc = await loadVocabularies(client, table);
  const fb = FALLBACK[table] || {};
  const tipologie = voc.tipologia || fb.tipologia || "";
  const categorie = voc.categoria || fb.categoria || "";
  return buildCatalog(tipologie, categorie);
}
