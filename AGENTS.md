# AGENTS.md

## Zweck
- Diese Datei gibt Arbeitsregeln fuer Codex und andere Coding-Agents in diesem Repository.
- Halte Aenderungen klein, nachvollziehbar und kompatibel mit dem bestehenden React-, TypeScript- und Vite-Setup.

## Projektueberblick
- App-Typ: Schiebepuzzle-Web-App mit Startscreen, Bild-Upload, Zufallsbild, KI-generiertem Prompt-Bild, Crop, Spielansicht, Pause mit verdecktem Board, Hinweisen, adaptiver Geisteransicht, Solver, Statistik, Galerie, Live-Challenge-Zielvergleich, dauerhaften Challenge-Medaillen, interaktivem KI-Tag-System, manuellen und dauerhaft abgelehnten KI-Tags, tag-basierten Partikeleffekten beim Gewinn, Gemini-Tagging, Gemini-Spielstandstiteln, sentiment-basiertem Bild-Theme, Sammlungen, Backup und Musik.
- Frontend: React 18 + TypeScript.
- Animationen: `motion` / `motion/react` plus `@react-spring/web` fuer federnde Zahlen- und Karten-Mikrointeraktionen.
- Statistik-Charts: `recharts` fuer responsive Donut- und Line-Charts.
- Icons: `lucide-react` fuer React-SVG-Icons, plus kuratierte lokale SVGs unter `src/assets/system/`.
- Build, Dev-Server und Tests: Vite, TypeScript, Vitest und ESLint.
- Lokale API: `localApi.ts` wird ueber `vite.config.ts` als Vite-Plugin eingebunden.
- Persistenz: Spielstaende, Statistik, Galerie und Sammlungen liegen lokal unter `spielstaende/`; Backups liegen unter `backups/`.
- Dev-Server: `vite.config.ts` nutzt `127.0.0.1:5173` mit `strictPort: true`.

## Wichtige Pfade
- `src/App.tsx`: zentraler App-Flow, Lazy-Loading der Screens, Session-Handling, Autosave, Recovery, Save-/Stats-/Gallery-Refresh und Screen-Wechsel.
- `src/app/`: app-weite Hooks und Hilfen fuer Command Palette, Hilfesystem, Recovery, Last-Session, Crop-Drafts, Fokus- und Tastatursteuerung.
- `src/screens/StartScreen.tsx`: Einstieg, Hero-Motiv, Schnellaktionen und Resume-Flow.
- `src/screens/UploadScreen.tsx` und `src/screens/upload/`: Upload-Dashboard, gespeicherte Spiele, Statistik, Galerie, Sammlungen, Backup-Import/-Export und Workspace-Fenster.
- `src/screens/CropScreen.tsx`: Zuschnitt, Transform und Puzzle-Konfiguration.
- `src/screens/PuzzleScreen.tsx` und `src/screens/puzzle/`: Spielansicht, Panels, Kontextmenue, Tastaturkuerzel und Solver-Worker-Hooks.
- `src/components/`: wiederverwendbare UI wie `CommandPalette`, `GlobalHelpOverlay`, `WinDialog`, `ThemeSwitcher`, Toasts, Recovery-Dialog und Icon-Komponenten.
- `src/contexts/ThemeContext.tsx`: Theme-Zustand inklusive aktivierbarem Emotion-Theme.
- `src/motion/`: gemeinsame Motion-Komponenten, Varianten, Tokens und Dialog-A11y-Hooks.
- `src/services/PuzzleEngine.ts`: Kernlogik fuer Board, Moves, Shuffle, Heuristiken und Hinweise.
- `src/services/PuzzleStateService.ts`: Persistierbare Puzzle-Fortschritte, Move-/Redo-History und Run-Metriken.
- `src/services/PuzzleRenderer.ts`: Canvas-Rendering und visuelle Hervorhebungen.
- `src/services/PuzzleSolver.ts`: Solver-Logik.
- `src/services/ExactPuzzleSolver.ts` und `src/workers/exact-puzzle-solver.worker.ts`: exakte Solver-Variante und Worker.
- `src/workers/puzzle-solver.worker.ts`: Worker fuer rechenintensive Solver-Aufgaben.
- `src/services/SaveService.ts`, `StatsService.ts`, `GalleryService.ts`, `CollectionService.ts`, `BackupService.ts`, `MusicService.ts`: Frontend-Zugriff auf lokale `/api/*`-Routen.
- `src/services/ImageThemeService.ts`: lokale Farbanalyse, lokale Stimmungsklassifikation und intensive semantische Theme-Paletten fuer Bilder.
- `src/services/tagCategories/`: gemeinsame statische Tag-Taxonomie, Kategorie-Typen und lokale Resolverlogik fuer statische, KI-gelernte, dynamische und manuelle Zuordnungen.
- `src/services/RandomImageService.ts`, `PromptImageService.ts` und Provider-Dateien wie `NasaImageProvider.ts`, `MetMuseumImageProvider.ts`, `PicsumImageProvider.ts`, `OpenverseImageProvider.ts`, `LoremFlickrImageProvider.ts`, `PixabayImageProvider.ts`, `PexelsImageProvider.ts`, `WikimediaImageProvider.ts`, `SmithsonianImageProvider.ts`, `ArtInstituteImageProvider.ts`, `GeneratedImageProvider.ts`: Zufallsbild-, Tag-Suchbild- und Prompt-Bild-Quellen.
- `src/services/AudioService.ts`, `MusicPlaybackController.ts`, `services/music/` und `musicStyles.ts`: lokale und externe Musikauswahl, Fallback-Tracks und Wiedergabezustand.
- `src/services/api/apiClient.ts`: gemeinsamer Fetch-/Fehler-Wrapper fuer Frontend-API-Calls.
- `localApi.ts`: lokale Dateipersistenz und API-Routen fuer Saves, Stats, Galerie, Sammlungen, Backup, Clipboard und Musik.
- `src/types/index.ts`: zentrale Typdefinitionen.
- `src/utils/`: Hilfslogik fuer Puzzle-Schwierigkeit, Run-Vergleich und Context-Window.
- `src/utils/galleryChallenge.ts`: zentrale Medaillenregeln, Medaillen-Rangfolge und Challenge-Formatierung.
- `src/utils/puzzleEstimates.ts`: heuristische Soft-Ziele fuer Motiv, Raster, Crop und Startboard inklusive persoenlicher Median-Anpassung.
- `src/styles/`: globale und screen-/component-spezifische CSS-Dateien.
- `src/assets/system/`: kuratierte SVG-Icon-Sets fuer Kontextmenues und lokale Spezial-Icons; Screen-Icon-Komponenten koennen Lucide-Icons kapseln.
- `public/audio/` und `public/fonts/`: statische Audio- und Font-Assets.
- `src/test/`: Vitest-Tests und Test-Setup.
- `scripts/generate-audio-assets.mjs`: Generierung lokaler Audio-Assets.

