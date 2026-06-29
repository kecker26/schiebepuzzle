# Schiebepuzzle Web-App

Eine lokale React-Web-App zum Erstellen, Zuschneiden, Spielen und Auswerten von Schiebepuzzles. Die App ist inzwischen mehr als ein MVP: Sie umfasst Startscreen, Bild-Upload, Zufallsbilder, Crop-Werkzeug, Canvas-Spielansicht, Hinweise, Solver, Autosave, Wiederherstellung, Statistik, Galerie, Sammlungen, Backup-Import/-Export und Musik.

## Funktionsumfang

- Eigene Bilder hochladen und als Puzzle-Motiv verwenden.
- Zufallsbilder aus mehreren Quellen laden, optional mit Suchbegriffen, darunter keylose Openverse- und LoremFlickr-Suchen sowie weitere lokale und externe Provider.
- KI-generierte Puzzle-Motive per Prompt ueber Pollinations Z-Image Turbo erstellen.
- Bildzuschnitt mit Crop-Ansicht, Transform und Puzzle-Konfiguration.
- Schiebepuzzle mit Canvas-Rendering, Drag-/Keyboard-Interaktion und visuellen Hervorhebungen.
- Manuelle Pause per Schaltflaeche oder `P` sowie automatische Pause bei verstecktem Browser-Tab; Timer stoppt und Brett sowie Zielbild werden verdeckt.
- Loesbare Shuffle-Logik, konkrete Klartext-Hinweise mit Ist-/Sollposition und priorisierten Canvas-Markierungen, ein abschaltbarer visueller Bereichsfokus im Zielbild sowie direktes Fortschrittsfeedback nach Zuegen.
- Adaptive Geisteransicht auf dem Brett mit Vollbild-, Kontur- und Kantenmodus, Fokus- oder Falschkachel-Bereich, optionalem Pulsieren, progressiv schwaecherer Hilfe, `Shift+G`-Moduswechsel, `+`/`-`-Staerkeregelung und separatem Nutzungs-Tracking in Statistik und Rohdaten.
- Konfigurierbare Heatmap mit klassischen Entfernungs-Farbflaechen, Richtungspfeilen oder Fortschrittsvergleich der letzten fuenf Zuege, optionalen kompakten X-/Y-Zielabweichungen, Intensitaetsregler und separatem Nutzungs-Tracking in Statistik und Rohdaten. Bewegliche Kacheln erhalten zusaetzlich eine gruen/gelb/rote Zugpotenzial-Bewertung; die beste Option wird mit derselben Solver-/Verlaufslogik wie der konkrete Hinweis bestimmt und direkt am Board sowie in der Heatmap-Karte erklaert. Ein optionaler interaktiver Zielpfad nummeriert bis zu vier folgende Solver-Zuege, erklaert jeden Schritt kompakt und meldet Fortschritt, erreichtes Zwischenziel oder eine notwendige Neuberechnung nach Abweichungen. Die X-/Y-Anzeige aktiviert automatisch Farbflaechen; Pfeile oder Verlauf blenden sie wieder aus. Dabei zeigt `X+` nach rechts und `Y+` nach oben.
- Exakter Solver ueber separaten Worker fuer passende Puzzle-Groessen.
- Autosave, kreative KI-Titel fuer neue Spielstaende, motivbasierte Titel-Wiederverwendung, maximal 30 aktive Spielstaende mit 5er-Seitennavigation, Resume-Flow, Recovery-Dialog und Last-Session-Wiederaufnahme.
- Sentiment-basiertes Bild-Theme: hochgeladene, generierte oder wiederverwendete Motive praegen standardmaessig die komplette UI-Farbwelt; Stimmung und Palette werden rein lokal aus Farbe, Helligkeit, Kontrast und Waerme berechnet und zentral im Menue ein- oder ausgeschaltet.
- Statistik mit vier visuellen Hauptansichten fuer Dashboard, Verlauf & Trends, Medaillen-Aufstiege sowie Rohdaten & Details, Einzellauf-Tabelle mit 25er-Seitennavigation; Recharts visualisiert Laufarten und die beste Challenge-Medaille pro Motiv als Donut-Charts sowie interaktive Laufverlaeufe und gestapelte Verteilungen fuer Aktionen oder Zeit. Verlauf und Verteilung besitzen jeweils eigene Metrik- und Zeitraumsteuerungen, eine eigene Schwierigkeitsfarblegende und einen Sprung zum Seitenanfang. Die Verteilung nutzt 15-Sekunden-Intervalle im dichtesten Laufzeitbereich beziehungsweise automatisch passende runde Aktionsintervalle; nach aussen werden die Intervalle zunehmend groesser, leere Bereiche eng verdichtet und Balkenabstaende bei vielen Intervallen automatisch verkleinert. Die Trendansicht bietet einen optionalen gleitenden 5er-Durchschnitt je Schwierigkeitsstufe, ruhige Rohdatenpunkte, fokussierbare Schwierigkeitsreihen und kollisionsfrei zusammengefuehrte Bestwert-/Median-Referenzen. Die eigene Medaillen-Seite zeigt motivweit gruppierte Karten mit echtem Aufstiegsweg, Rastergroessen, klickbaren Medaillenfiltern, Sortierung, vollstaendiger Galerie-Detailkarte, 5er-Seitennavigation und konsistenter Ruecknavigation; Rohdaten-Tabellen greifen dieselben Schwierigkeitsfarben auf, waehrend CSV-/JSON-Exporte direkt im Projektordner landen.
- Galerie geloester Motive inklusive bildspezifischer Paletten fuer Galerie-, Spielstand-, Sammlungs- und Detailkarten, die dem zentralen Palette-Schalter folgen, Wiedereinstieg mit gespeicherter Stufe, gespeichertem Originalzuschnitt, transparentem Challenge-Startdialog mit eindeutigen Medaillen-Regeln, Soft-Zielen als geschaetztem Vergleich, Qualifikationslaeufen zum Erspielen echter Vorlagen, clean-only Medaillen-Vorlagen und clean-only Bronze-, Silber-, Gold- und Diamant-Medaillen, Uebungs-Replay fuer assistierte Startzustaende, neutralen Startzustand-Serien fuer Laeufe mit gleichem Startbrett ohne Medaillenbezug sowie bereits fuer einzelne cleane Vorlagen mit sichtbarer leerer Uebungslauf-Liste, jeweils einer einklappbaren Serienkarte, einer gemeinsamen Aktion fuer Uebung oder cleane Medaillen-Vorlage, cleanem Vorlagenanker und kompakten Laufzeilen nach Bestwert sowie verwandten Startzustandslaeufen direkt an der passenden Challenge-Serie mit einem gemeinsamen Uebungsstart, Anzeige der besten noch erreichbaren Medaille fuer Zeit, Netto-Zuege und Hilfe-Status, medaillenlosen assistierten Challenge-Abschluessen als verwandte Startzustandslaeufe, medaillenlosen cleanen Challenge-Abschluessen ohne uebertroffene Vorlage, motivweit deduplizierter Medaillen-Sammlung mit klickbaren Filtern, Medaillen-Jagd nach fehlenden oder nahen Upgrades, konkreten Jagd-Zielen und Naehe-Einschaetzungen pro Motiv, Sortierung nach Upgrade-Potenzial und kompaktem Medaillen-Fortschritt pro Galeriekarte, konkretem Hinweis auf die naechste Medaillenstufe im Gewinn-Dialog, farbcodierten und mit den gemeinsamen Motion-Tokens einzeln einklappbaren Medaillen- und geschaetzten Ursprungserien mit chronologischer Medaillen-Entwicklung, Bereich "Vor dem echten Ziel", nach Bestwert sortierten direkten Medaillenversuchen, sichtbaren Folgebeziehungen und Vorschauen des tatsaechlich gemischten Startbretts sowie einem getrennten Bereich fuer eigenstaendige Laeufe mit groesserer Startbrett-Vorschau, 9er-Seitennavigation, optionalem KI-Tagging, vollstaendiger Tag-Anzeige auf Galeriekarten, Retry fuer fehlgeschlagene Tags, manuellen Tags im Detaildialog und als Tag-Manager-Batch, dauerhaft ausgeblendeten abgelehnten KI-Tags, gemeinsamer lokaler Tag-Taxonomie, ungeordneten unbekannten Tags, persistierten manuellen und KI-gelernten Kategoriezuordnungen sowie bestaetigungspflichtigen KI-Vorschlaegen fuer eigene Kategorien, klickbaren Tag-Filtern und kontextuellen Multi-Tag-Chips mit UND-Verknuepfung, Tag-Bildersuche fuer Online-Provider mit direktem Crop-Flow, aehnlichen Motiven nach Tag-Ueberschneidung und kategorisierter Tag-Verwaltung mit Mehrfachauswahl.
- Tag-basierte Partikeleffekte beim Gewinn: Alle statischen Tag-Kategorien besitzen passende visuelle Effekte, spezifische Motive wie Musik, Schnee, Regen, Meer, Blumen, Cyberpunk und Fantasie erhalten eigene Varianten, und selbst erstellte Kategorien werden ueber ihr Kategorie-Icon sinnvoll zugeordnet. Suchbegriffe und vorhandene Galerie-Tags greifen sofort; fuer neue Uploads wird die semantische Effektanalyse bereits waehrend des Spiels vorbereitet.
- Bild-Sammlungen fuer Lieblingsmotive aus der Galerie mit 9er-Seitennavigation, visuell sowie per Tooltip getrennt gekennzeichneten KI- und direkten Tag-Sammlungsvorschlaegen, automatischem Motiv-Tag beim Annehmen eines KI-Sammlungsvorschlags, allen priorisierten direkten Vorschlaegen fuer namensgleiche Motiv-Tags, motivweit deduplizierten Sammlungen aus Tag-Treffern und denselben bearbeitbaren Motiv-Tags wie im Galerie-Detail. Wird dort ein Tag entfernt, wird das Motiv zugleich aus der namensgleichen Tag-Sammlung entfernt.
- Lokale Backups fuer Spielstaende, Statistik, Galerie und Sammlungen.
- Musik- und Sound-Unterstuetzung mit lokalen Fallback-Tracks.
- Command Palette mit direkten Schnellaktionen fuer Medaillen-Aufstiege und Medaillen-Jagd, kontextbezogene globale Hilfe inklusive Challenge- und Medaillen-Regeln, Kontextmenues, Theme-Umschaltung und Motion-Animationen.
- Konsistente animierte Wartezustaende fuer KI-, Netzwerk-, Speicher-, Import-, Export-, Solver- und Hintergrundaufgaben mit reduzierter Bewegung fuer entsprechende Systemeinstellungen.

