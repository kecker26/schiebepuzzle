# Design QA: Kontextmenü

source visual truth path: `C:\Users\kerts\AppData\Local\Temp\codex-clipboard-321135b1-5d0a-4ec6-8cae-502d5df6a9c7.png`
implementation screenshot path: `C:\Eigene Dateien\HTML\schiebepuzzle\preview.context-menu.jpg`
viewport: 1280 x 720 CSS px, devicePixelRatio 1
source and implementation pixel dimensions: source 1608 x 978 px; implementation 1280 x 720 px; comparison normalized to the shared context-menu region
state: Startseite, Lightmodus, Kontextmenü geöffnet per Rechtsklick

## Vergleich

- Full-view comparison: Die Menüposition, die helle Oberfläche und die visuelle Vordergrundhierarchie wurden gegen die Lightmodus-Referenz geprüft.
- Focused region comparison: Kontextmenü inklusive Außenrand, Halo, Gruppenflächen und Kategorie-Titeln.
- Primary interaction tested: Rechtsklick öffnet das Menü; Hover und aktiver Fokus zeigen die farbige linke Akzentkante; Escape schließt es; Menüeinträge bleiben per Tastatur fokussierbar.
- Console errors checked: keine relevanten Browserfehler festgestellt.

## Findings

Keine offenen P0-, P1- oder P2-Abweichungen.

- Farben und Tokens: Die Menügrundfläche ist im Lightmodus hell und neutral umgesetzt. Der cyan-blaue Rand und der Halo sind auf die äußere Menüfläche begrenzt.
- Kategorie-Farben: Nur Gruppenlabels und Kategorieflächen verwenden weiterhin die bestehenden `--image-accent-*`-Variablen.
- Aktionsflächen: Hover-, Fokus- und aktive Zeilen sowie Trenner bleiben neutral und übernehmen keine Themenfarbe.
- Aktionsrahmen: Die Themenfarbe erscheint nur als 4-Pixel-Akzentkante links an Hover-, Fokus- und aktiven Zeilen.
- Lightmodus: Aktionsfelder bleiben hell und neutral; Kategorieflächen behalten ihre Themenfarbe.
- Spacing und Layout: Keine Änderungen an Position, Größe, Innenabständen, Gruppenabständen oder Eintragsstruktur.
- Barrierefreiheit: Bestehende Fokus- und Tastaturinteraktionen bleiben unverändert.

## Implementation Checklist

- [x] Plum-Charcoal-Menüfläche umgesetzt
- [x] Leuchtenden cyan-blauen Außenrahmen ergänzt
- [x] Zurückhaltenden Halo und Schatten ergänzt
- [x] Kategorie-Farben auf Kategorien begrenzt
- [x] Aktionsflächen neutral hervorgehoben
- [x] Build erfolgreich
- [x] Lint erfolgreich

## Follow-up Polish

Keine notwendigen P3-Anpassungen.

final result: passed