## Arbeitsregeln
- Vor groesseren Aenderungen die betroffenen Datenfluesse lesen, nicht nur die UI-Datei.
- Aenderungen an App-Flows immer gegen `src/App.tsx`, die betroffenen Hooks in `src/app/` und die jeweiligen Screen-Props pruefen.
- Aenderungen an Spielmechanik immer gegen `PuzzleEngine`, `PuzzleStateService`, `PuzzleSolver`, `ExactPuzzleSolver`, Worker-Protokolle und betroffene Typen pruefen.
- Aenderungen an Save-/Stats-/Gallery-/Collections-/Backup-Features immer auf Frontend-Service, `src/types/index.ts` und `localApi.ts` abstimmen.
- Bestehende API-Pfade (`/api/saves`, `/api/saves/:saveId/title`, `/api/stats`, `/api/gallery`, `/api/gallery/:entryId/analyze`, `/api/gallery/win-effect-tags`, `/api/collections`, `/api/backup`, `/api/clipboard`, `/api/generated-image`, `/api/music`) nur aendern, wenn Frontend und lokale API gemeinsam angepasst werden.
- Bei persistierten Formaten rueckwaertskompatibel bleiben; bestehende Saves, `__stats.json`, `__gallery.json`, `__collections.json` und `.spbkp`-Backups muessen weiter defensiv gelesen werden.
- `dist/`, `node_modules/`, `spielstaende/`, `backups/`, `preview.*.txt`, temporaere Dateien und Office-Lockdateien nicht manuell bearbeiten, ausser die Aufgabe verlangt es explizit.
- Bestehende deutsche UI-Texte beibehalten, sofern kein ausdrueckliches Rewriting gewuenscht ist.
- Bei UI-Aenderungen bestehende CSS-Struktur unter `src/styles/` sowie Icon-Komponenten und Motion-Bausteine wiederverwenden.
- Bei Aenderungen an Tastatur, Fokus, Hilfe oder Command Palette die Hooks in `src/app/` und Barrierefreiheit mitdenken.
- Bei Audio-/Musik-Aenderungen lokale Fallbacks, Provider-Ausfallpfade und `VITE_JAMENDO_CLIENT_ID` aus `.env.example` beachten.
- Bei Zufallsbild-Features Provider-Ausfaelle und CORS-/Lizenz-/Attributionsdaten defensiv behandeln.
- Bei Galerie-KI-Tagging und Spielstand-Titeln `GEMINI_API_KEY` serverseitig halten, grosse Bilder nicht ungeprueft senden und Fehler/fehlende Keys als nicht-blockierende KI-Metadaten behandeln. Manuelle Tags und `rejectedAiTags` muessen bei erneuter KI-Analyse erhalten bleiben. Bildstimmungs-Themes laufen lokal im Browser und duerfen keine Gemini-Anfrage ausloesen.
- Nach Projektstruktur-, Workflow-, Befehls-, Persistenz- oder Architektur-Aenderungen diese `AGENTS.md` immer pruefen und bei Bedarf im selben Arbeitsgang aktualisieren.
- Nach Aenderungen an Funktionsumfang, Setup, Befehlen, Datenhaltung, API, Projektstruktur oder Verifikation auch `README.md` immer pruefen und bei Bedarf im selben Arbeitsgang aktualisieren.
- Nach jeder Aenderung dem Nutzer kurz erklaeren, wie diese Aenderungen getestet werden koennen.
- Vor groesseren, riskanteren oder laenger laufenden Aenderungen den Nutzer fragen, ob dafuer ein neuer Git-Branch erstellt werden soll; bei kleinen, klar begrenzten Doku- oder Bugfix-Aenderungen ist ein Branch nicht noetig.
- Bevorzuge kleine, lokale Fixes statt breiter Refactors.
- Nach abgeschlossenen Codeaenderungen den Nutzer fragen, ob die Aenderungen nach GitHub gepusht werden sollen; wenn der Nutzer bereits ausdruecklich Push/Upload verlangt hat, committen und pushen.

