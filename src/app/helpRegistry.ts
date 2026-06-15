import type { GlobalUiIconName } from '../components/GlobalUiIcon.tsx'
import type { AppState } from '../types/index'

interface HelpItem {
  keys?: string[]
  label: string
  detail?: string
}

interface HelpSection {
  title: string
  icon: GlobalUiIconName
  items: HelpItem[]
  isGlobal?: boolean
}

interface HelpView {
  kicker: string
  title: string
  description: string
  sections: HelpSection[]
}

type HelpContext =
  | 'welcome'
  | 'upload-start'
  | 'upload-savedGames'
  | 'upload-stats'
  | 'upload-gallery'
  | 'imageLoaded'
  | 'playing'
  | 'solved'

const ALL_HELP_CONTEXTS: HelpContext[] = [
  'welcome',
  'upload-start',
  'upload-savedGames',
  'upload-stats',
  'upload-gallery',
  'imageLoaded',
  'playing',
  'solved',
]

const COMMON_SECTIONS: HelpSection[] = [
  {
    title: 'Ueberall in der App',
    icon: 'command',
    isGlobal: true,
    items: [
      {
        keys: ['F1'],
        label: 'Hilfe oeffnen oder schliessen',
        detail: 'Funktioniert in jeder Ansicht und ueber fast allen Dialogen.',
      },
      {
        keys: ['?'],
        label: 'Shortcut-Hilfe schnell aufrufen',
        detail: 'Ideal, wenn du gerade nicht mehr weisst, welche Tasten hier gelten.',
      },
      {
        keys: ['Strg', '/'],
        label: 'Alternative Hilfe-Taste',
        detail: 'Nuetzlich auf Tastaturen, auf denen das Fragezeichen unpraktisch liegt.',
      },
      {
        keys: ['F8'],
        label: 'Schnellaktionen oeffnen',
        detail: 'Oeffnet die Command Palette fuer Start, Auswahl, Musik, Hilfe und wichtige Direktaktionen.',
      },
      {
        keys: ['Strg', 'Pos1'],
        label: 'Zum ersten sinnvollen Fokusziel der aktuellen Ansicht springen',
        detail: 'Richtet die sichtbare Ebene wieder am Anfang aus und setzt den Fokus auf die primaere Aktion der aktuellen Seite oder des aktuellen Dialogs.',
      },
      {
        keys: ['Tab'],
        label: 'Zum naechsten Fokusziel springen',
      },
      {
        keys: ['Shift', 'Tab'],
        label: 'Zum vorherigen Fokusziel zurueck',
      },
      {
        keys: ['Enter'],
        label: 'Fokussierte Standardaktion ausfuehren',
      },
      {
        keys: ['Leertaste'],
        label: 'Buttons und Umschalter bestaetigen',
      },
      {
        keys: ['Esc'],
        label: 'Die oberste offene Ebene schliessen',
        detail: 'Zum Beispiel Hilfe, Menues oder andere modale Fenster.',
      },
    ],
  },
  {
    title: 'Dialoge und Fenster',
    icon: 'layout',
    isGlobal: true,
    items: [
      {
        label: 'Dialoge behalten den Fokus bei sich, bis du sie schliesst.',
      },
      {
        label: 'Nach dem Schliessen springt der Fokus wieder an den Ausloeser zurueck.',
      },
      {
        label: 'Die Hilfe oeffnet ueber der aktuellen Ansicht, ohne den Kontext zu verlieren.',
      },
    ],
  },
  {
    title: 'Musik und Darstellung',
    icon: 'zap',
    isGlobal: true,
    items: [
      {
        label: 'Links oben liegen Start, Command Palette und Hilfe; rechts oben bleiben Musik, Musikstil, Bildpalette und Hell-/Dunkel-Modus.',
      },
      {
        keys: ['Pfeile', 'Pos1', 'Ende'],
        label: 'In den kompakten Werkzeugleisten oben direkt zwischen den sichtbaren Buttons wechseln',
      },
      {
        label: 'Per Pfeil nach unten oeffnest du Lautstaerke oder Stilauswahl direkt im Dropdown.',
      },
      {
        label: 'Die Bildpalette laesst sich zentral fuer UI, Galerie-, Spielstand- und Sammlungskarten ein- oder ausschalten; das Theme wechselt sofort zwischen hell und dunkel.',
      },
    ],
  },
]

