# P3-Endabnahme

Diese Checkliste ist die manuelle Abschlussrunde fuer `P3`.

Ziel:
- die wichtigsten Nutzerpfade einmal komplett pruefen
- Save-, Recovery-, Hilfe- und Tastatur-Features gemeinsam absichern
- Light- und Dark-Mode kurz gegenpruefen

## Vorbereitung

1. App starten:
   `npm run dev`
2. Wenn moeglich in einem frischen Browser-Tab testen.
3. Fuer Save- und Recovery-Tests sollte mindestens ein bestaetigt gespeicherter Spielstand entstehen.
4. Fuer Accessibility-Checks optional `Narrator` starten:
   `Strg + Windows + Enter`

## Automatische Basischecks

Vor oder nach der manuellen Runde einmal ausfuehren:

```bash
npm run lint
npm run test:smoke
npm run build
```

Erwartung:
- alle drei Befehle laufen ohne Fehler durch

## 1. Startbildschirm

1. App oeffnen.
   Erwartung: ruhige Startseite, `Start`, `Palette`, `Hilfe` und rechte Topbar sind sichtbar.
2. Mit `Tab` durch die primaeren Aktionen gehen.
   Erwartung: nur echte Aktionsziele bekommen Fokus, Fokusmarkierung ist klar sichtbar.
3. `F1` druecken.
   Erwartung: Hilfe oeffnet mit passendem Willkommen-Kontext.
4. `F8` druecken.
   Erwartung: Command Palette oeffnet sich und ueberlagert die Hilfe sauber.
5. `Strg + Pos1` druecken.
   Erwartung: Fokus springt auf das erste sinnvolle Element der aktuellen Ansicht.

## 2. Auswahl / Upload

1. Vom Start in die Auswahl gehen.
   Erwartung: Upload-Karte, Zufallsbild und Datenbereiche sind erreichbar.
2. `Spielstaende`, `Statistik` und `Galerie` einzeln oeffnen.
   Erwartung: jedes Fenster erscheint sauber, ohne abgeschnittene Inhalte.
3. In jedem Fenster `F1` druecken.
   Erwartung: Hilfe zeigt den richtigen Bereichskontext.
4. In jedem Fenster `F8` druecken.
   Erwartung: Command Palette bleibt benutzbar und schliesst/oeffnet sauber.
5. In `Statistik` mit `Pfeilen`, `Pos1` und `Ende` durch Abschnittskoepfe, Filter und Tabellen gehen.
   Erwartung: Fokus bleibt sichtbar, Scrollen zieht sauber mit.

## 3. Crop

1. Ein Bild laden oder ein Zufallsbild starten.
2. Im Crop-Screen nur mit Tastatur arbeiten:
   - `Pfeile`
   - `Shift + Pfeile`
   - `+` / `-`
   - `Q` / `E`
   - `R`
   - `Enter`
3. Erwartung:
   - Ausschnitt bewegt sich
   - Zoom und Rotation reagieren
   - Reset funktioniert
   - `Enter` startet das Puzzle
4. `F1` im Crop-Screen testen.
   Erwartung: Hilfe bleibt beim Crop-Kontext.

## 4. Puzzle

1. Im Puzzle mit `Tab` aufs Brett gehen oder `B` druecken.
   Erwartung: Brett ist klar fokussiert.
2. Mit `Pfeilen` oder `WASD` ziehen.
   Erwartung: Kacheln bewegen sich.
3. Danach testen:
   - `H`
   - `Enter`
   - `Leertaste`
   - `G`
   - `M`
   - `N`
   - `Strg + Z`
   - `Strg + Y`
4. Erwartung:
   - Aktionen reagieren
   - Fokus bleibt sinnvoll
   - Brett bleibt gut sichtbar
5. Linkes und rechtes Panel per `Tab` pruefen.
   Erwartung: Fokuszustand bleibt auf allen Flaechen klar.

## 5. Save-Status

1. In einer aktiven Runde 1 bis 3 Zuege machen.
   Erwartung: Topbar zeigt einen sinnvollen Save-Status.