## Befehle
- Installieren: `npm install`
- Dev-Server: `npm run dev`
- Build-Check: `npm run build`
- Lint: `npm run lint`
- Smoke-Test: `npm run test:smoke`
- Alle Vitest-Tests: `npm exec vitest run`
- Einzelne Vitest-Datei: `npm exec vitest run src/test/<datei>.test.ts`
- Preview: `npm run preview`
- Audio-Assets generieren: `npm run generate:audio`

## Verifikation
- Nach relevanten Codeaenderungen mindestens `npm run build` ausfuehren.
- Bei Aenderungen an TypeScript- oder React-Code nach Moeglichkeit auch `npm run lint` ausfuehren.
- Bei Aenderungen an Save-/Stats-Logik pruefen, ob Erstellen, Laden, Aktualisieren und Loeschen von Spielstaenden weiter funktioniert.
- Bei Aenderungen an Galerie, Sammlungen oder Backups pruefen, ob Export, lokales Backup-Erstellen, Import, Loeschen und Wiederherstellen weiter funktionieren.
- Bei Aenderungen an Solver oder Rendering auf offensichtliche Laufzeitprobleme in Start-, Upload-, Crop- und Puzzle-Ansicht achten.
- Bei Aenderungen an Tastatur-/Fokuslogik mindestens `npm run test:smoke` ausfuehren.
- Bei Aenderungen an `src/screens/upload/galleryReplayActions.ts`, `UploadGalleryDisplayUtils.ts` oder Run-Vergleichen die passenden Vitest-Dateien unter `src/test/` ausfuehren.
- Bei API- oder Persistenz-Aenderungen nach Moeglichkeit einen kurzen manuellen Lauf im Dev-Server machen, weil `localApi.ts` als Vite-Middleware arbeitet.

