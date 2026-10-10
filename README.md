# 🍿 Movie Night Finder

Schluss mit Endlos-Scrollen: 4 kurze Fragen, dann schlägt die App **3 Filme oder Serien** vor – nur aus euren Abos (Netflix, Prime Video, Disney+; im Live-Modus auch Apple TV+ und Paramount+).

## So funktioniert's

1. **Welche Abos habt ihr?** – wird gespeichert
2. **Worauf habt ihr Lust?** – bis zu 2 Stimmungen (Lachen, Romantik, Spannung, Grusel …)
3. **Film oder Serie?** – „Beides“ (mind. ein Film *und* eine Serie), „Film, nicht zu lang“, „Film“ oder „Nur Serien“ – plus **Bekannte Hits / Gemischt / Geheimtipps** (bei „Gemischt“ ist immer ein 💎 Geheimtipp dabei)
4. **Was fandet ihr richtig gut?** – optional, z. B. „Lioness“ oder „Trap: No Way Out“; wird gespeichert und für die Ähnlichkeitssuche genutzt – auch über Film/Serie hinweg

Danach:
- **Wo läuft's?** öffnet JustWatch mit dem aktuellen Streaming-Stand
- **▶ Trailer** sucht den deutschen Trailer auf YouTube
- **Schon gesehen** ersetzt den Vorschlag und merkt ihn sich dauerhaft
- **Andere Vorschläge** zeigt 3 neue, ohne Wiederholungen
- Beim nächsten Mal: **„Wie letztes Mal, nur neue Vorschläge“** auf dem Startbildschirm → ein Klick

## Starten

Reine HTML/CSS/JS-App ohne Server und ohne Build-Schritt.

- Lokal: `index.html` im Browser öffnen (oder `python3 -m http.server` und http://localhost:8000)
- Aufs Handy: Repo-Einstellungen → **Pages** → Branch auswählen → Seite öffnen → „Zum Home-Bildschirm hinzufügen“. Läuft dann wie eine App, auch offline.

## Live-Modus (empfohlen)

Ohne Live-Modus nutzt die App eine eingebaute Liste (~165 Titel). Mit einem **kostenlosen TMDB-Schlüssel** kennt sie jeden Film und jede Serie, zeigt Poster und prüft live, was in Deutschland gerade auf euren Diensten läuft:

1. Auf [themoviedb.org](https://www.themoviedb.org/signup) registrieren
2. Unter [Einstellungen → API](https://www.themoviedb.org/settings/api) einen Schlüssel beantragen (Developer, private Nutzung)
3. In der App auf ⚙️ tippen, Schlüssel einfügen, „Prüfen & speichern“

Der Schlüssel bleibt nur auf eurem Gerät (nicht im Repo). Fällt TMDB aus, nutzt die App automatisch die eingebaute Liste.

*Diese App nutzt die TMDB-API, ist aber nicht von TMDB geprüft oder zertifiziert.*

## Titel pflegen (Offline-Liste)

Alle Titel stehen in `js/data.js` (~165 vorschlagbare Titel plus Referenz-Titel für „Das hat uns gefallen“). Pro Titel: Dienste (`p`), Genres (`g`), Stimmungen (`m`), Stichworte für die Ähnlichkeit (`k`), Laufzeit, Bewertung, Kurzbeschreibung. Ein Titel mit leerem `p` wird nie vorgeschlagen, kann aber als Favorit ausgewählt werden. Geheimtipps stehen in `GEM_TITLES` am Ende der Datei.

Hinweis: Die Verfügbarkeit ist für Deutschland hinterlegt und ändert sich mit der Zeit – deshalb gibt es bei jedem Vorschlag den JustWatch-Link.
