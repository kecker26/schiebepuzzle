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
    title: 'Überall in der App',
    icon: 'command',
    isGlobal: true,
    items: [
      {
        keys: ['F1'],
        label: 'Hilfe öffnen oder schließen',
        detail: 'Funktioniert in jeder Ansicht und über fast allen Dialogen.',
      },
      {
        keys: ['?'],
        label: 'Shortcut-Hilfe schnell aufrufen',
        detail: 'Ideal, wenn du gerade nicht mehr weißt, welche Tasten hier gelten.',
      },
      {
        keys: ['Strg', '/'],
        label: 'Alternative Hilfe-Taste',
        detail: 'Nützlich auf Tastaturen, auf denen das Fragezeichen unpraktisch liegt.',
      },
      {
        keys: ['F8'],
        label: 'Schnellaktionen öffnen',
        detail: 'Öffnet die Command Palette für Start, Auswahl, Musik, Hilfe und wichtige Direktaktionen.',
      },
      {
        keys: ['Strg', 'Pos1'],
        label: 'Zum ersten sinnvollen Fokusziel der aktuellen Ansicht springen',
        detail: 'Richtet die sichtbare Ebene wieder am Anfang aus und setzt den Fokus auf die primäre Aktion der aktuellen Seite oder des aktuellen Dialogs.',
      },
      {
        keys: ['Tab'],
        label: 'Zum nächsten Fokusziel springen',
      },
      {
        keys: ['Shift', 'Tab'],
        label: 'Zum vorherigen Fokusziel zurück',
      },
      {
        keys: ['Enter'],
        label: 'Fokussierte Standardaktion ausführen',
      },
      {
        keys: ['Leertaste'],
        label: 'Buttons und Umschalter bestätigen',
      },
      {
        keys: ['Esc'],
        label: 'Die oberste offene Ebene schließen',
        detail: 'Zum Beispiel Hilfe, Menüs oder andere modale Fenster.',
      },
    ],
  },
  {
    title: 'Dialoge und Fenster',
    icon: 'layout',
    isGlobal: true,
    items: [
      {
        label: 'Dialoge behalten den Fokus bei sich, bis du sie schließt.',
      },
      {
        label: 'Nach dem Schließen springt der Fokus wieder an den Auslöser zurück.',
      },
      {
        label: 'Die Hilfe öffnet über der aktuellen Ansicht, ohne den Kontext zu verlieren.',
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
        label: 'Per Pfeil nach unten öffnest du Lautstärke oder Stilauswahl direkt im Dropdown.',
      },
      {
        label: 'Das Emotion-Theme leitet aus dem aktuellen Bild eine passende Stimmung und Farbpalette für UI, Galerie-, Spielstand- und Sammlungskarten ab.',
      },
      {
        label: 'Die Bildstimmung entsteht direkt auf deinem Gerät; dafür werden keine Bilddaten an die KI gesendet.',
      },
      {
        label: 'Mit dem Palette-Button wechselst du jederzeit zwischen Emotion-Theme und Standard-Farbgebung; Hell- und Dunkel-Modus bleiben davon unabhängig.',
      },
    ],
  },
]

