# Design QA: kompakte Kontextmenüs

## Vergleichsgrundlage

- Source visual truth: `C:\Users\kerts\.codex\generated_images\01a0006e-ef12-7cf1-b945-0e3abfac1ea7\exec-ce976aa9-4ed0-4dba-9611-1065c89902e9.png`
- Implementierungsaufnahme: `C:\Users\kerts\.codex\visualizations\2026\08\14\01a0006e-ef12-7cf1-b945-0e3abfac1ea7\context-menu-dark-final.png`
- Gemeinsame Vergleichsansicht: `C:\Users\kerts\.codex\visualizations\2026\08\14\01a0006e-ef12-7cf1-b945-0e3abfac1ea7\context-menu-comparison-final.png`
- Browser-Viewport: 1280 x 720 CSS-Pixel, `devicePixelRatio: 1`
- Source: 809 x 1944 Pixel
- Implementierungsaufnahme: 1265 x 712 Pixel; untersuchter Menüausschnitt: 263 x 643 Pixel
- Dichtenormalisierung: Beide Menüausschnitte wurden proportional auf dieselbe Vergleichsbreite von 526 Pixel skaliert. Es wurde kein Geräte-Rahmen verglichen.
- Zustand: Upload-Screen, Dunkelmodus, paletteabhängiger grüner Akzent, Kontextmenü geöffnet, Fokus-/Aktivzustand sichtbar.

## Geprüfte Interaktionen

- Kontextmenü per Rechtsklick geöffnet.
- Initialfokus und Navigation per Pfeiltaste geprüft.
- Dynamische Verfügbarkeit von „Bild einfügen“ geprüft.
- Hell- und Dunkelmodus visuell geprüft.
- Browserkonsole geprüft: keine Fehler.

## Vergleichsevidenz

### Gesamtansicht

- Die drei Gruppen „Bild“, „Workspace“ und „App“ bilden dieselbe Hierarchie wie der Entwurf.
- Die Überschriften sind inhaltsbreit, textbasiert, sanft gefüllt und mit eigenem Abstand von den Aktionsflächen getrennt.
- Die Aktionsflächen sind dezent umrandet; der äußere Menürahmen bleibt als zurückhaltende Glasfläche mit Schatten im Hintergrund.
- Die stärkere, volle Trennung vor den Backup-Aktionen ist sichtbar; normale Zeilentrenner beginnen an der Textschiene.
- Die paletteabhängige Tönung bleibt erhalten und wird für Überschriften, Hover/Fokus und die stärkere Trennlinie verwendet.

### Fokusbereich

Der fokussierte Menüausschnitt wurde separat und auf identische Breite normalisiert verglichen, weil Typografie, Zeilenhöhe, Trennlinien und Badge-Abstände in der Gesamtaufnahme sonst zu klein wären. Icons bleiben als bestehende kuratierte App-Assets erhalten; es wurden keine Bild-Assets durch Platzhalter ersetzt.

## Pflichtflächen

- Typografie: Schriftfamilie und bestehende App-Gewichte bleiben konsistent. Überschriften sind kleiner, versal und stärker gesperrt; Aktionslabels und Badges besitzen weiterhin klare optische Gewichte und keine problematischen Umbrüche.
- Abstand und Rhythmus: Gruppenabstand, Überschrift-zu-Panel-Abstand und 44-Pixel-Zeilenhöhe entsprechen der gewählten lockeren Richtung. Die Menüposition wird weiterhin an den Viewport angepasst.
- Farben und Tokens: Akzente verwenden die extrahierte Bildpalette. Kontrast und Glasflächen funktionieren in Hell- und Dunkelmodus.
- Bild- und Assettreue: Bestehende lokale Kontextmenü-Icons werden unverändert verwendet und bleiben scharf. Die Überschriften enthalten gemäß Entscheidung keine Icons.
- Text und Inhalt: Deutsche Aktionsnamen, Kennzahlen und Shortcut-Badges bleiben erhalten. „Bild einfügen“ ist zusätzlich zum reduzierten Visual-Entwurf bewusst weiterhin vorhanden, da es eine bestehende Funktion des Upload-Menüs ist.

## Vergleichshistorie

1. P2: Die erste Implementierung war mit 40 Pixel hohen Zeilen sichtbar dichter als der normalisierte Entwurf.
   - Fix: Mindesthöhe auf 44 Pixel und vertikales Padding auf 9 Pixel erhöht.
   - Nachweis: Der finale Menüausschnitt misst 263 x 643 Pixel und entspricht damit bei gleicher Breite dem vertikalen Rhythmus des 809 x 1944 Pixel großen Entwurfs deutlich besser.
   - Ergebnis nach erneutem Vergleich: keine verbleibende P0-, P1- oder P2-Abweichung.

## Findings

- Keine verbleibenden P0-, P1- oder P2-Findings.
- Erwartete Abweichung: Die Implementierung zeigt „Bild einfügen“, während der reduzierte Entwurf diese bestehende Funktion nicht abbildet.

## Implementierungscheckliste

- [x] Gemeinsame Gruppenstruktur für alle Kontextmenüs
- [x] Textbasierte, inhaltsbreite Überschriften
- [x] Sanfte Füllung und paletteabhängige Akzente
- [x] Dezent umrandete Aktionsblöcke
- [x] Volle starke Backup-Trennung und eingerückte Standardtrenner
- [x] Leicht getönter Hover-/Fokuszustand mit linker Akzentkante
- [x] Browserkonsole, Tastatur, Hell-/Dunkelmodus, Build, Lint und Smoke-Test geprüft

final result: passed
