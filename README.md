# Schiebepuzzle Web-App

Eine lokale React-Web-App zum Erstellen, Zuschneiden, Spielen und Auswerten von Schiebepuzzles. Die App ist inzwischen mehr als ein MVP: Sie umfasst Startscreen, Bild-Upload, Zufallsbilder, Crop-Werkzeug, Canvas-Spielansicht, Hinweise, Solver, Autosave, Wiederherstellung, Statistik, Galerie, Sammlungen, Backup-Import/-Export und Musik.

## Funktionsumfang

- Eigene Bilder hochladen und als Puzzle-Motiv verwenden.
- Zufallsbilder aus mehreren Quellen laden, mit lokalen und externen Providern.
- KI-generierte Puzzle-Motive per Prompt ueber Pollinations Z-Image Turbo erstellen.
- Bildzuschnitt mit Crop-Ansicht, Transform und Puzzle-Konfiguration.
- Schiebepuzzle mit Canvas-Rendering, Drag-/Keyboard-Interaktion und visuellen Hervorhebungen.
- Loesbare Shuffle-Logik, Hinweise und Solver-Unterstuetzung.
- Exakter Solver ueber separaten Worker fuer passende Puzzle-Groessen.
- Autosave, Resume-Flow, Recovery-Dialog und Last-Session-Wiederaufnahme.
- Statistik mit vier visuellen Hauptansichten fuer Ueberblick, Analyse, Verlauf und Rohdaten-Explorer; Analyse buendelt Stufen, Rekorde und Sauberkeit, der Rohdaten-Explorer speichert CSV-/JSON-Exporte direkt im Projektordner.
- Galerie geloester Motive inklusive Replay-Funktion, optionalem Gemini-Tagging und klickbaren Tag-Filtern.
- Bild-Sammlungen fuer Lieblingsmotive aus der Galerie mit KI-Sammlungsvorschlaegen und Sammlungen aus Tag-Treffern.
- Lokale Backups fuer Spielstaende, Statistik, Galerie und Sammlungen.
- Musik- und Sound-Unterstuetzung mit lokalen Fallback-Tracks.
- Command Palette, globale Hilfe, Kontextmenues, Theme-Umschaltung und Motion-Animationen.

## Technologie

- React 18 und TypeScript
- Vite 5 als Dev-Server und Build-Tool
- HTML5 Canvas fuer Puzzle-Rendering
- `motion` / `motion/react` fuer Animationen
- `lucide-react` fuer konsistente React-SVG-Icons
- Vitest, Testing Library und jsdom fuer Tests
- ESLint mit TypeScript-, React-Hooks- und React-Refresh-Regeln
- Lokale Vite-Middleware in `localApi.ts` fuer `/api/*`

## Installation

```bash
npm install
```

Optional kann eine lokale `.env` aus `.env.example` angelegt werden. Ohne diese Schluessel nutzt die App weiterhin lokale Fallbacks oder Provider, die ohne Key funktionieren.

```env
VITE_JAMENDO_CLIENT_ID=deine_jamendo_client_id
VITE_PEXELS_API_KEY=dein_pexels_api_key
VITE_PIXABAY_API_KEY=dein_pixabay_api_key
VITE_SMITHSONIAN_API_KEY=dein_smithsonian_api_key
POLLINATIONS_API_KEY=dein_pollinations_secret_key
POLLINATIONS_IMAGE_MODEL=zimage
CLOUDFLARE_ACCOUNT_ID=deine_cloudflare_account_id
CLOUDFLARE_API_TOKEN=dein_cloudflare_workers_ai_token
CLOUDFLARE_IMAGE_MODEL=@cf/black-forest-labs/flux-1-schnell
GEMINI_API_KEY=dein_gemini_api_key
GEMINI_GALLERY_MODEL=gemini-2.5-flash
```

