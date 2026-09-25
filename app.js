'use strict';

/* ==========================================================================
   Kanzlei-KI Prototyp – regelbasierte Belegklassifizierung
   Läuft vollständig im Browser, ohne Backend und ohne externe Dienste.
   ========================================================================== */

const BELEG_ORDNER = 'belege/';
const ANZAHL_BELEGE = 20; // beleg_01.txt bis beleg_20.txt
const LOESUNGEN_DATEI = BELEG_ORDNER + 'loesungen.json';

/* SKR03-Konten, die der Prototyp vorschlagen kann. */
const KONTEN = {
  '4930': 'Bürobedarf',
  '4964': 'Aufwendungen für zeitlich befristete Überlassung von Rechten (Lizenzen)',
  '4530': 'Laufende Kfz-Betriebskosten',
  '4650': 'Bewirtungskosten',
  '4663': 'Reisekosten Arbeitnehmer Fahrtkosten',
  '4666': 'Reisekosten Arbeitnehmer Übernachtungsaufwand',
  '4920': 'Telefon',
  '4925': 'Internetkosten',
  '4210': 'Miete (unbewegliche Wirtschaftsgüter)'
};

/* Regeln je Belegart: Muster mit Gewicht. Das Muster wird auf den klein
   geschriebenen Belegtext angewendet; \b verhindert Treffer in Wortteilen
   (z. B. "gast" in "Gasthaus"). Die Belegart mit der höchsten Summe gewinnt. */
const REGELN = [
  {
    belegart: 'Büromaterial',
    muster: [
      [/bürobedarf|büromaterial|schreibwaren|papeterie/, 3],
      [/kopierpapier|druckerpapier|druckerpatrone|toner/, 3],
      [/ordner|hängeregistratur|locher|hefter|haftnotiz|kugelschreiber|textmarker|briefumschl|etikett/, 2]
    ]
  },
  {
    belegart: 'Software-Abo',
    muster: [
      [/software|lizenz|saas|subscription/, 3],
      [/\babo\b|abonnement/, 2],
      [/cloud|nutzer|user|datenbank|modul/, 1]
    ]
  },
  {
    belegart: 'Tankbeleg',
    muster: [
      [/zapfsäule|kraftstoff|tankstelle|tankkarte/, 3],
      [/super e10|super e5|diesel|benzin|adblue/, 3],
      [/autohof|tankhof|scheibenreiniger/, 2]
    ]
  },
  {
    belegart: 'Bewirtung',
    muster: [
      [/bewirtung|bewirtete personen/, 4],
      [/restaurant|gasthaus|gaststätte|trattoria|brauhaus|bistro|café|pizzeria/, 3],
      [/menü|speise|getränk|\btisch\b|trinkgeld/, 2],
      [/espresso|kaffee|schnitzel|pasta|salat|wein|bier|weizen|schorle|mineralwasser/, 1]
    ]
  },
  {
    belegart: 'Reisekosten',
    muster: [
      [/übernachtung|hotel|pension|einzelzimmer|doppelzimmer/, 3],
      [/fahrkarte|fahrschein|bahn|fernverkehr|\bflug|bahncard/, 3],
      [/hbf|hin- und rückfahrt|\bgast\b|kurbeitrag|\bzug\b/, 2]
    ]
  },
  {
    belegart: 'Telefon/Internet',
    muster: [
      [/telefon|mobilfunk|festnetz|telekommunikation/, 3],
      [/internet|glasfaser|\bdsl\b|breitband|ip-adresse/, 3],
      [/roaming|verbindungsentgelt|tarif|\bsim\b|router|anschluss|pbx/, 2]
    ]
  },
  {
    belegart: 'Miete',
    muster: [
      [/miete|mietrechnung|mietvertrag|kaltmiete|warmmiete/, 4],
      [/nebenkosten|vermiet|büroeinheit|büroräume/, 2],
      [/m²|grundbesitz|immobilien|pacht/, 1]
    ]
  }
];

/* --------------------------------------------------------------------------
   Hilfsfunktionen für Beträge
   -------------------------------------------------------------------------- */

/** Wandelt einen deutschen Betrag wie "1.234,56" in die Zahl 1234.56 um. */
function parseBetrag(text) {
  return Number(text.replace(/\./g, '').replace(',', '.'));
}