## Hinweise fuer sichere Aenderungen
- Canvas- und Solver-Code ist zustandsabhaengig; dort keine stillen Strukturbrueche an `PuzzleState`, `Tile` oder Worker-Nachrichten einfuehren.
- Autosave, Recovery und Last-Session greifen ineinander; vor Aenderungen die Snapshots in `src/app/recoverySession.ts`, `lastSession.ts` und `cropDraftSession.ts` pruefen.
- Persistierte Daten muessen rueckwaertskompatibel behandelt werden, wenn bestehende Dateien in `spielstaende/` und `backups/` weiter lesbar bleiben sollen. Das gilt auch fuer den Tag-Kategorie-Cache `__tag_category_cache.json` und eigene Kategorien in `__custom_tag_categories.json`.
- Ziel-Laeufe sind in vier Arten getrennt: Soft-Ziel als geschaetzter Vergleich im normalen Spiel, Qualifikationslauf gegen eine Schaetzung, echte Vorlage als erster erfolgreicher cleaner Referenzlauf und Medaillenlauf gegen eine echte Vorlage.
- Soft-Ziele entstehen nur fuer Motiv + Raster + Crop/Full + Startboard ohne bestehende echte oder geschaetzte Serie. Sie werden erst beim Abschluss als `estimatedChallengeTarget` gespeichert, autosaven normal und duerfen Hilfen nutzen.
- Qualifikations- und Medaillenlaeufe mit aktivem `challengeMode` `qualification` oder `medal` werden nicht als fortsetzbare Spielstaende autosaved. Beim Abbruch muss ein eventuell bereits vorhandener aelterer Challenge-Spielstand geloescht werden; Galerie-Laeufe speichern weiterhin optional `challengeTargetId`, aber `challengeMedal` bleibt echten Medaillenlaeufen vorbehalten.
- Aktive Qualifikations- und Medaillenlaeufe sperren im Puzzle-Screen alle Spielhilfen inklusive Vorschau-Umschaltung und Zugverlauf; Zielbild und strategischer Fokus rechts bleiben verfuegbar. Buttons, Tastaturkuerzel, Kontextmenue und Handler muessen dieselbe Sperre beachten.
- Challenge-Medaillen sind exklusiv gestaffelt: Bronze verbessert genau ein Ziel, Silber beide Ziele strikt, Gold beide Ziele um mindestens 20 Prozent und Diamant beide Ziele um mindestens 40 Prozent. Gold und Diamant gelten nur als verfuegbar, wenn die gerundeten Zugziele weiterhin mindestens 1 Zug erlauben; Solver-Optimalitaet ist keine Diamant-Bedingung mehr. Bestehende gespeicherte Medaillen werden nicht rueckwirkend neu bewertet.
- Challenge-Startzustand-Serienkarten im Galerie-Detail sind ueber `AnimatedCollapse` einzeln einklappbar und fassen alle Laeufe mit identischem gespeicherten Startbrett zusammen. Die Karte trennt geschaetzte Vorphase im Bereich "Vor dem echten Ziel", echte Vorlage, Medaillenlaeufe nach Bestwert, chronologische Medaillen-Entwicklung und weitere nicht gewertete Laeufe mit kurzem Rollenkommentar.
- Neue Medaillen-Vorlagen duerfen nur aus cleanen Galerie-Laeufen mit Detailprofil entstehen; assistierte Startzustaende bleiben als Replay/Uebung moeglich, duerfen aber kein `challengeTarget` setzen.
- Neue und zuordenbare Laeufe mit gleichem gespeicherten Startbrett werden im Galerie-Detail der passenden synthetischen oder echten Challenge-Serie als verwandte Startzustandslaeufe zugeordnet, bleiben ausserhalb der Medaillenwertung und teilen dort einen gemeinsamen Uebungsstart. Gemeinsame Uebungsstarts duerfen kein `challengeTarget` setzen. Neutrale Startzustand-Serien sind nur noch ein Legacy-Fallback fuer alte oder inkonsistente Laeufe ohne Zielserienbezug; dort besitzt jede Serie genau eine Startbrett-Vorschau und kompakte Laufzeilen.
- Sammlungen referenzieren Galerie-Eintraege ueber IDs; beim Laden fehlende Galerie-Referenzen defensiv ausfiltern statt die UI zu blockieren.
- Wenn neue Features neue Felder in Save- oder Stats-Dateien brauchen, defensiv parsen und sinnvolle Defaults vorsehen.
- Geisterbild- und Heatmap-Nutzungsfelder (`ghostUsageCount`, `ghostUsageDurationMs`, `ghostUsageByMode`, `heatmapUsageCount`, `heatmapUsageDurationMs`, `heatmapUsageByMode`) werden als separate Laufmetriken behandelt und zaehlen zugleich als Hilfe fuer Clean-/Hint-/Auto-Assistance-Auswertungen sowie alle Challenge-Medaillen. Assistierte Challenge-Abschluesse bleiben medaillenlos und werden als verwandte Startzustandslaeufe gefuehrt.
- Externe Provider duerfen die App nicht blockieren; bei Netzwerk-/API-Fehlern muss ein nutzbarer Fallback oder eine klare Fehlermeldung erhalten bleiben.
- `localApi.ts` ist gross und traegt mehrere Verantwortungen; neue Endpunkte moeglichst nahe an den bestehenden Handlern und Validierungsfunktionen ergaenzen.