`POLLINATIONS_API_KEY` ist ein serverseitiger Secret Key und wird nur von der lokalen Vite-Middleware genutzt. Er darf nicht als `VITE_`-Variable ins Frontend gegeben werden. `zimage` ist ein fuer den getesteten Key freigegebenes schnelles Pollinations-Bildmodell.
`CLOUDFLARE_API_TOKEN` ist der serverseitige Fallback fuer KI-Bilder, wenn Pollinations fehlschlaegt. Der Token braucht Zugriff auf Workers AI fuer die angegebene `CLOUDFLARE_ACCOUNT_ID`; `CLOUDFLARE_IMAGE_MODEL` ist standardmaessig `@cf/black-forest-labs/flux-1-schnell`.
`GEMINI_API_KEY` ist ein serverseitiger Secret Key fuer automatische Galerie-Tags und Sammlungsvorschlaege. Ohne Key speichert die App geloeste Bilder weiterhin normal, markiert das KI-Tagging aber als nicht konfiguriert. `GEMINI_GALLERY_MODEL` ist standardmaessig `gemini-2.5-flash`.

## Start und Befehle

```bash
# Dev-Server starten
npm run dev

# Production-Build pruefen
npm run build

# Lint ausfuehren
npm run lint

# Keyboard-Smoke-Test
npm run test:smoke

# Alle Vitest-Tests
npm exec vitest run

# Preview-Server starten
npm run preview

# Lokale Audio-Assets generieren
npm run generate:audio
```

Der Dev-Server ist in `vite.config.ts` auf `http://127.0.0.1:5173/` mit `strictPort: true` konfiguriert.

## Lokale Daten

Die App arbeitet lokal. Die Vite-Middleware in `localApi.ts` verwaltet die Daten direkt im Projektordner:

- `spielstaende/`: gespeicherte Partien, `__stats.json`, `__gallery.json` und `__collections.json`
- `backups/`: lokale Backup-Dateien mit der Endung `.spbkp`
- `statistik-exporte/`: CSV- und JSON-Dateien aus dem Rohdaten-Explorer
- `public/audio/`: lokale Musik- und Sound-Assets
- `public/fonts/`: eingebundene Fonts

Diese Nutzdaten und Build-Artefakte sind fuer manuelle Bearbeitung tabu, sofern eine Aufgabe das nicht ausdruecklich verlangt.

## Lokale API

Die Frontend-Services greifen ueber lokale API-Routen auf die Middleware zu:

- `/api/saves`: Spielstaende erstellen, laden, aktualisieren und loeschen.
- `/api/stats`: Statistik laden, zuruecksetzen, Abschluesse aufzeichnen und Rohdaten-Exporte speichern.
- `/api/gallery`: Galerie geloester Motive laden, erweitern und bereinigen.
- `/api/gallery/:entryId/analyze`: Galerie-Motiv mit Gemini taggen und Sammlungsvorschlaege speichern.
- `/api/collections`: Bild-Sammlungen laden, erstellen, bearbeiten und mit Galerie-Motiven verknuepfen.
- `/api/backup`: Daten exportieren, importieren und lokale Backup-Dateien verwalten.
- `/api/clipboard`: Clipboard-Hilfen fuer lokale Bild- und Textablage.
- `/api/generated-image`: KI-Motiv aus einem Prompt ueber Pollinations Z-Image Turbo erzeugen, mit Cloudflare Workers AI Flux Schnell als Fallback.
- `/api/music`: Musiktracks anhand des gewaehlten Stils auswaehlen.

Bei Aenderungen an diesen Routen muessen Frontend-Service, Typen und `localApi.ts` gemeinsam angepasst werden.

## Projektstruktur

```text
src/
  app/         App-weite Hooks fuer Hilfe, Fokus, Sessions, Recovery und Shortcuts
  assets/      System-Icons fuer Screens, Kontextmenues und globale UI
  components/  Wiederverwendbare UI-Komponenten
  contexts/    React-Kontexte, aktuell vor allem Theme-Zustand
  motion/      Motion-Komponenten, Tokens, Varianten und Dialog-A11y
  screens/     Start-, Upload-, Crop- und Puzzle-Ansichten
  services/    Puzzle-, Save-, Stats-, Galerie-, Sammlungs-, Backup-, Musik- und Bildprovider-Logik
  styles/      Globale, Komponenten- und Screen-CSS-Dateien
  test/        Vitest-Tests und Test-Setup
  types/       Zentrale TypeScript-Typen
  utils/       Hilfslogik fuer Schwierigkeit, Run-Vergleich und Kontextfenster
  workers/     Solver-Worker
```