/** Formatiert eine Zahl als "1.234,56 €". */
function formatBetrag(zahl) {
  if (zahl === null || Number.isNaN(zahl)) return '–';
  return zahl.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

const BETRAG = '(\\d{1,3}(?:\\.\\d{3})*,\\d{2}|\\d+,\\d{2})';

/** Sucht den Bruttobetrag: erst nach eindeutigen Stichwörtern, sonst den größten Betrag. */
function erkenneBrutto(text) {
  const stichwoerter = [
    'brutto(?:betrag)?', 'gesamtbetrag', 'rechnungsbetrag', 'endbetrag',
    'zu zahlen', 'summe', 'gesamt', 'total'
  ];
  for (const wort of stichwoerter) {
    const treffer = text.match(new RegExp(wort + '[^\\d\\n]*' + BETRAG, 'i'));
    if (treffer) return parseBetrag(treffer[1]);
  }
  const alle = [...text.matchAll(new RegExp(BETRAG, 'g'))].map(t => parseBetrag(t[1]));
  return alle.length ? Math.max(...alle) : null;
}

/** Sucht den USt-Satz (19, 7 oder 0 %). */
function erkenneUstSatz(text) {
  const muster = [
    /(?:ust|mwst|umsatzsteuer|mehrwertsteuer)\.?\s*(\d{1,2})(?:,0+)?\s*%/i,
    /(\d{1,2})(?:,0+)?\s*%\s*(?:ust|mwst|umsatzsteuer|mehrwertsteuer)/i
  ];
  for (const m of muster) {
    const treffer = text.match(m);
    if (treffer) return Number(treffer[1]);
  }
  if (/steuerfrei|§\s*4\s*nr/i.test(text)) return 0;
  return null;
}

/* ==========================================================================
   KLASSIFIZIERUNG
   --------------------------------------------------------------------------
   Diese Funktion ist die einzige Stelle, an der ein Beleg bewertet wird.
   Sie bekommt den reinen Belegtext und liefert ein Ergebnisobjekt:

     {
       belegart:         'Tankbeleg' | ... | 'Unbekannt',
       bruttobetrag:     Zahl oder null,
       ustSatz:          19 | 7 | 0 | null,
       konto:            SKR03-Kontonummer als Text oder null,
       kontoBezeichnung: Text,
       treffer:          erkannte Schlüsselwörter (zur Nachvollziehbarkeit)
     }

   Später durch einen KI-Aufruf ersetzen: Die Funktion ist bereits async.
   Sie kann also z. B. per fetch() einen eigenen Server-Endpunkt aufrufen, der
   das Modell anfragt, und dessen Antwort in dasselbe Format bringen. Der
   API-Schlüssel gehört dabei auf den Server, nie in diese Datei. Der Rest der
   Seite (Tabelle, Abgleich, CSV) muss dafür nicht geändert werden.
   ========================================================================== */
async function klassifiziereBeleg(text) {
  const klein = text.toLowerCase();

  // 1. Belegart: Punkte je Regel sammeln, höchste Summe gewinnt.
  let beste = { belegart: 'Unbekannt', punkte: 0, treffer: [] };
  for (const regel of REGELN) {
    let punkte = 0;
    const treffer = [];
    for (const [muster, gewicht] of regel.muster) {
      const gefunden = klein.match(new RegExp(muster.source, 'g'));
      if (gefunden) {
        punkte += gewicht * gefunden.length;
        treffer.push(...gefunden);
      }
    }
    if (punkte > beste.punkte) beste = { belegart: regel.belegart, punkte, treffer };
  }

  // 2. Beträge und Steuersatz aus dem Text lesen.
  const bruttobetrag = erkenneBrutto(text);
  const ustSatz = erkenneUstSatz(text);

  // 3. SKR03-Konto aus der Belegart ableiten (teils mit Unterscheidung).
  const konto = kontoFuer(beste.belegart, klein);

  return {
    belegart: beste.belegart,
    bruttobetrag,
    ustSatz,
    konto,
    kontoBezeichnung: konto ? KONTEN[konto] : 'kein Vorschlag',
    treffer: [...new Set(beste.treffer)]
  };
}

/** Ordnet einer Belegart das passende SKR03-Konto zu. */
function kontoFuer(belegart, klein) {
  switch (belegart) {
    case 'Büromaterial': return '4930';
    case 'Software-Abo': return '4964';
    case 'Tankbeleg': return '4530';
    case 'Bewirtung': return '4650';
    case 'Miete': return '4210';
    case 'Reisekosten':
      // Hotel/Übernachtung und Fahrtkosten werden getrennt gebucht.
      return /übernachtung|hotel|pension|zimmer/.test(klein) ? '4666' : '4663';
    case 'Telefon/Internet':
      // Reine Internetanschlüsse auf 4925, alles mit Telefonie auf 4920.
      return /internet|glasfaser|\bdsl\b|breitband/.test(klein) &&
        !/telefon|mobilfunk|festnetz/.test(klein) ? '4925' : '4920';
    default: return null;
  }
}

/* --------------------------------------------------------------------------
   Abgleich mit der Lösungsdatei
   -------------------------------------------------------------------------- */

function vergleiche(ergebnis, loesung) {
  if (!loesung) return null;
  const felder = {
    belegart: ergebnis.belegart === loesung.belegart,
    bruttobetrag: ergebnis.bruttobetrag !== null &&
      Math.abs(ergebnis.bruttobetrag - loesung.bruttobetrag) < 0.005,
    ustSatz: ergebnis.ustSatz === loesung.ust_satz,
    konto: ergebnis.konto === loesung.skr03_konto
  };
  felder.alle = Object.values(felder).every(Boolean);
  return felder;
}

/* --------------------------------------------------------------------------
   Oberfläche
   -------------------------------------------------------------------------- */

let tabellenZeilen = []; // Ergebnisse für den CSV-Export

function el(tag, klasse, text) {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Erste Zeile des Belegs = Aussteller. */
function aussteller(text) {
  return text.split('\n').find(z => z.trim()) || '–';
}

async function ladeText(pfad) {
  const antwort = await fetch(pfad);
  if (!antwort.ok) throw new Error(pfad + ' (HTTP ' + antwort.status + ')');
  return antwort.text();
}

async function ladeUndKlassifiziere() {
  const quote = document.getElementById('trefferquote');
  const fehler = document.getElementById('fehler');
  let loesungen = [];
  let texte;

  try {
    const dateinamen = Array.from({ length: ANZAHL_BELEGE },
      (_, i) => 'beleg_' + String(i + 1).padStart(2, '0') + '.txt');
    texte = await Promise.all(dateinamen.map(async name => ({ name, text: await ladeText(BELEG_ORDNER + name) })));
    loesungen = JSON.parse(await ladeText(LOESUNGEN_DATEI));
  } catch (e) {
    quote.hidden = true;
    fehler.hidden = false;
    fehler.textContent = 'Die Belege konnten nicht geladen werden: ' + e.message +
      '. Falls die Seite direkt als Datei (file://) geöffnet wurde: Bitte über einen ' +
      'Webserver aufrufen, z. B. lokal mit „python3 -m http.server“ oder auf Netlify.';
    return;
  }

  tabellenZeilen = [];
  for (const { name, text } of texte) {
    const ergebnis = await klassifiziereBeleg(text);
    const loesung = loesungen.find(l => l.dateiname === name);
    tabellenZeilen.push({ name, text, ergebnis, loesung, abgleich: vergleiche(ergebnis, loesung) });
  }

  zeigeTabelle();
  zeigeTrefferquote();
  document.getElementById('csv-export').disabled = false;
}

function zeigeTrefferquote() {
  const quote = document.getElementById('trefferquote');
  const n = tabellenZeilen.length;
  const zaehle = feld => tabellenZeilen.filter(z => z.abgleich && z.abgleich[feld]).length;
  quote.replaceChildren(
    el('span', 'gross', zaehle('alle') + ' von ' + n + ' korrekt'),
    el('span', 'details',
      'Belegart ' + zaehle('belegart') + '/' + n +
      ' · Brutto ' + zaehle('bruttobetrag') + '/' + n +
      ' · USt ' + zaehle('ustSatz') + '/' + n +
      ' · Konto ' + zaehle('konto') + '/' + n)
  );
}

/** Zelle mit erkanntem Wert; bei Abweichung rot mit erwartetem Wert darunter. */
function wertZelle(inhalt, richtig, erwartet, klasse) {
  const td = el('td', klasse || '');
  if (typeof inhalt === 'string') td.textContent = inhalt; else td.append(...inhalt);
  if (richtig === false) {
    td.classList.add('abweichung');
    td.append(el('span', 'erwartet', 'erwartet: ' + erwartet));
  }
  return td;
}

function ustText(satz) {
  return satz === null ? '–' : satz + ' %';
}

function zeigeTabelle() {
  const tbody = document.getElementById('ergebnisse');
  tbody.replaceChildren();

  for (const zeile of tabellenZeilen) {
    const { name, text, ergebnis: e, loesung: l, abgleich: a } = zeile;
    const tr = el('tr');

    const nameZelle = el('td');
    const knopf = el('button', 'dateilink', name);
    knopf.type = 'button';
    knopf.setAttribute('aria-expanded', 'false');
    nameZelle.append(knopf);

    const konto = [el('span', 'konto-nr', e.konto || '–'), el('span', 'konto-name', e.kontoBezeichnung)];
    const status = a
      ? el('span', 'status ' + (a.alle ? 'richtig' : 'falsch'), a.alle ? '✓ richtig' : '✗ falsch')
      : el('span', 'status', 'keine Lösung');

    tr.append(
      nameZelle,
      el('td', '', aussteller(text)),
      wertZelle(e.belegart, a && a.belegart, l && l.belegart),
      wertZelle(formatBetrag(e.bruttobetrag), a && a.bruttobetrag, l && formatBetrag(l.bruttobetrag), 'zahl'),
      wertZelle(ustText(e.ustSatz), a && a.ustSatz, l && ustText(l.ust_satz), 'zahl'),
      wertZelle(konto, a && a.konto, l && l.skr03_konto),
      (() => { const td = el('td'); td.append(status); return td; })()
    );

    // Aufklappbare Detailzeile mit Belegtext und erkannten Schlüsselwörtern
    const detail = el('tr', 'detailzeile');
    detail.hidden = true;
    const td = el('td');
    td.colSpan = 7;
    td.append(
      el('pre', '', text),
      el('p', 'treffer-liste', 'Erkannte Schlüsselwörter: ' + (e.treffer.join(', ') || 'keine'))
    );
    detail.append(td);

    knopf.addEventListener('click', () => {
      detail.hidden = !detail.hidden;
      knopf.setAttribute('aria-expanded', String(!detail.hidden));
    });

    tbody.append(tr, detail);
  }
}

async function klassifiziereEigenen() {
  const text = document.getElementById('eigener-text').value;
  const ausgabe = document.getElementById('eigenes-ergebnis');
  ausgabe.hidden = false;

  if (!text.trim()) {
    ausgabe.replaceChildren(el('p', '', 'Bitte zuerst einen Belegtext einfügen.'));
    return;
  }

  const e = await klassifiziereBeleg(text);
  const dl = el('dl');
  const eintraege = [
    ['Belegart', e.belegart],
    ['Bruttobetrag', formatBetrag(e.bruttobetrag)],
    ['USt-Satz', e.ustSatz === null ? 'nicht erkannt' : e.ustSatz + ' %'],
    ['SKR03-Konto', e.konto ? e.konto + ' – ' + e.kontoBezeichnung : 'kein Vorschlag'],
    ['Schlüsselwörter', e.treffer.join(', ') || 'keine']
  ];
  for (const [begriff, wert] of eintraege) dl.append(el('dt', '', begriff), el('dd', '', wert));
  ausgabe.replaceChildren(dl);
}

/* --------------------------------------------------------------------------
   CSV-Export (Semikolon und Dezimalkomma, damit Excel die Datei direkt öffnet)
   -------------------------------------------------------------------------- */

function csvFeld(wert) {
  const s = wert === null || wert === undefined ? '' : String(wert);
  return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function csvZahl(zahl) {
  return zahl === null || zahl === undefined ? '' : zahl.toFixed(2).replace('.', ',');
}

function exportiereCsv() {
  const kopf = ['Dateiname', 'Aussteller', 'Belegart', 'Bruttobetrag', 'USt-Satz', 'SKR03-Konto',
    'Kontobezeichnung', 'Erwartete Belegart', 'Erwarteter Bruttobetrag', 'Erwarteter USt-Satz',
    'Erwartetes Konto', 'Ergebnis'];
  const zeilen = tabellenZeilen.map(({ name, text, ergebnis: e, loesung: l, abgleich: a }) => [
    name, aussteller(text), e.belegart, csvZahl(e.bruttobetrag), e.ustSatz, e.konto, e.kontoBezeichnung,
    l && l.belegart, l && csvZahl(l.bruttobetrag), l && l.ust_satz, l && l.skr03_konto,
    a ? (a.alle ? 'richtig' : 'falsch') : ''
  ]);
  const csv = [kopf, ...zeilen].map(z => z.map(csvFeld).join(';')).join('\r\n');

  // BOM, damit Excel die Umlaute korrekt als UTF-8 liest
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const link = el('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'belegklassifizierung.csv';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

/* --------------------------------------------------------------------------
   Start
   -------------------------------------------------------------------------- */

if (typeof document !== 'undefined') {
  document.getElementById('csv-export').addEventListener('click', exportiereCsv);
  document.getElementById('eigener-knopf').addEventListener('click', klassifiziereEigenen);
  ladeUndKlassifiziere();
} else if (typeof module !== 'undefined') {
  // Ermöglicht Tests der Klassifizierung mit Node.js
  module.exports = { klassifiziereBeleg, vergleiche };
}
