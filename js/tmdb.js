// Live-Modus: The Movie Database (TMDB) – kennt praktisch alle Filme & Serien
// inkl. Streaming-Verfügbarkeit in Deutschland (Daten von JustWatch).
// Der API-Schlüssel wird nur lokal im Browser gespeichert.
window.TMDB = (() => {
  "use strict";
  const API = "https://api.themoviedb.org/3";
  const IMG = "https://image.tmdb.org/t/p/w342";
  const KEY_STORE = "mnf.tmdbKey";

  // Provider-IDs (watch_region=DE). Name-Muster als Absicherung beim Auswerten.
  const PROVIDERS = {
    netflix: { ids: [8, 1796], match: /netflix/i },
    prime: { ids: [9], match: /amazon prime video/i },
    disney: { ids: [337], match: /disney/i },
    apple: { ids: [350], match: /apple tv/i },
    paramount: { ids: [531], match: /paramount/i },
  };

  // TMDB-Genre-IDs -> interne Genre-Schlüssel (für Farben/Labels/Stimmungen)
  const GENRE_KEY = {
    28: "action", 12: "abenteuer", 16: "animation", 35: "komödie", 80: "krimi", 99: "doku", 18: "drama",
    10751: "familie", 14: "fantasy", 36: "historisch", 27: "horror", 10402: "musik", 9648: "mystery",
    10749: "romantik", 878: "scifi", 53: "thriller", 10752: "historisch", 37: "abenteuer",
    10759: "action", 10765: "scifi", 10768: "drama",
  };
  // Stimmung -> Genres je Medientyp
  const MOOD_GENRES = {
    movie: {
      lachen: [35], romantik: [10749], spannung: [53, 9648, 80], action: [28, 12], grusel: [27],
      wohlfuehl: [35, 10751, 16, 10402], nachdenken: [18, 36], staunen: [878, 14, 12],
    },
    tv: {
      lachen: [35], romantik: [18, 35], spannung: [80, 9648], action: [10759], grusel: [9648, 10765],
      wohlfuehl: [35, 10751, 16], nachdenken: [18, 10768], staunen: [10765, 10759],
    },
  };
  // Genre-Übersetzung Film <-> Serie (für "Lioness" -> passende Filme)
  const TO_TV = { 28: 10759, 12: 10759, 878: 10765, 14: 10765, 10752: 10768, 53: 80 };
  const TO_MOVIE = { 10759: 28, 10765: 878, 10768: 10752 };
  const EXCLUDE = { movie: "99", tv: "10763,10764,10766,10767,10762,99" };

  const getKey = () => { try { return localStorage.getItem(KEY_STORE) || ""; } catch { return ""; } };
  const setKey = (k) => { try { k ? localStorage.setItem(KEY_STORE, k.trim()) : localStorage.removeItem(KEY_STORE); } catch {} };

  async function get(path, params = {}, key = getKey()) {
    const url = new URL(API + path);
    const bearer = key.startsWith("eyJ"); // v4 "Lese-Zugriffstoken" statt v3 "API-Schlüssel"
    if (!bearer) url.searchParams.set("api_key", key);
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
    const res = await fetch(url, { headers: bearer ? { Authorization: "Bearer " + key, accept: "application/json" } : { accept: "application/json" } });
    if (res.status === 401) throw new Error("401");
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  async function test(key) {
    await get("/configuration", {}, key.trim());
    return true;
  }

  const yearOf = (x) => Number((x.release_date || x.first_air_date || "").slice(0, 4)) || null;
  const titleOf = (x) => x.title || x.name || x.original_title || x.original_name || "";

  async function search(q) {
    const data = await get("/search/multi", { query: q, language: "de-DE", include_adult: "false" });
    return (data.results || [])
      .filter((x) => (x.media_type === "movie" || x.media_type === "tv") && (x.vote_count || 0) > 5)
      .slice(0, 7)
      .map((x) => ({ tmdbId: x.id, mt: x.media_type, t: titleOf(x), y: yearOf(x) }));
  }

  // ---------- Empfehlungen ----------
  const providerIds = (services) => services.flatMap((s) => (PROVIDERS[s] ? PROVIDERS[s].ids : [])).join("|");
  const rnd = (n) => 1 + Math.floor(Math.random() * n);
  const isGem = (x, mt) => (x.vote_count || 0) < (mt === "movie" ? 1500 : 400);

  function discoverParams(mt, opts, extra = {}) {
    const p = {
      language: "de-DE", watch_region: "DE", with_watch_monetization_types: "flatrate",
      with_watch_providers: providerIds(opts.services), without_genres: EXCLUDE[mt],
      "vote_average.gte": opts.pop === "hits" ? 6.6 : 6.3, include_adult: "false",
    };
    const minVotes = mt === "movie" ? { hits: 1500, mix: 150, gems: 60 } : { hits: 400, mix: 60, gems: 25 };
    p["vote_count.gte"] = minVotes[opts.pop] || minVotes.mix;
    if (opts.pop === "gems") p["vote_count.lte"] = mt === "movie" ? 2500 : 600;
    p.sort_by = opts.pop === "gems" ? "vote_average.desc" : "popularity.desc";
    if (mt === "movie") {
      p["with_runtime.gte"] = 70;
      if (opts.format === "film-kurz") p["with_runtime.lte"] = 110;
    }
    return Object.assign(p, extra);
  }

  async function favInfo(fav) {
    const d = await get(`/${fav.mt}/${fav.tmdbId}`, { language: "de-DE", append_to_response: "keywords" });
    const kw = (d.keywords && (d.keywords.keywords || d.keywords.results)) || [];
    return { ...fav, genres: (d.genres || []).map((g) => g.id), keywords: kw.slice(0, 8).map((k) => k.id) };
  }

  async function recommend(opts) {
    // opts: services[], moods[], format, pop ('hits'|'mix'|'gems'), favs[], exclude Set
    const types = opts.format === "serie" ? ["tv"] : opts.format === "egal" ? ["movie", "tv"] : ["movie"];
    const cands = new Map();
    const add = (x, mt, src) => {
      const key = `${mt}:${x.id}`;
      if (opts.exclude.has(key)) return;
      let c = cands.get(key);
      if (!c) { c = { key, mt, x, onService: false, recFrom: new Set(), simFrom: new Set(), fromMood: false }; cands.set(key, c); }
      if (src.onService) c.onService = true;
      if (src.rec) c.recFrom.add(src.rec);
      if (src.sim) c.simFrom.add(src.sim);
      if (src.mood) c.fromMood = true;
    };

    const jobs = [];
    // 1) Stimmung -> discover je Medientyp
    for (const mt of types) {
      const genres = [...new Set(opts.moods.flatMap((m) => MOOD_GENRES[mt][m] || []))].join("|");
      for (const page of [rnd(3), rnd(3) + 3]) {
        jobs.push(get(`/discover/${mt}`, discoverParams(mt, opts, { with_genres: genres, page }))
          .then((d) => (d.results || []).forEach((x) => add(x, mt, { onService: true, mood: true }))));
      }
    }
    // 2) Favoriten -> TMDB-Empfehlungen + Stichwort-Suche (auch über Film/Serie hinweg)
    const favs = await Promise.all(opts.favs.slice(0, 5).map((f) => favInfo(f).catch(() => null)));
    for (const f of favs.filter(Boolean)) {
      if (types.includes(f.mt)) {
        jobs.push(get(`/${f.mt}/${f.tmdbId}/recommendations`, { language: "de-DE" })
          .then((d) => (d.results || []).forEach((x) => add(x, f.mt, { rec: f.t }))));
      }
      for (const mt of types) {
        const map = mt === f.mt ? null : mt === "tv" ? TO_TV : TO_MOVIE;
        const g = f.genres.map((id) => (map && map[id]) || id).filter((id) => GENRE_KEY[id]);
        const params = { page: 1 };
        if (f.keywords.length) params.with_keywords = f.keywords.join("|");
        else if (g.length) params.with_genres = g.slice(0, 2).join(",");
        else continue;
        jobs.push(get(`/discover/${mt}`, discoverParams(mt, { ...opts, pop: opts.pop === "hits" ? "mix" : opts.pop }, params))
          .then((d) => (d.results || []).forEach((x) => {
            // bei Stichwort-Treffern zusätzlich Genre-Nähe verlangen
            const gx = x.genre_ids || [];
            if (!f.keywords.length || g.some((id) => gx.includes(id))) add(x, mt, { onService: true, sim: f.t });
          })));
      }
    }
    const results = await Promise.allSettled(jobs);
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.some((r) => r.reason && r.reason.message === "401")) throw new Error("401");
    if (failed.length === results.length) throw failed[0] ? failed[0].reason : new Error("keine Daten");

    // Bewerten
    const moodGenreSet = (mt) => new Set(opts.moods.flatMap((m) => MOOD_GENRES[mt][m] || []));
    const scored = [...cands.values()].map((c) => {
      const gx = c.x.genre_ids || [];
      const mg = moodGenreSet(c.mt);
      const moodHits = gx.filter((id) => mg.has(id)).length;
      const gem = isGem(c.x, c.mt);
      let s = moodHits * 2.5 + c.recFrom.size * 4 + c.simFrom.size * 3;
      s += ((c.x.vote_average || 0) - 6.8) * 1.6;
      if (opts.pop === "gems") s += gem ? 3 : -3;
      if (opts.pop === "hits") s += gem ? -2.5 : 1.5;
      if ((c.x.vote_count || 0) < 20) s -= 5;
      s += Math.random() * 1.5;
      return { ...c, s, moodHits, gem };
    }).filter((c) => !opts.moods.length || c.moodHits > 0 || c.recFrom.size || c.simFrom.size)
      .sort((a, b) => b.s - a.s);

    // Top-Kandidaten im Detail laden (Laufzeit, Anbieter) – Empfehlungen sind noch nicht auf Abos gefiltert
    const picks = [];
    const wantMix = opts.format === "egal";
    const wantGem = opts.pop === "mix";
    for (let i = 0; i < scored.length && picks.length < 3; i += 8) {
      const batch = scored.slice(i, i + 8);
      const detailed = await Promise.all(batch.map((c) => details(c, opts).catch(() => null)));
      for (const d of detailed) {
        if (!d || picks.length >= 3) continue;
        if (!d.item.p.length) continue; // läuft nicht in euren Abos
        if (opts.format === "film-kurz" && d.item.rt > 115) continue;
        picks.push(d);
      }
      if (i >= 24) break;
    }
    await enforce(picks, scored, opts);
    return picks;
  }

  // Für "Beides" mindestens ein Film und eine Serie, bei "Mix" mindestens ein Geheimtipp
  async function enforce(picks, scored, opts) {
    const sat = (list) => window.MNF_RULES.satisfied(list.map((p) => p.item), opts);
    if (picks.length < 3 || sat(picks) === 2) return;
    const used = new Set(picks.map((p) => p.item.key));
    const rest = scored.filter((c) => !used.has(c.key)).slice(0, 24);
    for (let i = 0; i < rest.length; i += 8) {
      const ds = await Promise.all(rest.slice(i, i + 8).map((c) => details(c, opts).catch(() => null)));
      for (const d of ds) {
        if (!d || !d.item.p.length) continue;
        if (opts.format === "film-kurz" && d.item.rt > 115) continue;
        window.MNF_RULES.tryImprove(picks, d, (p) => p.item, opts);
        if (sat(picks) === 2) return;
      }
    }
  }

  async function details(c, opts) {
    const d = await get(`/${c.mt}/${c.x.id}`, { language: "de-DE", append_to_response: "watch/providers" });
    const de = (d["watch/providers"] && d["watch/providers"].results && d["watch/providers"].results.DE) || {};
    const flat = de.flatrate || [];
    const p = opts.services.filter((s) => PROVIDERS[s] && flat.some((f) => PROVIDERS[s].ids.includes(f.provider_id) || PROVIDERS[s].match.test(f.provider_name)));
    const rt = c.mt === "movie" ? d.runtime || 0 : (d.episode_run_time && d.episode_run_time[0]) || (d.last_episode_to_air && d.last_episode_to_air.runtime) || 0;
    const reasons = [];
    if (c.recFrom.size) reasons.push(`Ähnlich wie „${[...c.recFrom][0]}“`);
    else if (c.simFrom.size) reasons.push(`Ähnliche Themen wie „${[...c.simFrom][0]}“`);
    return {
      item: {
        key: c.key, t: d.title || d.name, y: yearOf(d), type: c.mt === "movie" ? "film" : "serie",
        rt, seasons: d.number_of_seasons || 0, r: d.vote_average || c.x.vote_average || 0,
        g: (d.genres || []).map((x) => GENRE_KEY[x.id]).filter(Boolean),
        p, d: shorten(d.overview || c.x.overview || ""), poster: d.poster_path ? IMG + d.poster_path : null,
        gem: c.gem, link: `https://www.themoviedb.org/${c.mt}/${c.x.id}?language=de-DE`, jwLink: de.link || null,
      },
      reasons, moodHits: c.moodHits,
    };
  }

  function shorten(s) {
    if (s.length <= 240) return s;
    const cut = s.slice(0, 240);
    const dot = cut.lastIndexOf(". ");
    return (dot > 120 ? cut.slice(0, dot + 1) : cut.replace(/\s+\S*$/, "") + " …");
  }

  return { getKey, setKey, test, search, recommend, PROVIDERS };
})();
