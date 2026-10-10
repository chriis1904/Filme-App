(() => {
  "use strict";

  // ---------- Konfiguration ----------
  const SERVICES = [
    { id: "netflix", label: "Netflix", color: "#e50914" },
    { id: "prime", label: "Prime Video", color: "#00a8e1" },
    { id: "disney", label: "Disney+", color: "#113ccf" },
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
    { id: "film-kurz", emoji: "⏱️", label: "Film, nicht zu lang", sub: "bis ca. 1 h 50" },
    { id: "film", emoji: "🎬", label: "Film, Länge egal", sub: "auch mal ein Epos" },
    { id: "serie", emoji: "📺", label: "Neue Serie anfangen", sub: "für die nächsten Wochen" },
    { id: "egal", emoji: "🤷", label: "Egal", sub: "Hauptsache gut" },
  ];
  const GENRE_STYLE = {
    komödie: ["😂", "#f7b733", "#fc4a1a"], romantik: ["💕", "#ff758c", "#ff7eb3"],
    krimi: ["🕵️", "#4b6cb7", "#182848"], thriller: ["🔪", "#434343", "#8e2b2b"],
    horror: ["👻", "#232526", "#5b1a1a"], action: ["💥", "#ff512f", "#9b1d1d"],
    abenteuer: ["🗺️", "#11998e", "#38ef7d"], scifi: ["🚀", "#0f2027", "#2c5364"],
    fantasy: ["🐉", "#5f2c82", "#49a09d"], drama: ["🎭", "#614385", "#516395"],
    animation: ["✨", "#36d1dc", "#5b86e5"], musik: ["🎵", "#c94b4b", "#4b134f"],
    mystery: ["🧩", "#1f1c2c", "#928dab"], historisch: ["🏛️", "#8e6e53", "#3e2c23"],
    familie: ["🏡", "#56ab2f", "#a8e063"],
  };
  const GENRE_LABEL = {
    komödie: "Komödie", romantik: "Romantik", krimi: "Krimi", thriller: "Thriller", horror: "Horror",
    action: "Action", abenteuer: "Abenteuer", scifi: "Sci-Fi", fantasy: "Fantasy", drama: "Drama",
    animation: "Animation", musik: "Musik", mystery: "Mystery", historisch: "Historisch", familie: "Familie",
  };

  const TITLES = window.TITLES.map((x, i) => ({ ...x, id: i }));
  const CANDIDATES = TITLES.filter((x) => x.p.length > 0);

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
    favs: store.get("favs", []), // Titel-Strings (robust gegen Änderungen der Liste)
    seen: store.get("seen", []),
    shown: [], // bereits in dieser Runde gezeigte IDs
    current: [], // aktuell angezeigte IDs
  };
  const save = () => {
    store.set("services", state.services); store.set("moods", state.moods);
    store.set("format", state.format); store.set("favs", state.favs); store.set("seen", state.seen);
  };

  // ---------- Hilfen ----------
  const $ = (s) => document.querySelector(s);
  const el = (tag, props = {}, ...children) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") n.className = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else if (k === "html") n.innerHTML = v;
      else n.setAttribute(k, v);
    }
    for (const c of children.flat()) if (c != null) n.append(c);
    return n;
  };
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const byTitle = new Map(TITLES.map((x) => [x.t, x]));
  const fmtTime = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${m} min`);

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
    updateNextButtons();
  }
  function next() { const i = STEPS.indexOf(currentScreen); show(i < STEPS.length - 1 ? STEPS[i + 1] : "screen-results"); }
  function back() { const i = STEPS.indexOf(currentScreen); show(i > 0 ? STEPS[i - 1] : "screen-start"); }
  function updateNextButtons() {
    const ok = { "screen-services": state.services.length > 0, "screen-mood": state.moods.length > 0, "screen-format": !!state.format };
    document.querySelectorAll("[data-next]").forEach((b) => {
      const sid = b.closest(".screen").id;
      b.disabled = ok[sid] === false;
    });
  }

  // ---------- Optionen rendern ----------
  function renderOptions() {
    const sv = $("#opt-services"); sv.innerHTML = "";
    SERVICES.forEach((s) => {
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
        onclick: () => { state.format = f.id; save(); renderOptions(); updateNextButtons(); setTimeout(next, 180); },
      }, el("span", { class: "emoji" }, f.emoji), el("span", { class: "txt" }, el("b", {}, f.label), el("small", {}, f.sub))));
    });
    renderFavs();
  }
  const toggle = (arr, v) => { const i = arr.indexOf(v); i >= 0 ? arr.splice(i, 1) : arr.push(v); };

  // ---------- Favoriten-Suche ----------
  function renderFavs() {
    const box = $("#favChips"); box.innerHTML = "";
    state.favs = state.favs.filter((t) => byTitle.has(t));
    state.favs.forEach((t) => box.append(el("button", {
      type: "button", class: "chip", "aria-label": `${t} entfernen`,
      onclick: () => { state.favs = state.favs.filter((x) => x !== t); save(); renderFavs(); },
    }, t, el("span", { class: "x" }, "×"))));
    $("#favEmpty").hidden = state.favs.length > 0;
  }
  function searchTitles(q) {
    const nq = norm(q);
    if (nq.length < 2) return [];
    return TITLES
      .filter((x) => !state.favs.includes(x.t))
      .map((x) => { const n = norm(x.t); const pos = n.indexOf(nq); return { x, pos, starts: n.split(" ").some((w) => w.startsWith(nq)) }; })
      .filter((r) => r.pos >= 0)
      .sort((a, b) => (b.starts - a.starts) || a.pos - b.pos || a.x.t.length - b.x.t.length)
      .slice(0, 6).map((r) => r.x);
  }
  let activeSuggest = -1;
  function renderSuggest() {
    const list = $("#favSuggest"); list.innerHTML = "";
    const res = searchTitles($("#favInput").value);
    activeSuggest = Math.min(activeSuggest, res.length - 1);
    res.forEach((x, i) => list.append(el("li", {
      role: "option", class: i === activeSuggest ? "active" : "",
      onmousedown: (e) => { e.preventDefault(); addFav(x.t); },
    }, el("span", {}, x.t), el("small", {}, `${x.y} · ${x.type === "serie" ? "Serie" : "Film"}`))));
    if ($("#favInput").value.trim().length >= 2 && res.length === 0) {
      list.append(el("li", { class: "none" }, "Kenne ich leider nicht – probier einen ähnlichen Titel."));
    }
    return res;
  }
  function addFav(t) {
    if (!state.favs.includes(t)) state.favs.push(t);
    save(); $("#favInput").value = ""; activeSuggest = -1; renderSuggest(); renderFavs(); $("#favInput").focus();
  }

  // ---------- Empfehlungs-Logik ----------
  const overlap = (a, b) => a.reduce((n, x) => n + (b.includes(x) ? 1 : 0), 0);

  function similarity(c, fav) {
    const g = overlap(c.g, fav.g) / Math.max(c.g.length, fav.g.length);
    const k = overlap(c.k, fav.k);
    return g * 3 + Math.min(k, 3) * 1.5;
  }

  function score(c, favs) {
    let s = 0;
    const reasons = [];

    const moodHits = c.m.filter((m) => state.moods.includes(m));
    s += moodHits.length * 3;
    if (c.m[0] && state.moods.includes(c.m[0])) s += 1; // Hauptstimmung passt

    let best = null;
    if (favs.length) {
      const sims = favs.filter((f) => f.t !== c.t).map((f) => ({ f, v: similarity(c, f) })).sort((a, b) => b.v - a.v);
      if (sims.length) {
        best = sims[0];
        s += best.v * 1.3 + sims.slice(1).reduce((n, x) => n + x.v, 0) * 0.2;
        if (best.v >= 3) reasons.push(`Ähnlich wie „${best.f.t}“`);
      }
    }

    s += (c.r - 6.8) * 1.6; // Qualität
    s += Math.random() * 1.5; // etwas Abwechslung für jeden Samstag

    if (moodHits.length) reasons.push(moodHits.map((m) => MOODS.find((x) => x.id === m).label).join(" + "));
    if (c.r >= 8.3) reasons.push("Top bewertet");
    return { c, s, reasons, moodHits: moodHits.length };
  }

  function recommend() {
    const favs = state.favs.map((t) => byTitle.get(t)).filter(Boolean);
    const exclude = new Set([...state.seen, ...state.shown]);
    let pool = CANDIDATES.filter((c) => c.p.some((p) => state.services.includes(p)) && !exclude.has(c.id) && !state.favs.includes(c.t));

    if (state.format === "film-kurz") pool = pool.filter((c) => c.type === "film" && c.rt <= 110);
    else if (state.format === "film") pool = pool.filter((c) => c.type === "film");
    else if (state.format === "serie") pool = pool.filter((c) => c.type === "serie");

    let scored = pool.map((c) => score(c, favs));
    const matching = scored.filter((x) => x.moodHits > 0);
    let relaxed = false;
    if (matching.length >= 3) scored = matching; else relaxed = true;
    scored.sort((a, b) => b.s - a.s);

    // Vielfalt: nicht 3x dasselbe Hauptgenre bzw. dasselbe Franchise
    const picks = [];
    for (const x of scored) {
      if (picks.length === 3) break;
      const sameGenre = picks.filter((p) => p.c.g[0] === x.c.g[0]).length;
      const sameFranchise = picks.some((p) => overlap(p.c.k, ["marvel", "star-wars", "pixar"].filter((f) => x.c.k.includes(f))) > 0);
      if (sameGenre >= 2 || sameFranchise) continue;
      picks.push(x);
    }
    for (const x of scored) { if (picks.length === 3) break; if (!picks.includes(x)) picks.push(x); }
    return { picks, relaxed, poolSize: pool.length };
  }

  // ---------- Ergebnis anzeigen ----------
  function renderResults() {
    const { picks, relaxed } = recommend();
    picks.forEach((p) => state.shown.push(p.c.id));
    state.current = picks.map((p) => p.c.id);
    const box = $("#results"); box.innerHTML = "";

    const svcNames = SERVICES.filter((s) => state.services.includes(s.id)).map((s) => s.label);
    $("#resultHint").textContent = picks.length
      ? `Aus ${svcNames.join(", ")}${relaxed ? " – zu eurer Stimmung gab's nicht mehr viel, deshalb etwas breiter gesucht" : ""}.`
      : "";
    $("#resetSeenBtn").hidden = state.seen.length === 0;

    if (!picks.length) {
      box.append(el("div", { class: "empty" },
        el("div", { class: "hero-emoji" }, "🫠"),
        el("p", {}, "Ihr habt schon alles gesehen, was hier passt! Versucht eine andere Stimmung oder ein anderes Format."),
        state.shown.length ? el("button", { class: "btn ghost", type: "button", onclick: () => { state.shown = []; renderResults(); } }, "Von vorne durchmischen") : null));
      return;
    }

    picks.forEach((p, i) => box.append(card(p, i)));
  }

  function card({ c, reasons }, i) {
    const [emoji, c1, c2] = GENRE_STYLE[c.g[0]] || ["🎬", "#444", "#222"];
    const q = encodeURIComponent(c.t);
    const node = el("article", { class: "card", style: `--c1:${c1};--c2:${c2};animation-delay:${i * 90}ms` },
      el("div", { class: "poster" },
        el("span", { class: "poster-emoji" }, emoji),
        el("span", { class: "rank" }, ["🥇", "🥈", "🥉"][i] || "")),
      el("div", { class: "body" },
        el("h3", {}, c.t),
        el("div", { class: "meta" },
          el("span", {}, String(c.y)),
          el("span", {}, c.type === "serie" ? `Serie · ~${c.rt} min/Folge` : fmtTime(c.rt)),
          el("span", { class: "star" }, `★ ${c.r.toFixed(1)}`)),
        el("div", { class: "tags" },
          c.p.filter((p) => state.services.includes(p)).map((p) => {
            const s = SERVICES.find((x) => x.id === p);
            return el("span", { class: "svc", style: `--svc:${s.color}` }, s.label);
          }),
          c.g.slice(0, 3).map((g) => el("span", { class: "genre" }, GENRE_LABEL[g] || g))),
        el("p", { class: "desc" }, c.d),
        reasons.length ? el("p", { class: "why" }, "👉 " + reasons.slice(0, 2).join(" · ")) : null,
        el("div", { class: "actions" },
          el("a", { class: "btn small", href: `https://www.justwatch.com/de/Suche?q=${q}`, target: "_blank", rel: "noopener" }, "Wo läuft's?"),
          el("a", { class: "btn small", href: `https://www.youtube.com/results?search_query=${q}+${c.y}+trailer+deutsch`, target: "_blank", rel: "noopener" }, "▶ Trailer"),
          el("button", { class: "btn small ghost", type: "button", onclick: () => markSeen(c.id) }, "Schon gesehen"))));
    return node;
  }

  // Gesehenen Titel merken und nur diese eine Karte durch einen neuen Vorschlag ersetzen
  function markSeen(id) {
    if (!state.seen.includes(id)) state.seen.push(id);
    save();
    const favs = state.favs.map((t) => byTitle.get(t)).filter(Boolean);
    const replacement = recommend().picks.find((p) => !state.current.includes(p.c.id));
    state.current = state.current.flatMap((x) => (x !== id ? [x] : replacement ? [replacement.c.id] : []));
    if (replacement) state.shown.push(replacement.c.id);
    const box = $("#results"); box.innerHTML = "";
    state.current.forEach((cid, i) => box.append(card(score(TITLES[cid], favs), i)));
    $("#resetSeenBtn").hidden = false;
  }

  // ---------- Events ----------
  function find() {
    state.shown = [];
    show("screen-results");
    renderResults();
  }
  function init() {
    renderOptions();
    $("#startBtn").addEventListener("click", () => show("screen-services"));
    $("#homeBtn").addEventListener("click", () => show("screen-start"));
    document.querySelectorAll("[data-next]").forEach((b) => b.addEventListener("click", next));
    document.querySelectorAll("[data-back]").forEach((b) => b.addEventListener("click", back));
    $("#findBtn").addEventListener("click", find);
    $("#rerollBtn").addEventListener("click", () => { renderResults(); window.scrollTo({ top: 0, behavior: "smooth" }); });
    $("#restartBtn").addEventListener("click", () => show("screen-mood"));
    $("#resetSeenBtn").addEventListener("click", () => { state.seen = []; save(); find(); });

    const quick = $("#quickBtn");
    if (state.services.length && state.moods.length && state.format) {
      quick.hidden = false;
      quick.addEventListener("click", find);
    }

    const input = $("#favInput");
    input.addEventListener("input", () => { activeSuggest = -1; renderSuggest(); });
    input.addEventListener("blur", () => setTimeout(() => ($("#favSuggest").innerHTML = ""), 100));
    input.addEventListener("keydown", (e) => {
      const res = searchTitles(input.value);
      if (e.key === "ArrowDown") { activeSuggest = Math.min(activeSuggest + 1, res.length - 1); renderSuggest(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { activeSuggest = Math.max(activeSuggest - 1, 0); renderSuggest(); e.preventDefault(); }
      else if (e.key === "Enter") { const x = res[Math.max(activeSuggest, 0)]; if (x) addFav(x.t); e.preventDefault(); }
    });

    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }
  init();
})();