## Technologie

- React 18 und TypeScript
- Vite 5 als Dev-Server und Build-Tool
- HTML5 Canvas fuer Puzzle-Rendering
- `motion` / `motion/react` fuer Animationen
- `@react-spring/web` fuer federnde Zahlen- und Karten-Mikrointeraktionen
- `recharts` fuer responsive Statistikdiagramme
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
LLM_PROVIDER=gemini
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_API_KEY=dein_openrouter_oder_groq_key
LLM_MODEL=openrouter/free
GROQ_API_KEY=dein_groq_api_key
GROQ_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
```

`POLLINATIONS_API_KEY` ist ein serverseitiger Secret Key und wird nur von der lokalen Vite-Middleware genutzt. Er darf nicht als `VITE_`-Variable ins Frontend gegeben werden. `zimage` ist ein fuer den getesteten Key freigegebenes schnelles Pollinations-Bildmodell.
`CLOUDFLARE_API_TOKEN` ist der serverseitige Fallback fuer KI-Bilder, wenn Pollinations fehlschlaegt. Der Token braucht Zugriff auf Workers AI fuer die angegebene `CLOUDFLARE_ACCOUNT_ID`; `CLOUDFLARE_IMAGE_MODEL` ist standardmaessig `@cf/black-forest-labs/flux-1-schnell`.
`GEMINI_API_KEY` ist ein serverseitiger Secret Key fuer automatische Galerie-Tags, Sammlungsvorschlaege und kreative Spielstand-Titel. Ohne Key speichert die App geloeste Bilder und Spielstaende weiterhin normal. Bildstimmungs-Themes laufen bewusst rein lokal im Browser, damit der Theme-Wechsel sofort greift. `GEMINI_GALLERY_MODEL` ist standardmaessig `gemini-2.5-flash` und wird auch fuer Spielstand-Titel genutzt. Alternativ kann `LLM_PROVIDER=openrouter` mit `LLM_API_KEY`, `LLM_BASE_URL` und `LLM_MODEL` verwendet werden. Fuer kostenlose OpenRouter-Vision-Anfragen ist `openrouter/free` der empfohlene Default, weil OpenRouter dabei ein aktuell verfuegbares Free-Modell mit passenden Bild- und JSON-Faehigkeiten waehlt. Wird zusaetzlich `GROQ_API_KEY` konfiguriert, nutzt die App Groq Cloud automatisch als Fallback, wenn alle OpenRouter-Modellkandidaten fehlschlagen. `GROQ_MODEL` ist standardmaessig `meta-llama/llama-4-scout-17b-16e-instruct`.

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

- `spielstaende/`: bis zu 30 gespeicherte Partien, `__stats.json`, `__gallery.json` und `__collections.json`
- `backups/`: lokale Backup-Dateien mit der Endung `.spbkp`
- `statistik-exporte/`: CSV- und JSON-Dateien aus dem Rohdaten-Explorer
- `public/audio/`: lokale Musik- und Sound-Assets
- `public/fonts/`: eingebundene Fonts

Diese Nutzdaten und Build-Artefakte sind fuer manuelle Bearbeitung tabu, sofern eine Aufgabe das nicht ausdruecklich verlangt.

## Lokale API

Die Frontend-Services greifen ueber lokale API-Routen auf die Middleware zu:

- `/api/saves`: Spielstaende erstellen, laden, aktualisieren und loeschen.
- `/api/saves/:saveId/title`: Spielstand-Motiv mit Gemini oder einem OpenAI-kompatiblen LLM betiteln oder einen vorhandenen Titel fuer dasselbe Motiv wiederverwenden.
- `/api/stats`: Statistik laden, zuruecksetzen, Abschluesse aufzeichnen und Rohdaten-Exporte speichern.
- `/api/gallery`: Galerie geloester Motive laden, erweitern und bereinigen.
- `/api/gallery/:entryId/analyze`: Galerie-Motiv mit Gemini oder einem OpenAI-kompatiblen LLM taggen und Sammlungsvorschlaege speichern.
- `/api/gallery/win-effect-tags`: Verkleinerte Motivvorschau waehrend des Spiels fluechtig analysieren, damit passende Gewinneffekte bereits beim Oeffnen des Win-Dialogs bereitstehen.
- `/api/gallery/tags` und `/api/gallery/:entryId/tags`: Tags global bereinigen oder manuell fuer einzelne beziehungsweise mehrere Galerie-Eintraege hinzufuegen und entfernen.
- `/api/gallery/tag-categories`, `/api/gallery/tag-categories/assignments` und `/api/gallery/tag-categories/classify`: Statische und eigene Tag-Kategorien laden, verwalten, manuelle Zuordnungen speichern und unbekannte Tags gebuendelt ueber den bestehenden LLM-Provider klassifizieren.
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
2. Bild hochladen, Zufallsbild leer oder mit Suchbegriffen laden oder Galerie-/Save-Eintrag wiederverwenden.
3. Motiv zuschneiden und Puzzle-Groesse waehlen; bei neuen Galerie-Wiedereinstiegen laesst sich ein cleaner gespeicherter Startzustand direkt erneut herausfordern, assistierte Startzustaende starten als Uebung ohne Medaille, oder dasselbe Motiv wird komplett neu ueber den Crop-Flow gestartet. Alte Eintraege fallen auf gespeicherten Ausschnitt mit neu gemischten Kacheln zurueck.
4. Puzzle spielen, Hinweise, Geisteransicht, Heatmap oder Solver-Unterstuetzung nutzen; ein Soft-Ziel zeigt nur einen geschaetzten Vergleich und erlaubt weiter Hilfen, Qualifikations- und Medaillenlaeufe sperren Hinweis, Auto-Zug, Vorschau-Umschaltung, Geisterbild, Heatmap, Nummern sowie Rueckgaengig/Wiederholen. Zielbild und strategischer Fokus rechts bleiben verfuegbar. Qualifikations- und Medaillenlaeufe werden nicht als fortsetzbare Spielstaende autosaved und beim Abbruch vollstaendig verworfen.
5. Nach dem Loesen Statistik, Bestwerte und Galerie aktualisieren lassen; absolut cleane Medaillenlaeufe erhalten Bronze beim strikten Unterbieten genau eines Ziels, Silber beim strikten Unterbieten beider Ziele, Gold bei mindestens 20 % Verbesserung in beiden Zielen und Diamant bei mindestens 40 % Verbesserung in beiden Zielen. Gold und Diamant werden nur angeboten, wenn die gerundeten Zugziele weiterhin mindestens 1 Zug erlauben. Soft- und Qualifikationslaeufe koennen echte Vorlagen erzeugen, vergeben aber selbst keine Medaille. Assistierte Challenge-Abschluesse bleiben medaillenlos und erscheinen bei den verwandten Startzustandslaeufen.
6. Neue Galerie-Motive optional automatisch mit KI taggen, fehlgeschlagene Taggings erneut versuchen, eigene Tags im Detail oder gesammelt im Tag-Manager ergaenzen, unpassende KI-Tags dauerhaft entfernen, Tags bereinigen, einzelne Tags direkt oder mehrere Tags ueber kontextuell eingeblendete Chip-Filter und Tagverwaltung als UND-Filter anwenden, per Tag ein neues Online-Motiv suchen und direkt zuschneiden, aehnliche Galerie-Motive oeffnen und Tag-Treffer als Sammlung uebernehmen.
7. Die aktive Bildstimmung faerbt die UI automatisch ein; die lokale Farbanalyse nutzt eine dominante fast-average-color-Basis und kann im Darstellungsbereich zentral fuer UI und bildspezifische Karten auf Standard zurueckgeschaltet werden.
8. Neue Spielstaende erhalten im Hintergrund einen KI-Titel; taucht dasselbe Motiv mehrfach auf, wird der vorhandene Motivtitel wiederverwendet.
9. Spielstaende, Galerie, Sammlungen, Tag-Kategoriezuordnungen und Statistik bei Bedarf als Backup sichern oder wiederherstellen.

## Entwicklungshinweise

- Bestehende deutsche UI-Texte beibehalten, sofern kein Rewriting gewuenscht ist.
- Persistierte Daten defensiv lesen, damit alte Spielstaende, Statistik-, Galerie-, Sammlungs- und Backup-Dateien weiter funktionieren.
- Soft-Ziele sind geschaetzte Vergleiche fuer ein neues Motiv/Raster/Crop/Startboard und werden erst beim Abschluss als `estimatedChallengeTarget` gespeichert. Qualifikationslaeufe gegen solche Schaetzungen koennen eine echte Vorlage erzeugen, vergeben aber keine Medaille. Medaillenlaeufe laufen nur gegen echte Vorlagen; `challengeMedal` wird ausschliesslich fuer absolut cleane Medaillenlaeufe gesetzt. Bestehende Medaillen werden nicht neu bewertet, auch wenn neue Regeln gelten.
- Qualifikations- und Medaillenlaeufe werden nicht als fortsetzbare Spielstaende gespeichert; Soft-Ziele autosaven wie normale Laeufe. Aeltere geladene Spielstaende koennen ihr aktives Ziel noch rueckwaertskompatibel als `challengeTarget` enthalten und werden beim Abbruch geloescht, wenn sie ein gesperrter Zielmodus sind. Galerieeintraege speichern ihre `challengeTargetId` auch bei medaillenlosen Soft-/Qualifikations-/Challenge-Abschluessen. Neue Medaillen-Vorlagen muessen ein cleanes Detailprofil haben; assistierte Startzustaende bleiben als Uebung replaybar und werden im Detaildialog per Startbrett-Fingerprint als neutrale Startzustand-Serie gruppiert. Bereits eine einzelne cleane Vorlage eroeffnet eine Serie mit leerer, sichtbarer Uebungslauf-Liste. Jede Serie zeigt ihr gemeinsames Startbrett und die gemeinsame Aktion genau einmal; ohne cleanen Lauf startet sie als Uebung, nach einem cleanen Abschluss wird dieser Lauf zur herausforderbaren Medaillen-Vorlage. Darunter stehen die Uebungslaeufe kompakt nach Bestwert; die cleane Vorlage bleibt davon getrennt. Startzustandslaeufe mit demselben Startbrett sowie assistierte Challenge-Abschluesse werden als verwandte Laeufe in der passenden Challenge-Serie angezeigt, bleiben ausserhalb der Medaillenwertung und teilen dort einen gemeinsamen Uebungsstart, der das Challenge-Ziel explizit deaktiviert.
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
