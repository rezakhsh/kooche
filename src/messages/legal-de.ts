import type { LegalDoc } from './legal-types';

// The binding German versions of the terms of use and the privacy policy (approved Oct 21, 2026 as
// drafts; a lawyer checks them before launch). The Persian versions in fa.ts follow the same
// sections; tests/legal.test.ts keeps the numbering of both in step. Facts (periods, services,
// cookies) come from the code and docs/schema.md, section 14: change them here and in fa.ts
// together with the code.

const terms: LegalDoc = {
  title: 'Nutzungsbedingungen',
  updated: 'Stand: 22. Oktober 2026',
  draft: true,
  intro: [
    'Diese Nutzungsbedingungen regeln die Nutzung von Peydoo (پیدو). Sie liegen auf Deutsch und auf Persisch vor; rechtlich maßgeblich ist diese deutsche Fassung (Ziffer 13.2).',
  ],
  sections: [
    { id: '1', heading: '1. Betreiber und Geltungsbereich', body: [] },
    { id: '1.1', heading: '1.1 Betreiber', body: ['Peydoo wird betrieben von:', { operator: true }] },
    {
      id: '1.2',
      heading: '1.2 Geltungsbereich',
      body: ['Diese Bedingungen gelten für alle, die Peydoo besuchen oder ein Konto anlegen („Nutzer“). Mit dem Anlegen eines Kontos erklären Sie sich mit ihnen einverstanden.'],
    },
    { id: '2', heading: '2. Was Peydoo ist', body: [] },
    {
      id: '2.1',
      heading: '2.1 Leistungen',
      body: [
        'Peydoo ist ein Online-Marktplatz für Kleinanzeigen und Veranstaltungen von Iranerinnen und Iranern in Deutschland und Österreich. Nutzer können Anzeigen und Veranstaltungen veröffentlichen, durchsuchen und merken und über die Nachrichtenfunktion Kontakt aufnehmen. Die Grundfunktionen sind kostenlos. Für kostenpflichtige Zusatzleistungen und Geschäftskonten gilt zusätzlich Ziffer 14.',
      ],
    },
    {
      id: '2.2',
      heading: '2.2 Keine Vertragspartei',
      body: [
        'Peydoo ist nicht Partei der Verträge, die Nutzer miteinander schließen. Wir verkaufen nichts, wickeln keine Zahlungen ab und prüfen weder die angebotenen Waren und Leistungen noch die Identität der Nutzer. Für Angebote, Preise, Übergabe, Versand und Zahlung sind allein die beteiligten Nutzer verantwortlich.',
      ],
    },
    {
      id: '2.3',
      heading: '2.3 Verfügbarkeit',
      body: ['Wir bemühen uns um einen störungsfreien Betrieb, schulden aber keine ununterbrochene Verfügbarkeit. Wartung, Sicherheitsmaßnahmen und Störungen können die Nutzung zeitweise einschränken.'],
    },
    { id: '3', heading: '3. Konto', body: [] },
    {
      id: '3.1',
      heading: '3.1 Wer ein Konto anlegen darf',
      body: ['Ein Konto dürfen nur volljährige (mindestens 18 Jahre alte) natürliche Personen anlegen. Jedes Konto gehört einer Person und darf nicht weitergegeben werden.'],
    },
    {
      id: '3.2',
      heading: '3.2 Anmeldung und Telefonnummer',
      body: [
        'Die Anmeldung erfolgt mit einem Code, den wir an Ihre E-Mail-Adresse senden. Um Anzeigen oder Veranstaltungen zu veröffentlichen und Nachrichten zu senden, müssen Sie eine Telefonnummer bestätigen (über Telegram oder per SMS). Eine Telefonnummer kann nur mit einem Konto verbunden sein.',
      ],
    },
    {
      id: '3.3',
      heading: '3.3 Wahre Angaben',
      body: ['Ihre Angaben müssen zutreffen. Ihr Anzeigename darf nicht irreführen; insbesondere dürfen Sie sich nicht als Peydoo, als Support oder als Mitarbeiter von Peydoo ausgeben.'],
    },
    {
      id: '3.4',
      heading: '3.4 Sicherheit des Kontos',
      body: ['Halten Sie den Zugang zu Ihrem E-Mail-Postfach geheim. Wenn Sie einen Missbrauch vermuten, melden Sie unbekannte Geräte unter „Meine Geräte“ („دستگاه‌های من“) ab und informieren Sie uns.'],
    },
    {
      id: '3.5',
      heading: '3.5 Gewerbliche Anbieter',
      body: [
        'Wer als Unternehmer anbietet, muss das in der Anzeige erkennbar machen und die gesetzlichen Pflichten gegenüber Verbrauchern selbst erfüllen (zum Beispiel Anbieterkennzeichnung, Widerrufsbelehrung und Preisangaben).',
      ],
    },
    { id: '4', heading: '4. Anzeigen und Veranstaltungen', body: [] },
    {
      id: '4.1',
      heading: '4.1 Wahrheitsgemäß und verfügbar',
      body: ['Anzeigen müssen wahr sein und ein tatsächlich verfügbares Angebot beschreiben. Sie dürfen nur Waren und Leistungen anbieten, über die Sie verfügen dürfen.'],
    },
    {
      id: '4.2',
      heading: '4.2 Richtige Kategorie, ein Angebot je Anzeige',
      body: ['Wählen Sie die passende Kategorie und das Land, in dem das Angebot besteht. Jede Anzeige beschreibt ein Angebot. Veröffentlichen Sie dasselbe Angebot nicht mehrfach.'],
    },
    {
      id: '4.3',
      heading: '4.3 Eigene Fotos',
      body: [
        'Verwenden Sie nur Fotos, die Sie selbst aufgenommen haben oder für die Sie die Rechte besitzen, und die das angebotene Stück zeigen. Fotos aus fremden Anzeigen oder aus dem Internet sind nicht erlaubt. Fotos, die bereits ein anderes Konto veröffentlicht hat, erkennen wir automatisch (Ziffer 7.1).',
      ],
    },
    {
      id: '4.4',
      heading: '4.4 Preise',
      body: ['Preise werden in der Währung des Landes der Anzeige angegeben und müssen ernst gemeint sein. Lockpreise, die nicht gelten, sind nicht erlaubt.'],
    },
    {
      id: '4.5',
      heading: '4.5 Keine Diskriminierung',
      body: [
        'Wohnungs- und Stellenanzeigen dürfen niemanden wegen der ethnischen Herkunft, des Geschlechts, der Religion oder Weltanschauung, einer Behinderung, des Alters oder der sexuellen Identität ausschließen oder benachteiligen.',
      ],
    },
    {
      id: '4.6',
      heading: '4.6 Links bei Veranstaltungen',
      body: [
        'Ticket- und Online-Links müssen mit https beginnen und direkt zum Ziel führen. Linkverkürzer und Weiterleitungen, deren Ziel nicht erkennbar ist, sind nicht erlaubt. Online-Links zeigen wir nur angemeldeten Besuchern.',
      ],
    },
    {
      id: '4.7',
      heading: '4.7 Laufzeit',
      body: [
        'Anzeigen laufen 30 Tage und können in den letzten drei Tagen und nach Ablauf verlängert werden. Veranstaltungen enden nach ihrem letzten Termin. Markieren Sie verkaufte Angebote als verkauft oder löschen Sie sie.',
      ],
    },
    { id: '5', heading: '5. Verbotene Waren und Inhalte', body: ['Nicht erlaubt sind Anzeigen, Veranstaltungen und Nachrichten mit folgenden Inhalten:'] },
    {
      id: '5.1',
      heading: '5.1 Rechtswidrige Inhalte',
      body: ['Alles, was gegen geltendes Recht verstößt, insbesondere gegen Straf-, Jugendschutz-, Urheber-, Marken-, Wettbewerbs- oder Datenschutzrecht.'],
    },
    {
      id: '5.2',
      heading: '5.2 Waffen',
      body: ['Schusswaffen, Munition, Sprengstoffe und wesentliche Teile davon.'],
    },
    {
      id: '5.3',
      heading: '5.3 Drogen',
      body: ['Betäubungsmittel, Drogen und neue psychoaktive Stoffe.'],
    },
    {
      id: '5.4',
      heading: '5.4 Geldwechsel und Geldtransfer nach Iran',
      body: [
        'Geldwechsel und Devisenhandel, Geldtransfers nach und aus Iran (auch über Hawala oder Wechselstuben) und alle Angebote, die gegen die Sanktionen der Europäischen Union gegen Iran oder gegen Vorschriften zur Bekämpfung der Geldwäsche verstoßen.',
      ],
    },
    {
      id: '5.5',
      heading: '5.5 Arzneimittel und Tabak',
      body: ['Arzneimittel, Tabak- und Nikotinprodukte.'],
    },
    {
      id: '5.6',
      heading: '5.6 Fälschungen und gestohlene Waren',
      body: ['Gefälschte Markenwaren, gestohlene oder rechtswidrig erlangte Waren sowie gefälschte Dokumente, Zeugnisse und Ausweise.'],
    },
    {
      id: '5.7',
      heading: '5.7 Sexuelle Dienstleistungen, Hass und Gewalt',
      body: ['Sexuelle Dienstleistungen, pornografische Inhalte, Partner- und Heiratsvermittlung sowie Inhalte, die zu Hass oder Gewalt aufrufen, Menschen beleidigen oder bedrohen.'],
    },
    {
      id: '5.8',
      heading: '5.8 Daten anderer Personen',
      body: ['Persönliche Daten, Fotos oder Kontaktangaben anderer Personen ohne deren Einwilligung.'],
    },
    {
      id: '5.9',
      heading: '5.9 Weitere Angebote mit Bezug zu Iran',
      body: ['Immobilien in Iran sowie die Mitnahme von Gepäck, Waren oder Dokumenten nach Iran gegen Entgelt.'],
    },
    { id: '6', heading: '6. Nachrichten und Verhalten', body: [] },
    {
      id: '6.1',
      heading: '6.1 Nachrichten',
      body: [
        'Die Nachrichtenfunktion dient dem Kontakt zu einer Anzeige oder Veranstaltung. Werbung, Massennachrichten, Belästigung, Drohungen und Betrugsversuche sind nicht erlaubt.',
      ],
    },
    {
      id: '6.2',
      heading: '6.2 Automatische Warnhinweise',
      body: [
        'Wir prüfen Nachrichten automatisch auf typische Merkmale von Betrug (Links, Zahlungs- und Anzahlungsforderungen, Bankverbindungen, Telefonnummern und den Wunsch, das Gespräch außerhalb von Peydoo fortzusetzen). Der Empfänger sieht dann einen Warnhinweis. Konten, die jünger als sieben Tage sind, können keine Links und keine Bankverbindungen (IBAN) senden.',
      ],
    },
    {
      id: '6.3',
      heading: '6.3 Blockieren und Melden',
      body: ['Sie können andere Nutzer blockieren und Nachrichten melden. Nachrichten blockierter Nutzer erreichen Sie nicht.'],
    },
    { id: '7', heading: '7. Moderation', body: [] },
    {
      id: '7.1',
      heading: '7.1 Automatische Prüfungen',
      body: [
        'Anzeigen und Veranstaltungen werden sofort veröffentlicht. Nach jeder Veröffentlichung und Änderung prüfen wir sie automatisch, unter anderem auf verbotene Begriffe (Ziffer 5), bereits von anderen Konten verwendete Fotos (Ziffer 4.3) und unzulässige Links (Ziffer 4.6). Eine automatische Prüfung kann eine Anzeige sofort entfernen. Zusätzlich können Inhalte von Menschen geprüft werden.',
      ],
    },
    {
      id: '7.2',
      heading: '7.2 Maßnahmen',
      body: [
        'Bei Verstößen gegen diese Bedingungen oder gegen das Recht können wir:',
        {
          list: [
            'Anzeigen, Veranstaltungen oder Fotos entfernen oder sperren,',
            'Nachrichten ausblenden oder Gespräche schließen,',
            'das Veröffentlichen oder Senden von Nachrichten einschränken,',
            'ein Konto vorübergehend oder dauerhaft sperren.',
          ],
        },
        'Wir wählen eine angemessene Maßnahme und berücksichtigen dabei die Schwere und Häufigkeit des Verstoßes und ob er absichtlich war.',
      ],
    },
    {
      id: '7.3',
      heading: '7.3 Begründung',
      body: [
        'Jede Einschränkung begründen wir (Art. 17 der Verordnung (EU) 2022/2065, „Digital Services Act“): was wir entschieden haben, auf welche Tatsachen wir uns stützen, ob die Entscheidung automatisiert getroffen wurde, gegen welche Ziffer dieser Bedingungen oder welches Gesetz der Inhalt verstößt und welche Rechtsbehelfe Sie haben.',
      ],
    },
    {
      id: '7.4',
      heading: '7.4 Widerspruch',
      body: [
        'Wenn Sie eine Entscheidung für falsch halten, können Sie über die Schaltfläche „Widerspruch“ bei der Entscheidung (unter „Mein Konto“ → „Entscheidungen von Peydoo“) innerhalb von sechs Monaten widersprechen, den Inhalt korrigieren und erneut einreichen oder uns unter der in Ziffer 1.1 genannten E-Mail-Adresse schreiben. Ein Mensch prüft die Entscheidung dann erneut, nach Möglichkeit eine andere Person als beim ersten Mal. Der Rechtsweg zu den Gerichten bleibt Ihnen offen.',
      ],
    },
    {
      id: '7.5',
      heading: '7.5 Missbrauch',
      body: [
        'Wer wiederholt offensichtlich rechtswidrige Inhalte veröffentlicht, kann nach vorheriger Warnung gesperrt werden. Meldungen von Personen, die wiederholt offensichtlich unbegründete Meldungen einreichen, können wir für eine angemessene Zeit nicht mehr bearbeiten.',
      ],
    },
    { id: '8', heading: '8. Rechtswidrige Inhalte melden', body: [] },
    {
      id: '8.1',
      heading: '8.1 Meldungen',
      body: [
        'Jede Person kann uns Inhalte melden, die sie für rechtswidrig oder für einen Verstoß gegen diese Bedingungen hält (Art. 16 Digital Services Act): über die Schaltfläche „Melden“ auf der Seite jeder Anzeige, Veranstaltung, jedes Nutzers und jedes Unternehmens, auch ohne Anmeldung, oder per E-Mail an die in Ziffer 1.1 genannte Adresse. Eine Meldung enthält:',
        {
          list: [
            'die genaue Adresse (URL) des Inhalts,',
            'warum der Inhalt Ihrer Ansicht nach rechtswidrig ist,',
            'Ihren Namen und Ihre E-Mail-Adresse (nicht nötig bei bestimmten Straftaten gegen Kinder),',
            'die Erklärung, dass Ihre Angaben nach bestem Wissen richtig und vollständig sind.',
          ],
        },
        'Wir bestätigen den Eingang per E-Mail, entscheiden zügig und sorgfältig und teilen Ihnen unsere Entscheidung mit. Nachrichten können Sie direkt im Gespräch melden.',
      ],
    },
    {
      id: '8.2',
      heading: '8.2 Kontaktstelle',
      body: [
        'Die in Ziffer 1.1 genannte E-Mail-Adresse ist unsere zentrale Kontaktstelle für Behörden der Mitgliedstaaten, die Europäische Kommission und Nutzer (Art. 11 und 12 Digital Services Act). Sie erreichen uns auf Deutsch, Englisch und Persisch.',
      ],
    },
    { id: '9', heading: '9. Rechte an Inhalten', body: [] },
    {
      id: '9.1',
      heading: '9.1 Nutzungsrecht',
      body: [
        'Die Rechte an Ihren Inhalten bleiben bei Ihnen. Sie räumen uns ein einfaches, unentgeltliches Recht ein, Ihre Anzeigen und Veranstaltungen samt Fotos für die Dauer ihrer Veröffentlichung auf Peydoo und in unseren Kanälen bei Telegram und Instagram zu zeigen, sie dafür technisch anzupassen (zum Beispiel Größe und Format der Fotos) und zu speichern.',
      ],
    },
    {
      id: '9.2',
      heading: '9.2 Rechte Dritter',
      body: ['Sie versichern, dass Sie die nötigen Rechte an Ihren Inhalten haben. Verletzen Sie schuldhaft Rechte Dritter, stellen Sie uns von deren berechtigten Ansprüchen frei.'],
    },
    { id: '10', heading: '10. Haftung', body: [] },
    {
      id: '10.1',
      heading: '10.1 Haftung von Peydoo',
      body: [
        'Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit, bei Verletzung von Leben, Körper oder Gesundheit und nach dem Produkthaftungsgesetz. Bei leichter Fahrlässigkeit haften wir nur für die Verletzung wesentlicher Vertragspflichten, deren Erfüllung die Nutzung von Peydoo erst ermöglicht, und nur für den vorhersehbaren, typischen Schaden.',
      ],
    },
    {
      id: '10.2',
      heading: '10.2 Inhalte der Nutzer',
      body: [
        'Für Inhalte der Nutzer und für Verträge zwischen Nutzern haften wir nicht. Von rechtswidrigen Inhalten, die uns bekannt werden, entfernen oder sperren wir den Zugang zügig.',
      ],
    },
    { id: '11', heading: '11. Ende der Nutzung', body: [] },
    {
      id: '11.1',
      heading: '11.1 Konto löschen',
      body: ['Sie können Ihr Konto jederzeit unter „Mein Konto“ („حساب من“) → „Meine Daten und Konto löschen“ („داده‌های من و حذف حساب“) löschen. Was dann mit Ihren Daten geschieht, steht in der Datenschutzerklärung.'],
    },
    {
      id: '11.2',
      heading: '11.2 Kündigung durch Peydoo',
      body: [
        'Wir können den Nutzungsvertrag mit einer Frist von zwei Wochen kündigen. Bei schweren Verstößen (Ziffer 7) können wir ihn ohne Frist kündigen. Wir teilen Ihnen die Gründe per E-Mail mit.',
      ],
    },
    {
      id: '12',
      heading: '12. Änderungen dieser Bedingungen',
      body: [
        'Wir können diese Bedingungen ändern, wenn es dafür einen sachlichen Grund gibt, etwa neue Funktionen oder geänderte Gesetze. Wir informieren Sie mindestens vier Wochen vorher per E-Mail. Sind Sie nicht einverstanden, können Sie Ihr Konto jederzeit löschen. Änderungen, die Ihre Rechte wesentlich einschränken, gelten nur mit Ihrer ausdrücklichen Zustimmung.',
      ],
    },
    { id: '13', heading: '13. Recht, Sprache und Streitbeilegung', body: [] },
    {
      id: '13.1',
      heading: '13.1 Anwendbares Recht',
      body: [
        'Es gilt das Recht der Bundesrepublik Deutschland. Sind Sie Verbraucher, gilt diese Rechtswahl nur, soweit Ihnen dadurch nicht der Schutz zwingender Vorschriften des Staates entzogen wird, in dem Sie Ihren gewöhnlichen Aufenthalt haben.',
      ],
    },
    {
      id: '13.2',
      heading: '13.2 Sprache',
      body: ['Diese Bedingungen gibt es auf Deutsch und auf Persisch. Bei Abweichungen gilt die deutsche Fassung.'],
    },
    {
      id: '13.3',
      heading: '13.3 Streitbeilegung',
      body: ['Wir sind nicht bereit und nicht verpflichtet, an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.'],
    },
    { id: '14', heading: '14. Kostenpflichtige Leistungen und Geschäftskonten', body: [] },
    {
      id: '14.1',
      heading: '14.1 Private und gewerbliche Anzeigen',
      body: [
        'Private Nutzer veröffentlichen Anzeigen kostenlos. Wer regelmäßig Dienstleistungen gegen Entgelt anbietet, Waren zum Weiterverkauf ankauft oder herstellt oder für ein Unternehmen inseriert, handelt gewerblich und muss ein Geschäftskonto mit vollständigen Angaben zum Anbieter (Impressum) verwenden.',
        'Privat sind höchstens zwei aktive Angebote in den Rubriken Dienstleistungen und Unterricht gleichzeitig möglich. Stellenangebote und Anzeigen in Rubriken für bestimmte Berufe (etwa Steuern und Buchhaltung) sind nur mit einem Geschäftskonto möglich.',
        'Ein Geschäftskonto ohne Abonnement kann bis zu drei aktive Anzeigen gleichzeitig haben. Das Kennzeichen „geprüftes Unternehmen“ vergibt nur Peydoo nach einer Prüfung der Angaben.',
      ],
    },
    {
      id: '14.2',
      heading: '14.2 Leistungen und Preise',
      body: [
        'Wir bieten gegen Entgelt an: das Hochschieben einer Anzeige an den Anfang der Listen, ein Paket aus drei Hochschiebungen innerhalb von sieben Tagen, die Hervorhebung einer Anzeige für sieben Tage und die Hervorhebung einer Veranstaltung bis zu ihrem Ende (höchstens 30 Tage), sowie für Geschäftskonten die Abonnements „Pro“ und „Pro Plus“ mit mehr aktiven Anzeigen, monatlichen Hochschiebungen, Hervorhebungen und Mitarbeiterzugängen.',
        'Es gelten die vor der Buchung angezeigten Preise. Sie sind Endpreise; gemäß § 19 UStG (Kleinunternehmerregelung) wird keine Umsatzsteuer berechnet.',
      ],
    },
    {
      id: '14.3',
      heading: '14.3 Zahlung und Rechnung',
      body: [
        'Die Zahlung wird über Stripe Payments Europe, Limited (Dublin, Irland) abgewickelt, per Karte, Apple Pay, Google Pay, PayPal, EPS oder (bei Abonnements) SEPA-Lastschrift. Die Rechnung erhalten Sie per E-Mail. Die gebuchte Leistung beginnt, sobald Stripe uns die Zahlung bestätigt.',
      ],
    },
    {
      id: '14.4',
      heading: '14.4 Widerrufsrecht für Verbraucher',
      body: [
        'Verbraucher haben bei Verträgen über Dienstleistungen ein Widerrufsrecht von 14 Tagen ab Vertragsschluss. Auf Ihren ausdrücklichen Wunsch beginnen wir mit der Leistung sofort. Sie bestätigen vor der Zahlung, dass Ihnen bekannt ist, dass Ihr Widerrufsrecht mit vollständiger Erbringung der Leistung erlischt (§ 356 Abs. 4 BGB); ein Hochschieben ist mit seiner Ausführung vollständig erbracht.',
        'Bei Leistungen über einen Zeitraum (Hervorhebung) können Sie innerhalb der 14 Tage widerrufen; Sie zahlen dann den Anteil, der bis zum Widerruf erbracht wurde (§ 357a Abs. 2 BGB). Den Widerruf erklären Sie per E-Mail an die Adresse in Ziffer 1.1.',
      ],
    },
    {
      id: '14.5',
      heading: '14.5 Abonnements für Geschäftskonten',
      body: [
        'Abonnements richten sich an Unternehmer. Sie laufen monatlich oder jährlich und verlängern sich jeweils um die gewählte Laufzeit, wenn sie nicht vorher gekündigt werden. Sie können jederzeit zum Ende der laufenden Laufzeit kündigen, Tarif und Zahlungsweise wechseln und Rechnungen abrufen, im Kundenportal von Stripe, das unter „Abonnement und Rechnungen“ erreichbar ist.',
        'Bei kostenlosen Startzeiträumen (Gutscheincode) endet das Abonnement nach deren Ablauf, wenn keine Zahlungsart hinterlegt ist; sonst läuft es zum regulären Preis weiter. Im Abonnement enthaltene Hochschiebungen und Hervorhebungen verfallen, wenn sie nicht genutzt werden.',
      ],
    },
    {
      id: '14.6',
      heading: '14.6 Erstattung und Ende der Leistung',
      body: [
        'Wird eine Anzeige wegen eines Verstoßes gegen diese Bedingungen (Ziffern 5 und 7) entfernt, endet die gebuchte Leistung ohne Erstattung. Gesetzliche Rechte bleiben unberührt. Wird eine Zahlung erstattet oder zurückgebucht, endet die damit bezahlte Leistung.',
      ],
    },
  ],
};