const HELP_VIEWS: Record<HelpContext, HelpView> = {
  welcome: {
    kicker: 'Willkommen',
    title: 'Erste Schritte',
    description: 'So funktioniert die App: Bild laden, zuschneiden, Puzzle lösen. Dein Fortschritt wird automatisch gespeichert.',
    sections: [
      {
        title: 'Was ist ein Schiebepuzzle?',
        icon: 'grid',
        items: [
          {
            label: 'Du schiebst Kacheln in ein Leerfeld, um ein zerstückeltes Bild wiederherzustellen.',
          },
          {
            label: 'Je höher die Schwierigkeit, desto mehr Kacheln – von 3x3 bis 7x7.',
          },
          {
            label: 'Dein Weg: Bild hochladen oder Zufallsbild starten, Ausschnitt wählen, Puzzle lösen.',
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
            label: 'Spiel starten oder Beenden bestätigen',
          },
          {
            label: 'Die Infokarten sind Lesebereiche; die primären Aktionen liegen im Aktionspanel.',
          },
        ],
      },
      {
        title: 'Features im Überblick',
        icon: 'helpCircle',
        items: [
          {
            label: 'Hinweise und automatische Züge helfen dir, wenn du festhängst.',
          },
          {
            label: 'Geisterbild, konfigurierbare Heatmap und Nummern-Overlay zeigen visuelle Hilfen auf dem Brett.',
          },
          {
            label: 'Statistik, Galerie und Spielstände behalten deinen Fortschritt im Blick.',
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
    title: 'Bild laden und Bereiche öffnen',
    description: 'Bild laden, Zufallsbild starten oder in Spielstände, Statistik und Galerie springen.',
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
            label: 'Fokussierte Karte oder Schaltfläche öffnen',
          },
          {
            keys: ['Pfeile', 'Pos1', 'Ende'],
            label: 'Auf den großen Karten und Backup-Aktionen direkt zwischen benachbarten Zielen wechseln',
          },
          {
            keys: ['Strg', 'V'],
            label: 'Ein Bild direkt aus der Zwischenablage einfügen',
            detail: 'Funktioniert in der Auswahlansicht ohne zusätzlichen Dateidialog.',
          },
          {
            keys: ['Esc'],
            label: 'Zur Startseite zurückkehren, solange kein Dialog oder Datenfenster offen ist',
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
            label: 'Die Datenbereiche Spielstände, Statistik und Galerie öffnen sich per Klick.',
          },
        ],
      },
      {
        title: 'Datenbereiche und Backups',
        icon: 'archive',
        items: [
          {
            label: 'Spielstände, Statistik, Galerie und Sammlungen lassen sich vollständig per Fokus und Enter öffnen.',
          },
          {
            label: 'Backups können ohne Maus exportiert und importiert werden.',
          },
          {
            label: 'Ein Backup sichert Spielstände, Statistik, Galerie, Sammlungen sowie eigene und gelernte Tag-Kategorien gemeinsam.',
          },
          {
            label: 'Die App behält die 3 neuesten lokalen Backups; beim Erstellen eines weiteren Backups wird das älteste automatisch entfernt.',
          },
          {
            label: 'Ein Import führt Daten nicht zusammen, sondern ersetzt den aktuellen Datenstand komplett. Erstelle vorher ein frisches Backup, wenn du ihn behalten möchtest.',
          },
        ],
      },
    ],
  },
  'upload-savedGames': {
    kicker: 'Spielstände',
    title: 'Offene Partien verwalten',
    description: 'Gespeicherte Spiele fortsetzen, löschen oder direkt zu Statistik, Galerie und Start wechseln.',
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
            detail: 'Links und rechts wechseln innerhalb einer Karte, hoch und runter zur gleichen Aktion anderer Spielstände.',
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
            label: 'Weiterspielen, Löschen oder Alle löschen bestätigen',
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
            label: 'Klicke Löschen, um einen einzelnen Spielstand zu entfernen.',
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
            label: 'Zwischen den Abschnittsköpfen wechseln und den Zielabschnitt oben ausrichten',
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
            label: 'Immer direkt zur letzten Abschnittsüberschrift Verlaufstabelle springen',
          },
        ],
      },
      {
        title: 'Filter und Tabellen',
        icon: 'refreshCw',
        items: [
          {
            keys: ['Tab'],
            label: 'Zwischen Filter-Chips, Sortierköpfen, Reset und Rückwegen wechseln',
          },
          {
            keys: ['Pfeile'],
            label: 'Filter-Chips und Sortierköpfe direkt horizontal durchlaufen',
          },
          {
            keys: ['Home', 'Ende'],
            label: 'Innerhalb der Filter- oder Sortierreihe direkt zum ersten oder letzten Ziel springen',
          },
          {
            keys: ['Enter'],
            label: 'Filter-Chips, Sortierköpfe und Schaltflächen auslösen',
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
            label: 'Überblick: Gesamtsiege, Bestzeiten, Durchschnitte und Streaks.',
          },
          {
            label: 'Vergleichsmatrix: Jede Schwierigkeit im direkten Vergleich nach Zeit, Zügen und Anteil ohne Hilfe.',
          },
          {
            label: 'Verlaufstabelle: Jedes gelöste Puzzle einzeln, filterbar nach Schwierigkeit und sortierbar.',
          },
        ],
      },
      {
        title: 'Medaillen-Aufstiege',
        icon: 'medal',
        items: [
          {
            label: 'Die Medaillen-Ansicht gruppiert Challenge-Läufe pro Motiv und zeigt nur echte Aufstiege.',
          },
          {
            label: 'Pro Motiv zählt in der Verteilung ausschließlich die beste erreichte Medaille.',
          },
          {
            label: 'Medaillenfilter, Sortierung und Motivkarten helfen dir, Aufstiegswege gezielt nachzuvollziehen.',
          },
          {
            keys: ['F8'],
            label: 'Medaillen-Aufstiege direkt öffnen',
            detail: 'Suche in den Schnellaktionen nach Medaillen-Aufstiege.',
          },
        ],
      },
    ],
  },
  'upload-gallery': {
    kicker: 'Galerie',
    title: 'Gelöste Motive und Filter',
    description: 'Galerieeinträge, Filter und Rückwege lassen sich direkt über Fokus und Aktionen bedienen.',
    sections: [
      {
        title: 'Filter und Einträge',
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
            label: 'Details öffnen, Motiv erneut spielen oder Einträge löschen',
          },
          {
            label: 'Filter, Sortierung und Zurücksetzen lassen sich komplett ohne Maus steuern.',
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
            label: 'Auf den großen Bereichskarten zwischen Start, Spielständen, Statistik und Galerie wechseln',
          },
          {
            label: 'Von jeder Galerieansicht kommst du direkt zur Statistik, zu Spielständen oder zur Auswahl zurück.',
          },
        ],
      },
      {
        title: 'Per Maus',
        icon: 'move',
        items: [
          {
            label: 'Klicke auf das Vorschaubild oder Details, um die Motiv-Detailansicht zu öffnen.',
          },
          {
            label: 'Über die Filter-Selects oben kannst du Schwierigkeit und Laufart einschränken.',
          },
        ],
      },
      {
        title: 'Sammlungen erstellen & verwalten',
        icon: 'archive',
        items: [
          {
            label: 'Füge ein gelöstes Motiv in der Galerie einer bestehenden oder direkt einer neuen Sammlung hinzu.',
          },
          {
            label: 'Aus einem aktiven Tag kannst du passende Galerie-Motive gemeinsam als neue Sammlung übernehmen oder eine bestehende Sammlung ergänzen.',
          },
          {
            label: 'In der Sammlungsansicht kannst du Name und Beschreibung bearbeiten, Motive öffnen und einzelne Motive wieder entfernen.',
          },
          {
            label: 'Das Entfernen eines Motivs oder das Löschen einer Sammlung löscht keine Galerie-Einträge.',
          },
        ],
      },
      {
        title: 'Tags und Tag-Manager',
        icon: 'helpCircle',
        items: [
          {
            label: 'Bild-Tags stammen aus der KI-Analyse, aus importierten Daten oder aus deinen manuellen Ergänzungen.',
          },
          {
            label: 'Die Kategorie eines Tags kommt getrennt davon aus der statischen Taxonomie, einer manuellen Zuordnung oder dem lokal gespeicherten KI-Lerncache.',
          },
          {
            label: 'Im Tag-Manager kannst du Tags suchen, filtern, umbenennen, zusammenführen, gesammelt hinzufügen oder aus betroffenen Motiven entfernen.',
          },
          {
            label: 'Entfernte KI-Tags bleiben abgelehnt und erscheinen bei einer erneuten Analyse nicht wieder.',
            detail: 'Wenn du einen solchen Tag später selbst hinzufügst, wird er wieder verwendet.',
          },
          {
            label: 'KI-Tags und Sammlungsvorschläge sind von der lokalen Bildstimmungsanalyse für das Emotion-Theme getrennt.',
          },
        ],
      },
      {
        title: 'Challenges und Medaillen',
        icon: 'medal',
        items: [
          {
            label: 'Bronze: Absolut clean genau ein Ziel der Vorlage strikt unterbieten.',
          },
          {
            label: 'Silber: Absolut clean Zeit und Züge strikt unterbieten.',
          },
          {
            label: 'Gold: Absolut clean Zeit und Züge jeweils um mindestens 20 % unterbieten.',
          },
          {
            label: 'Diamant: Gold erreichen und zusätzlich exakt solver-optimal lösen.',
          },
          {
            label: 'Gold oder Diamant können für einzelne Vorlagen mathematisch nicht erreichbar sein.',
          },
          {
            keys: ['F8'],
            label: 'Medaillen-Jagd direkt öffnen',
            detail: 'Zeigt upgradefähige Motive zuerst nach ihrem besten Upgrade-Potenzial.',
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
            label: 'Den Zuschnitt auf den Ausgangspunkt zurücksetzen',
          },
          {
            keys: ['Pfeile', 'Pos1', 'Ende'],
            label: 'In Rotations- und Aktionsreihen zwischen den sichtbaren Schaltflächen wechseln',
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
            label: 'Aus dem Zuschnitt jederzeit zur Auswahlansicht zurückkehren',
          },
          {
            label: 'Zurück kehrt in die Auswahlansicht zurück, ohne die App zu verlassen.',
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
    description: 'Hier findest du die wichtigsten Tasten für Brett, Hilfen und Navigation.',
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
            label: 'Den Fokus jederzeit direkt zurück auf das Puzzlebrett holen',
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
            label: 'Alternative Brettsteuerung für die gleichen Bewegungen',
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
            detail: 'Legt das Originalbild halbtransparent über offene Kacheln.',
          },
          {
            keys: ['M'],
            label: 'Heatmap umschalten',
            detail: 'Bewertet bewegliche Kacheln: Grün verbessert, Gelb bereitet vor, Rot verschlechtert.',
          },
          {
            keys: ['N'],
            label: 'Nummern kurz einblenden',
            detail: 'Zeigt fünf Sekunden lang die Soll-Position jeder Kachel.',
          },
        ],
      },
      {
        title: 'Verlauf und Navigation',
        icon: 'refreshCw',
        items: [
          {
            keys: ['Strg', 'Z'],
            label: 'Letzten Zug rückgängig machen',
          },
          {
            keys: ['Strg', 'Y'],
            label: 'Rückgängigen Zug wiederholen',
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
            label: 'Runde abbrechen und zur Auswahl zurückkehren',
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
            label: 'Doppelklick auf eine falsch platzierte Kachel hebt ihre Zielposition auf dem Brett hervor.',
          },
          {
            label: 'Rechtsklick auf das Brett öffnet ein Kontextmenü mit Shortcuts und Aktionen.',
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
            label: 'Die fokussierte Werkzeugaktion auslösen',
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
            label: 'Geschätzte Vergleiche erlauben Hilfen; der Lauf zählt dann als unterstützt.',
          },
          {
            label: 'Qualifikations- und Medaillenläufe sperren alle Spielhilfen.',
          },
          {
            label: 'Silber verbessert beide Ziele, Gold beide um mindestens 20 % und Diamant beide um mindestens 40 %.',
          },
        ],
      },
    ],
  },
  solved: {
    kicker: 'Geschafft',
    title: 'Runde abgeschlossen',
    description: 'Die Gewinnansicht fasst den Lauf zusammen und bietet die nächsten Schritte an.',
    sections: [
      {
        title: 'Nächste Schritte',
        icon: 'zap',
        items: [
          {
            keys: ['Tab'],
            label: 'Zwischen Nochmal spielen, nächster Schwierigkeit und Rückwegen wechseln',
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
            label: 'Die fokussierte Folgeaktion sofort auslösen',
          },
          {
            label: 'Die Statistikmeldung bleibt lesbar, während du schon die nächste Aktion wählen kannst.',
          },
        ],
      },
      {
        title: 'Ergebnisse',
        icon: 'grid',
        items: [
          {
            label: 'Der Dialog zeigt deine Zeit, Züge, Netto-Züge und ob du Hilfen benutzt hast.',
          },
          {
            label: 'Neue Bestzeiten und Best-Züge werden sofort angezeigt.',
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
            label: 'Der Gewinn-Dialog erklärt deine erreichte Medaille und ob sie einen neuen Aufstieg darstellt.',
          },
          {
            label: 'Das nächste Medaillenziel nennt konkret, welche Zeit, Zugzahl oder Hilfe-Bedingung noch fehlt.',
          },
          {
            label: 'Ein Challenge-Abschluss ohne Medaille entfernt keine bereits früher erreichte Medaille.',
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