Wichtige Einstiegspunkte:

- `src/App.tsx`: zentraler App-Flow, Lazy-Loading, Autosave, Recovery und Screen-Wechsel.
- `src/screens/UploadScreen.tsx`: Workspace fuer Upload, Saves, Statistik, Galerie, Sammlungen und Backups.
- `src/screens/CropScreen.tsx`: Zuschnitt und Puzzle-Konfiguration.
- `src/screens/PuzzleScreen.tsx`: Spielansicht und Puzzle-Interaktion.
- `src/services/PuzzleEngine.ts`: Kernlogik fuer Board, Moves, Shuffle und Hinweise.
- `src/services/PuzzleRenderer.ts`: Canvas-Rendering.
- `src/services/PuzzleSolver.ts` und `src/services/ExactPuzzleSolver.ts`: Solver-Logik.
- `localApi.ts`: lokale Dateipersistenz und API-Middleware.

## User Flow

1. Startscreen oeffnen und optional letzte Sitzung fortsetzen.
2. Bild hochladen, Zufallsbild laden oder Galerie-/Save-Eintrag wiederverwenden.
3. Motiv zuschneiden und Puzzle-Groesse waehlen.
4. Puzzle spielen, Hinweise nutzen oder Solver-Unterstuetzung anfordern.
5. Nach dem Loesen Statistik, Bestwerte und Galerie aktualisieren lassen.
6. Neue Galerie-Motive optional automatisch mit Gemini taggen, per Tag filtern und Tag-Treffer als Sammlung uebernehmen.
7. Spielstaende, Galerie, Sammlungen und Statistik bei Bedarf als Backup sichern oder wiederherstellen.

## Entwicklungshinweise

- Bestehende deutsche UI-Texte beibehalten, sofern kein Rewriting gewuenscht ist.
- Persistierte Daten defensiv lesen, damit alte Spielstaende, Statistik-, Galerie-, Sammlungs- und Backup-Dateien weiter funktionieren.
- Solver-, Canvas- und Worker-Aenderungen immer gegen `PuzzleState`, `Tile`, Worker-Protokolle und Tests pruefen.
- UI-Aenderungen sollten vorhandene CSS-Struktur, Icon-Komponenten und Motion-Bausteine wiederverwenden.
- Fuer groessere oder riskantere Aenderungen vorab klaeren, ob ein eigener Git-Branch sinnvoll ist.
- Bei Struktur-, Workflow-, Befehls-, Persistenz- oder Architektur-Aenderungen auch `AGENTS.md` pruefen und bei Bedarf aktualisieren.

## Feedback und Mitmachen

Verbesserungsvorschlaege sind willkommen. Wenn du einen Bug findest, eine Idee hast oder Feedback zu Bedienung, Design, Barrierefreiheit, Performance oder Code-Struktur geben moechtest, erstelle am besten ein GitHub Issue.

Konkrete Code-Aenderungen koennen ueber einen Pull Request vorgeschlagen werden. Bitte beschreibe kurz, was geaendert wurde und warum die Aenderung hilfreich ist.

## Verifikation

Fuer reine Dokumentationsaenderungen ist normalerweise kein Build noetig. Fuer Codeaenderungen gilt:

- Mindestens `npm run build` ausfuehren.
- Nach TypeScript-/React-Aenderungen moeglichst `npm run lint` ausfuehren.
- Bei Tastatur-/Fokuslogik `npm run test:smoke` ausfuehren.
- Bei Galerie-, Replay- oder Run-Vergleichslogik passende Vitest-Dateien unter `src/test/` ausfuehren.
- Bei API-/Persistenz-Aenderungen nach Moeglichkeit einen kurzen manuellen Dev-Server-Test machen.

## Lizenz

In diesem Repository ist aktuell keine separate Lizenzdatei hinterlegt.