const privacy: LegalDoc = {
  title: 'Datenschutzerklärung',
  updated: 'Stand: 24. Oktober 2026',
  draft: true,
  intro: [
    'Diese Erklärung beschreibt, welche personenbezogenen Daten Peydoo verarbeitet, wozu, wie lange und an wen sie gehen. Sie liegt auf Deutsch und auf Persisch vor; maßgeblich ist diese deutsche Fassung.',
  ],
  sections: [
    {
      id: '1',
      heading: '1. Verantwortlicher',
      body: [
        'Verantwortlich im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:',
        { operator: true },
        'Für Fragen zum Datenschutz schreiben Sie an die oben genannte E-Mail-Adresse. Einen Datenschutzbeauftragten haben wir nicht benannt, weil dafür die gesetzlichen Voraussetzungen nicht vorliegen.',
      ],
    },
    {
      id: '2',
      heading: '2. Das Wichtigste in Kürze',
      body: [
        {
          list: [
            'Kein Tracking, keine Analysedienste, keine Werbung, kein Verkauf von Daten.',
            'Nur technisch notwendige Cookies, deshalb kein Cookie-Banner.',
            'Server und Fotos liegen in der Europäischen Union.',
            'Ihre Daten können Sie jederzeit herunterladen, und Sie können Ihr Konto jederzeit löschen.',
          ],
        },
      ],
    },
    { id: '3', heading: '3. Besuch der Website', body: [] },
    {
      id: '3.1',
      heading: '3.1 Cloudflare und Server',
      body: [
        'Jeder Aufruf läuft über Cloudflare (Ziffer 8), das die Website vor Angriffen schützt und Seiten zwischenspeichert. Dabei werden Ihre IP-Adresse, Zeitpunkt, aufgerufene Adresse, Browser und die verweisende Seite verarbeitet. Unser Server speichert keine Zugriffsprotokolle mit IP-Adressen; technische Fehlerprotokolle werden nach kurzer Zeit überschrieben.',
        'Rechtsgrundlage ist unser berechtigtes Interesse an einer sicheren und schnellen Website (Art. 6 Abs. 1 lit. f DSGVO).',
        'Fehlerberichte: Tritt auf der Website oder auf unseren Servern ein technischer Fehler auf, senden wir einen Bericht darüber an Sentry (Ziffer 8). Er enthält die Fehlermeldung, die Stelle im Programmcode, die Art der Seite, Browser und Betriebssystem, den Zeitpunkt und die Programmversion. IP-Adressen, E-Mail-Adressen, Telefonnummern, Cookies und Nachrichteninhalte entfernen wir auf unserem eigenen Server, bevor der Bericht ihn verlässt; Sentry sieht nur die Adresse unseres Servers. Die Berichte werden nach 30 Tagen gelöscht. Rechtsgrundlage ist unser berechtigtes Interesse an einer fehlerfreien Website (Art. 6 Abs. 1 lit. f DSGVO).',
      ],
    },
    {
      id: '3.2',
      heading: '3.2 Schutz vor Missbrauch',
      body: [
        'Um massenhafte Anfragen zu verhindern, zählen wir Anfragen je IP-Adresse, je Konto und bei der Anmeldung je E-Mail-Adresse. Diese Zähler werden nach höchstens einem Tag automatisch gelöscht (Art. 6 Abs. 1 lit. f DSGVO).',
      ],
    },
    {
      id: '3.3',
      heading: '3.3 Cookies',
      body: [
        'Wir setzen nur Cookies, die für die von Ihnen gewünschten Funktionen unbedingt erforderlich sind (§ 25 Abs. 2 Nr. 2 TDDDG). Eine Einwilligung ist dafür nicht nötig.',
        {
          list: [
            '__Secure-better-auth.session_token: hält Sie angemeldet, 30 Tage.',
            'login_email und login_next: merken sich während der Anmeldung Ihre E-Mail-Adresse und die Seite, zu der Sie zurückkehren, 10 Minuten.',
            'pending_favorite: merkt sich eine Anzeige, die Sie vor der Anmeldung merken wollten, 30 Minuten.',
            'country: das gewählte Land, 1 Jahr.',
            'view: Darstellung als Raster oder Liste, 1 Jahr.',
          ],
        },
      ],
    },
    {
      id: '3.4',
      heading: '3.4 Standort',
      body: [
        'Ihren Standort verwenden wir nur, wenn Sie „In meiner Nähe“ („نزدیک من“) oder „Meinen Standort verwenden“ („استفاده از موقعیت من“) antippen und Ihr Browser es erlaubt. Der Browser rundet die Position vor dem Senden auf ein Raster von etwa 500 Metern. Bei der Suche steht der gerundete Punkt verschlüsselt und zwei Stunden gültig in der Adresse und wird nicht gespeichert. Bei einer Anzeige speichern wir den gerundeten Punkt mit der Anzeige und zeigen ihn als ungefähren Ort.',
      ],
    },
    { id: '4', heading: '4. Ihr Konto', body: [] },
    {
      id: '4.1',
      heading: '4.1 Anmeldung und Geräte',
      body: [
        'Zur Anmeldung verarbeiten wir Ihre E-Mail-Adresse und senden Ihnen einen sechsstelligen Code. Den Code speichern wir nur verschlüsselt (als Hash) und löschen ihn nach der Verwendung, spätestens einen Tag nach Ablauf. Für jede Anmeldung speichern wir eine Sitzung mit IP-Adresse, Browser und Betriebssystem, die Sie unter „Meine Geräte“ („دستگاه‌های من“) sehen und beenden können. Sitzungen gelten 30 Tage und werden 30 Tage nach Ablauf gelöscht.',
        'Rechtsgrundlage ist die Erfüllung des Nutzungsvertrags (Art. 6 Abs. 1 lit. b DSGVO).',
      ],
    },
    {
      id: '4.2',
      heading: '4.2 Telefonnummer',
      body: [
        'Um Spam und Betrug zu verhindern, muss vor dem Veröffentlichen und vor dem Senden von Nachrichten eine Telefonnummer bestätigt werden. Wir speichern die Nummer und die Art der Bestätigung. Bei Bestätigung über Telegram teilen Sie uns Ihre Nummer über unseren Telegram-Bot mit, und wir speichern zusätzlich Ihre Telegram-Nutzerkennung. Bestätigungsversuche löschen wir nach 90 Tagen.',
        'Rechtsgrundlagen: Art. 6 Abs. 1 lit. b und lit. f DSGVO (Schutz der Nutzer vor Betrug).',
      ],
    },
    {
      id: '4.3',
      heading: '4.3 Weitere Angaben',
      body: ['Freiwillig: Ihr Anzeigename, ein gespeicherter Ort (Postleitzahl, Stadt, Stadtteil) für neue Anzeigen und Ihre Einstellungen für Benachrichtigungen.'],
    },
    { id: '5', heading: '5. Anzeigen und Veranstaltungen', body: [] },
    {
      id: '5.1',
      heading: '5.1 Was öffentlich ist',
      body: [
        'Anzeigen und Veranstaltungen sind öffentlich: Titel, Beschreibung, Preis, Fotos, Ort und ungefährer Standort, Ihr Anzeigename, seit wann Sie Mitglied sind und ob Ihre Nummer bestätigt ist. Ihre öffentliche Verkäuferseite zeigt dieselben Angaben und Ihre aktiven Anzeigen. Ihre E-Mail-Adresse zeigen wir nie.',
        'Geschäftskonten: Die Unternehmensseite zeigt die Angaben, die das Unternehmen dafür eingibt, auch Anschrift, E-Mail-Adresse, Telefon und Impressum (§ 5 DDG). Anzeigen eines Unternehmens zeigen das Unternehmen als Anbieter.',
        'Für die Statistik des Anbieters zählen wir, wie oft eine Anzeige aufgerufen wird. Damit ein Besucher nicht mehrfach zählt, speichern wir dafür 30 Minuten lang einen gekürzten Hashwert der IP-Adresse (Art. 6 Abs. 1 lit. f DSGVO).',
      ],
    },
    {
      id: '5.2',
      heading: '5.2 Ihre Telefonnummer',
      body: [
        'Ihre Telefonnummer erscheint nur, wenn Sie das bei einer Anzeige einschalten, und nur für angemeldete Besucher mit bestätigter Nummer, mit einer Begrenzung je Besucher. Jede Anzeige der Nummer protokollieren wir mit Besucher, IP-Adresse und Browser, um Missbrauch nachzuverfolgen; IP-Adresse und Browser löschen wir nach 90 Tagen, den Eintrag nach zwei Jahren.',
      ],
    },
    {
      id: '5.3',
      heading: '5.3 Fotos',
      body: [
        'Fotos werden neu kodiert; dabei entfernen wir alle eingebetteten Daten, auch den Aufnahmeort. Sie liegen bei Cloudflare R2 im EU-Rechtsraum und werden über unseren eigenen Bilddienst ausgeliefert.',
      ],
    },
    {
      id: '5.4',
      heading: '5.4 Unsere Kanäle',
      body: [
        'Öffentliche Anzeigen und Veranstaltungen (Titel, Preis, Ort, Foto, Link) können wir in unseren Kanälen bei Telegram und Instagram veröffentlichen (Ziffer 9 der Nutzungsbedingungen). Das geschieht über n8n (Ziffer 8).',
      ],
    },
    {
      id: '5.5',
      heading: '5.5 Merkliste und Erinnerungen',
      body: [
        'Welche Anzeigen Sie merken, sehen nur Sie; der Anbieter sieht nur die Anzahl. Kurz vor Ablauf einer Anzeige erinnern wir Sie per E-Mail.',
      ],
    },
    {
      id: '6',
      heading: '6. Nachrichten',
      body: [
        'Nachrichten speichern wir auf unseren Servern, damit beide Seiten das Gespräch sehen. Wir prüfen sie automatisch auf typische Betrugsmerkmale und zeigen dem Empfänger dann einen Warnhinweis (Art. 6 Abs. 1 lit. f DSGVO, Schutz vor Betrug). Wir lesen Nachrichten nicht, außer eine Nachricht wurde gemeldet oder es ist zur Aufklärung eines Verstoßes nötig.',
        'Benachrichtigungen über neue Nachrichten senden wir über unseren Telegram-Bot oder per E-Mail. Sie enthalten den Namen des Absenders und den Titel der Anzeige, nie den Text der Nachricht. Sie können sie unter „Benachrichtigungen“ („اعلان پیام‌ها“) abschalten.',
      ],
    },
    {
      id: '7',
      heading: '7. Moderation und Sicherheit',
      body: [
        'Anzeigen prüfen wir automatisch (Ziffer 7 der Nutzungsbedingungen): auf verbotene Begriffe, auf Fotos, die schon ein anderes Konto verwendet hat (über einen Fingerabdruck der Bilddatei), und auf unzulässige Links. Entscheidungen speichern wir mit dem geprüften Inhalt, um sie begründen und überprüfen zu können. Wichtige Vorgänge (zum Beispiel Bestätigung der Telefonnummer, Datenexport, Löschantrag) halten wir in einem Sicherheitsprotokoll fest.',
        'Meldungen: Wenn Sie etwas melden, speichern wir die Meldung und, falls Sie nicht angemeldet sind, Ihren Namen und Ihre E-Mail-Adresse, um sie zu prüfen und Ihnen Eingang und Ergebnis mitzuteilen. Ihren Namen und Ihre E-Mail-Adresse geben wir nicht an die gemeldete Person weiter. Um eine gemeldete Nachricht zu prüfen, sehen unsere Mitarbeitenden auch einige Nachrichten davor und danach in demselben Gespräch.',
        'Rechtsgrundlagen: Art. 6 Abs. 1 lit. c DSGVO (Pflichten aus dem Digital Services Act) und lit. f (Sicherheit, Schutz der Nutzer). Gegen automatische Entscheidungen können Sie Widerspruch einlegen; dann prüft ein Mensch.',
      ],
    },
    {
      id: '8',
      heading: '8. Dienstleister und Empfänger',
      body: [
        'Wir setzen folgende Dienstleister ein. Mit den Auftragsverarbeitern haben wir Verträge nach Art. 28 DSGVO geschlossen.',
        {
          list: [
            'Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen, Deutschland: Server (Rechenzentrum Helsinki, Finnland) und verschlüsselte Sicherungskopien (Falkenstein, Deutschland).',
            'Cloudflare, Inc., 101 Townsend St., San Francisco, CA 94107, USA: Schutz vor Angriffen, Zwischenspeicher, DNS, Speicherung der Fotos (R2, EU-Rechtsraum) und Weiterleitung von E-Mails an unsere Kontaktadresse. Ein Zugriff aus den USA ist nicht auszuschließen; Cloudflare ist nach dem EU-U.S. Data Privacy Framework zertifiziert, zusätzlich gelten Standardvertragsklauseln.',
            'Amazon Web Services EMEA SARL, 38 Avenue John F. Kennedy, L-1855 Luxemburg: Versand von E-Mails (Amazon SES, Region Frankfurt). Für einen möglichen Zugriff aus den USA gelten das EU-U.S. Data Privacy Framework und Standardvertragsklauseln.',
            'Stripe Payments Europe, Limited, 1 Grand Canal Street Lower, Grand Canal Dock, Dublin, D02 H210, Irland: Abwicklung von Zahlungen, Rechnungen und Kundenportal für Abonnements. Stripe erhebt die Zahlungsdaten (etwa Kartennummer oder IBAN) selbst; wir erhalten Name, E-Mail-Adresse, das Land der Rechnungsadresse (bei Abonnements die Rechnungsadresse), Betrag und Zahlungsstatus, nie Karten- oder Kontonummern. Stripe verarbeitet Daten auch in den USA (Stripe, Inc.; EU-U.S. Data Privacy Framework und Standardvertragsklauseln) und ist für die Betrugsprävention und eigene gesetzliche Pflichten selbst verantwortlich. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertrag) und lit. c (Aufbewahrungspflichten).',
            'Functional Software, Inc. (Sentry), 45 Fremont Street, 8th Floor, San Francisco, CA 94105, USA: Fehlerberichte (Ziffer 3.1), gespeichert in der EU-Region (Frankfurt am Main, Deutschland). Ein Zugriff aus den USA ist nicht auszuschließen; Sentry ist nach dem EU-U.S. Data Privacy Framework zertifiziert, zusätzlich gelten Standardvertragsklauseln.',
            'n8n: Software für Benachrichtigungen und die Veröffentlichung in unseren Kanälen, die wir selbst auf einem eigenen Server bei Hetzner in Helsinki betreiben. Sie erhält keine Kontodaten, nur Serverwarnungen und öffentliche Anzeigendaten.',
          ],
        },
        'Telegram (Telegram FZ-LLC, Dubai, Vereinigte Arabische Emirate) ist kein Auftragsverarbeiter, sondern ein eigener Verantwortlicher, den Sie selbst wählen. Wenn Sie Ihre Nummer über Telegram bestätigen oder Benachrichtigungen über Telegram erhalten, übermitteln wir die dafür nötigen Daten an Telegram. Für die Vereinigten Arabischen Emirate gibt es keinen Angemessenheitsbeschluss; die Übermittlung erfolgt, weil Sie sie durch die Wahl von Telegram veranlassen (Art. 49 Abs. 1 lit. b DSGVO). Ohne Telegram erhalten Sie Benachrichtigungen per E-Mail.',
        'Behörden erhalten Daten nur, wenn wir gesetzlich dazu verpflichtet sind.',
      ],
    },
    {
      id: '9',
      heading: '9. Speicherdauer',
      body: [
        {
          list: [
            'Konto: bis Sie es löschen. Danach bleibt nur ein leerer Eintrag ohne persönliche Angaben, damit Verweise gültig bleiben.',
            'Abgelaufene Sitzungen: 30 Tage nach Ablauf.',
            'Anmeldecodes: höchstens einen Tag nach Ablauf.',
            'Versuche zur Bestätigung der Telefonnummer: 90 Tage.',
            'Gelöschte Anzeigen mit Fotos: 12 Monate, länger nur, solange eine Meldung, eine Moderationsentscheidung oder eine Bestellung darauf verweist.',
            'Nachrichten: 90 Tage, nachdem einer der beiden Gesprächspartner sein Konto gelöscht hat; länger nur, solange eine Meldung oder Entscheidung darauf verweist.',
            'Meldungen und Moderationsentscheidungen: zwei Jahre nach der Entscheidung.',
            'Sicherheitsprotokoll: zwei Jahre; IP-Adressen und Browserangaben darin 90 Tage.',
            'Bestellungen, Zahlungen, Abonnements und Rechnungen: zehn Jahre wegen der handels- und steuerrechtlichen Aufbewahrungspflichten (§ 147 AO, § 257 HGB), auch nach Löschung des Kontos.',
            'Fehlerberichte bei Sentry: 30 Tage.',
            'Verschlüsselte Sicherungskopien: bis zu sechs Monate (tägliche für eine Woche, wöchentliche für einen Monat, monatliche für sechs Monate).',
          ],
        },
      ],
    },
    {
      id: '10',
      heading: '10. Ihre Rechte',
      body: [
        'Sie haben das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch gegen Verarbeitungen auf Grundlage von Art. 6 Abs. 1 lit. f (Art. 21). Unter „Mein Konto“ („حساب من“) → „Meine Daten und Konto löschen“ („داده‌های من و حذف حساب“) können Sie Ihre Daten selbst herunterladen und Ihr Konto löschen. Für alles andere schreiben Sie uns.',
        'Sie können sich bei einer Datenschutz-Aufsichtsbehörde beschweren, zum Beispiel bei der für uns zuständigen:',
        { list: ['Berliner Beauftragte für Datenschutz und Informationsfreiheit, Alt-Moabit 59–61, 10555 Berlin, www.datenschutz-berlin.de'] },
      ],
    },
    {
      id: '11',
      heading: '11. Pflicht zur Angabe',
      body: ['Ohne E-Mail-Adresse können Sie kein Konto anlegen, ohne bestätigte Telefonnummer nichts veröffentlichen und keine Nachrichten senden. Zum Stöbern brauchen Sie kein Konto.'],
    },
    {
      id: '12',
      heading: '12. Änderungen',
      body: ['Wenn wir neue Dienste einsetzen oder Funktionen ändern, passen wir diese Erklärung an. Über wesentliche Änderungen informieren wir angemeldete Nutzer per E-Mail.'],
    },
  ],
};

