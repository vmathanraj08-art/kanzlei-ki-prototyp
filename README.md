# kanzlei-ki-prototyp

## Projektziel

Dieser Prototyp erprobt KI-gestützte Workflows für den Kanzleialltag, etwa die automatische Verarbeitung und Einordnung von Belegen. Er dient ausschließlich zu Test- und Demonstrationszwecken.

> **Hinweis:** Keine echten Mandantendaten in diesem Repository.

## Geplante nächste Schritte

- Dummy-Belege erzeugen
- Belegklassifizierung
- Web-Oberfläche

## Testdaten

Der Ordner `belege/` enthält 20 fiktive Belege (`beleg_01.txt` bis `beleg_20.txt`) zum Testen der Belegklassifizierung. Sie verteilen sich auf sieben Belegarten: Büromaterial, Software-Abo, Tankbeleg, Bewirtung, Reisekosten, Telefon/Internet und Miete. Alle Firmen, Namen und Adressen sind frei erfunden.

`belege/loesungen.json` enthält die richtige Zuordnung für jeden Beleg: Belegart, Bruttobetrag, USt-Satz und SKR03-Konto. Mit dieser Datei lässt sich prüfen, wie genau die automatische Klassifizierung arbeitet.

Annahmen: Alle Belege stammen aus 2025. Für Bewirtung gilt deshalb 19 % (der ermäßigte Satz für Speisen in der Gastronomie gilt erst ab 2026). Reisekosten werden als Reisekosten von Arbeitnehmern gebucht (4663/4666).
