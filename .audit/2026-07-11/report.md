# UX-, Text- und Logik-Audit – Schiebepuzzle

Datum: 11.07.2026  
Geprüfter Desktop-Viewport: ca. 1265 × 765 px  
Umfang: Start, Auswahl, Spielstände, Statistik, Galerie, Sammlungen, Zuschnitt, Puzzle, Pause und Hilfe.

## Gesamturteil

Die App bietet ungewöhnlich viel Funktionalität und eine grundsätzlich klare visuelle Sprache. Die größten Schwächen liegen nicht in fehlenden Funktionen, sondern in widersprüchlichen Statusaussagen, einer überladenen Informationsarchitektur und mehreren wiederkehrenden Darstellungs- und Textproblemen. Drei Punkte sollten vor weiterer Politur zuerst behoben werden: abgeschnittene Fensterinhalte, falsche Challenge-/Diamant-Texte und die aktuell fehlschlagenden Galerie-Smoke-Tests.

## Geprüfte Schritte

1. **Startseite – brauchbar, aber metrisch missverständlich.** Evidenz: `01-start.png`.
2. **Auswahl – funktional, aber textlich übererklärt.** Evidenz: `02-auswahl.png`.
3. **Spielstände – funktional, mit schwerem Layout- und Redundanzproblem.** Evidenz: `04-spielstaende.png`.
4. **Statistik – datenreich, aber sehr dicht und links abgeschnitten.** Evidenz: `05-statistik.png`.
5. **Galerie – mächtig, aber durch doppelte Filterlogik überladen.** Evidenz: `06-galerie.png`.
6. **Sammlungen – verständlicher Grundflow, inkonsistente Begriffe.** Evidenz: `07-sammlungen.png`.
7. **Zuschnitt – funktional, mit falscher Kachelbezeichnung und Fokus-Tooltip.** Evidenz: `08-zuschnitt.png`.
8. **Puzzle – spielbar, aber widersprüchliche Ziel-/Hilfenkommunikation.** Evidenz: `09-puzzle.png`.
9. **Pause – funktional, aber doppelte Aktion und schwacher Kontrast.** Evidenz: `10-pause.png`.
10. **Hilfe – umfassend, aber zu lang und teilweise veraltet.** Evidenz: `11-hilfe.png`.

## Priorisierte Probleme und Vorschläge

