// views/shared/org-picker.js
//
// Selettore multiplo di organizzazioni, con ricerca e filtro per provincia.
//
// Il catalogo unisce l'anagrafica `db-organizzazioni` (la piu' completa) e le
// organizzazioni effettivamente presenti sulle risorse operative, cosi' compare
// anche chi e' al campo ma non e' ancora in anagrafica.
//
// Il valore e' sempre **una stringa** con i nomi separati da virgola e spazio:
// e' cosi' che `squadre.organizzazioni` e' memorizzato in tabella.
//
// Uso:
//   const orgPicker = createOrgPicker({ client, html, rerender });
//   await orgPicker.load();                      // o in background
//   ${orgPicker.template({
//       value: form.organizzazioni,
//       onChange: v => { form.organizzazioni = v; rerender(); },
//       disabled: formBusy
//   })}

function getRecords(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.records)) return res.records;
  return [];
}

function norm(s) {
  return String(s ?? "").trim().replace(/\s+/g, " ");
}

export function splitOrg(v) {
  return norm(v).split(",").map(x => norm(x)).filter(Boolean);
}

export function joinOrg(lista) {
  return lista.join(", ");
}

export function createOrgPicker({ client, html, rerender }) {
  let items = [];        // [{ nome, provincia }]
  let loaded = false;
  let loading = false;
  let error = null;

  // Filtri condivisi fra tutti gli usi del picker nella stessa vista: in
  // pratica solo uno e' visibile alla volta, e ritrovare il filtro impostato
  // e' comodo piu' che confondente.
  let query = "";
  let prov = "";

  async function load() {
    if (loaded || loading) return;
    loading = true;
    error = null;
    rerender();

    const pick = async (table, colNome) => {
      const res = await client.table(table).list({
        include: [colNome, "provincia"], size: 5000
      });
      return getRecords(res)
        .map(r => ({ nome: norm(r[colNome]), provincia: norm(r.provincia).toUpperCase() }))
        .filter(o => o.nome);
    };

    const results = await Promise.allSettled([
      pick("db-organizzazioni", "denominazione"),
      pick("volontari", "organizzazione"),
      pick("mezzi", "organizzazione"),
      pick("materiali", "organizzazione")
    ]);

    // La prima sorgente vince, con un'eccezione: una provincia valorizzata
    // batte una vuota, perche' sulle risorse il campo resta spesso in bianco.
    const mappa = new Map();
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      for (const o of r.value) {
        const k = o.nome.toLowerCase();
        if (!mappa.has(k)) mappa.set(k, o);
        else if (!mappa.get(k).provincia && o.provincia) mappa.set(k, o);
      }
    }
    items = Array.from(mappa.values()).sort((a, b) => a.nome.localeCompare(b.nome, "it"));

    if (items.length === 0 && results.every(r => r.status === "rejected")) {
      error = "Catalogo organizzazioni non raggiungibile.";
    }

    loaded = true;
    loading = false;
    rerender();
  }

  function province() {
    return Array.from(new Set(items.map(o => o.provincia).filter(Boolean))).sort();
  }

  /**
   * @param {Object}   o
   * @param {String}   o.value     stringa con i nomi separati da virgola
   * @param {Function} o.onChange  riceve la nuova stringa
   * @param {Boolean}  [o.disabled]
   * @param {String}   [o.altezza] altezza massima dell'elenco
   */
  function template({ value, onChange, disabled = false, altezza = "190px" }) {
    const attive = splitOrg(value);

    const inCatalogo = new Set(items.map(o => o.nome));
    // AGENTS.md: un valore fuori catalogo resta visibile, non si scarta
    const fuori = attive.filter(n => !inCatalogo.has(n))
      .map(n => ({ nome: n, provincia: "", fuori: true }));

    const toggle = nome => {
      const cur = splitOrg(value);
      const i = cur.indexOf(nome);
      if (i >= 0) cur.splice(i, 1);
      else cur.push(nome);
      onChange(joinOrg(cur));
    };

    const q = norm(query).toLocaleLowerCase("it-IT");
    const visibili = [...items, ...fuori].filter(o => {
      if (prov && o.provincia !== prov) return false;
      if (!q) return true;
      return `${o.nome} ${o.provincia}`.toLocaleLowerCase("it-IT").includes(q);
    });

    const prv = province();

    return html`
      ${error ? html`
        <div class="notification is-warning is-light is-small mb-2">
          <i class="ri-error-warning-line mr-1"></i> ${error}
        </div>` : ""}

      <div class="is-flex mb-2" style="gap:.5rem;flex-wrap:wrap">
        <div class="control has-icons-left" style="flex:1;min-width:170px">
          <input class="input is-small" type="text" placeholder="Cerca organizzazione…"
            .value=${query} ?disabled=${disabled}
            @input=${e => { query = e.target.value; rerender(); }} />
          <span class="icon is-small is-left"><i class="ri-search-line"></i></span>
        </div>
        ${prv.length ? html`
          <div class="select is-small">
            <select ?disabled=${disabled}
              @change=${e => { prov = e.target.value; rerender(); }}>
              <option value="" ?selected=${prov === ""}>Tutte le province</option>
              ${prv.map(p => html`<option value=${p} ?selected=${prov === p}>${p}</option>`)}
            </select>
          </div>` : ""}
      </div>

      <div style=${`max-height:${altezza};overflow:auto;border:1px solid #dbdbdb;border-radius:4px;padding:.5rem`}>
        ${loading
          ? html`<progress class="progress is-small"></progress>`
          : visibili.length === 0
            ? html`<p class="help">${items.length === 0 ? "Catalogo vuoto." : "Nessuna corrispondenza."}</p>`
            : visibili.map(o => html`
              <label class="checkbox is-size-7"
                style="display:flex;align-items:center;gap:.4rem;margin-bottom:.2rem">
                <input type="checkbox" .checked=${attive.includes(o.nome)}
                  ?disabled=${disabled} @change=${() => toggle(o.nome)} />
                <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                  ${o.nome}
                </span>
                ${o.provincia
                  ? html`<span class="tag is-light" style="font-size:.6rem">${o.provincia}</span>` : ""}
                ${o.fuori
                  ? html`<span class="tag is-warning is-light" style="font-size:.6rem">fuori lista</span>` : ""}
              </label>
            `)}
      </div>

      ${attive.length ? html`
        <div class="mt-2" style="display:flex;gap:.3rem;flex-wrap:wrap;align-items:center">
          <span class="is-size-7 has-text-grey">Selezionate:</span>
          ${attive.map(n => html`
            <span class="tag is-info is-light">
              ${n}
              ${!disabled ? html`
                <button class="delete is-small" @click=${() => toggle(n)}></button>` : ""}
            </span>
          `)}
        </div>
      ` : html`<p class="help mt-1">Nessuna organizzazione selezionata.</p>`}
    `;
  }

  return { load, template, items: () => items, isLoaded: () => loaded };
}
