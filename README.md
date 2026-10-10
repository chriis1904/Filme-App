# 🍿 Movie Night Finder

Schluss mit Endlos-Scrollen: 4 kurze Fragen, dann schlägt die App **3 Filme oder Serien** vor – nur aus euren Abos (Netflix, Prime Video, Disney+).

## So funktioniert's

1. **Welche Abos habt ihr?** – wird gespeichert
2. **Worauf habt ihr Lust?** – bis zu 2 Stimmungen (Lachen, Romantik, Spannung, Grusel …)
3. **Film oder Serie?** – inkl. „Film, nicht zu lang“
4. **Was fandet ihr richtig gut?** – optional, z. B. „Knives Out“ oder „Friends“; wird gespeichert und für die Ähnlichkeitssuche genutzt

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

## Titel pflegen

Alle Titel stehen in `js/data.js` (~120 vorschlagbare Titel plus Referenz-Titel für „Das hat uns gefallen“). Pro Titel: Dienste (`p`), Genres (`g`), Stimmungen (`m`), Stichworte für die Ähnlichkeit (`k`), Laufzeit, Bewertung, Kurzbeschreibung. Ein Titel mit leerem `p` wird nie vorgeschlagen, kann aber als Favorit ausgewählt werden.

Hinweis: Die Verfügbarkeit ist für Deutschland hinterlegt und ändert sich mit der Zeit – deshalb gibt es bei jedem Vorschlag den JustWatch-Link.
