(() => {
  "use strict";

  // ---------- Konfiguration ----------
  const SERVICES = [
    { id: "netflix", label: "Netflix", color: "#e50914" },
    { id: "prime", label: "Prime Video", color: "#00a8e1" },
    { id: "disney", label: "Disney+", color: "#113ccf" },
    { id: "apple", label: "Apple TV+", color: "#6e6e73", liveOnly: true },
    { id: "paramount", label: "Paramount+", color: "#0064ff", liveOnly: true },
  ];
  const MOODS = [
    { id: "lachen", emoji: "😂", label: "Was zum Lachen" },
    { id: "romantik", emoji: "💕", label: "Romantisch" },
    { id: "spannung", emoji: "🔍", label: "Spannend & Rätseln" },
    { id: "action", emoji: "💥", label: "Action & Adrenalin" },
    { id: "grusel", emoji: "👻", label: "Gruselig" },
    { id: "wohlfuehl", emoji: "🛋️", label: "Gemütlich & Wohlfühlen" },
    { id: "nachdenken", emoji: "🧠", label: "Tiefgang & Gefühle" },
    { id: "staunen", emoji: "🌌", label: "Große Welten & Staunen" },
  ];
  const FORMATS = [
    { id: "egal", emoji: "🍿", label: "Beides – Filme & Serien", sub: "mindestens ein Film und eine Serie" },
    { id: "film-kurz", emoji: "⏱️", label: "Film, nicht zu lang", sub: "bis ca. 1 h 50" },
    { id: "film", emoji: "🎬", label: "Film, Länge egal", sub: "auch mal ein Epos" },
    { id: "serie", emoji: "📺", label: "Nur Serien", sub: "was Neues für die nächsten Wochen" },
  ];
  const POPS = [
    { id: "hits", label: "Bekannte Hits" },
    { id: "mix", label: "Gemischt" },
    { id: "gems", label: "Geheimtipps" },
  ];
  const GENRE_STYLE = {
    komödie: ["😂", "#f7b733", "#fc4a1a"], romantik: ["💕", "#ff758c", "#ff7eb3"],
    krimi: ["🕵️", "#4b6cb7", "#182848"], thriller: ["🔪", "#434343", "#8e2b2b"],
    horror: ["👻", "#232526", "#5b1a1a"], action: ["💥", "#ff512f", "#9b1d1d"],
    abenteuer: ["🗺️", "#11998e", "#38ef7d"], scifi: ["🚀", "#0f2027", "#2c5364"],
    fantasy: ["🐉", "#5f2c82", "#49a09d"], drama: ["🎭", "#614385", "#516395"],
    animation: ["✨", "#36d1dc", "#5b86e5"], musik: ["🎵", "#c94b4b", "#4b134f"],
    mystery: ["🧩", "#1f1c2c", "#928dab"], historisch: ["🏛️", "#8e6e53", "#3e2c23"],
    familie: ["🏡", "#56ab2f", "#a8e063"], doku: ["🎥", "#3a6073", "#16222a"],
  };
  const GENRE_LABEL = {
    komödie: "Komödie", romantik: "Romantik", krimi: "Krimi", thriller: "Thriller", horror: "Horror",
    action: "Action", abenteuer: "Abenteuer", scifi: "Sci-Fi", fantasy: "Fantasy", drama: "Drama",
    animation: "Animation", musik: "Musik", mystery: "Mystery", historisch: "Historisch", familie: "Familie", doku: "Doku",
  };

  const GEMS = window.GEM_TITLES || new Set();
  const TITLES = window.TITLES;
  const CANDIDATES = TITLES.filter((x) => x.p.length > 0);
  const byTitle = new Map(TITLES.map((x) => [x.t, x]));

  // ---------- Regeln für die Zusammenstellung (auch vom Live-Modus genutzt) ----------
  const RULES = {
    // Wie viele der beiden Regeln (Film+Serie bei "Beides", Geheimtipp bei "Gemischt") erfüllt sind (0-2)
    satisfied(items, opts) {
      const mixOk = opts.format !== "egal" || new Set(items.map((x) => x.type)).size > 1;
      const gemOk = opts.pop !== "mix" || items.some((x) => x.gem);
      return (mixOk ? 1 : 0) + (gemOk ? 1 : 0);
    },
    // Ersetzt (von hinten) einen Vorschlag durch cand, wenn dadurch mehr Regeln erfüllt sind
    tryImprove(picks, cand, getItem, opts) {
      const now = RULES.satisfied(picks.map(getItem), opts);
      for (let j = picks.length - 1; j >= 0; j--) {
        const trial = picks.slice(); trial[j] = cand;
        if (RULES.satisfied(trial.map(getItem), opts) > now) { picks[j] = cand; return true; }
      }
      return false;
    },
  };
  window.MNF_RULES = RULES;

  // ---------- Zustand (mit Speicherung) ----------
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem("mnf." + key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem("mnf." + key, JSON.stringify(value)); } catch { /* privat-Modus o. ä. */ }
    },
  };
  const state = {
    services: store.get("services", []),
    moods: store.get("moods", []),
    format: store.get("format", null),
    pop: store.get("pop", "mix"),
    favs: store.get("favs", []), // Offline: Titel-Strings
    liveFavs: store.get("liveFavs", []), // Live: {tmdbId, mt, t, y, g}
    dislikes: store.get("dislikes", []), // Lernmodus offline: Titel, die blöd waren
    liveDislikes: store.get("liveDislikes", []), // Lernmodus live: {tmdbId, mt, t, y, g}
    learn: store.get("learn", true),
    seen: store.get("seen", []).filter((x) => typeof x === "string"), // Schlüssel "L:Titel" bzw. "movie:123"
    watchlist: store.get("watchlist", []), // Merkliste: {item, reasons, added}
    shown: [], // in dieser Runde schon gezeigte Schlüssel
    current: [], // aktuell angezeigte Vorschläge {item, reasons}
  };
  const save = () => {
    for (const k of ["services", "moods", "format", "pop", "favs", "liveFavs", "dislikes", "liveDislikes", "learn", "seen", "watchlist"]) store.set(k, state[k]);
  };
  const isLive = () => !!window.TMDB.getKey();

  // ---------- Hilfen ----------
  const $ = (s) => document.querySelector(s);
  const el = (tag, props = {}, ...children) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") n.className = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    for (const c of children.flat()) if (c != null) n.append(c);
    return n;
  };
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const fmtTime = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${m} min`);
  const overlap = (a, b) => a.reduce((n, x) => n + (b.includes(x) ? 1 : 0), 0);
  const visibleServices = () => SERVICES.filter((s) => !s.liveOnly || isLive());
  const activeServices = () => state.services.filter((id) => visibleServices().some((s) => s.id === id));

  // ---------- Navigation ----------
  const STEPS = ["screen-services", "screen-mood", "screen-format", "screen-favs"];
  let currentScreen = "screen-start";
  function show(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === id));
    currentScreen = id;
    const idx = STEPS.indexOf(id);
    const prog = $("#progress");
    prog.innerHTML = "";
    if (idx >= 0) STEPS.forEach((_, i) => prog.append(el("span", { class: i <= idx ? "on" : "" })));
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (id === "screen-start") renderStart();
    if (id === "screen-favs") renderFavs();
    if (id === "screen-services") renderOptions();
    if (id === "screen-watchlist") renderWatchlist();
    if (id === "screen-taste") renderTaste();
    updateNextButtons();
  }
  function next() { const i = STEPS.indexOf(currentScreen); if (i === STEPS.length - 1) find(); else show(STEPS[i + 1]); }
  function back() { const i = STEPS.indexOf(currentScreen); show(i > 0 ? STEPS[i - 1] : "screen-start"); }
  function updateNextButtons() {
    const ok = { "screen-services": activeServices().length > 0, "screen-mood": state.moods.length > 0, "screen-format": !!state.format };
    document.querySelectorAll("[data-next]").forEach((b) => { b.disabled = ok[b.closest(".screen").id] === false; });
  }

  function renderStart() {
    const ready = activeServices().length && state.moods.length && state.format;
    $("#quickBtn").hidden = !ready;
    $("#watchStartBtn").hidden = state.watchlist.length === 0;
    const nRated = ratedEntries().length;
    $("#tasteStartBtn").hidden = nRated === 0;
    $("#tasteStartBtn").textContent = `🧠 Euer Geschmack (${nRated} bewertet)`;
    $("#watchStartBtn").textContent = `❤️ Merkliste (${state.watchlist.length})`;
    $("#liveBadge").hidden = !isLive();
    $("#liveTip").hidden = isLive();
  }

  // ---------- Optionen rendern ----------
  function renderOptions() {
    const sv = $("#opt-services"); sv.innerHTML = "";
    visibleServices().forEach((s) => {
      const on = state.services.includes(s.id);
      sv.append(el("button", {
        type: "button", class: "opt service" + (on ? " selected" : ""), style: `--svc:${s.color}`, "aria-pressed": on,
        onclick: () => { toggle(state.services, s.id); save(); renderOptions(); updateNextButtons(); },
      }, el("span", { class: "dot" }), s.label, el("span", { class: "check" }, "✓")));
    });

    const md = $("#opt-mood"); md.innerHTML = "";
    MOODS.forEach((m) => {
      const on = state.moods.includes(m.id);
      md.append(el("button", {
        type: "button", class: "opt mood" + (on ? " selected" : ""), "aria-pressed": on,
        onclick: () => {
          if (on) state.moods = state.moods.filter((x) => x !== m.id);
          else { state.moods.push(m.id); if (state.moods.length > 2) state.moods.shift(); }
          save(); renderOptions(); updateNextButtons();
        },
      }, el("span", { class: "emoji" }, m.emoji), el("span", {}, m.label)));
    });

    const fm = $("#opt-format"); fm.innerHTML = "";
    FORMATS.forEach((f) => {
      const on = state.format === f.id;
      fm.append(el("button", {
        type: "button", class: "opt format" + (on ? " selected" : ""), "aria-pressed": on,
        onclick: () => { state.format = f.id; save(); renderOptions(); updateNextButtons(); },
      }, el("span", { class: "emoji" }, f.emoji), el("span", { class: "txt" }, el("b", {}, f.label), el("small", {}, f.sub))));
    });

    const pp = $("#opt-pop"); pp.innerHTML = "";
    POPS.forEach((o) => {
      const on = state.pop === o.id;
      pp.append(el("button", {
        type: "button", class: on ? "selected" : "", "aria-pressed": on,
        onclick: () => { state.pop = o.id; save(); renderOptions(); },
      }, o.label));
    });
  }
  const toggle = (arr, v) => { const i = arr.indexOf(v); i >= 0 ? arr.splice(i, 1) : arr.push(v); };

  // ---------- Bewertungen & Lernmodus ----------
  // Schlüssel: offline der Titel, live "movie:123" / "tv:456"
  const liveKey = (f) => `${f.mt}:${f.tmdbId}`;
  const likedLocal = () => state.favs.filter((t) => byTitle.has(t));
  const dislikedLocal = () => state.dislikes.filter((t) => byTitle.has(t));
  let favMode = "like"; // Favoriten-Bildschirm: gerade "Gefallen" oder "Blöd" eintragen

  function ratedEntries() {
    const live = isLive();
    const mk = (kind) => (x) => (typeof x === "string" ? { label: x, key: x, kind } : { label: x.t, key: liveKey(x), kind });
    return [
      ...(live ? state.liveFavs : likedLocal()).map(mk("like")),
      ...(live ? state.liveDislikes : dislikedLocal()).map(mk("dislike")),
    ];
  }
  function removeRating(key, kind) {
    if (kind === "like") {
      state.favs = state.favs.filter((t) => t !== key);
      state.liveFavs = state.liveFavs.filter((f) => liveKey(f) !== key);
    } else {
      state.dislikes = state.dislikes.filter((t) => t !== key);
      state.liveDislikes = state.liveDislikes.filter((f) => liveKey(f) !== key);
    }
    save();
  }
  // Einen Titel bewerten: v = 1 (gut), -1 (blöd), 0 (nur gesehen)
  function rate(x, v) {
    // x: {t, y, g, local:true} oder {tmdbId, mt, t, y, g}
    const key = x.local ? x.t : liveKey(x);
    removeRating(key, "like"); removeRating(key, "dislike");
    if (v === 1) x.local ? state.favs.push(x.t) : state.liveFavs.push({ tmdbId: x.tmdbId, mt: x.mt, t: x.t, y: x.y, g: x.g || [] });
    if (v === -1) x.local ? state.dislikes.push(x.t) : state.liveDislikes.push({ tmdbId: x.tmdbId, mt: x.mt, t: x.t, y: x.y, g: x.g || [] });
    save();
  }
  // Vorschlag (item mit key "L:Titel" oder "movie:123") bewerten
  function rateItem(item, v) {
    if (!state.seen.includes(item.key)) state.seen.push(item.key);
    if (item.key.startsWith("L:")) rate({ local: true, t: item.t }, v);
    else { const [mt, id] = item.key.split(":"); rate({ tmdbId: Number(id), mt, t: item.t, y: item.y, g: item.g }, v); }
  }

  // Geschmacksprofil: Gewicht je Genre zwischen -1 (mögt ihr nicht) und +1 (mögt ihr)
  function tasteProfile() {
    if (!state.learn) return {};
    const sum = {};
    // Hauptgenre zählt voll, Nebengenres halb (ein 👎 für einen Horror-Thriller trifft v. a. Horror)
    const add = (gs, v) => [...new Set(gs || [])].forEach((g, i) => { sum[g] = (sum[g] || 0) + v * (i === 0 ? 1 : 0.5); });
    likedLocal().forEach((t) => add(byTitle.get(t).g, 1));
    dislikedLocal().forEach((t) => add(byTitle.get(t).g, -1.2));
    state.liveFavs.forEach((f) => add(f.g, 1));
    state.liveDislikes.forEach((f) => add(f.g, -1.2));
    const prof = {};
    for (const [g, v] of Object.entries(sum)) prof[g] = Math.max(-1, Math.min(1, v / 3));
    return prof;
  }
  const profileScore = (genres, prof) => [...new Set(genres)].reduce((n, g) => n + (prof[g] || 0), 0);

  // ---------- Favoriten-Suche (offline: eigene Liste, live: TMDB) ----------
  function renderFavs() {
    const box = $("#favChips"); box.innerHTML = "";
    const list = ratedEntries();
    list.forEach((f) => box.append(el("button", {
      type: "button", class: "chip" + (f.kind === "dislike" ? " bad" : ""), "aria-label": `${f.label} entfernen`,
      onclick: () => { removeRating(f.key, f.kind); renderFavs(); },
    }, f.kind === "dislike" ? "👎 " : "👍 ", f.label, el("span", { class: "x" }, "×"))));
    $("#favEmpty").hidden = list.length > 0;
    document.querySelectorAll("#favMode button").forEach((b) => {
      b.classList.toggle("selected", b.dataset.mode === favMode);
      b.setAttribute("aria-pressed", b.dataset.mode === favMode);
    });
    $("#favInput").placeholder = favMode === "dislike"
      ? "Was war blöd? z. B. ein Film, bei dem ihr eingeschlafen seid …"
      : isLive() ? "Jeder Film, jede Serie – z. B. Lioness, Trap …" : "z. B. Knives Out, Lioness, Friends …";
  }
  function searchLocal(q) {
    const nq = norm(q);
    if (nq.length < 2) return [];
    return TITLES
      .filter((x) => !state.favs.includes(x.t) && !state.dislikes.includes(x.t))
      .map((x) => { const n = norm(x.t); return { x, pos: n.indexOf(nq), starts: n.split(" ").some((w) => w.startsWith(nq)) }; })
      .filter((r) => r.pos >= 0)
      .sort((a, b) => (b.starts - a.starts) || a.pos - b.pos || a.x.t.length - b.x.t.length)
      .slice(0, 6).map((r) => ({ t: r.x.t, y: r.x.y, mt: r.x.type === "serie" ? "tv" : "movie" }));
  }
  let suggestions = [];
  let activeSuggest = -1;
  let searchSeq = 0;
  let searchTimer = null;
  async function updateSuggest() {
    const q = $("#favInput").value.trim();
    const seq = ++searchSeq;
    if (q.length < 2) { suggestions = []; return drawSuggest(q); }
    if (!isLive()) { suggestions = searchLocal(q); return drawSuggest(q); }
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      try {
        const res = await window.TMDB.search(q);
        if (seq !== searchSeq) return;
        const rated = new Set([...state.liveFavs, ...state.liveDislikes].map(liveKey));
        suggestions = res.filter((r) => !rated.has(liveKey(r)));
      } catch (e) {
        if (seq !== searchSeq) return;
        suggestions = []; return drawSuggest(q, "Suche gerade nicht möglich – Internet/Schlüssel prüfen.");
      }
      drawSuggest(q);
    }, 250);
  }
  function drawSuggest(q, error) {
    const list = $("#favSuggest"); list.innerHTML = "";
    activeSuggest = Math.min(activeSuggest, suggestions.length - 1);
    suggestions.forEach((x, i) => list.append(el("li", {
      role: "option", class: i === activeSuggest ? "active" : "",
      onmousedown: (e) => { e.preventDefault(); addFav(x); },
    }, el("span", {}, x.t), el("small", {}, `${x.y || "–"} · ${x.mt === "tv" ? "Serie" : "Film"}`))));
    if (error) list.append(el("li", { class: "none" }, error));
    else if (q.length >= 2 && !suggestions.length && !isLive()) {
      list.append(el("li", { class: "none" }, "Kenne ich offline nicht – mit dem Live-Modus (⚙️) findet die App jeden Titel."));
    }
  }
  function addFav(x) {
    rate(isLive() ? x : { local: true, t: x.t }, favMode === "dislike" ? -1 : 1); $("#favInput").value = ""; activeSuggest = -1; suggestions = []; drawSuggest(""); renderFavs(); $("#favInput").focus();
  }

  // ---------- Offline-Empfehlungen ----------
  const toItem = (c) => ({
    key: "L:" + c.t, t: c.t, y: c.y, type: c.type, rt: c.rt, seasons: 0, r: c.r, g: c.g,
    p: c.p.filter((p) => state.services.includes(p)), d: c.d, poster: null, gem: GEMS.has(c.t), link: null,
  });
  function similarity(c, fav) {
    const g = overlap(c.g, fav.g) / Math.max(c.g.length, fav.g.length);
    return g * 3 + Math.min(overlap(c.k, fav.k), 3) * 1.5;
  }
  function scoreLocal(c, favs, bads, prof) {
    let s = 0;
    const reasons = [];
    const moodHits = c.m.filter((m) => state.moods.includes(m));
    s += moodHits.length * 3;
    if (c.m[0] && state.moods.includes(c.m[0])) s += 1;
    const sims = favs.map((f) => ({ f, v: similarity(c, f) })).sort((a, b) => b.v - a.v);
    if (sims.length) {
      s += sims[0].v * 1.3 + sims.slice(1).reduce((n, x) => n + x.v, 0) * 0.2;
      if (sims[0].v >= 3) reasons.push(`Ähnlich wie „${sims[0].f.t}“`);
    }
    // Lernmodus: Ähnlichkeit zu blöd gefundenen Titeln und Genre-Geschmack
    const badSims = bads.map((f) => ({ f, v: similarity(c, f) })).sort((a, b) => b.v - a.v);
    if (badSims.length) s -= badSims[0].v * 1.6 + badSims.slice(1).reduce((n, x) => n + x.v, 0) * 0.3;
    const taste = profileScore(c.g, prof);
    s += taste * 1.6;
    if (taste >= 1 && !reasons.length) reasons.push("Passt zu eurem Geschmack");
    const gem = GEMS.has(c.t);
    if (state.pop === "gems") s += gem ? 3 : -3;
    if (state.pop === "hits") s += gem ? -2.5 : 1;
    s += (c.r - 6.8) * 1.6;
    s += Math.random() * 1.5; // etwas Abwechslung für jeden Samstag
    if (moodHits.length) reasons.push(moodHits.map((m) => MOODS.find((x) => x.id === m).label).join(" + "));
    if (c.r >= 8.3) reasons.push("Top bewertet");
    return { item: toItem(c), reasons, s, moodHits: moodHits.length, c };
  }
  function recommendLocal(exclude) {
    const favs = likedLocal().map((t) => byTitle.get(t));
    const bads = state.learn ? dislikedLocal().map((t) => byTitle.get(t)) : [];
    const prof = tasteProfile();
    let pool = CANDIDATES.filter((c) => c.p.some((p) => state.services.includes(p)) && !exclude.has("L:" + c.t)
      && !state.favs.includes(c.t) && !state.dislikes.includes(c.t));
    if (state.format === "film-kurz") pool = pool.filter((c) => c.type === "film" && c.rt <= 110);
    else if (state.format === "film") pool = pool.filter((c) => c.type === "film");
    else if (state.format === "serie") pool = pool.filter((c) => c.type === "serie");

    let scored = pool.map((c) => scoreLocal(c, favs, bads, prof));
    const matching = scored.filter((x) => x.moodHits > 0);
    const relaxed = matching.length < 3;
    if (!relaxed) scored = matching;
    scored.sort((a, b) => b.s - a.s);

    // Vielfalt: nicht 3x dasselbe Hauptgenre bzw. dasselbe Franchise
    const FR = ["marvel", "star-wars", "pixar"];
    const picks = [];
    for (const x of scored) {
      if (picks.length === 3) break;
      const sameGenre = picks.filter((p) => p.c.g[0] === x.c.g[0]).length;
      const sameFranchise = picks.some((p) => FR.some((f) => p.c.k.includes(f) && x.c.k.includes(f)));
      if (sameGenre < 2 && !sameFranchise) picks.push(x);
    }
    for (const x of scored) { if (picks.length === 3) break; if (!picks.includes(x)) picks.push(x); }
    // Regeln: Film + Serie bei "Beides", ein Geheimtipp bei "Gemischt"
    const opts = { format: state.format, pop: state.pop };
    for (const x of scored.slice(0, 40)) {
      if (picks.length < 3 || RULES.satisfied(picks.map((p) => p.item), opts) === 2) break;
      if (!picks.includes(x)) RULES.tryImprove(picks, x, (p) => p.item, opts);
    }
    return { picks, relaxed };
  }

  // ---------- Empfehlungen holen ----------
  async function getPicks(exclude) {
    if (isLive()) {
      try {
        const picks = await window.TMDB.recommend({
          services: activeServices(), moods: state.moods, format: state.format, pop: state.pop,
          favs: state.liveFavs, exclude,
          dislikes: state.learn ? state.liveDislikes : [], profile: tasteProfile(),
        });
        return { picks, live: true };
      } catch (e) {
        const msg = e.message === "401" ? "Der TMDB-Schlüssel wird nicht akzeptiert" : "Die Live-Datenbank ist gerade nicht erreichbar";
        return { ...recommendLocal(exclude), warning: `${msg} – Vorschläge aus der eingebauten Liste.` };
      }
    }
    return recommendLocal(exclude);
  }

  let busy = false;
  async function renderResults() {
    if (busy) return;
    busy = true;
    const box = $("#results");
    box.innerHTML = "";
    box.append(el("div", { class: "loading" }, el("div", { class: "spinner" }), "Suche die perfekten Filme …"));
    $("#rerollBtn").disabled = true;
    const exclude = new Set([...state.seen, ...state.shown, ...watchKeys()]);
    let res;
    try { res = await getPicks(exclude); } finally { busy = false; $("#rerollBtn").disabled = false; }
    const { picks, relaxed, warning } = res;
    picks.forEach((p) => state.shown.push(p.item.key));
    state.current = picks.map((p) => ({ item: p.item, reasons: p.reasons }));

    const svcNames = SERVICES.filter((s) => activeServices().includes(s.id)).map((s) => s.label);
    $("#resultHint").textContent = picks.length
      ? `Aus ${svcNames.join(", ")}${relaxed ? " – zu eurer Stimmung gab's nicht mehr viel, deshalb etwas breiter gesucht" : ""}.`
      : "";
    $("#resultWarn").textContent = warning || "";
    $("#resultWarn").hidden = !warning;
    $("#resetSeenBtn").hidden = state.seen.length === 0;
    $("#tmdbNote").hidden = !res.live;

    box.innerHTML = "";
    if (!picks.length) {
      box.append(el("div", { class: "empty" },
        el("div", { class: "hero-emoji" }, "🫠"),
        el("p", {}, "Hier passt gerade nichts mehr. Versucht eine andere Stimmung, ein anderes Format oder „Bekannte Hits“/„Geheimtipps“."),
        state.shown.length ? el("button", { class: "btn ghost", type: "button", onclick: () => { state.shown = []; renderResults(); } }, "Von vorne durchmischen") : null));
      return;
    }
    drawCards();
  }
  function drawCards() {
    const box = $("#results"); box.innerHTML = "";
    state.current.forEach((p, i) => box.append(card(p, i)));
  }

  function card({ item: c, reasons }, i, mode = "result") {
    const [emoji, c1, c2] = GENRE_STYLE[c.g[0]] || ["🎬", "#444", "#222"];
    const q = encodeURIComponent(c.t);
    const runtime = c.type === "serie"
      ? `Serie${c.seasons ? ` · ${c.seasons} ${c.seasons === 1 ? "Staffel" : "Staffeln"}` : ""}${c.rt ? ` · ~${c.rt} min/Folge` : ""}`
      : (c.rt ? `Film · ${fmtTime(c.rt)}` : "Film");
    const poster = c.poster
      ? el("img", { src: c.poster, alt: `Poster: ${c.t}`, loading: "lazy" })
      : el("span", { class: "poster-emoji" }, emoji);
    return el("article", { class: "card" + (c.poster ? " has-img" : ""), style: `--c1:${c1};--c2:${c2};animation-delay:${i * 90}ms` },
      el("div", { class: "poster" }, poster,
        c.gem ? el("span", { class: "gem" }, "💎 Geheimtipp") : null),
      el("div", { class: "body" },
        el("h3", {}, c.t),
        el("div", { class: "meta" },
          c.y ? el("span", {}, String(c.y)) : null,
          el("span", {}, runtime),
          c.r ? el("span", { class: "star" }, `★ ${c.r.toFixed(1)}`) : null),
        el("div", { class: "tags" },
          c.p.map((p) => {
            const s = SERVICES.find((x) => x.id === p);
            return s ? el("span", { class: "svc", style: `--svc:${s.color}` }, s.label) : null;
          }),
          c.g.slice(0, 3).map((g) => el("span", { class: "genre" }, GENRE_LABEL[g] || g))),
        c.d ? el("p", { class: "desc" }, c.d) : null,
        reasons.length ? el("p", { class: "why" }, "👉 " + reasons.slice(0, 2).join(" · ")) : null,
        el("div", { class: "actions" },
          el("a", { class: "btn small", href: c.jwLink || `https://www.justwatch.com/de/Suche?q=${q}`, target: "_blank", rel: "noopener" }, "Wo läuft's?"),
          el("a", { class: "btn small", href: `https://www.youtube.com/results?search_query=${q}+${c.y || ""}+trailer+deutsch`, target: "_blank", rel: "noopener" }, "▶ Trailer"),
          mode === "watch"
            ? [
              el("button", { class: "btn small", type: "button", onclick: () => watchedFromList(c.key, 1) }, "👍 Gesehen & gut"),
              el("button", { class: "btn small ghost", type: "button", onclick: () => watchedFromList(c.key, -1) }, "👎 Gesehen & blöd"),
              el("button", { class: "btn small ghost", type: "button", onclick: () => { removeFromWatchlist(c.key); renderWatchlist(); } }, "Entfernen"),
            ]
            : [
              el("button", {
                class: "btn small heart" + (inWatchlist(c.key) ? " on" : ""), type: "button", "aria-pressed": inWatchlist(c.key),
                onclick: (e) => toggleWatch({ item: c, reasons }, e.currentTarget),
              }, inWatchlist(c.key) ? "❤️ Gemerkt" : "🤍 Merken"),
              el("button", { class: "btn small ghost", type: "button", onclick: (e) => askRating(c, e.currentTarget.closest(".actions")) }, "Schon gesehen"),
            ])));
  }

  // ---------- Merkliste ----------
  const watchKeys = () => state.watchlist.map((w) => w.item.key);
  const inWatchlist = (key) => state.watchlist.some((w) => w.item.key === key);
  function updateWatchBadge() {
    const n = state.watchlist.length;
    $("#watchCount").textContent = n;
    $("#watchCount").hidden = n === 0;
  }
  function toggleWatch(entry, btn) {
    const on = !inWatchlist(entry.item.key);
    if (on) state.watchlist.unshift({ item: entry.item, reasons: entry.reasons, added: Date.now() });
    else removeFromWatchlist(entry.item.key);
    save(); updateWatchBadge();
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-pressed", on);
    btn.textContent = on ? "❤️ Gemerkt" : "🤍 Merken";
  }
  function removeFromWatchlist(key) {
    state.watchlist = state.watchlist.filter((w) => w.item.key !== key);
    save(); updateWatchBadge();
  }
  // Aus der Merkliste gesehen: bewerten (Lernmodus) und von der Liste nehmen
  function watchedFromList(key, v) {
    const w = state.watchlist.find((x) => x.item.key === key);
    if (!w) return;
    rateItem(w.item, v);
    removeFromWatchlist(key);
    renderWatchlist(v === 1 ? `👍 „${w.item.t}“ gemerkt – ihr bekommt mehr in der Art.`
      : `👎 „${w.item.t}“ gemerkt – sowas schlägt die App euch seltener vor.`);
  }
  function renderWatchlist(message = "") {
    const box = $("#watchItems"); box.innerHTML = "";
    const n = state.watchlist.length;
    $("#watchHint").textContent = n ? `${n} ${n === 1 ? "Titel" : "Titel"} für die nächsten Filmabende.` : "";
    $("#watchMsg").textContent = message;
    $("#watchMsg").hidden = !message;
    $("#watchRandom").hidden = n < 2;
    if (!n) {
      box.append(el("div", { class: "empty" },
        el("div", { class: "hero-emoji" }, "🤍"),
        el("p", {}, "Noch leer. Tippt bei einem Vorschlag auf „🤍 Merken“, dann landet er hier.")));
      return;
    }
    state.watchlist.forEach((w, i) => box.append(card(w, i, "watch")));
  }
  function randomFromWatchlist() {
    const cards = [...document.querySelectorAll("#watchItems .card")];
    if (!cards.length) return;
    cards.forEach((c) => c.classList.remove("picked"));
    const c = cards[Math.floor(Math.random() * cards.length)];
    c.classList.add("picked");
    c.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // "Schon gesehen" -> kurz fragen, wie er war (Lernmodus)
  function askRating(item, actions) {
    actions.innerHTML = "";
    actions.append(
      el("span", { class: "ask" }, "Wie fandet ihr ihn?"),
      el("button", { class: "btn small", type: "button", onclick: () => markSeen(item, 1, actions) }, "👍 Gut"),
      el("button", { class: "btn small", type: "button", onclick: () => markSeen(item, -1, actions) }, "👎 Blöd"),
      el("button", { class: "btn small ghost", type: "button", onclick: () => markSeen(item, 0, actions) }, "🤷 Ging so"));
  }

  // Gesehenen Titel bewerten und nur diese eine Karte durch einen neuen Vorschlag ersetzen
  async function markSeen(item, v, actions) {
    const key = item.key;
    rateItem(item, v);
    if (actions) {
      actions.innerHTML = "";
      actions.append(el("span", { class: "ask" }, v === -1 ? "👎 Verstanden – sowas kommt seltener. Suche Ersatz …"
        : v === 1 ? "👍 Notiert – mehr davon! Suche Ersatz …" : "Suche Ersatz …"));
    }
    const exclude = new Set([...state.seen, ...state.shown, ...watchKeys(), ...state.current.map((p) => p.item.key)]);
    const { picks } = await getPicks(exclude);
    const others = state.current.filter((p) => p.item.key !== key);
    // Ersatz so wählen, dass Film/Serie-Mix und Geheimtipp-Regel möglichst erhalten bleiben
    const opts = { format: state.format, pop: state.pop };
    const sorted = picks.slice().sort((a, b) =>
      RULES.satisfied([...others.map((p) => p.item), b.item], opts) - RULES.satisfied([...others.map((p) => p.item), a.item], opts));
    const replacement = sorted[0];
    state.current = state.current.flatMap((p) => (p.item.key !== key ? [p] : replacement ? [{ item: replacement.item, reasons: replacement.reasons }] : []));
    if (replacement) state.shown.push(replacement.item.key);
    drawCards();
    $("#resetSeenBtn").hidden = false;
  }

  // ---------- Geschmack-Seite ----------
  function renderTaste() {
    $("#learnToggle").checked = state.learn;
    const prof = tasteProfile();
    const entries = Object.entries(prof).filter(([, v]) => Math.abs(v) >= 0.3);
    const likes = entries.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const dislikes = entries.filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]);
    const box = $("#tasteGenres"); box.innerHTML = "";
    const bar = ([g, v]) => el("div", { class: "tbar" },
      el("span", { class: "tlabel" }, (GENRE_STYLE[g] || ["🎬"])[0] + " " + (GENRE_LABEL[g] || g)),
      el("span", { class: "ttrack" }, el("span", { class: "tfill " + (v > 0 ? "pos" : "neg"), style: `width:${Math.round(Math.abs(v) * 100)}%` })));
    if (!state.learn) box.append(el("p", { class: "hint small" }, "Lernmodus ist aus – Bewertungen werden gespeichert, aber nicht für Vorschläge genutzt."));
    else if (!entries.length) box.append(el("p", { class: "hint small" }, "Noch zu wenig bewertet. Nach ein paar 👍/👎 seht ihr hier, welche Genres ihr mögt."));
    else {
      if (likes.length) box.append(el("h3", { class: "subq" }, "Mögt ihr"), ...likes.map(bar));
      if (dislikes.length) box.append(el("h3", { class: "subq" }, "Eher nicht"), ...dislikes.map(bar));
    }
    const list = ratedEntries();
    for (const [id, kind] of [["#tasteLikes", "like"], ["#tasteDislikes", "dislike"]]) {
      const c = $(id); c.innerHTML = "";
      const items = list.filter((f) => f.kind === kind);
      if (!items.length) c.append(el("span", { class: "hint small" }, "Noch nichts."));
      items.forEach((f) => c.append(el("button", {
        type: "button", class: "chip" + (kind === "dislike" ? " bad" : ""), "aria-label": `${f.label} entfernen`,
        onclick: () => { removeRating(f.key, f.kind); renderTaste(); },
      }, f.label, el("span", { class: "x" }, "×"))));
    }
  }

  // ---------- Einstellungen (Live-Modus) ----------
  function renderSettings() {
    const key = window.TMDB.getKey();
    $("#keyInput").value = key;
    $("#keyStatus").textContent = key ? "✅ Live-Modus ist aktiv." : "Live-Modus ist aus – die App nutzt die eingebaute Liste.";
    $("#keyRemove").hidden = !key;
  }
  async function saveKey() {
    const key = $("#keyInput").value.trim();
    const status = $("#keyStatus");
    if (!key) { status.textContent = "Bitte einen Schlüssel einfügen."; return; }
    status.textContent = "Prüfe Schlüssel …";
    try {
      await window.TMDB.test(key);
      window.TMDB.setKey(key);
      status.textContent = "✅ Klappt! Live-Modus ist aktiv.";
      $("#keyRemove").hidden = false;
    } catch (e) {
      status.textContent = e.message === "401" ? "❌ Der Schlüssel wird nicht akzeptiert – bitte nochmal kopieren." : "❌ TMDB nicht erreichbar – Internetverbindung prüfen.";
    }
  }

  // ---------- Events ----------
  function find() {
    state.shown = [];
    show("screen-results");
    renderResults();
  }
  function init() {
    renderOptions();
    renderStart();
    $("#startBtn").addEventListener("click", () => show("screen-services"));
    $("#homeBtn").addEventListener("click", () => show("screen-start"));
    $("#settingsBtn").addEventListener("click", () => { renderSettings(); show("screen-settings"); });
    $("#watchBtn").addEventListener("click", () => show("screen-watchlist"));
    $("#tasteStartBtn").addEventListener("click", () => show("screen-taste"));
    $("#tasteLink").addEventListener("click", () => show("screen-taste"));
    $("#tasteFind").addEventListener("click", () => (activeServices().length && state.moods.length && state.format ? find() : show("screen-services")));
    $("#learnToggle").addEventListener("change", (e) => { state.learn = e.target.checked; save(); renderTaste(); });
    $("#tasteReset").addEventListener("click", () => {
      if (!confirm("Alle 👍/👎-Bewertungen löschen?")) return;
      state.favs = []; state.liveFavs = []; state.dislikes = []; state.liveDislikes = [];
      save(); renderTaste();
    });
    document.querySelectorAll("#favMode button").forEach((b) => b.addEventListener("click", () => {
      favMode = b.dataset.mode; renderFavs(); $("#favInput").focus();
    }));
    $("#watchStartBtn").addEventListener("click", () => show("screen-watchlist"));
    $("#watchRandom").addEventListener("click", randomFromWatchlist);
    $("#watchFind").addEventListener("click", () => show("screen-start"));
    updateWatchBadge();
    $("#liveTipBtn").addEventListener("click", () => { renderSettings(); show("screen-settings"); });
    $("#keySave").addEventListener("click", saveKey);
    $("#keyRemove").addEventListener("click", () => { window.TMDB.setKey(""); renderSettings(); });
    $("#settingsDone").addEventListener("click", () => show("screen-start"));
    document.querySelectorAll("[data-next]").forEach((b) => b.addEventListener("click", next));
    document.querySelectorAll("[data-back]").forEach((b) => b.addEventListener("click", back));
    $("#findBtn").addEventListener("click", find);
    $("#quickBtn").addEventListener("click", find);
    $("#rerollBtn").addEventListener("click", () => { renderResults(); window.scrollTo({ top: 0, behavior: "smooth" }); });
    $("#restartBtn").addEventListener("click", () => show("screen-mood"));
    $("#resetSeenBtn").addEventListener("click", () => { state.seen = []; save(); find(); });

    const input = $("#favInput");
    input.addEventListener("input", () => { activeSuggest = -1; updateSuggest(); });
    input.addEventListener("blur", () => setTimeout(() => { suggestions = []; drawSuggest(""); }, 100));
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { activeSuggest = Math.min(activeSuggest + 1, suggestions.length - 1); drawSuggest(input.value.trim()); e.preventDefault(); }
      else if (e.key === "ArrowUp") { activeSuggest = Math.max(activeSuggest - 1, 0); drawSuggest(input.value.trim()); e.preventDefault(); }
      else if (e.key === "Enter") { const x = suggestions[Math.max(activeSuggest, 0)]; if (x) addFav(x); e.preventDefault(); }
    });

    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }
  init();
})();
