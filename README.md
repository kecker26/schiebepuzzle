# Schiebepuzzle Web-App (MVP)

Eine interaktive Web-App zum Erstellen und Spielen von Schiebepuzzles mit Bild-Upload, Crop und Maus-Zieh-Steuerung.

## Features (MVP Phase 1-5)

✅ **Phase 1 - Fundament (Bild + Crop)**
- Beliebiges Bild hochladen (JPG, PNG, WebP)
- Interaktive Crop-Ansicht mit Seitenverhältnis-Anpassung
- Puzzlegröße wählen (3×3 bis 6×6)

✅ **Phase 2 - Puzzle-Generierung**
- Raster aus quadratischen Kacheln erzeugen
- Korrekte Bildausschnitte pro Kachel
- Leerfeld definieren

✅ **Phase 3 - Shuffle + Lösbarkeit**
- Lösbar mischen (durch gültige Zufallszüge)
- Garantiert solvable Startzustand

✅ **Phase 4 - Interaktion mit Maus-Drag**
- Linke Maustaste zum Ziehen
- Nur benachbarte Kacheln bewegbar
- Schwellwert-basiertes Einrasten

✅ **Phase 5 - Win-Check + UX-Polish**
- Gewinnzustand erkennen
- Zeit und Züge tracking
- Erfolgsdialog mit Statistik

## Technologie-Stack

- **Framework**: React 18 + TypeScript
- **Build-Tool**: Vite (blitzschnell)
- **Rendering**: HTML5 Canvas (für Performance)
- **Styling**: Modular CSS

## Installation & Start

```bash
# Dependencies installieren
npm install

# Development-Server starten
npm run dev

# Für Production bauen
npm run build
```

Der Server läuft dann auf `http://localhost:5173`

## Projekt-Struktur

```
src/
├── components/          # Komponenten (WinDialog)
├── screens/            # App-Blöcke (Upload, Crop, Puzzle)
├── services/           # Business Logic (Engine, Renderer)
├── styles/            # CSS nach Komponenten
├── types/             # TypeScript Definitionen
├── App.tsx             # State Management + Flow
└── main.tsx           # Entry Point
```

## User Flow

1. **Upload** → Bild hochladen
2. **Crop** → Puzzlegröße wählen + Zuschnitt festlegen  
3. **Generate** → Puzzle aus Bildausschnitt erstellen
4. **Shuffle** → Lösbar durchmischen
5. **Play** → Kacheln mit Maus ziehen
6. **Win** → Erfolgsdialog

## Wichtige Designentscheidungen

### Arch textur

- **State Machine**: App hat klare Zustände (`idle`, `imageLoaded`, `cropping`, `playing`, `solved`)
- **Service Layer**: PuzzleEngine für Business Logic, PuzzleRenderer für Canvas
- **Tile-Datenmodell**: Jede Kachel kennt ihre Ist- UND Soll-Position

### Rendering

- **Canvas**: Effizient, performankant bei Drag-Operationen
- **Bildausschnitt**: Per `drawImage()` source-region
- **Raster**: Einfache Linien zum visuellen Feedback

### Shuffle-Logik

- Vom gelösten Zustand aus N gültige Zufallszüge
- Verhindert direkte Rückwärtszüge (besseres Mischen)
- Immer lösbar (mathematisch garantiert)

### Interaktion

- Nur **direkt benachbarte** Kacheln (klassisch)
- Achsen-Sperrung (horizontal ODER vertikal)
- 50% Schwellwert für Einrasten

## Nächste Schritte (nicht in MVP)

- [ ] Touch-Unterstützung
- [ ] Sounds + Animationen
- [ ] Highscore-Persistierung
- [ ] Mehrfeld-Shift (ganze Reihe ziehen)
- [ ] Bildrotation/Zoom beim Crop
- [ ] Mobile-Responsive-Optimierung

## Lizenz

MIT
