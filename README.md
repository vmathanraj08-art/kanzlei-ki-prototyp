# kanzlei-ki-prototyp

## Projektziel

Dieser Prototyp erprobt KI-gestützte Workflows für den Kanzleialltag, etwa die automatische Verarbeitung und Einordnung von Belegen. Er dient ausschließlich zu Test- und Demonstrationszwecken.

> **Hinweis:** Keine echten Mandantendaten in diesem Repository.


## Testdaten

Der Ordner `belege/` enthält 20 fiktive Belege (`beleg_01.txt` bis `beleg_20.txt`) zum Testen der Belegklassifizierung. Sie verteilen sich auf sieben Belegarten: Büromaterial, Software-Abo, Tankbeleg, Bewirtung, Reisekosten, Telefon/Internet und Miete. Alle Firmen, Namen und Adressen sind frei erfunden.

`belege/loesungen.json` enthält die richtige Zuordnung für jeden Beleg: Belegart, Bruttobetrag, USt-Satz und SKR03-Konto. Mit dieser Datei lässt sich prüfen, wie genau die automatische Klassifizierung arbeitet.

Annahmen: Alle Belege stammen aus 2025. Für Bewirtung gilt deshalb 19 % (der ermäßigte Satz für Speisen in der Gastronomie gilt erst ab 2026). Reisekosten werden als Reisekosten von Arbeitnehmern gebucht (4663/4666).

## Funktionen

Die Web-Oberfläche (`index.html`) klassifiziert die Test-Belege automatisch:

- **Übersicht:** lädt alle 20 Belege aus `belege/` und zeigt sie als Tabelle. Ein Klick auf den Dateinamen zeigt den Belegtext und die erkannten Schlüsselwörter.
- **Klassifizierung:** erkennt für jeden Beleg Belegart, Bruttobetrag und USt-Satz und schlägt ein SKR03-Konto vor.
- **Abgleich:** vergleicht die Ergebnisse mit `belege/loesungen.json`. Jeder Beleg wird grün (richtig) oder rot (falsch) markiert, abweichende Felder zeigen den erwarteten Wert. Oben steht die Trefferquote, z. B. „20 von 20 korrekt“.
- **Eigener Beleg:** Belegtext in das Textfeld einfügen und auf „Klassifizieren“ klicken. Der Text bleibt im Browser.
- **Export:** „Als CSV exportieren“ lädt die Ergebnistabelle als CSV herunter (Semikolon, Dezimalkomma, öffnet direkt in Excel).

Die Klassifizierung ist regelbasiert (Schlüsselwörter mit Gewichtung, Muster für Beträge und Steuersätze). Es gibt keinen KI-Dienst und keinen API-Schlüssel.

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html` | Seitenstruktur |
| `style.css` | Gestaltung |
| `app.js` | Laden der Belege, Klassifizierung, Abgleich, CSV-Export |
| `belege/` | Test-Belege und Lösungsdatei |

Die gesamte Klassifizierungslogik steckt in der Funktion `klassifiziereBeleg(text)` in `app.js`. Sie bekommt den Belegtext und gibt Belegart, Bruttobetrag, USt-Satz und Konto zurück. Um später eine KI zu nutzen, reicht es, diese eine Funktion zu ersetzen. Der Rest der Seite bleibt unverändert.

## Lokal starten

Die Seite lädt die Belege per `fetch()`. Das funktioniert nicht, wenn man `index.html` per Doppelklick öffnet (`file://`). Stattdessen im Projektordner einen einfachen Webserver starten:

```
python3 -m http.server 8000
```

Dann im Browser `http://localhost:8000` öffnen.

Auf Netlify ist keine Einrichtung nötig: Das Repository verbinden, kein Build-Befehl, Veröffentlichungsordner ist das Hauptverzeichnis.

## Nächste Schritte

- Weitere, schwierigere Test-Belege ergänzen (z. B. Mischsteuersätze, unvollständige Belege, Tippfehler). Die aktuellen Regeln wurden anhand der 20 vorhandenen Belege entwickelt, daher sagt die Trefferquote von 20/20 noch wenig über echte Belege aus.
- `klassifiziereBeleg()` durch einen KI-Aufruf ersetzen. Der API-Schlüssel gehört dabei in eine Netlify Function oder ein anderes Backend, nie in `app.js`.
- Regelbasiertes Ergebnis und KI-Ergebnis nebeneinander mit der Lösungsdatei vergleichen.
- Hochladen von PDF- oder Bilddateien mit Texterkennung (OCR).
