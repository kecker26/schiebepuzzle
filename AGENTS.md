# AGENTS.md

## Zweck
- Diese Datei gibt Arbeitsregeln fuer Codex und andere Coding-Agents in diesem Repository.
- Halte Aenderungen klein, nachvollziehbar und kompatibel mit dem bestehenden React-, TypeScript- und Vite-Setup.

## Projektueberblick
- App-Typ: Schiebepuzzle-Web-App mit Bild-Upload, Crop, Spielansicht, Hinweisen, Solver und Statistik.
- Frontend: React 18 + TypeScript.
- Build und Dev-Server: Vite.
- Lokale API: `localApi.ts` wird ueber `vite.config.ts` als Plugin eingebunden.
- Persistenz: Spielstaende und Statistiken liegen lokal unter `spielstaende/`.

## Wichtige Pfade
- `src/App.tsx`: zentraler App-Flow, Session-Handling, Save-/Stats-Refresh, Screen-Wechsel.
- `src/screens/`: UI-Bloecke fuer Upload, Crop und Puzzle.
- `src/components/`: wiederverwendbare UI wie `WinDialog` und `ThemeSwitcher`.
- `src/contexts/ThemeContext.tsx`: Theme-Zustand.
- `src/services/PuzzleEngine.ts`: Kernlogik fuer Board, Moves, Shuffle, Heuristiken und Hinweise.
- `src/services/PuzzleRenderer.ts`: Canvas-Rendering und visuelle Hervorhebungen.
- `src/services/PuzzleSolver.ts`: Solver-Logik.
- `src/workers/puzzle-solver.worker.ts`: Worker fuer rechenintensive Solver-Aufgaben.
- `src/services/SaveService.ts` und `src/services/StatsService.ts`: Frontend-Zugriff auf `/api/*`.
- `localApi.ts`: lokale Dateipersistenz fuer Saves und Statistiken.
- `src/types/index.ts`: zentrale Typdefinitionen.
- `src/styles/`: globale und screen-/component-spezifische CSS-Dateien.

## Arbeitsregeln
- Vor groesseren Aenderungen die betroffenen Datenfluesse lesen, nicht nur die UI-Datei.
- Aenderungen an Spielmechanik immer gegen `PuzzleEngine`, `PuzzleStateService`, `PuzzleSolver` und betroffene Typen pruefen.
- Aenderungen an Save-/Stats-Features immer auf Frontend und `localApi.ts` abstimmen.
- Bestehende API-Pfade (`/api/saves`, `/api/stats`) nur aendern, wenn Frontend und lokale API gemeinsam angepasst werden.
- `dist/`, `node_modules/` und gespeicherte Nutzdaten unter `spielstaende/` nicht manuell bearbeiten, ausser die Aufgabe verlangt es explizit.
- Bestehende deutsche UI-Texte beibehalten, sofern kein ausdrueckliches Rewriting gewuenscht ist.
- Bevorzuge kleine, lokale Fixes statt breiter Refactors.

## Befehle
- Installieren: `npm install`
- Dev-Server: `npm run dev`
- Build-Check: `npm run build`
- Lint: `npm run lint`

## Verifikation
- Nach relevanten Codeaenderungen mindestens `npm run build` ausfuehren.
- Bei Aenderungen an TypeScript- oder React-Code nach Moeglichkeit auch `npm run lint` ausfuehren.
- Bei Aenderungen an Save-/Stats-Logik pruefen, ob Erstellen, Laden, Aktualisieren und Loeschen von Spielstaenden weiter funktioniert.
- Bei Aenderungen an Solver oder Rendering auf offensichtliche Laufzeitprobleme in Upload-, Crop- und Puzzle-Ansicht achten.

## Hinweise fuer sichere Aenderungen
- Canvas- und Solver-Code ist zustandsabhaengig; dort keine stillen Strukturbrueche an `PuzzleState`, `Tile` oder Worker-Nachrichten einfuehren.
- Persistierte Daten muessen rueckwaertskompatibel behandelt werden, wenn bestehende Dateien in `spielstaende/` weiter lesbar bleiben sollen.
- Wenn neue Features neue Felder in Save- oder Stats-Dateien brauchen, defensiv parsen und sinnvolle Defaults vorsehen.