| Prio | Problem | Auswirkung | Vorschlag |
|---|---|---|---|
| Hoch | Die globale linke Werkzeugleiste liegt mit `z-index: 1150` über den Workspace-Fenstern (`z-index: 1100`). Dadurch werden Titel und Einleitung links abgeschnitten. | Spielstände, Statistik, Galerie und Sammlungen verlieren sichtbare Anfangsbuchstaben und wirken kaputt. | Werkzeugleiste bei modalem Workspace ausblenden oder unter den Overlay-Layer legen; alternativ links einen echten reservierten Rand vorsehen. |
| Hoch | Beim geschätzten Vergleich lautet das ARIA-Label immer „Zielmodus aktiv – Spielhilfen sind gesperrt“, obwohl Soft-Ziele die Hilfen erlauben und die Buttons aktiv sind. | Sichtbare Funktion und Zustandsbeschreibung widersprechen sich; für Screenreader ist der Zustand falsch. | Sperrtext nur bei `qualification`/`medal` ausgeben. Für `soft`: „Geschätzter Vergleich – Hilfen sind erlaubt, der Lauf gilt dann als unterstützt.“ |
| Hoch | Die Hilfe behauptet weiterhin, Diamant brauche eine bekannte exakte optimale Zugzahl. Die aktuelle Medaillenlogik verlangt stattdessen 40 % Verbesserung bei Zeit und Zügen. | Nutzer verfolgen ein nicht mehr gültiges Ziel; Dokumentation und Code widersprechen sich. | Hilfeeintrag an die zentrale Medaillenregel anbinden oder aus derselben Datenquelle generieren. |
| Hoch | Die drei relevanten Galerie-Smoke-Tests schlagen fehl, weil sie einen Button „Zuruecksetzen“ erwarten, die UI aber „Alle Filter zuruecksetzen“ anbietet. | Die zentrale Tastatur-/Filterregression ist aktuell nicht grün; weitere echte Fehler können übersehen werden. | Accessible Name und Tests bewusst vereinheitlichen und die komplette Smoke-Suite wieder grün machen. |
| Hoch | Startseite: „7 Spiele“ steht neben „22 Siege“. Die 7 sind tatsächlich offene Spielstände. | Siege können scheinbar höher als Spiele sein; die Kennzahlen wirken unlogisch. | „Spiele“ in „Offene Partien“ oder „Spielstände“ umbenennen. „Siege“ und „Motive“ klar als abgeschlossene Werte kennzeichnen. |
| Hoch | Backup-Texte nennen nur Spielstände, Statistik und Galerie. Der Export enthält aber auch Sammlungen, Tag-Kategorien und Assets. | Nutzer unterschätzen den Sicherungsumfang und wissen nicht, ob Sammlungen geschützt sind. | Einheitlich „Sichert alle lokalen App-Daten“ schreiben und darunter die enthaltenen Bereiche vollständig auflisten. |
| Mittel | „Sammlungen“ und „Kollektionen“ werden auf derselben Ansicht abwechselnd verwendet. | Es wirkt wie zwei verschiedene Funktionen. | Produktweit nur „Sammlungen“ verwenden; auch „2 Kollektionen“ und „Deine Kollektionen“ ersetzen. |
| Mittel | Die Fenster erklären mehrfach ihre eigene UI-Architektur („in einem eigenen Fenster“, „damit die Startseite ruhig bleibt“) und wiederholen Überschriften. | Viel Text ohne Entscheidungshilfe; wichtige Inhalte rutschen nach unten. | Pro Fenster eine Hauptüberschrift und einen kurzen Nutzen-Satz. Technische Meta-Erklärungen entfernen. |
| Mittel | Mehrere gleichwertige Rückwege existieren gleichzeitig: Auswahl oben, Auswahl in der Seitennavigation und „Zur Auswahl“ unten. | Mehr visuelle Last, ohne zusätzlichen Nutzen. | Einen primären Rückweg im Header behalten; Seitennavigation nur für Bereichswechsel nutzen; unteren Rückweg entfernen. |
| Mittel | 4×4 wird im Zuschnitt als „16 spielbare Kacheln“ bezeichnet, im Puzzle korrekt als „15 Teile“. | Sachlich widersprüchlich, weil ein Feld leer bleibt. | Entweder „16 Felder“ oder „15 bewegliche Teile + 1 Leerfeld“ schreiben. |
| Mittel | Tooltips erscheinen sofort auf automatisch fokussierten Elementen und verdecken beim Eintritt Teile der Oberfläche. | Sichtbar in Spielständen, Galerie, Zuschnitt und Hilfe; besonders störend für Tastaturnutzer. | Fokus-Tooltips verzögern, bei automatischem Fokus unterdrücken und bei Ansichtswechsel sofort schließen; wichtige Erklärungen zusätzlich über `aria-describedby` bereitstellen. |
| Mittel | Die Galerie zeigt Medaillen-Schnellfilter und zusätzlich den Dropdown-Filter „Medaillen-Jagd“. Daneben stehen deaktivierte Aktionen wie „Alle Motive“ und „Sammlung aus Tag“. | Hohe kognitive Last; mehrere Kontrollen scheinen dasselbe zu tun. | Entweder Schnellfilter oder Dropdown prominent zeigen. Sekundärfilter in „Weitere Filter“ einklappen; nicht ausführbare Aktionen erst nach passender Auswahl einblenden. |
| Mittel | Der Challenge-Block wiederholt Diamant mehrfach und zeigt negative Differenzen wie `(-132)` bzw. `(-220s)`, obwohl damit ein verbleibendes Budget gemeint ist. | Die wichtigste Zielinformation ist schwer zu scannen und klingt nach Rückstand. | Eine Zeile „Diamant aktuell möglich“, darunter „132 Züge / 3:40 verbleiben“. Gold-/Diamant-Schwellen erst auf Nachfrage zeigen. |
| Mittel | Die Puzzleansicht hat drei voneinander unabhängige Scrollbereiche plus Seitenscrollbar. Werkzeuge liegen beim Einstieg unterhalb der sichtbaren Fläche. | Scrollen ist unvorhersehbar; Nutzer verlieren Brett oder Kontext. | Brett sticky halten und Seitenpanels in einklappbare Abschnitte gliedern oder einen gemeinsamen Seitenscroll verwenden. |
| Mittel | Im Pausezustand gibt es „Weiterspielen“ doppelt; der Dialogtext ist auf dem dunklen Overlay kaum lesbar und deaktivierte Hilfen sehen weiterhin aktiv aus. | Unklare Handlungspriorität und Kontrastrisiko. | Nur die zentrale Fortsetzen-Aktion zeigen, Seitenwerkzeuge deutlich abdunkeln/ausblenden und Dialogtext kontrastreicher darstellen. |
| Mittel | Die Hilfe enthält sehr lange technische Absätze, interne Implementierungsdetails und veraltete Regeln. | Die Suche nach einer konkreten Taste dauert unnötig lange. | Kurzhilfe auf „Aktion → Taste → Folge“ begrenzen. Heatmap-/Theme-/Datenschutzdetails in separate „Mehr erfahren“-Abschnitte verschieben. |
| Niedrig | Deutsche Texte verwenden häufig ASCII-Umschreibungen („Zufaellig“, „Ueberraschung“, „oeffnen“), daneben echte Umlaute. Außerdem steht „Reset“ zwischen deutschen Aktionen. | Unruhige, unfertige Textqualität. | UTF-8-Texte mit echten Umlauten verwenden; „Reset“ durch „Zurücksetzen“ ersetzen. |
| Niedrig | „Nano Banana erstellt daraus …“ nennt einen internen/technischen Modellnamen statt des Nutzens. | Der Text altert schnell und ist für viele Nutzer unverständlich. | Neutral: „Die KI erstellt daraus ein Puzzle-Bild.“ Provider nur in Einstellungen oder Datenschutzinfo nennen. |
| Niedrig | Startseite trennt „Medaillen-Jagd“ und „Medaillenspiegel“, obwohl beide denselben Fortschritt erklären. | Doppelte Information auf kleinem Raum. | Zu einer Karte „Medaillen“ zusammenführen: oben beste Stufen, darunter nächstes realistisches Upgrade. |
| Niedrig | Galerie-Button zeigt „Details“, der Accessible Name lautet „Spielen und Details … öffnen“. | Sichtbare und vorgelesene Aktion versprechen nicht dasselbe. | Accessible Name auf „Details zu … öffnen“ angleichen; „Erneut spielen“ erst im Detaildialog anbieten. |

## Verifikation

- Der von der Prüfung erzeugte Testspielstand wurde anschließend gelöscht; der Bestand liegt wieder bei 7 offenen Partien.
- Relevante Tests: 120 bestanden, 3 fehlgeschlagen. Betroffen sind ausschließlich Galerie-Reset-/Medaillenfilterfälle in `keyboardSmoke.test.tsx`; `galleryChallenge.test.ts` und `puzzleMedalRun.test.tsx` bestanden.
- Es wurden keine Produktivdateien geändert.

## Grenzen

Die Prüfung erfolgte auf einem Desktop-Viewport mit bestehendem lokalen Datenbestand. Mobile Breakpoints, Zoom über 100 %, echte Screenreader-Ausgabe, Farbkontrastmessungen und alle seltenen Fehler-/Leerzustände wurden nicht vollständig geprüft. Aus Screenshots allein lässt sich keine vollständige WCAG-Konformität ableiten.