2. Kurz warten.
   Erwartung: Status wechselt auf `Speichert...`, danach auf `Gespeichert`.
3. Weitere Zuege machen.
   Erwartung: Status reagiert erneut, ohne andere Topbar-Elemente zu verdecken.

## 6. Recovery

1. Eine Runde starten und warten, bis einmal `Gespeichert` sichtbar war.
2. Browser-Tab neu laden oder App schliessen.
3. App erneut oeffnen.
   Erwartung: Recovery-Dialog erscheint.
4. Im Dialog testen:
   - `Pfeil links/rechts`
   - `Pfeil hoch/runter`
   - `Pos1`
   - `Ende`
   - `Esc`
5. Erwartung:
   - Fokus startet auf `Spaeter`
   - Navigation zwischen `Spaeter` und `Spielstand fortsetzen` funktioniert
   - `Spielstand fortsetzen` laedt direkt wieder ins Puzzle

## 7. Siegdialog

1. Eine Runde loesen oder mit vorhandenem Teststand in einen Sieg laufen.
2. Im Gewinnfenster per Tastatur pruefen:
   - `Tab`
   - `Shift + Tab`
   - `Pfeile`
   - `Pos1`
   - `Ende`
3. Erwartung:
   - alle Aktionen sind erreichbar
   - Fokus startet sinnvoll
   - keine Aktion ist abgeschnitten oder schwer sichtbar

## 8. Command Palette

1. `F8` oder `Strg + K` druecken.
   Erwartung: Palette oeffnet.
2. Nach folgenden Begriffen suchen:
   - `Statistik`
   - `Galerie`
   - `Backup`
   - `Hilfe`
   - `Musik`
3. Mit `Pfeil hoch/runter`, `Pos1`, `Ende` und `Enter` arbeiten.
   Erwartung:
   - Treffer filtern sofort
   - Auswahl reagiert sauber
   - Aktion wird ausgefuehrt und Palette schliesst sich

## 9. Hilfe

1. Hilfe aus folgenden Bereichen oeffnen:
   - Start
   - Auswahl
   - Spielstaende
   - Statistik
   - Galerie
   - Crop
   - Puzzle
2. Erwartung:
   - Kontext-Badge passt zum aktuellen Bereich
   - der Block `Gerade sinnvoll` passt zum Fokuskontext
   - Suche filtert Inhalte sinnvoll
   - Scrollbereich ist per Maus und Tastatur bedienbar

## 10. Light- und Dark-Mode

1. Zwischen Hell- und Dunkelmodus wechseln.
2. In beiden Modi pruefen:
   - Start
   - Spielstaende
   - Statistik
   - Galerie
   - Hilfe
   - Recovery-Dialog
   - Topbar
3. Erwartung:
   - Icons, Texte, Chips und Fokusmarkierungen bleiben klar sichtbar
   - keine wichtigen Elemente wirken verwaschen oder verschwinden

## 11. Accessibility-Kurztest

Optional mit `Narrator`:

1. Hilfe oeffnen und den Hilfekontext wechseln.
   Erwartung: Kontextwechsel wird angesagt.
2. Statistikabschnitt auf- und zuklappen.
   Erwartung: `aufgeklappt` / `eingeklappt` wird angesagt.
3. Im Puzzle aufs Brett gehen.
   Erwartung: Brettfokus und Bewegungslogik werden verstaendlich beschrieben.
4. Recovery-Dialog oeffnen.
   Erwartung: Dialoginhalt und Aktionsgruppe sind sinnvoll lesbar.

## 12. Ergebnisprotokoll

Pro Testblock kurz notieren:

- `OK`
- `Fehler`
- `Fehlerbeschreibung`
- `Reproduzierbar ja/nein`
- `Theme`
- `Browser`

## Freigabe fuer P3

P3 ist freigabebereit, wenn:

- `build`, `lint` und `test:smoke` gruen sind
- kein Blocker in Save, Recovery, Hilfe, Puzzle oder Workspace auftritt
- Fokus, Scrollen und Shortcuts in den Hauptpfaden stabil bleiben
- Light- und Dark-Mode keine groben Kontrast- oder Sichtbarkeitsfehler mehr haben