export const legalDe = {
  terms,
  privacy,
  // Shared labels on the German pages
  draft: 'Entwurf – wird vor dem Start anwaltlich geprüft.',
  persianVersion: 'Persische Fassung (فارسی)',
  binding: 'Diese deutsche Fassung ist rechtlich maßgeblich.',
  contents: 'Inhalt',
} as const;

/**
 * German lines in the emails to people who report something (DSA art. 16(4) and (5)): anyone may
 * send a notice, also someone who reads no Persian, so the receipt and the outcome carry a short
 * German version under the Persian text (src/modules/moderation/notices.ts).
 */
export const reportMailDe = {
  receivedSubject: 'Ihre Meldung ist eingegangen',
  received: (what: string) =>
    `Ihre Meldung zu „${what}“ ist bei uns eingegangen (Art. 16 Digital Services Act). Ein Mensch prüft sie; das Ergebnis teilen wir Ihnen per E-Mail mit.`,
  outcomeSubject: 'Ergebnis Ihrer Meldung',
  removed: (what: string) => `Wir haben Ihre Meldung zu „${what}“ geprüft und den Inhalt entfernt bzw. das Konto eingeschränkt.`,
  kept: (what: string) => `Wir haben Ihre Meldung zu „${what}“ geprüft und keinen Verstoß gegen unsere Nutzungsbedingungen oder das Gesetz festgestellt. Der Inhalt bleibt sichtbar.`,
  redress: (email: string) => `Wenn Sie mit der Entscheidung nicht einverstanden sind, schreiben Sie uns an ${email}. Der Rechtsweg zu den Gerichten bleibt Ihnen offen.`,
  message: 'eine Nachricht im Chat',
} as const;