const HELP_VIEWS: Record<HelpContext, HelpView> = {
  welcome: {
    kicker: 'Willkommen',
    title: 'Erste Schritte',
    description: 'So funktioniert die App: Bild laden, zuschneiden, Puzzle loesen. Dein Fortschritt wird automatisch gespeichert.',
    sections: [
      {
        title: 'Was ist ein Schiebepuzzle?',
        icon: 'grid',
        items: [
          {
            label: 'Du schiebst Kacheln in ein Leerfeld, um ein zerstueckeltes Bild wiederherzustellen.',
          },
          {
            label: 'Je hoeher die Schwierigkeit, desto mehr Kacheln – von 3x3 bis 7x7.',
          },
          {
            label: 'Dein Weg: Bild hochladen oder Zufallsbild starten, Ausschnitt waehlen, Puzzle loesen.',
          },
        ],
      },
      {
        title: 'So gehts los',
        icon: 'navigation',
        items: [
          {
            keys: ['Tab'],
            label: 'Zwischen Palette, Hilfe, Spiel starten und Beenden wechseln',
          },
          {
            keys: ['Pfeile'],
            label: 'Zwischen Spiel starten und Beenden direkt seitlich wechseln',
          },
          {
            keys: ['Enter'],
            label: 'Spiel starten oder Beenden bestaetigen',
          },
          {
            label: 'Die Infokarten sind Lesebereiche; die primaeren Aktionen liegen im Aktionspanel.',
          },
        ],
      },
      {
        title: 'Features im Ueberblick',
        icon: 'helpCircle',
        items: [
          {
            label: 'Hinweise und automatische Zuege helfen dir, wenn du festhaengst.',
          },
          {
            label: 'Geisterbild, konfigurierbare Heatmap und Nummern-Overlay zeigen visuelle Hilfen auf dem Brett.',
          },
          {
            label: 'Statistik, Galerie und Spielstaende behalten deinen Fortschritt im Blick.',
          },
          {
            label: 'Alles funktioniert komplett per Tastatur und per Maus.',
          },
        ],
      },
    ],
  },
  'upload-start': {
    kicker: 'Auswahl',
    title: 'Bild laden und Bereiche oeffnen',
    description: 'Bild laden, Zufallsbild starten oder in Spielstaende, Statistik und Galerie springen.',
    sections: [
      {
        title: 'Bild vorbereiten',
        icon: 'image',
        items: [
          {
            keys: ['Tab'],
            label: 'Zwischen Upload-Karte, Zufallsbild und den Datenbereichen wechseln',
          },
          {
            keys: ['Enter'],
            label: 'Fokussierte Karte oder Schaltflaeche oeffnen',
          },
          {
            keys: ['Pfeile', 'Pos1', 'Ende'],
            label: 'Auf den grossen Karten und Backup-Aktionen direkt zwischen benachbarten Zielen wechseln',
          },
          {
            keys: ['Strg', 'V'],
            label: 'Ein Bild direkt aus der Zwischenablage einfuegen',
            detail: 'Funktioniert in der Auswahlansicht ohne zusaetzlichen Dateidialog.',
          },
          {
            keys: ['Esc'],
            label: 'Zur Startseite zurueckkehren, solange kein Dialog oder Datenfenster offen ist',
          },
        ],
      },
      {
        title: 'Per Maus',
        icon: 'move',
        items: [
          {
            label: 'Klicke auf die Upload-Karte oder ziehe ein Bild per Drag-and-Drop hinein.',
          },
          {
            label: 'Die Datenbereiche (Spielstaende, Statistik, Galerie) oeffnen sich per Klick.',
          },
        ],
      },
      {
        title: 'Datenbereiche und Backups',
        icon: 'archive',
        items: [
          {
            label: 'Spielstaende, Statistik und Galerie lassen sich vollstaendig per Fokus und Enter oeffnen.',
          },
          {
            label: 'Backups koennen ohne Maus exportiert und importiert werden.',
          },
          {
            label: 'Die Auswahlansicht bleibt bewusst ruhig, waehrend Datenbereiche in eigenen Fenstern oeffnen.',
          },
        ],
      },
    ],
  },
  'upload-savedGames': {
    kicker: 'Spielstaende',
    title: 'Offene Partien verwalten',
    description: 'Gespeicherte Spiele fortsetzen, loeschen oder direkt zu Statistik, Galerie und Start wechseln.',
    sections: [
      {
        title: 'Im Fenster navigieren',
        icon: 'navigation',
        items: [
          {
            keys: ['V'],
            label: 'Fokus direkt auf die rechte Bereichsnavigation setzen',
          },
          {
            keys: ['Pfeile'],
            label: 'Auf den Bereichskarten und in der Spielstandliste wechseln',
            detail: 'Links und rechts wechseln innerhalb einer Karte, hoch und runter zur gleichen Aktion anderer Spielstaende.',
          },
          {
            keys: ['Pos1'],
            label: 'Zum Anfang des Fensters springen und bei Start weiterarbeiten',
          },
          {
            keys: ['Ende'],
            label: 'Zum letzten Bereichsziel oder zur letzten Fokusaktion im Fenster springen',
          },
        ],
      },
      {
        title: 'Partien verwalten',
        icon: 'archive',
        items: [
          {
            keys: ['Enter'],
            label: 'Weiterspielen, Loeschen oder Alle loeschen bestaetigen',
          },
          {
            keys: ['Home', 'Ende'],
            label: 'In einer Aktionsspalte direkt zum ersten oder letzten Spielstand springen',
          },
          {
            label: 'Jede Spielstandkarte bietet direkte Aktionen zum Fortsetzen oder Entfernen.',
          },
          {
            label: 'Statistik, Galerie und Startseite sind im selben Fenster direkt erreichbar.',
          },
        ],
      },
      {
        title: 'Per Maus',
        icon: 'move',
        items: [
          {
            label: 'Klicke auf Weiterspielen, um direkt ins Puzzle zu springen.',
          },
          {
            label: 'Klicke Loeschen, um einen einzelnen Spielstand zu entfernen.',
          },
        ],
      },
    ],
  },
  'upload-stats': {
    kicker: 'Statistik',
    title: 'Verlauf, Vergleiche und Rekorde',
    description: 'Statistikabschnitte, Filter und Tabellen lassen sich gezielt per Tastatur lesen und steuern.',
    sections: [
      {
        title: 'Statistikabschnitte',
        icon: 'grid',
        items: [
          {
            keys: ['V'],
            label: 'Fokus direkt auf die rechte Bereichsnavigation setzen',
          },
          {
            keys: ['Pfeile'],
            label: 'Zwischen den Abschnittskoepfen wechseln und den Zielabschnitt oben ausrichten',
          },
          {
            keys: ['Enter'],
            label: 'Den fokussierten Statistikabschnitt auf- oder zuklappen',
          },
          {
            keys: ['Pos1'],
            label: 'Ganz an den Anfang der Statistikseite springen und Fokus auf Start setzen',
          },
          {
            keys: ['Ende'],
            label: 'Immer direkt zur letzten Abschnittsueberschrift Verlaufstabelle springen',
          },
        ],
      },
      {
        title: 'Filter und Tabellen',
        icon: 'refreshCw',
        items: [
          {
            keys: ['Tab'],
            label: 'Zwischen Filter-Chips, Sortierkoepfen, Reset und Rueckwegen wechseln',
          },
          {
            keys: ['Pfeile'],
            label: 'Filter-Chips und Sortierkoepfe direkt horizontal durchlaufen',
          },
          {
            keys: ['Home', 'Ende'],
            label: 'Innerhalb der Filter- oder Sortierreihe direkt zum ersten oder letzten Ziel springen',
          },
          {
            keys: ['Enter'],
            label: 'Filter-Chips, Sortierkoepfe und Schaltflaechen ausloesen',
          },
          {
            label: 'Vergleichsmatrix, Detailtabelle und Verlauf reagieren komplett auf Fokus statt auf Mauszwang.',
          },
        ],
      },
      {
        title: 'Enthaltene Daten',
        icon: 'helpCircle',
        items: [
          {
            label: 'Ueberblick: Gesamtsiege, Bestzeiten, Durchschnitte und Streaks.',
          },
          {
            label: 'Vergleichsmatrix: Jede Schwierigkeit im direkten Vergleich nach Zeit, Zuegen und Anteil ohne Hilfe.',
          },
          {
            label: 'Verlaufstabelle: Jedes geloeste Puzzle einzeln, filterbar nach Schwierigkeit und sortierbar.',
          },
        ],
      },
      {
        title: 'Medaillen-Aufstiege',
        icon: 'medal',
        items: [
          {
            label: 'Die Medaillen-Ansicht gruppiert Challenge-Laeufe pro Motiv und zeigt nur echte Aufstiege.',
          },
          {
            label: 'Pro Motiv zaehlt in der Verteilung ausschliesslich die beste erreichte Medaille.',
          },
          {
            label: 'Medaillenfilter, Sortierung und Motivkarten helfen dir, Aufstiegswege gezielt nachzuvollziehen.',
          },
          {
            keys: ['F8'],
            label: 'Medaillen-Aufstiege direkt oeffnen',
            detail: 'Suche in den Schnellaktionen nach Medaillen-Aufstiege.',
          },
        ],
      },
    ],
  },
  'upload-gallery': {
    kicker: 'Galerie',
    title: 'Geloeste Motive und Filter',
    description: 'Galerieeintraege, Filter und Rueckwege lassen sich direkt ueber Fokus und Aktionen bedienen.',
    sections: [
      {
        title: 'Filter und Eintraege',
        icon: 'image',
        items: [
          {
            keys: ['Tab'],
            label: 'Zwischen Filtern, Sortierung, Galerie-Karten und Seitenaktionen wechseln',
          },
          {
            keys: ['Pfeile'],
            label: 'Innerhalb einer Galerie-Karte seitlich und im sichtbaren Raster zwischen gleichen Kartenaktionen vertikal wechseln',
          },
          {
            keys: ['Home', 'Ende'],
            label: 'In der aktuellen Aktionsspalte direkt zur ersten oder letzten sichtbaren Karte springen',
          },
          {
            keys: ['Enter'],
            label: 'Details oeffnen, Motiv erneut spielen oder Eintraege loeschen',
          },
          {
            label: 'Filter, Sortierung und Zuruecksetzen lassen sich komplett ohne Maus steuern.',
          },
        ],
      },
      {
        title: 'Wechsel in andere Bereiche',
        icon: 'navigation',
        items: [
          {
            keys: ['V'],
            label: 'Fokus direkt auf die rechte Bereichsnavigation setzen',
          },
          {
            keys: ['Pfeile'],
            label: 'Auf den grossen Bereichskarten zwischen Start, Spielstaenden, Statistik und Galerie wechseln',
          },
          {
            label: 'Von jeder Galerieansicht kommst du direkt zur Statistik, zu Spielstaenden oder zur Auswahl zurueck.',
          },
        ],
      },
      {
        title: 'Per Maus',
        icon: 'move',
        items: [
          {
            label: 'Klicke auf das Vorschaubild oder Details, um die Motiv-Detailansicht zu oeffnen.',
          },
          {
            label: 'Ueber die Filter-Selects oben kannst du Schwierigkeit und Laufart einschraenken.',
          },
        ],
      },
      {
        title: 'Challenges und Medaillen',
        icon: 'medal',
        items: [
          {
            label: 'Bronze: Zeit oder Zugziel der Vorlage strikt unterbieten.',
          },
          {
            label: 'Silber: Beide Zielwerte der Vorlage erreichen oder unterbieten.',
          },
          {
            label: 'Gold: Beide Zielwerte strikt unterbieten und ohne Hilfe loesen.',
          },
          {
            label: 'Diamant: Ohne Hilfe, schneller als die Vorlage und exakt solver-optimal loesen.',
          },
          {
            label: 'Gold oder Diamant koennen fuer einzelne Vorlagen mathematisch nicht erreichbar sein.',
          },
          {
            keys: ['F8'],
            label: 'Medaillen-Jagd direkt oeffnen',
            detail: 'Zeigt upgradefaehige Motive zuerst nach ihrem besten Upgrade-Potenzial.',
          },
        ],
      },
    ],
  },
  imageLoaded: {
    kicker: 'Crop',
    title: 'Bildzuschnitt',
    description: 'Schwierigkeit, Bildmodus und Zuschnitt vorbereiten, bevor die Runde beginnt.',
    sections: [
      {
        title: 'Steuerung im Zuschnitt',
        icon: 'move',
        items: [
          {
            keys: ['Tab'],
            label: 'Zwischen Schwierigkeit, Bildmodus, Vorschau, Zoom, Rotation und den Aktionen wechseln',
          },
          {
            keys: ['B'],
            label: 'Den Fokus jederzeit direkt auf die Vorschau setzen',
          },
          {
            keys: ['Pfeile'],
            label: 'Im fokussierten Vorschaubereich den Ausschnitt verschieben',
          },
          {
            keys: ['Shift', 'Pfeile'],
            label: 'Den Ausschnitt grober verschieben',
          },
          {
            keys: ['+', '-'],
            label: 'Im Vorschaubereich direkt hinein- oder herauszoomen',
          },
          {
            keys: ['Q', 'E'],
            label: 'Das Bild im Vorschaubereich um 90 Grad drehen',
          },
          {
            keys: ['R'],
            label: 'Den Zuschnitt auf den Ausgangspunkt zuruecksetzen',
          },
          {
            keys: ['Pfeile', 'Pos1', 'Ende'],
            label: 'In Rotations- und Aktionsreihen zwischen den sichtbaren Schaltflaechen wechseln',
          },
        ],
      },
      {
        title: 'Per Maus',
        icon: 'image',
        items: [
          {
            label: 'Ziehe den sichtbaren Ausschnitt in der Vorschau mit der Maus.',
          },
          {
            label: 'Nutze das Mausrad zum Zoomen im Vorschaubereich.',
          },
          {
            label: 'Die Schwierigkeitskarten sind direkt anklickbar.',
          },
        ],
      },
      {
        title: 'Schnelle Aktionen',
        icon: 'navigation',
        items: [
          {
            keys: ['Enter'],
            label: 'Im Vorschaubereich oder auf Buttons direkt das Spiel starten',
          },
          {
            keys: ['Esc'],
            label: 'Aus dem Zuschnitt jederzeit zur Auswahlansicht zurueckkehren',
          },
          {
            label: 'Zurueck kehrt in die Auswahlansicht zurueck, ohne die App zu verlassen.',
          },
          {
            label: 'Bei Zufallsbildern kannst du direkt ein anderes Motiv nachladen.',
          },
        ],
      },
    ],
  },
  playing: {
    kicker: 'Puzzle',
    title: 'Aktive Runde',
    description: 'Das Puzzlebrett und alle Hilfswerkzeuge sind ueber Fokus, Hotkeys und Schaltflaechen erreichbar.',
    sections: [
      {
        title: 'Brett und Bewegung',
        icon: 'move',
        items: [
          {
            keys: ['Tab'],
            label: 'Zum Puzzlebrett und zu den Werkzeugen springen',
          },
          {
            keys: ['B'],
            label: 'Den Fokus jederzeit direkt zurueck auf das Puzzlebrett holen',
          },
          {
            keys: ['P'],
            label: 'Runde pausieren oder fortsetzen',
            detail: 'Beim Pausieren stoppt der Timer und Brett sowie Zielbild werden verdeckt. Ein versteckter Browser-Tab pausiert die Runde automatisch.',
          },
          {
            keys: ['Pfeile'],
            label: 'Bei fokussiertem Brett eine benachbarte Kachel in das Leerfeld schieben',
          },
          {
            keys: ['W', 'A', 'S', 'D'],
            label: 'Alternative Brettsteuerung fuer die gleichen Bewegungen',
          },
        ],
      },
      {
        title: 'Hilfen und Overlays',
        icon: 'helpCircle',
        items: [
          {
            keys: ['H'],
            label: 'Hinweis auf dem Brett anzeigen',
          },
          {
            keys: ['Enter'],
            label: 'Empfohlenen Zug direkt spielen',
          },
          {
            keys: ['Leertaste'],
            label: 'Bildvorschau ein- oder ausblenden',
          },
          {
            keys: ['G'],
            label: 'Geisteransicht umschalten',
            detail: 'Legt das Originalbild halbtransparent ueber offene Kacheln. Im Modus-Wechsel stehen Vollbild, Konturen und Kanten zur Verfuegung.',
          },
          {
            keys: ['M'],
            label: 'Heatmap umschalten',
            detail: 'Zeigt Entfernung als Farbflaechen oder Zielrichtung als Pfeile. Intensitaet und Distanzzahlen lassen sich im linken Panel anpassen.',
          },
          {
            keys: ['N'],
            label: 'Nummern kurz einblenden',
            detail: 'Zeigt 5 Sekunden lang die Soll-Position jeder Kachel und animiert korrekte gruen, falsche rot.',
          },
        ],
      },
      {
        title: 'Verlauf und Navigation',
        icon: 'refreshCw',
        items: [
          {
            keys: ['Strg', 'Z'],
            label: 'Letzten Zug rueckgaengig machen',
          },
          {
            keys: ['Strg', 'Y'],
            label: 'Rueckgaengigen Zug wiederholen',
          },
          {
            keys: ['Strg', 'Shift', 'Z'],
            label: 'Alternative Redo-Kombination',
          },
          {
            keys: ['R'],
            label: 'Runde neu starten',
          },
          {
            keys: ['Esc'],
            label: 'Runde abbrechen und zur Auswahl zurueckkehren',
          },
        ],
      },
      {
        title: 'Per Maus',
        icon: 'image',
        items: [
          {
            label: 'Klicke auf eine Kachel neben dem Leerfeld, um sie dorthin zu schieben.',
          },
          {
            label: 'Doppelklick auf eine korrekt platzierte Kachel spielt eine gruene Bestaetigungsanimation.',
          },
          {
            label: 'Doppelklick auf eine falsch platzierte Kachel hebt ihre Zielposition auf dem Brett hervor.',
          },
          {
            label: 'Rechtsklick auf das Brett oeffnet ein Kontextmenue mit Shortcuts und Aktionen.',
          },
        ],
      },
      {
        title: 'Werkzeuge im linken Panel',
        icon: 'layout',
        items: [
          {
            keys: ['Tab'],
            label: 'Zwischen Hinweis, Zug spielen, Overlays, Undo, Redo und Abbrechen wechseln',
          },
          {
            keys: ['Enter'],
            label: 'Die fokussierte Werkzeugaktion ausloesen',
          },
          {
            label: 'Im rechten Panel findest du Referenzbild, Strategiefokus und Musiksteuerung.',
          },
        ],
      },
      {
        title: 'Challenge-Ziel',
        icon: 'medal',
        items: [
          {
            label: 'Die Live-Prognose zeigt die beste Medaille, die mit dem aktuellen Stand noch erreichbar ist.',
          },
          {
            label: 'Erreicht bedeutet gleich gut oder besser; strikt unterboten bedeutet schneller oder mit weniger Zuegen.',
          },
          {
            label: 'Hinweise und automatische Zuege verhindern Gold und Diamant, Silber und Bronze bleiben erreichbar.',
          },
          {
            label: 'Diamant ist nur verfuegbar, wenn eine exakte optimale Zugzahl fuer das Startbrett bekannt ist.',
          },
        ],
      },
    ],
  },
  solved: {
    kicker: 'Geschafft',
    title: 'Runde abgeschlossen',
    description: 'Die Gewinnansicht fasst den Lauf zusammen und bietet die naechsten Schritte an.',
    sections: [
      {
        title: 'Naechste Schritte',
        icon: 'zap',
        items: [
          {
            keys: ['Tab'],
            label: 'Zwischen Nochmal spielen, naechster Schwierigkeit und Rueckwegen wechseln',
          },
          {
            keys: ['Pfeile'],
            label: 'Die Aktionen direkt seitlich oder vertikal durchlaufen',
          },
          {
            keys: ['Pos1', 'Ende'],
            label: 'Sofort zur ersten oder letzten Aktion springen',
          },
          {
            keys: ['Enter'],
            label: 'Die fokussierte Folgeaktion sofort ausloesen',
          },
          {
            label: 'Die Statistikmeldung bleibt lesbar, waehrend du schon die naechste Aktion waehlen kannst.',
          },
        ],
      },
      {
        title: 'Ergebnisse',
        icon: 'grid',
        items: [
          {
            label: 'Der Dialog zeigt deine Zeit, Zuege, Netto-Zuege und ob du Hilfen benutzt hast.',
          },
          {
            label: 'Neue Bestzeiten und Best-Zuege werden sofort angezeigt.',
          },
          {
            label: 'Die Runde wird automatisch in der Statistik und der Galerie vermerkt.',
          },
        ],
      },
      {
        title: 'Challenge-Ergebnis',
        icon: 'medal',
        items: [
          {
            label: 'Der Gewinn-Dialog erklaert deine erreichte Medaille und ob sie einen neuen Aufstieg darstellt.',
          },
          {
            label: 'Das naechste Medaillenziel nennt konkret, welche Zeit, Zugzahl oder Hilfe-Bedingung noch fehlt.',
          },
          {
            label: 'Ein Challenge-Abschluss ohne Medaille entfernt keine bereits frueher erreichte Medaille.',
          },
        ],
      },
    ],
  },
}

export type { HelpContext, HelpItem, HelpSection, HelpView }

export { ALL_HELP_CONTEXTS }

export function getDefaultHelpContext(appState: AppState): HelpContext {
  switch (appState) {
    case 'welcome':
      return 'welcome'
    case 'idle':
      return 'upload-start'
    case 'imageLoaded':
      return 'imageLoaded'
    case 'playing':
      return 'playing'
    case 'solved':
      return 'solved'
  }
}

export function getHelpView(helpContext: HelpContext): HelpView {
  const view = HELP_VIEWS[helpContext]
  return {
    ...view,
    sections: [...view.sections, ...COMMON_SECTIONS],
  }
}
