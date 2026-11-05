import type { LegalDoc } from './legal-types';
import { operator } from './operator';

// The German versions of the terms of use and the privacy policy. Both language versions are
// binding (terms 13.2; rewritten Nov 2, 2026 from docs/legal-review.md; a lawyer checks them).
// The Persian versions in fa.ts follow the same sections; tests/legal.test.ts keeps the numbering
// of both in step. Facts (periods, services, cookies) come from the code and docs/schema.md,
// section 14: change them here and in fa.ts together with the code. Terms 14.4 quotes the
// statutory model withdrawal notice and form (Anlagen 1 and 2 zu Art. 246a § 1 Abs. 2 EGBGB, as
// in force since June 19, 2026): keep their wording.

/** Name, postal address and email of the operator, as the model withdrawal notice asks */
const OPERATOR_LINE = `${operator.name}, ${operator.street}, ${operator.postalCode} ${operator.city}, ${operator.countryDe}${operator.phone ? `, Telefon: ${operator.phone}` : ''}, E-Mail: ${operator.email}`;

const terms: LegalDoc = {
  title: 'Nutzungsbedingungen',
  updated: 'Stand: 4. November 2026',
  draft: false,
  intro: [
    'Diese Nutzungsbedingungen regeln die Nutzung von Peydoo (پیدو). Sie liegen auf Persisch und auf Deutsch vor; beide Fassungen sind verbindlich (Ziffer 13.2).',
  ],
  sections: [
    { id: '1', heading: '1. Betreiber und Geltungsbereich', body: [] },
    { id: '1.1', heading: '1.1 Betreiber', body: ['Peydoo wird betrieben von:', { operator: true }] },
    {
      id: '1.2',
      heading: '1.2 Geltungsbereich',
      body: [
        'Diese Bedingungen gelten für den Vertrag über die Nutzung von Peydoo, der mit dem Anlegen eines Kontos zustande kommt (Ziffer 15.1), und für alle, die ein Konto haben („Nutzer“). Wer Peydoo ohne Konto nutzt, darf Inhalte nur zu privaten Zwecken ansehen; die Ziffern 5 und 8 gelten entsprechend.',
        'Abweichende Bedingungen von Nutzern gelten nicht, auch wenn wir ihnen nicht ausdrücklich widersprechen.',
      ],
    },
    {
      id: '1.3',
      heading: '1.3 Wechsel des Betreibers',
      body: [
        'Wir können Peydoo künftig von einer Gesellschaft betreiben lassen, zum Beispiel einer GmbH oder UG, und diesen Vertrag dann mit allen Rechten und Pflichten auf sie übertragen. Ihre Rechte aus diesem Vertrag bleiben dabei unverändert.',
        'Eine solche Übertragung kündigen wir Ihnen mindestens vier Wochen vorher per E-Mail an und nennen dabei die Gesellschaft mit Namen und Anschrift. Sind Sie damit nicht einverstanden, können Sie den Vertrag bis zum Tag der Übertragung ohne Frist und ohne Kosten beenden, zum Beispiel indem Sie Ihr Konto löschen (Ziffer 11.1); für bereits bezahlte, noch nicht erbrachte Leistungen erstatten wir Ihnen dann den anteiligen Betrag.',
      ],
    },
    { id: '2', heading: '2. Was Peydoo ist', body: [] },
    {
      id: '2.1',
      heading: '2.1 Leistungen',
      body: [
        'Peydoo ist ein persischsprachiger Online-Marktplatz für Anzeigen und Veranstaltungen. Peydoo steht in den Ländern und Städten zur Verfügung, die auf der Website als geöffnet angezeigt werden; für andere Länder und Städte kann man sich auf eine Warteliste setzen. Nutzer können Anzeigen und Veranstaltungen veröffentlichen, durchsuchen und merken und über die Nachrichtenfunktion Kontakt aufnehmen. Die Grundfunktionen sind kostenlos. Für kostenpflichtige Zusatzleistungen und Geschäftskonten gilt zusätzlich Ziffer 14.',
        'Welche Länder, Städte, Kategorien und Funktionen wir anbieten, bestimmen wir; wir können sie erweitern, einschränken oder einstellen. Bereits bezahlte Leistungen erbringen wir in diesem Fall zu Ende oder erstatten den nicht genutzten Teil anteilig.',
        'Sind diesen Bedingungen Länderhinweise beigefügt, gelten sie ergänzend für Nutzer mit gewöhnlichem Aufenthalt in dem jeweiligen Land; bei Widersprüchen gehen sie diesen Bedingungen vor.',
      ],
    },
    {
      id: '2.2',
      heading: '2.2 Keine Vertragspartei, keine Prüfung',
      body: [
        'Peydoo ist nicht Partei der Verträge, die Nutzer miteinander schließen. Wir verkaufen nichts, wickeln keine Zahlungen zwischen Nutzern ab und bieten keinen Käuferschutz. Für Angebote, Preise, Übergabe, Versand und Zahlung sind allein die beteiligten Nutzer verantwortlich.',
        'Außer den in den Ziffern 3.2 und 14.1 beschriebenen Prüfungen (bestätigte Telefonnummer; Nachweis für das Kennzeichen „geprüftes Unternehmen“) prüfen wir weder Angebote noch Nutzer. Diese Prüfungen sind keine Zusicherung über Identität, Zuverlässigkeit oder Leistungen eines Nutzers.',
      ],
    },
    {
      id: '2.3',
      heading: '2.3 Verfügbarkeit',
      body: [
        'Wir bemühen uns um einen störungsfreien Betrieb, schulden aber keine ununterbrochene Verfügbarkeit. Wartung, Sicherheitsmaßnahmen und Störungen können die Nutzung zeitweise einschränken.',
        'Gesetzliche Rechte bei kostenpflichtigen Leistungen bleiben unberührt. Fällt eine bezahlte Hervorhebung durch unser Verschulden mehr als 24 Stunden aus, verlängern wir sie um die Dauer des Ausfalls.',
      ],
    },
    { id: '3', heading: '3. Konto', body: [] },
    {
      id: '3.1',
      heading: '3.1 Wer ein Konto anlegen darf',
      body: [
        'Ein Konto dürfen nur volljährige (mindestens 18 Jahre alte) natürliche Personen anlegen. Jedes Konto gehört einer Person und darf nicht weitergegeben werden.',
        'Ein Geschäftskonto (eine Unternehmensseite) dürfen nur Unternehmer (Ziffer 3.5) anlegen. Wer für ein Unternehmen handelt, versichert, dazu berechtigt zu sein.',
      ],
    },
    {
      id: '3.2',
      heading: '3.2 Anmeldung und Telefonnummer',
      body: [
        'Die Anmeldung erfolgt mit einem Code, den wir an Ihre E-Mail-Adresse senden. Um Anzeigen oder Veranstaltungen zu veröffentlichen und Nachrichten zu senden, müssen Sie eine Telefonnummer bestätigen (über Telegram, WhatsApp oder per SMS). Eine iranische Nummer (+98) kann nur über Telegram bestätigt werden und berechtigt nur zum Senden von Nachrichten, nicht zum Veröffentlichen und nicht zum Anzeigen der Telefonnummern anderer Nutzer. Eine Telefonnummer kann nur mit einem Konto verbunden sein.',
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
      body: [
        'Halten Sie den Zugang zu Ihrem E-Mail-Postfach geheim. Wenn Sie einen Missbrauch vermuten, melden Sie unbekannte Geräte unter „Meine Geräte“ („دستگاه‌های من“) ab und informieren Sie uns.',
        'Für Handlungen über Ihr Konto haften Sie, wenn Sie den Missbrauch zu vertreten haben (etwa weil Sie Anmeldecodes weitergegeben haben).',
      ],
    },
    {
      id: '3.5',
      heading: '3.5 Privat oder als Unternehmer',
      body: [
        'Unternehmer ist, wer in Ausübung seiner gewerblichen oder selbständigen beruflichen Tätigkeit handelt (§ 14 BGB), zum Beispiel wer regelmäßig Dienstleistungen gegen Entgelt anbietet, Waren zum Weiterverkauf ankauft oder herstellt oder für ein Unternehmen inseriert.',
        'Sie geben wahrheitsgemäß an, ob Sie privat oder als Unternehmer anbieten: Unternehmer bieten über ein Geschäftskonto an (Ziffer 14.1), private Nutzer über ihr eigenes Konto. Peydoo zeigt anderen Nutzern diese Angabe bei jeder Anzeige an. Unternehmer erfüllen die gesetzlichen Pflichten gegenüber Verbrauchern selbst (zum Beispiel Anbieterkennzeichnung, Widerrufsbelehrung und Preisangaben).',
      ],
    },
    {
      id: '3.6',
      heading: '3.6 Ein Konto je Person',
      body: [
        'Jede Person darf nur ein Konto haben. Unternehmensseiten verwalten Sie über dieses eine Konto; dafür brauchen Sie kein zweites.',
        'Haben wir ein Konto nach Ziffer 7.6 dauerhaft gesperrt oder den Vertrag nach Ziffer 11.2 aus wichtigem Grund gekündigt, darf die betroffene Person kein neues Konto anlegen und kein Konto eines anderen nutzen. Frühestens zwei Jahre nach der Sperre kann sie uns bitten, das zu überprüfen.',
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
      body: [
        'Wählen Sie die passende Kategorie und das Land, in dem das Angebot besteht. Jede Anzeige beschreibt ein Angebot. Veröffentlichen Sie dasselbe Angebot nicht mehrfach.',
        'Auch wer eine Anzeige löscht und dasselbe Angebot danach neu einstellt, damit es wieder oben in den Listen erscheint, veröffentlicht es mehrfach. Nach oben bringt eine Anzeige das Hochschieben (Ziffer 14.2).',
      ],
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
      body: [
        'Preise geben Sie in der Landeswährung des Landes an, in dem das Angebot besteht (Ziffer 4.2), und sie müssen ernst gemeint sein; Lockpreise sind nicht erlaubt. Unternehmer geben Gesamtpreise einschließlich Umsatzsteuer und aller Preisbestandteile an und erfüllen die Preisangabenvorschriften ihres Landes selbst. Peydoo prüft Preise nicht. Zeigt Peydoo zusätzlich einen umgerechneten Betrag an, ist er unverbindlich.',
      ],
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
    {
      id: '4.8',
      heading: '4.8 Passende Suchbegriffe, keine Werbung für andere Plattformen',
      body: [
        'Titel und Beschreibung handeln nur von Ihrem Angebot. Begriffe, Marken oder Orte, die damit nichts zu tun haben und nur bei mehr Suchen erscheinen sollen, sind nicht erlaubt.',
        'Eine Anzeige muss selbst etwas anbieten oder suchen. Anzeigen, die vor allem Besucher auf andere Websites, Kanäle, Gruppen oder Apps lenken sollen, sind nicht erlaubt. Für Veranstaltungen gilt Ziffer 4.6.',
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
        'Geldwechsel und Devisenhandel, Geldtransfers nach und aus Iran (auch über Hawala oder Wechselstuben) und alle Angebote, die gegen Sanktionen der Europäischen Union oder der Vereinten Nationen (Ziffer 5.10) oder gegen Vorschriften zur Bekämpfung der Geldwäsche verstoßen.',
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
    {
      id: '5.10',
      heading: '5.10 Sanktionslisten und Außenwirtschaftsrecht',
      body: [
        'Angebote von oder zugunsten von Personen, Organisationen oder Einrichtungen, die auf einer Sanktionsliste der Europäischen Union oder der Vereinten Nationen stehen, und Angebote, die gegen Embargo- oder Außenwirtschaftsvorschriften der Europäischen Union oder Deutschlands verstoßen. Solchen Personen, Organisationen und Einrichtungen können wir die Nutzung von Peydoo verweigern oder den Vertrag mit ihnen fristlos kündigen.',
      ],
    },
    {
      id: '5.11',
      heading: '5.11 Kurzzeitvermietung ohne Registrierung',
      body: ['Kurzzeitvermietungen von Wohnraum ohne eine Registrierungsnummer oder Genehmigung, die am Ort der Unterkunft vorgeschrieben ist.'],
    },
    {
      id: '5.12',
      heading: '5.12 Tiere',
      body: [
        'Tiere, die nach dem am Ort geltenden Recht nicht gehalten, abgegeben oder verkauft werden dürfen, insbesondere:',
        {
          list: [
            'Tiere geschützter Arten ohne die vorgeschriebenen Nachweise und Papiere,',
            'Hunde- und Katzenwelpen, die jünger als acht Wochen sind,',
            'Tiere als Gewinn, Preis oder Belohnung (zum Beispiel bei einer Verlosung) und Tiere, die nur verschenkt werden, wenn man etwas anderes kauft oder eine andere Bedingung erfüllt.',
          ],
        },
        'Wer ein Tier anbietet, macht wahre und vollständige Angaben zu Alter, Gesundheit und Impfungen.',
      ],
    },
    {
      id: '5.13',
      heading: '5.13 Eintrittskarten',
      body: [
        'Gefälschte oder nachgemachte Eintrittskarten, Karten, die Sie nicht selbst besitzen (zum Beispiel solche, die Sie erst noch kaufen wollen), und personalisierte Karten, deren Weitergabe der Veranstalter nicht erlaubt.',
      ],
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
    {
      id: '6.4',
      heading: '6.4 Technischer Missbrauch',
      body: [
        'Nicht erlaubt ist:',
        {
          list: [
            'Inhalte oder Daten von Peydoo mit Programmen (zum Beispiel Bots, Scrapern oder Crawlern) automatisch abzurufen, zu kopieren oder zu sammeln, wenn wir es nicht vorher in Textform erlaubt haben; Suchmaschinen dürfen Peydoo so erfassen, wie es unsere robots.txt zulässt,',
            'Telefonnummern, E-Mail-Adressen oder andere Angaben von Nutzern zu sammeln,',
            'Sperren, Grenzen oder andere Schutzmaßnahmen von Peydoo zu umgehen (zum Beispiel nach den Ziffern 3.6, 6.2, 7.5 und 14.1),',
            'Peydoo durch übermäßig viele Anfragen zu belasten oder seinen Betrieb auf andere Weise zu stören,',
            'Schadsoftware, Viren oder andere schädliche Dateien oder Links zu verbreiten,',
            'Spam zu senden, also unerwünschte Werbung, Kettenbriefe oder gleichlautende Nachrichten an viele Nutzer.',
          ],
        },
      ],
    },
    {
      id: '6.5',
      heading: '6.5 Daten anderer Nutzer',
      body: [
        'Angaben, die Sie über Peydoo von anderen Nutzern erhalten (zum Beispiel Namen, Telefonnummern, Adressen und Nachrichten), verwenden Sie nur für den Kontakt und das Geschäft zu der jeweiligen Anzeige oder Veranstaltung. Soweit das Datenschutzrecht für Sie gilt, sind Sie für diese Daten selbst verantwortlich; das gilt besonders für Geschäftskonten.',
      ],
    },
    { id: '7', heading: '7. Moderation', body: [] },
    {
      id: '7.1',
      heading: '7.1 Veröffentlichung und Prüfungen',
      body: [
        'Anzeigen und Veranstaltungen erscheinen in der Regel sofort. Gibt es Anzeichen für einen Verstoß oder Missbrauch, zum Beispiel bei einem sehr neuen Konto oder in einer Kategorie, in der häufig betrogen wird, können wir die Veröffentlichung zurückhalten, bis ein Mensch den Inhalt geprüft hat. Wir prüfen dann so schnell wie möglich; lehnen wir ab, begründen wir das (Ziffer 7.3).',
        'Arten von Waren oder Leistungen, die erfahrungsgemäß oft für Betrug angeboten werden, können wir ganz ausschließen. Wir nehmen sie dann nach Ziffer 12 in Ziffer 5 auf.',
        'Nach jeder Veröffentlichung und Änderung prüfen wir Anzeigen und Veranstaltungen automatisch, unter anderem auf verbotene Begriffe (Ziffer 5), bereits von anderen Konten verwendete Fotos (Ziffer 4.3) und unzulässige Links (Ziffer 4.6). Eine automatische Prüfung kann eine Anzeige sofort entfernen. Zusätzlich können Inhalte von Menschen geprüft werden.',
      ],
    },
    {
      id: '7.2',
      heading: '7.2 Maßnahmen',
      body: [
        'Bei Verstößen gegen das Recht oder gegen diese Bedingungen – auch wenn ein Inhalt nicht rechtswidrig ist, aber gegen diese Bedingungen verstößt – können wir:',
        {
          list: [
            'Sie verwarnen, als mildeste Maßnahme,',
            'Anzeigen, Veranstaltungen oder Fotos entfernen oder sperren,',
            'Nachrichten ausblenden oder Gespräche schließen,',
            'das Veröffentlichen oder Senden von Nachrichten einschränken,',
            'ein Konto vorübergehend oder dauerhaft sperren (Ziffer 7.6).',
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
        'Wenn Sie eine Entscheidung für falsch halten, können Sie über die Schaltfläche „Widerspruch“ bei der Entscheidung (unter „Mein Konto“ → „Entscheidungen von Peydoo“) innerhalb von sechs Monaten widersprechen, den Inhalt korrigieren und erneut einreichen oder uns unter der in Ziffer 1.1 genannten E-Mail-Adresse oder über das Kontaktformular schreiben. Ein Mensch prüft die Entscheidung dann erneut, nach Möglichkeit eine andere Person als beim ersten Mal. Der Rechtsweg zu den Gerichten bleibt Ihnen offen.',
      ],
    },
    {
      id: '7.5',
      heading: '7.5 Missbrauch',
      body: [
        'Wer wiederholt offensichtlich rechtswidrige Inhalte veröffentlicht, kann nach vorheriger Warnung gesperrt werden. Meldungen von Personen, die wiederholt offensichtlich unbegründete Meldungen einreichen, können wir für eine angemessene Zeit nicht mehr bearbeiten. Neue Konten haben in den ersten sieben Tagen engere Grenzen für Veröffentlichungen, Fotos und Nachrichten.',
      ],
    },
    {
      id: '7.6',
      heading: '7.6 Anhörung vor einer dauerhaften Sperre',
      body: [
        'Bevor wir ein Konto dauerhaft sperren, teilen wir Ihnen den Grund mit und geben Ihnen Gelegenheit zur Stellungnahme; danach entscheiden wir erneut. Ist das wegen der Schwere des Verstoßes (zum Beispiel Betrug, Gefahr für Leib oder Leben, Straftaten gegen Kinder) oder zum Schutz anderer Nutzer unzumutbar, sperren wir sofort und holen die Anhörung unverzüglich nach. Über das Entfernen einzelner Inhalte informieren wir Sie spätestens danach mit Begründung (Ziffer 7.3).',
      ],
    },
    { id: '8', heading: '8. Rechtswidrige Inhalte melden', body: [] },
    {
      id: '8.1',
      heading: '8.1 Meldungen',
      body: [
        'Jede Person kann uns Inhalte melden, die sie für rechtswidrig oder für einen Verstoß gegen diese Bedingungen hält (Art. 16 Digital Services Act): über die Schaltfläche „Melden“ auf der Seite jeder Anzeige, Veranstaltung, jedes Nutzers und jedes Unternehmens, auch ohne Anmeldung, über das Kontaktformular oder per E-Mail an die in Ziffer 1.1 genannte Adresse. Eine Meldung enthält:',
        {
          list: [
            'die genaue Adresse (URL) des Inhalts,',
            'warum der Inhalt Ihrer Ansicht nach rechtswidrig ist,',
            'Ihren Namen und Ihre E-Mail-Adresse (nicht nötig bei bestimmten Straftaten gegen Kinder),',
            'die Erklärung, dass Ihre Angaben nach bestem Wissen richtig und vollständig sind.',
          ],
        },
        'Wir bestätigen den Eingang per E-Mail, bearbeiten Meldungen zeitnah, sorgfältig, frei von Willkür und objektiv und teilen Ihnen unsere Entscheidung mit. Nachrichten können Sie direkt im Gespräch melden.',
      ],
    },
    {
      id: '8.2',
      heading: '8.2 Kontaktstellen',
      body: [
        'Kontaktstelle für Nutzer (Art. 12 Digital Services Act) sind die in Ziffer 1.1 genannte E-Mail-Adresse und das Kontaktformular unter peydoo.com/contact.',
        `Kontaktstelle für Behörden der Mitgliedstaaten, die Europäische Kommission und das Europäische Gremium für digitale Dienste (Art. 11 Digital Services Act) ist die E-Mail-Adresse ${operator.authoritiesEmail}. Anfragen von Nutzern, die dort eingehen, bearbeiten wir ebenfalls, aber langsamer.`,
        'Sie erreichen uns auf Deutsch, Englisch und Persisch.',
      ],
    },
    { id: '9', heading: '9. Rechte an Inhalten', body: [] },
    {
      id: '9.1',
      heading: '9.1 Nutzungsrecht',
      body: [
        'Die Rechte an Ihren Inhalten bleiben bei Ihnen. Sie räumen uns ein einfaches, unentgeltliches, räumlich unbeschränktes Recht ein, Ihre Inhalte (Texte, Fotos, Angaben) zu speichern, technisch anzupassen (zum Beispiel Format, Größe, Zuschnitt), auf Peydoo öffentlich zugänglich zu machen, in Linkvorschauen, Suchmaschinen und in Nachrichten an Nutzer (zum Beispiel Suchaufträge, Wochenübersicht) zu zeigen und, wenn Sie dem nicht widersprechen, in unseren eigenen Kanälen bei Telegram und Instagram zur Bewerbung Ihres Angebots und von Peydoo zu veröffentlichen. Dem Veröffentlichen in unseren Kanälen können Sie jederzeit per E-Mail oder über das Kontaktformular widersprechen.',
        'Wir dürfen Dienstleister einsetzen, die Inhalte für uns speichern und ausliefern. Das Recht endet mit der Löschung des Inhalts; Kopien, die wir zur Moderation, als Nachweis oder in Sicherungskopien aufbewahren müssen oder dürfen, löschen wir nach den Fristen der Datenschutzerklärung.',
      ],
    },
    {
      id: '9.2',
      heading: '9.2 Rechte Dritter',
      body: [
        'Sie versichern, dass Sie die nötigen Rechte an Ihren Inhalten haben. Verletzen Sie durch Ihre Inhalte oder Ihre Nutzung von Peydoo schuldhaft Rechte Dritter oder gesetzliche Vorschriften, stellen Sie uns von den daraus folgenden berechtigten Ansprüchen Dritter frei, einschließlich der angemessenen Kosten unserer Rechtsverteidigung in Höhe der gesetzlichen Gebühren. Sie unterstützen uns bei der Abwehr nach Kräften und geben uns die dafür nötigen Informationen.',
      ],
    },
    { id: '10', heading: '10. Haftung', body: [] },
    {
      id: '10.1',
      heading: '10.1 Haftung von Peydoo',
      body: [
        '(1) Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit, bei der Verletzung von Leben, Körper oder Gesundheit, bei arglistigem Verschweigen eines Mangels, aus einer übernommenen Garantie, nach dem Produkthaftungsgesetz und soweit die Haftung sonst gesetzlich zwingend ist.',
        '(2) Verletzen wir leicht fahrlässig eine wesentliche Vertragspflicht, ist unsere Haftung auf den vertragstypischen, bei Vertragsschluss vorhersehbaren Schaden begrenzt. Wesentliche Vertragspflichten sind solche, deren Erfüllung die ordnungsgemäße Durchführung des Vertrags überhaupt erst ermöglicht und auf deren Einhaltung Sie regelmäßig vertrauen dürfen.',
        '(3) Im Übrigen haften wir für leichte Fahrlässigkeit nicht.',
        '(4) Diese Regeln gelten auch für die persönliche Haftung unserer Mitarbeiter, Vertreter und Erfüllungsgehilfen.',
        '(5) Nur gegenüber Unternehmern: Ansprüche nach Absatz 2 verjähren in einem Jahr ab dem gesetzlichen Verjährungsbeginn. Bei Datenverlust haften wir nur für den Aufwand, der bei regelmäßiger Sicherung der Daten durch Sie entstanden wäre.',
        '(6) Bitte sichern Sie Inhalte, die Sie noch brauchen (zum Beispiel Fotos und Texte Ihrer Anzeigen), auch selbst.',
      ],
    },
    {
      id: '10.2',
      heading: '10.2 Inhalte der Nutzer',
      body: [
        'Inhalte der Nutzer sind fremde Inhalte. Wir machen sie uns nicht zu eigen und prüfen sie in der Regel nicht vor der Veröffentlichung (Ausnahme: Ziffer 7.1). Wir haften für sie nur nach den gesetzlichen Vorschriften für Hostingdienste (Art. 6 Digital Services Act); rechtswidrige Inhalte, die uns bekannt werden, entfernen oder sperren wir zügig. Für Verträge zwischen Nutzern gilt Ziffer 2.2.',
      ],
    },
    { id: '11', heading: '11. Ende der Nutzung', body: [] },
    {
      id: '11.1',
      heading: '11.1 Konto löschen',
      body: ['Sie können Ihr Konto jederzeit unter „Mein Konto“ („حساب من“) → „Meine Daten und Konto löschen“ („داده‌های من و حذف حساب“) löschen und damit den Nutzungsvertrag beenden. Was dann mit Ihren Daten geschieht, steht in der Datenschutzerklärung.'],
    },
    {
      id: '11.2',
      heading: '11.2 Kündigung durch Peydoo',
      body: [
        'Wir können den Nutzungsvertrag mit einer Frist von zwei Wochen kündigen, für ein Geschäftskonto mit einer Frist von 30 Tagen; die Kündigung begründen wir per E-Mail. Laufende bezahlte Leistungen erstatten wir dann anteilig.',
        'Das Recht zur fristlosen Kündigung aus wichtigem Grund bleibt unberührt (§ 314 BGB), insbesondere bei schweren Verstößen (Ziffern 5 und 7) und in den Fällen der Ziffer 5.10; Ziffer 7.6 gilt. Auch diese Kündigung begründen wir per E-Mail.',
      ],
    },
    {
      id: '11.3',
      heading: '11.3 Konten ohne Nutzung',
      body: [
        'Haben Sie sich 24 Monate lang nicht angemeldet und laufen für Ihr Konto keine bezahlten Leistungen, können wir Ihr Konto löschen und den Nutzungsvertrag damit beenden. Das kündigen wir Ihnen mindestens 30 Tage vorher per E-Mail an. Melden Sie sich in dieser Zeit an, bleibt Ihr Konto bestehen.',
      ],
    },
    {
      id: '12',
      heading: '12. Änderungen dieser Bedingungen',
      body: [
        '(1) Wir können diese Bedingungen mit Wirkung für die Zukunft ändern, wenn ein sachlicher Grund besteht (zum Beispiel Gesetzes- oder Rechtsprechungsänderungen, neue Funktionen oder Länder, Sicherheit).',
        '(2) Wir teilen Änderungen mindestens vier Wochen vor ihrem Inkrafttreten per E-Mail mit.',
        '(3) Änderungen, die nur neue Funktionen, Länder oder Kategorien betreffen, rein sprachlich sind oder Ihre Rechte und Pflichten nicht zu Ihrem Nachteil verändern, gelten ab dem mitgeteilten Tag.',
        '(4) Andere Änderungen gelten erst, wenn Sie zustimmen; darum bitten wir Sie bei Ihrer nächsten Anmeldung. Stimmen Sie nicht zu, können Sie und wir den Vertrag nach Ziffer 11 beenden; Sie können Ihr Konto jederzeit löschen.',
        '(5) Für Geschäftskonten gilt zusätzlich Art. 3 der Verordnung (EU) 2019/1150.',
      ],
    },
    { id: '13', heading: '13. Recht, Sprache und Streitbeilegung', body: [] },
    {
      id: '13.1',
      heading: '13.1 Anwendbares Recht',
      body: [
        'Es gilt das Recht der Bundesrepublik Deutschland. Sind Sie Verbraucher, gilt diese Rechtswahl nur, soweit Ihnen dadurch nicht der Schutz zwingender Vorschriften des Staates entzogen wird, in dem Sie Ihren gewöhnlichen Aufenthalt haben. Für Verträge mit Unternehmern gilt ausschließlich deutsches Recht.',
      ],
    },
    {
      id: '13.2',
      heading: '13.2 Sprache',
      body: [
        'Diese Bedingungen gibt es auf Persisch und auf Deutsch; beide Fassungen sind verbindlich. Weichen sie voneinander ab, gilt gegenüber Verbrauchern die für sie günstigere Fassung, gegenüber Unternehmern die deutsche Fassung. Vertragssprachen sind Persisch und Deutsch.',
      ],
    },
    {
      id: '13.3',
      heading: '13.3 Streitbeilegung',
      body: ['Wir sind nicht bereit und nicht verpflichtet, an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.'],
    },
    {
      id: '13.4',
      heading: '13.4 Gerichtsstand',
      body: [
        'Haben Sie als Unternehmer keinen allgemeinen Gerichtsstand in Deutschland oder sind Sie und wir Kaufleute, ist Berlin ausschließlicher Gerichtsstand; wir dürfen Sie auch an Ihrem Sitz verklagen. Für Verbraucher gelten die gesetzlichen Gerichtsstände.',
      ],
    },
    { id: '14', heading: '14. Kostenpflichtige Leistungen und Geschäftskonten', body: [] },
    {
      id: '14.1',
      heading: '14.1 Private und gewerbliche Anzeigen',
      body: [
        'Private Nutzer veröffentlichen Anzeigen kostenlos. Unternehmer (Ziffer 3.5) müssen ein Geschäftskonto mit vollständigen Angaben zum Anbieter (Impressum) verwenden.',
        'Private Nutzer können kostenlos veröffentlichen: Waren, Dienstleistungen und Unterricht 100 neue Angebote in 30 Tagen; Autos 2 neue Angebote in 30 Tagen; Motorräder, Nutzfahrzeuge, Boote und Wohnwagen 5; Wohnungen, Häuser und Zimmer 2 aktive und 2 neue Angebote in 30 Tagen; Grundstücke, Garagen und Gewerbeimmobilien 1. Gelöschte Angebote zählen mit; Gesuche sind nicht begrenzt. Stellenangebote sind nur mit einem Geschäftskonto möglich, erlaubnispflichtige Dienstleistungen (Steuern, Rechts- und Einwanderungsberatung, Gesundheit, Immobilienmakler, Finanzen und Versicherungen, Fahrschulen, beglaubigte Übersetzungen) nur mit einem geprüften Geschäftskonto.',
        'Ein Geschäftskonto ohne Abonnement kann bis zu drei aktive Anzeigen gleichzeitig haben. Das Kennzeichen „geprüftes Unternehmen“ vergibt nur Peydoo nach Prüfung eines Nachweises und der Registerangaben. Wirken die privaten Anzeigen eines Nutzers wie eine gewerbliche Tätigkeit, bitten wir ihn, innerhalb von 14 Tagen ein Geschäftskonto anzulegen; danach können neue private Anzeigen in denselben Rubriken abgelehnt werden. Veröffentlichte Anzeigen bleiben bestehen.',
      ],
    },
    {
      id: '14.2',
      heading: '14.2 Leistungen und Preise',
      body: [
        'Wir bieten gegen Entgelt an: das Hochschieben einer Anzeige an den Anfang der Listen, ein Paket aus drei Hochschiebungen innerhalb von sieben Tagen, die Hervorhebung einer Anzeige für sieben Tage und die Hervorhebung einer Veranstaltung bis zu ihrem Ende (höchstens 30 Tage), sowie für Geschäftskonten die Abonnements „Pro“ und „Pro Plus“ mit mehr aktiven Anzeigen, monatlichen Hochschiebungen, Hervorhebungen (nur Pro Plus) und Mitarbeiterzugängen.',
        'Es gelten die vor der Buchung angezeigten Preise. Sie sind Endpreise; gemäß § 19 UStG (Kleinunternehmerregelung) wird keine Umsatzsteuer berechnet.',
      ],
    },
    {
      id: '14.3',
      heading: '14.3 Zahlung und Rechnung',
      body: [
        'Die Zahlung wird über Stripe Payments Europe, Limited (Dublin, Irland) abgewickelt, per Karte, Apple Pay, Google Pay, PayPal, EPS oder (bei Abonnements) SEPA-Lastschrift. Die Rechnung erhalten Sie per E-Mail. Die gebuchte Leistung beginnt, sobald Stripe uns die Zahlung bestätigt.',
        'Preise gelten in Euro. Wählen Sie auf der Zahlungsseite von Stripe die Zahlung in Ihrer Landeswährung, rechnet Stripe zu einem dort angezeigten Kurs einschließlich Umrechnungsentgelt um; maßgeblich ist der vor der Zahlung angezeigte Betrag.',
        'Aus rechtlichen Gründen und nach den Bedingungen unseres Zahlungsdienstleisters können kostenpflichtige Leistungen nicht aus bestimmten Ländern gebucht werden; derzeit betrifft das Iran. Erstattungen und Widerruf bleiben möglich.',
      ],
    },
    {
      id: '14.4',
      heading: '14.4 Widerrufsrecht für Verbraucher',
      body: [
        'Für Verbraucher gilt bei den einmaligen Leistungen aus Ziffer 14.2 (Hochschieben, Hervorhebung) das folgende Widerrufsrecht. Für Abonnements von Geschäftskonten gilt es nicht (Ziffer 14.5).',
        'Widerrufsbelehrung',
        'Widerrufsrecht',
        'Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.',
        'Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.',
        `Um Ihr Widerrufsrecht auszuüben, müssen Sie uns (${OPERATOR_LINE}) mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder eine E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.`,
        'Sie können Ihr Widerrufsrecht auch online unter peydoo.com/my/orders („Meine Käufe“, „خریدهای من“: bei der Bestellung die Schaltfläche „Vertrag widerrufen“, dann „Widerruf bestätigen“) ausüben. Wenn Sie diese Online-Funktion nutzen, übermitteln wir Ihnen auf einem dauerhaften Datenträger (z. B. durch eine E-Mail) unverzüglich eine Eingangsbestätigung mit Informationen zum Inhalt der Widerrufserklärung sowie dem Datum und der Uhrzeit ihres Eingangs.',
        'Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.',
        'Folgen des Widerrufs',
        'Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, einschließlich der Lieferkosten (mit Ausnahme der zusätzlichen Kosten, die sich daraus ergeben, dass Sie eine andere Art der Lieferung als die von uns angebotene, günstigste Standardlieferung gewählt haben), unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.',
        'Haben Sie verlangt, dass die Dienstleistungen während der Widerrufsfrist beginnen soll, so haben Sie uns einen angemessenen Betrag zu zahlen, der dem Anteil der bis zu dem Zeitpunkt, zu dem Sie uns von der Ausübung des Widerrufsrechts hinsichtlich dieses Vertrags unterrichten, bereits erbrachten Dienstleistungen im Vergleich zum Gesamtumfang der im Vertrag vorgesehenen Dienstleistungen entspricht.',
        'Ende der Widerrufsbelehrung',
        'Muster-Widerrufsformular',
        '(Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und senden Sie es zurück.)',
        {
          list: [
            `An ${operator.name}, ${operator.street}, ${operator.postalCode} ${operator.city}, ${operator.countryDe}, E-Mail: ${operator.email}:`,
            'Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der folgenden Waren (*)/die Erbringung der folgenden Dienstleistung (*)',
            'Bestellt am (*)/erhalten am (*)',
            'Name des/der Verbraucher(s)',
            'Anschrift des/der Verbraucher(s)',
            'Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier)',
            'Datum',
          ],
        },
        '(*) Unzutreffendes streichen.',
        'Vorzeitiges Erlöschen und Erstattung: Auf Ihren ausdrücklichen Wunsch beginnen wir mit der Leistung sofort, also vor Ablauf der Widerrufsfrist. Vor der Zahlung stimmen Sie dem zu und bestätigen Ihre Kenntnis davon, dass Ihr Widerrufsrecht mit vollständiger Erbringung der Leistung erlischt (§ 356 Abs. 5 Nr. 2 BGB). Ein einzelnes Hochschieben ist mit seiner Ausführung vollständig erbracht. Widerrufen Sie eine Hervorhebung oder ein Paket, dessen Hochschiebungen noch nicht alle ausgeführt sind, zahlen Sie den Anteil der bis zum Widerruf erbrachten Leistung (§ 357a Abs. 2 BGB); den Rest erstatten wir: die nicht ausgeführten Hochschiebungen und die verbleibende Zeit der Hervorhebung anteilig. Die Schaltfläche „Vertrag widerrufen“ steht während der gesamten Widerrufsfrist bereit.',
      ],
    },
    {
      id: '14.5',
      heading: '14.5 Abonnements für Geschäftskonten',
      body: [
        'Abonnements richten sich ausschließlich an Unternehmer (§ 14 BGB). Vor dem Abschluss bestätigen Sie, dass Sie für Ihr Unternehmen und nicht als Verbraucher buchen; ein Widerrufsrecht für Verbraucher besteht daher nicht. Sie laufen monatlich oder jährlich und verlängern sich jeweils um die gewählte Laufzeit, wenn sie nicht vorher gekündigt werden. Sie können jederzeit zum Ende der laufenden Laufzeit kündigen, Tarif und Zahlungsweise wechseln und Rechnungen abrufen, im Kundenportal von Stripe, das unter „Abonnement und Rechnungen“ erreichbar ist.',
        'Bei kostenlosen Startzeiträumen (Angebot für Gründungsunternehmen, Ziffer 16.2) endet das Abonnement nach deren Ablauf, wenn keine Zahlungsart hinterlegt ist; sonst läuft es zum regulären Preis weiter. Im Abonnement enthaltene Hochschiebungen und Hervorhebungen verfallen, wenn sie nicht genutzt werden.',
      ],
    },
    {
      id: '14.6',
      heading: '14.6 Erstattung und Ende der Leistung',
      body: [
        'Wird eine Anzeige wegen eines Verstoßes gegen diese Bedingungen (Ziffern 5 und 7) entfernt, endet die gebuchte Leistung ohne Erstattung. Gesetzliche Rechte bleiben unberührt. Wird eine Zahlung erstattet oder zurückgebucht, endet die damit bezahlte Leistung.',
      ],
    },
    {
      id: '14.7',
      heading: '14.7 Reihenfolge der Anzeigen',
      body: [
        'Listen zeigen Anzeigen standardmäßig nach Aktualität: oben steht, was zuletzt veröffentlicht oder hochgeschoben wurde. Ein Hochschieben (bezahlt, im Abonnement enthalten oder als Aktionsgeschenk nach Ziffer 16.1) setzt eine Anzeige wieder an den Anfang, als wäre sie neu veröffentlicht; solche Anzeigen sind in den Listen mit „نردبان“ (hochgeschoben) gekennzeichnet.',
        'Hervorgehobene Anzeigen erscheinen zusätzlich in der Reihe „آگهی‌های ویژه“ (hervorgehobene Anzeigen), hervorgehobene Veranstaltungen über der Liste der Veranstaltungen; beide sind mit „ویژه“ (hervorgehoben) gekennzeichnet.',
        'Bei einer Suche mit Suchbegriffen ordnen wir nach Relevanz, also danach, wie gut die Begriffe zu Titel, Beschreibung und Kategorie einer Anzeige passen. Auf Wunsch sortieren Sie nach Preis oder Entfernung und grenzen mit Filtern ein.',
        'Das Abonnement Pro enthält Hochschiebungen, Pro Plus Hochschiebungen und Hervorhebungen. Andere Zahlungen oder Gegenleistungen beeinflussen die Reihenfolge nicht; Anzeigen privater Nutzer und von Geschäftskonten werden gleich behandelt. Eine kurze Erklärung steht unter peydoo.com/help#ranking („ترتیب نمایش آگهی‌ها“), verlinkt aus jeder Liste.',
      ],
    },
    {
      id: '14.8',
      heading: '14.8 Daten bei Geschäftskonten',
      body: [
        'In der Verwaltung ihres Unternehmens sehen Inhaber und Mitglieder Statistiken zu dessen Anzeigen (Aufrufe, wie oft eine Anzeige gemerkt wurde, Gespräche und wie oft die Telefonnummer angezeigt wurde). Nachrichten zu einer Anzeige erhält das Mitglied, das sie veröffentlicht hat. Weitere Daten anderer Nutzer erhalten Geschäftskonten nicht.',
        'Peydoo hat Zugang zu allen Daten, die Geschäftskonten und ihre Kunden bei Peydoo angeben oder die bei der Nutzung entstehen. Wir verwenden sie nur, wie in der Datenschutzerklärung beschrieben, und geben sie an Dritte nur in den dort genannten Fällen weiter. Ihre eigenen Daten können Sie unter „Meine Daten und Konto löschen“ („داده‌های من و حذف حساب“) herunterladen.',
      ],
    },
    {
      id: '14.9',
      heading: '14.9 Änderungen an laufenden bezahlten Leistungen',
      body: [
        'Eine bezahlte Leistung, die noch läuft (zum Beispiel eine Hervorhebung oder ein Abonnement), ändern wir nur aus einem triftigen Grund, etwa wegen neuer rechtlicher Vorgaben, aus Gründen der Sicherheit oder weil wir Peydoo technisch weiterentwickeln. Die Änderung kostet Sie nichts, und wir informieren Sie klar und verständlich darüber.',
        'Wird Ihr Zugang zu der Leistung oder ihr Nutzen für Sie dadurch mehr als nur unerheblich schlechter, teilen wir Ihnen Art und Zeitpunkt der Änderung rechtzeitig vorher per E-Mail mit. Sie können den Vertrag dann innerhalb von 30 Tagen nach der Änderung (oder nach unserer Mitteilung, wenn sie später kommt) kostenlos beenden und erhalten den Betrag für den nicht mehr erbrachten Teil anteilig zurück (§ 327r BGB). Das gilt nicht, wenn Sie die Leistung ohne zusätzliche Kosten unverändert weiter nutzen können.',
      ],
    },
    {
      id: '14.10',
      heading: '14.10 Leistungen gehören zum Konto',
      body: [
        'Gebuchte Leistungen und die in einem Abonnement enthaltenen Hochschiebungen, Hervorhebungen und Mitarbeiterzugänge gehören zu dem Konto oder der Unternehmensseite, für die sie gebucht wurden. Sie können sie weder verkaufen noch auf andere übertragen.',
      ],
    },
    { id: '15', heading: '15. Vertragsschluss und Vertragstext', body: [] },
    {
      id: '15.1',
      heading: '15.1 Nutzungsvertrag',
      body: [
        'Sie geben auf der Anmeldeseite Ihre E-Mail-Adresse ein; dort weisen wir Sie auf diese Bedingungen und die Datenschutzerklärung hin. Mit der Eingabe des Codes, den wir Ihnen per E-Mail senden, legen Sie Ihr Konto an; damit kommt der Nutzungsvertrag zustande. Bis dahin können Sie Ihre Eingaben jederzeit korrigieren oder den Vorgang abbrechen.',
      ],
    },
    {
      id: '15.2',
      heading: '15.2 Kostenpflichtige Leistungen',
      body: [
        'Sie wählen die Leistung auf Peydoo aus (bei einer Anzeige unter „ارتقای آگهی“, bei Abonnements unter „اشتراک و فاکتورها“) und werden zur Zahlungsseite von Stripe weitergeleitet. Dort sehen Sie Leistung und Gesamtpreis. Mit dem Klick auf die Schaltfläche zum Bezahlen schließen Sie den Vertrag verbindlich ab. Bis dahin können Sie Ihre Eingaben auf Peydoo, mit der Zurück-Funktion Ihres Browsers oder auf der Seite von Stripe korrigieren oder den Vorgang ohne Kosten abbrechen. Die Bestellung bestätigen wir per E-Mail.',
      ],
    },
    {
      id: '15.3',
      heading: '15.3 Vertragstext',
      body: [
        'Den Vertragstext, also diese Bedingungen in der bei Vertragsschluss geltenden Fassung, speichern wir. Die geltende Fassung können Sie jederzeit unter peydoo.com/terms (Persisch) und peydoo.com/terms/de (Deutsch) abrufen, speichern und ausdrucken; frühere Fassungen senden wir Ihnen auf Anfrage per E-Mail. Ihre Bestellungen sehen Sie unter „Meine Käufe“ („خریدهای من“), Rechnungen erhalten Sie per E-Mail.',
      ],
    },
    {
      id: '15.4',
      heading: '15.4 Sprachen und Verhaltenskodizes',
      body: ['Vertragssprachen sind Persisch und Deutsch (Ziffer 13.2). Wir haben uns keinen Verhaltenskodizes unterworfen.'],
    },
    { id: '16', heading: '16. Aktionsbedingungen', body: [] },
    {
      id: '16.1',
      heading: '16.1 Hochschieben für frühe Anmeldungen auf der Warteliste',
      body: [
        'Wenn wir eine Stadt eröffnen, erhalten die ersten bestätigten Anmeldungen auf ihrer Warteliste je ein kostenloses Hochschieben: in Städten ab einer Million Einwohnern die ersten 200, ab 300.000 Einwohnern die ersten 100, sonst die ersten 50. Städte, die gemeinsam eröffnen (zum Beispiel Bonn mit Köln), zählen zusammen; maßgeblich ist die Reihenfolge der Bestätigung.',
        'Jede E-Mail-Adresse erhält höchstens eine Belohnung je Stadt, auch wenn die Stadt erneut eröffnet wird. Die Belohnung gehört dem Konto mit derselben bestätigten E-Mail-Adresse und kann vom 3. bis zum 60. Tag nach der Eröffnung für eine eigene aktive Anzeige (keine Veranstaltung) genutzt werden. Sie ist nicht übertragbar und wird nicht in Geld ausgezahlt. Wer sich von der Warteliste austrägt, verliert sie.',
      ],
    },
    {
      id: '16.2',
      heading: '16.2 Angebot für Gründungsunternehmen',
      body: [
        'Peydoo kann geprüften Unternehmen einer Stadt ein Gründungsangebot machen; ein Anspruch darauf besteht nicht. Je Stadt gibt es so viele Plätze, wie Unternehmen für ihre Eröffnung nötig sind (in einer bereits geöffneten Stadt ohne ein solches Ziel 30); Städte, die gemeinsam eröffnen, zählen zusammen.',
        'Voraussetzungen: Ein Inhaber des Unternehmens hat eine bestätigte Telefonnummer aus dem Land des Unternehmens, und kein Inhaber hat bereits einen Gründungsplatz für ein anderes Unternehmen (ein Platz je Person). Wir prüfen das beim Angebot und noch einmal beim Start.',
        'Das Angebot umfasst sechs Monate Pro ohne Kosten (monatliches Abonnement, ohne Angabe einer Zahlungsart) und das Kennzeichen „بنیان‌گذار“ (Gründer) auf der Unternehmensseite, ein Jahr ab deren Erstellung. Hinterlegen Sie keine Zahlungsart, endet das Abonnement nach den sechs Monaten von selbst; hinterlegen Sie eine, läuft es zu dem bei Beginn geltenden Preis weiter (Ziffer 14.5). Wir erinnern Sie 14 und 3 Tage vor dem Ende per E-Mail. Jedes Unternehmen erhält höchstens einen kostenlosen Zeitraum; das Angebot ist nicht übertragbar und wird nicht in Geld ausgezahlt.',
      ],
    },
  ],
};

const privacy: LegalDoc = {
  title: 'Datenschutzerklärung',
  updated: 'Stand: 4. November 2026',
  draft: false,
  intro: [
    'Diese Erklärung beschreibt, welche personenbezogenen Daten Peydoo verarbeitet, wozu, auf welcher Rechtsgrundlage, wie lange und an wen sie gehen. Sie liegt auf Deutsch und auf Persisch vor; beide Fassungen haben denselben Inhalt.',
  ],
  sections: [
    {
      id: '1',
      heading: '1. Verantwortlicher',
      body: [
        'Verantwortlich im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:',
        { operator: true },
        'Für Fragen zum Datenschutz schreiben Sie an die oben genannte E-Mail-Adresse, über das Kontaktformular oder per Post. Einen Datenschutzbeauftragten haben wir nicht benannt, weil dafür die gesetzlichen Voraussetzungen nicht vorliegen.',
      ],
    },
    {
      id: '2',
      heading: '2. Das Wichtigste in Kürze',
      body: [
        {
          list: [
            'Kein Tracking durch Dritte, keine Analysedienste Dritter, keine Werbung, kein Verkauf von Daten. Besucher zählen wir selbst und ohne Cookies (Ziffer 3.5).',
            'Nur Cookies, die für die von Ihnen gewünschten Funktionen nötig sind (Ziffer 3.3), deshalb kein Cookie-Banner.',
            'Server und Fotos liegen in der Europäischen Union.',
            'Ihre Daten können Sie jederzeit herunterladen, und Sie können Ihr Konto jederzeit löschen.',
            'Verarbeitungen auf Grundlage unseres berechtigten Interesses können Sie widersprechen (Ziffer 10.1).',
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
        'Aus der IP-Adresse ermittelt Cloudflare das Land, aus dem die Anfrage kommt. Wir nutzen es, um Ihnen Ihr Land vorzuschlagen und um die für Iran geltenden Regeln anzuwenden (Nutzungsbedingungen Ziffern 3.2 und 14.3); gespeichert wird es nur als Teil der Tagessummen der Besucherzählung (Ziffer 3.5).',
        'Rechtsgrundlage ist unser berechtigtes Interesse an einer sicheren und schnellen Website und an der Einhaltung der für uns geltenden Regeln (Art. 6 Abs. 1 lit. f DSGVO).',
        'Fehlerberichte: Tritt auf der Website oder auf unseren Servern ein technischer Fehler auf, senden wir einen Bericht darüber an Sentry (Ziffer 8). Er enthält die Fehlermeldung, die Stelle im Programmcode, die Art der Seite, Browser und Betriebssystem, den Zeitpunkt und die Programmversion. IP-Adressen, E-Mail-Adressen, Telefonnummern, Cookies und Nachrichteninhalte entfernen wir auf unserem eigenen Server, bevor der Bericht ihn verlässt; Sentry sieht nur die Adresse unseres Servers. Die Berichte werden nach 30 Tagen gelöscht. Rechtsgrundlage ist unser berechtigtes Interesse an einer fehlerfreien Website (Art. 6 Abs. 1 lit. f DSGVO).',
      ],
    },
    {
      id: '3.2',
      heading: '3.2 Schutz vor Missbrauch',
      body: [
        'Um massenhafte Anfragen zu verhindern, zählen wir Anfragen je IP-Adresse, je Konto und bei der Anmeldung und beim Kontaktformular je E-Mail-Adresse; beim Kontaktformular ohne Anmeldung zählen wir außerdem alle Nachrichten einer Stunde zusammen. Diese Zähler werden nach höchstens einem Tag automatisch gelöscht (Art. 6 Abs. 1 lit. f DSGVO).',
        'Bei der Anmeldung, beim Veröffentlichen von Anzeigen und Veranstaltungen, beim Eintrag in eine Warteliste und beim Kontaktformular ohne Anmeldung prüft Cloudflare Turnstile (Ziffer 8), ob ein Mensch die Anfrage stellt. Dazu lädt Ihr Browser ein Programm von Cloudflare (challenges.cloudflare.com), das Ihre IP-Adresse und technische Merkmale von Browser und Gerät (zum Beispiel Browsertyp, Einstellungen und das Verhalten beim Laden der Seite) auswertet; wir erhalten nur das Ergebnis. Rechtsgrundlage ist unser berechtigtes Interesse, Konten und Nutzer vor automatisierten Angriffen und Spam zu schützen (Art. 6 Abs. 1 lit. f DSGVO). Der dafür nötige Zugriff auf Ihr Gerät ist für den von Ihnen gewünschten Dienst unbedingt erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG).',
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
            'theme: helle oder dunkle Darstellung, wenn Sie sie selbst wählen, 1 Jahr.',
            'legal_seen: merkt sich, dass Sie den Hinweis auf eine Änderung der Nutzungsbedingungen oder dieser Erklärung geschlossen haben, 60 Tage.',
            'Nur für Mitarbeiter von Peydoo: view_as (Ansicht der Website wie aus einem anderen Land, 2 Stunden), staff_return (die eigene Anmeldung während eines Einblicks in ein Konto nach Ziffer 7, höchstens 7 Tage) und acting_blocked (Hinweis auf eine gesperrte Änderung, 15 Sekunden).',
          ],
        },
        'Cloudflare setzt auf peydoo.com derzeit keine eigenen Cookies.',
      ],
    },
    {
      id: '3.4',
      heading: '3.4 Standort',
      body: [
        'Ihren Standort verwenden wir nur, wenn Sie „In meiner Nähe“ („نزدیک من“) oder „Meinen Standort verwenden“ („استفاده از موقعیت من“) antippen und Ihr Browser es erlaubt. Der Browser rundet die Position vor dem Senden auf ein Raster von etwa 500 Metern. Bei der Suche steht der gerundete Punkt verschlüsselt und zwei Stunden gültig in der Adresse und wird nicht gespeichert. Bei einer Anzeige speichern wir den gerundeten Punkt mit der Anzeige und zeigen ihn als ungefähren Ort.',
      ],
    },
    {
      id: '3.5',
      heading: '3.5 Besucherzahlen',
      body: [
        'Um zu sehen, wie Peydoo genutzt wird und woher Besucher kommen, zählen wir Seitenaufrufe selbst, ohne Cookies, ohne Speicherung auf Ihrem Gerät und ohne Dienste Dritter (kein Google Analytics). Jede Seite sendet dazu den Pfad, beim ersten Aufruf auch die verweisende Seite und einen etwaigen Werbelink-Code (`?ref=`). Damit eine Person an einem Tag nur einmal zählt, bilden wir aus IP-Adresse und Browserangabe mit einem täglich wechselnden geheimen Schlüssel einen Hashwert; Schlüssel und Hashwerte werden nach drei Tagen gelöscht, die IP-Adresse wird nicht gespeichert. Dauerhaft gespeichert werden nur Tagessummen (Aufrufe und Besucher je Seite, Land, Herkunft und Gerätetyp).',
        'Wenn Sie ein Konto anlegen, speichern wir bei Ihrem Konto, woher Sie an diesem Tag kamen (zum Beispiel eine Suchmaschine oder einer unserer Links), und, falls Sie die freiwillige Frage „Wie haben Sie von Peydoo erfahren?“ beantworten, Ihre Antwort. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse, unser Angebot und seine Bekanntmachung zu verbessern). Sie können dieser Verarbeitung widersprechen (Ziffer 10.1).',
      ],
    },
    {
      id: '3.6',
      heading: '3.6 Wartelisten für Städte',
      body: [
        'Wenn Sie sich für eine Stadt eintragen, die noch nicht geöffnet ist, speichern wir Ihre E-Mail-Adresse, die Stadt, die gewählte Rolle (Suche, private Anzeigen, Unternehmen) und den Zeitpunkt Ihrer Bestätigung und senden eine Bestätigungs-E-Mail; erst mit Ihrer Bestätigung sind Sie eingetragen. Wir nutzen die Adresse nur für die Nachricht über die Eröffnung dieser Stadt und für die Belohnung für frühe Anmeldungen (Nutzungsbedingungen Ziffer 16.1): Gehören Sie zu den ersten Anmeldungen, vermerken wir die Belohnung, ordnen sie dem Konto mit derselben bestätigten E-Mail-Adresse zu und schreiben Ihnen, sobald Sie sie nutzen können. Die Nachricht über die Eröffnung senden wir über Amazon SES oder aus unserem Postfach bei Zoho Mail (Ziffer 8).',
        'Rechtsgrundlage ist Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO). Sie können sie jederzeit mit Wirkung für die Zukunft widerrufen: über den Link zum Austragen in jeder E-Mail oder mit einer Nachricht an uns. Die Rechtmäßigkeit der Verarbeitung bis zum Widerruf bleibt unberührt. Mit dem Austragen löschen wir Ihren Eintrag und eine noch nicht genutzte Belohnung.',
      ],
    },
    {
      id: '3.7',
      heading: '3.7 Kontaktformular und E-Mails an uns',
      body: [
        'Die Kontaktseite (peydoo.com/contact) fragt zuerst, worum es geht. Zu dem gewählten Thema zeigt sie passende Antworten aus unserer Hilfe; erst wenn diese nicht weiterhelfen, öffnet sich das Formular. Wer welches Thema nutzen kann und was danach geschieht:',
        {
          list: [
            '„Ich kann mich nicht anmelden“: ohne Anmeldung. Sie erhalten keine Eingangsbestätigung per E-Mail, nur einen Hinweis auf dem Bildschirm.',
            'Anzeigen, Nachrichten und Unternehmensseiten; Zahlungen, Rechnungen und Pro; Widerspruch gegen eine Entscheidung: nur angemeldet. Ihrer Nachricht fügen wir einen Link zu Ihrem Konto bei.',
            'Rechtswidrige Inhalte melden: auch ohne Anmeldung. Nötig sind ein Link zu dem Inhalt auf Peydoo und Ihre Bestätigung (Häkchen), dass Ihre Angaben richtig und vollständig sind. Sie erhalten eine Eingangsbestätigung per E-Mail (Art. 16 Abs. 4 Digital Services Act), die Ihre Nachricht nicht wiederholt.',
            'Behörden: auch ohne Anmeldung; keine Eingangsbestätigung.',
            'Datenschutz und Sonstiges: auch ohne Anmeldung. Ohne Anmeldung halten wir Ihre Nachricht bis zu 24 Stunden auf unserem Server (im Zwischenspeicher Valkey) und senden Ihnen eine E-Mail mit einem Bestätigungslink. Erst wenn Sie den Link anklicken, geht die Nachricht an uns; bestätigen Sie nicht, wird sie nach 24 Stunden gelöscht. Angemeldet geht die Nachricht sofort an uns.',
          ],
        },
        'Wir verarbeiten dabei das Thema, Ihren Namen und Ihre E-Mail-Adresse, Ihre Nachricht und die Angaben, die das Thema verlangt (zum Beispiel einen Link), sowie, wenn Sie angemeldet sind, einen Link zu Ihrem Konto, sonst Ihre IP-Adresse (zum Schutz vor Missbrauch).',
        'Schutz vor automatisierten Nachrichten (nur ohne Anmeldung): Cloudflare Turnstile (Ziffer 3.2), ein für Menschen unsichtbares Feld, das nur Programme ausfüllen, und eine Mindestzeit für das Ausfüllen des Formulars. Feld und Mindestzeit speichern nichts; von Turnstile erhalten wir nur das Ergebnis. Eine Nachricht darf höchstens zwei Links enthalten. Außerdem begrenzen wir die Zahl der Nachrichten je IP-Adresse, je E-Mail-Adresse und insgesamt je Stunde; dafür speichern wir nur Zähler, die von selbst ablaufen (Ziffer 3.2).',
        'Die Nachricht senden wir über Amazon SES (Ziffer 8) an unser Postfach bei Zoho Mail; der Betreff enthält ein Kürzel für das Thema, damit wir sie richtig zuordnen können. Sind Sie angemeldet, erhalten Sie eine Eingangsbestätigung an die E-Mail-Adresse Ihres Kontos. Außer einer noch nicht bestätigten Nachricht (höchstens 24 Stunden) und den Zählern speichern wir auf den Servern von Peydoo nichts davon.',
        `E-Mails an unsere Adressen (${operator.email} und ${operator.authoritiesEmail}), auch die aus dem Kontaktformular, landen in unserem Postfach bei Zoho Mail (Rechenzentren in der EU), wo wir sie lesen und beantworten (Ziffer 8).`,
        'Zweck ist die Bearbeitung Ihres Anliegens. Rechtsgrundlagen: Art. 6 Abs. 1 lit. b DSGVO, wenn es um Ihren Vertrag mit uns oder dessen Abschluss geht; lit. c bei Meldungen und Anfragen nach dem Digital Services Act und bei Anträgen nach der DSGVO; sonst lit. f (unser berechtigtes Interesse, Anfragen zu beantworten). Bestätigungslink, Zähler und die anderen Schutzmaßnahmen beruhen auf unserem berechtigten Interesse, Spam und Missbrauch abzuwehren (lit. f). Wir löschen die E-Mails, wenn Ihr Anliegen erledigt ist, es sei denn, eine gesetzliche Aufbewahrungspflicht oder ein laufender Rechtsstreit erfordert, sie länger aufzubewahren.',
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
        'Um Spam und Betrug zu verhindern, muss vor dem Veröffentlichen und vor dem Senden von Nachrichten eine Telefonnummer bestätigt werden. Wir speichern die Nummer und die Art der Bestätigung. Bei Bestätigung über Telegram teilen Sie uns Ihre Nummer über unseren Telegram-Bot mit, und wir speichern zusätzlich Ihre Telegram-Nutzerkennung. Bei Bestätigung über WhatsApp senden Sie eine vorbereitete Nachricht mit einem Einmalcode an unsere WhatsApp-Business-Nummer; WhatsApp übermittelt uns dabei Ihre Telefonnummer, und wir antworten mit einer kurzen Bestätigung. Den Code speichern wir nur als Hashwert, den Text Ihrer Nachricht gar nicht. Bestätigungsversuche löschen wir nach 90 Tagen.',
        'Wir nehmen nur Nummern aus den Ländern an, für die Peydoo eingerichtet ist, keine anonymen Telegram-Nummern (+888) und Nummern aus Iran (+98) nur über Telegram und nur zum Senden von Nachrichten: So lässt sich jedes Konto, das veröffentlicht, einem Land zuordnen, und Betrug und Missbrauch werden erschwert. Von einer abgelehnten Nummer speichern wir nur das Land, nicht die Nummer.',
        'Rechtsgrundlagen: Art. 6 Abs. 1 lit. b und lit. f DSGVO (Schutz der Nutzer vor Betrug).',
      ],
    },
    {
      id: '4.3',
      heading: '4.3 Weitere Angaben',
      body: [
        'Freiwillig: Ihr Anzeigename, ein gespeicherter Ort (Postleitzahl, Stadt, Stadtteil) für neue Anzeigen und Ihre Einstellungen für Benachrichtigungen.',
        'Solange Sie angemeldet sind, übermittelt Ihr Browser die Zeitzone Ihres Geräts (z. B. „America/Los_Angeles“). Wir speichern sie bei Ihrem Konto, damit Benachrichtigungen zu Ihrer Ortszeit kommen (Ruhezeit von 22 bis 8 Uhr, tägliche Nachrichten). Sie zeigt nur die Zeitzone, keinen genauen Ort, und wird mit dem Konto gelöscht. Rechtsgrundlage: Erfüllung des Nutzungsvertrags (Art. 6 Abs. 1 lit. b DSGVO).',
      ],
    },
    {
      id: '4.4',
      heading: '4.4 Nur für Erwachsene',
      body: [
        'Peydoo richtet sich an Erwachsene; ein Konto darf nur anlegen, wer mindestens 18 Jahre alt ist (Nutzungsbedingungen Ziffer 3.1). Erfahren wir, dass ein Konto einer jüngeren Person gehört, schließen wir es und löschen ihre Daten, soweit wir sie nicht aus gesetzlichen Gründen aufbewahren müssen (Ziffer 9).',
      ],
    },
    { id: '5', heading: '5. Anzeigen und Veranstaltungen', body: [] },
    {
      id: '5.1',
      heading: '5.1 Was öffentlich ist',
      body: [
        'Anzeigen und Veranstaltungen sind öffentlich: Titel, Beschreibung, Preis, Fotos, Ort und ungefährer Standort, Ihr Anzeigename, seit wann Sie Mitglied sind und ob Ihre Nummer bestätigt ist. Ihre öffentliche Verkäuferseite zeigt dieselben Angaben und Ihre aktiven Anzeigen. Ihre E-Mail-Adresse zeigen wir nie.',
        'Geschäftskonten: Die Unternehmensseite zeigt die Angaben, die das Unternehmen dafür eingibt, auch Anschrift, E-Mail-Adresse, Telefon und Impressum. Anzeigen eines Unternehmens zeigen das Unternehmen als Anbieter (Art. 6 Abs. 1 lit. b und c DSGVO in Verbindung mit § 5 DDG).',
        'Prüfung von Unternehmen: Den Nachweis, den der Inhaber für das Kennzeichen „geprüft“ hochlädt (Gewerbeanmeldung, Registerauszug oder Erlaubnis), speichern wir nicht öffentlich; nur die entscheidenden Mitarbeiter sehen ihn (jeder Abruf wird protokolliert), und wir löschen ihn sieben Tage nach der Entscheidung. Eine angegebene EU-Umsatzsteuer-Identifikationsnummer prüfen wir über das VIES-System der Europäischen Kommission und speichern nur das Ergebnis (gültig oder nicht, eingetragener Name) (Art. 6 Abs. 1 lit. c und f DSGVO).',
        'Privat oder gewerblich: Wirken die privaten Anzeigen eines Kontos wie eine regelmäßige Tätigkeit (dieselbe Ware mehrfach, gewerbliche Begriffe, ein firmenähnlicher Name), markiert Peydoo das Konto automatisch zur Prüfung durch Mitarbeiter. Entschieden wird nicht automatisch; wir fragen zuerst nach (Art. 6 Abs. 1 lit. f DSGVO).',
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
        'Wir planen, öffentliche Anzeigen und Veranstaltungen (Titel, Preis, Ort, Foto, Link) künftig auch in unseren Kanälen bei Telegram und Instagram zu veröffentlichen (Ziffer 9.1 der Nutzungsbedingungen). Bevor wir damit beginnen, passen wir diese Erklärung an und nennen dann die Anbieter und wie Sie widersprechen können.',
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
      id: '5.6',
      heading: '5.6 Abgleich mit Sanktionslisten',
      body: [
        'Bei der Prüfung bestimmter Unternehmen (zum Beispiel Finanz-, Rechts- und Immobiliendienste sowie Unternehmen aus bestimmten Ländern) gleichen wir Name und Anschrift des Unternehmens und seiner Inhaber mit den Sanktionslisten der Europäischen Union und der Vereinten Nationen ab (Art. 6 Abs. 1 lit. c DSGVO in Verbindung mit Art. 23 der Verordnung (EU) Nr. 267/2012 und vergleichbaren Vorschriften; lit. f). Das Ergebnis speichern wir mit der Prüfung des Unternehmens.',
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
      id: '6.1',
      heading: '6.1 Daten, die Sie von anderen Nutzern erhalten',
      body: [
        'Erfahren Sie über Peydoo Daten anderer Nutzer, zum Beispiel aus Nachrichten oder durch eine angezeigte Telefonnummer, sind Sie für deren weitere Verwendung selbst verantwortlich, soweit das Datenschutzrecht für Sie gilt. Verwenden Sie diese Daten nur für den Kontakt zu der jeweiligen Anzeige oder Veranstaltung (Nutzungsbedingungen Ziffer 6.5).',
      ],
    },
    {
      id: '7',
      heading: '7. Moderation und Sicherheit',
      body: [
        'Anzeigen prüfen wir automatisch (Ziffer 7 der Nutzungsbedingungen): auf verbotene Begriffe, auf Fotos, die schon ein anderes Konto verwendet hat (über einen Fingerabdruck der Bilddatei), und auf unzulässige Links. Entscheidungen speichern wir mit dem geprüften Inhalt, um sie begründen und überprüfen zu können. Wichtige Vorgänge (zum Beispiel Bestätigung der Telefonnummer, Datenexport, Löschantrag) halten wir in einem Sicherheitsprotokoll fest.',
        'Meldungen: Wenn Sie etwas melden, speichern wir die Meldung und, falls Sie nicht angemeldet sind, Ihren Namen und Ihre E-Mail-Adresse, um sie zu prüfen und Ihnen Eingang und Ergebnis mitzuteilen. Ihren Namen und Ihre E-Mail-Adresse geben wir nicht an die gemeldete Person weiter. Um eine gemeldete Nachricht zu prüfen, sehen unsere Mitarbeitenden auch einige Nachrichten davor und danach in demselben Gespräch.',
        'Einblick in Ihr Konto: Um Ihnen zu helfen oder eine Meldung zu prüfen, kann der Betreiber Ihr Konto so ansehen, wie Sie es sehen: nur mit Zwei-Faktor-Bestätigung und schriftlicher Begründung, höchstens 30 Minuten am Stück, und jeder Einblick wird protokolliert. Dabei wird nichts geändert. Etwas für Sie geändert wird nur auf Ihre Bitte oder wenn es zur Erfüllung einer rechtlichen Pflicht nötig ist; auch das wird protokolliert, und Sie erhalten danach eine E-Mail.',
        'Gesperrte Konten: Löscht eine Person ihr Konto, während es wegen eines Verstoßes gesperrt ist, speichern wir einen verschlüsselten Fingerabdruck (Hashwert mit geheimem Schlüssel, also pseudonymisiert) ihrer Telefonnummer und ihres Telegram-Kontos, nicht die Nummer selbst. So kann dieselbe Nummer kein neues Konto bestätigen. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (Schutz der Nutzer vor Betrug und Missbrauch).',
        'Rechtsgrundlagen: Art. 6 Abs. 1 lit. c DSGVO (Pflichten aus dem Digital Services Act) und lit. f (Sicherheit, Schutz der Nutzer, Hilfe bei Ihren Anliegen). Zu automatischen Entscheidungen siehe Ziffer 7.1.',
      ],
    },
    {
      id: '7.1',
      heading: '7.1 Automatisierte Entscheidungen',
      body: [
        'Einige Entscheidungen treffen unsere Systeme automatisch, ohne dass ein Mensch sie vorher prüft:',
        {
          list: [
            'Eine Anzeige oder Veranstaltung wird nach dem Veröffentlichen oder Ändern sofort entfernt, wenn sie verbotene Begriffe, ein Foto, das schon ein anderes Konto verwendet hat, oder unzulässige Links wie Linkverkürzer enthält (Nutzungsbedingungen Ziffern 5, 4.3 und 4.6).',
            'Konten, die jünger als sieben Tage sind, können nur begrenzt veröffentlichen und Fotos hochladen und keine Links und Bankverbindungen in Nachrichten senden.',
            'Telefonnummern aus nicht unterstützten Ländern werden abgelehnt (Ziffer 4.2). Mit einer Nummer aus einer anderen Weltregion als das Land der Anzeige lassen sich nur bestimmte Anzeigen veröffentlichen (zum Beispiel Gesuche und Online-Dienstleistungen), und in der ersten Woche ist nur eine Anzeige außerhalb des Landes der Nummer möglich.',
            'Kommt eine Anfrage nach dem von Cloudflare ermittelten Land aus Iran (Ziffer 3.1), sind Zahlungen nicht möglich, und die Bestätigung über WhatsApp wird nicht angeboten. Ein Konto mit einer iranischen Nummer (+98) kann Nachrichten senden, aber nichts veröffentlichen (Ziffer 4.2).',
            'Nachrichten mit typischen Betrugsmerkmalen erhalten beim Empfänger einen Warnhinweis (Ziffer 6).',
          ],
        },
        'Diese Regeln gelten für alle gleich. Sie schützen vor Betrug, Spam und rechtswidrigen Inhalten und dienen der Erfüllung unserer rechtlichen Pflichten (Art. 6 Abs. 1 lit. b, c und f DSGVO). Soweit eine solche Entscheidung Sie erheblich beeinträchtigt, ist sie für den Nutzungsvertrag erforderlich (Art. 22 Abs. 2 lit. a DSGVO).',
        'Sie können jede automatische Entscheidung anfechten: mit der Schaltfläche „Widerspruch“ bei der Entscheidung (Nutzungsbedingungen Ziffer 7.4), über das Kontaktformular oder per E-Mail. Dann prüft ein Mensch die Entscheidung erneut, und Sie können Ihren Standpunkt darlegen.',
      ],
    },
    {
      id: '8',
      heading: '8. Dienstleister und Empfänger',
      body: [
        'Wir setzen folgende Dienstleister ein. Mit den Auftragsverarbeitern unter ihnen haben wir Verträge nach Art. 28 DSGVO geschlossen.',
        {
          list: [
            'Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen, Deutschland: Server (Rechenzentrum Nürnberg, Deutschland) und verschlüsselte Sicherungskopien (Falkenstein, Deutschland).',
            'Cloudflare, Inc., 101 Townsend St., San Francisco, CA 94107, USA: Schutz vor Angriffen, die Prüfung gegen automatisierte Zugriffe (Turnstile, Ziffer 3.2), Zwischenspeicher, DNS, Ermittlung des Landes einer Anfrage (Ziffer 3.1) und Speicherung der Fotos (R2, EU-Rechtsraum). Ein Zugriff aus den USA ist nicht auszuschließen; Cloudflare ist nach dem EU-U.S. Data Privacy Framework zertifiziert, zusätzlich gelten Standardvertragsklauseln.',
            'OpenStreetMap Foundation, St John’s Innovation Centre, Cowley Road, Cambridge, CB4 0WS, Vereinigtes Königreich: Suche der Kartenposition zu einer Geschäfts- oder Veranstaltungsadresse (Nominatim), einmal beim Speichern; übermittelt wird nur die Adresse. Für das Vereinigte Königreich gilt ein Angemessenheitsbeschluss der EU-Kommission.',
            'Amazon Web Services EMEA SARL, 38 Avenue John F. Kennedy, L-1855 Luxemburg: Versand von E-Mails (Amazon SES, Region Frankfurt), auch der Nachrichten aus dem Kontaktformular und der Bestätigungslinks dafür (Ziffer 3.7). Für einen möglichen Zugriff aus den USA gelten das EU-U.S. Data Privacy Framework und Standardvertragsklauseln.',
            'Zoho Corporation B.V., Beneluxlaan 4B, 3527 HT Utrecht, Niederlande: unser E-Mail-Postfach (Zoho Mail, Rechenzentren in der EU) für E-Mails an unsere Adressen (Ziffer 3.7), Nachrichten aus dem Kontaktformular und unsere Antworten. Ein Zugriff durch Zoho Corporation Pvt. Ltd. (Indien) als Unterauftragsverarbeiter, etwa für Betrieb und Support, ist nicht auszuschließen; dafür gelten Standardvertragsklauseln (Art. 46 Abs. 2 lit. c DSGVO).',
            'Stripe Payments Europe, Limited, 1 Grand Canal Street Lower, Grand Canal Dock, Dublin, D02 H210, Irland: Abwicklung von Zahlungen, Rechnungen und Kundenportal für Abonnements. Stripe erhebt die Zahlungsdaten (etwa Kartennummer oder IBAN) selbst; wir erhalten Name, E-Mail-Adresse, das Land der Rechnungsadresse (bei Abonnements die Rechnungsadresse), Betrag und Zahlungsstatus, nie Karten- oder Kontonummern. Stripe verarbeitet Daten auch in den USA (Stripe, Inc.; EU-U.S. Data Privacy Framework und Standardvertragsklauseln) und ist für die Betrugsprävention und eigene gesetzliche Pflichten selbst verantwortlich. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertrag) und lit. c (Aufbewahrungspflichten).',
            'Functional Software, Inc. (Sentry), 45 Fremont Street, 8th Floor, San Francisco, CA 94105, USA: Fehlerberichte (Ziffer 3.1), gespeichert in der EU-Region (Frankfurt am Main, Deutschland). Ein Zugriff aus den USA ist nicht auszuschließen; Sentry ist nach dem EU-U.S. Data Privacy Framework zertifiziert, zusätzlich gelten Standardvertragsklauseln.',
            'WhatsApp Ireland Limited, Merrion Road, Dublin 4, D04 X2K5, Irland (Unternehmensgruppe Meta): die WhatsApp-Business-Plattform, über die wir Ihre Nachricht zur Bestätigung der Telefonnummer empfangen und beantworten (Ziffer 4.2). Meta speichert diese Nachrichten höchstens 30 Tage. Eine Übermittlung an WhatsApp LLC und Meta Platforms, Inc. in den USA ist möglich; sie stützt sich auf den Angemessenheitsbeschluss der EU-Kommission zum EU-US Data Privacy Framework, nach dem Meta zertifiziert ist. Ihre eigene Nutzung von WhatsApp richtet sich nach den Bedingungen und der Datenschutzerklärung von WhatsApp.',
            'n8n: Software für Benachrichtigungen, die wir selbst auf einem eigenen Server bei Hetzner in Helsinki betreiben. Sie erhält keine Kontodaten; Serverwarnungen und Hinweise auf neue Meldungen (nur Anzahlen, ohne Namen oder Inhalte) sendet sie an den Telegram-Zugang des Betreibers.',
          ],
        },
        'Telegram (Telegram Messenger Inc., außerhalb des Europäischen Wirtschaftsraums; zur Unternehmensgruppe gehören Gesellschaften auf den Britischen Jungferninseln und in Dubai; Vertreter in der EU nach Art. 27 DSGVO: European Data Protection Office (EDPO), Avenue Huart Hamoir 71, 1030 Brüssel, Belgien) ist kein Auftragsverarbeiter, sondern ein eigener Verantwortlicher, den Sie selbst wählen und der die Daten nach seiner eigenen Datenschutzerklärung verarbeitet. Wenn Sie Ihre Nummer über Telegram bestätigen oder Benachrichtigungen über Telegram erhalten, übermitteln wir die dafür nötigen Daten an Telegram. Für Telegram gibt es weder einen Angemessenheitsbeschluss der EU-Kommission noch haben wir Garantien nach Art. 46 DSGVO vereinbart; Behörden außerhalb der EU könnten auf die Daten zugreifen, und Ihre Rechte lassen sich dort möglicherweise schwerer durchsetzen. Die Übermittlung erfolgt, weil Sie Telegram selbst wählen und sie für die von Ihnen gewünschte Leistung nötig ist (Art. 49 Abs. 1 lit. b DSGVO). Benachrichtigungen erhalten Sie ohne Telegram per E-Mail.',
        'Links zu Karten: Tippen Sie bei einem Unternehmen oder einer Veranstaltung auf „مسیریابی“ (Route) oder öffnen Sie die Karte, verlassen Sie Peydoo; dann gilt die Datenschutzerklärung von Google bzw. von OpenStreetMap.',
        'Behörden und Gerichte erhalten Daten nur, wenn wir gesetzlich dazu verpflichtet sind (Art. 6 Abs. 1 lit. c DSGVO). Erfahren wir von Informationen, die den Verdacht einer Straftat begründen, die eine Gefahr für das Leben oder die Sicherheit von Personen darstellt, informieren wir die zuständigen Behörden (Art. 18 Digital Services Act). Wer durch rechtswidrige Inhalte in seinen Rechten verletzt ist, kann nach einer gerichtlichen Anordnung Auskunft über Bestandsdaten erhalten (§ 21 TDDDG).',
      ],
    },
    {
      id: '9',
      heading: '9. Speicherdauer',
      body: [
        {
          list: [
            'Konto: bis Sie es löschen. Haben Sie sich 24 Monate lang nicht angemeldet und laufen keine bezahlten Leistungen, können wir es nach einer Ankündigung per E-Mail mindestens 30 Tage vorher ebenfalls löschen (Nutzungsbedingungen Ziffer 11.3). Danach bleibt nur ein leerer Eintrag ohne persönliche Angaben, damit Verweise gültig bleiben.',
            'Woher Sie bei der Anmeldung kamen und Ihre Antwort auf „Wie haben Sie von Peydoo erfahren?“: mit dem Konto; beim Löschen des Kontos entfernt.',
            'Abgelaufene Sitzungen: 30 Tage nach Ablauf.',
            'Anmeldecodes: höchstens einen Tag nach Ablauf.',
            'Versuche zur Bestätigung der Telefonnummer: 90 Tage.',
            'Fingerabdrücke von Telefonnummern und Telegram-Konten gesperrter Personen, die ihr Konto gelöscht haben (Ziffer 7): zwei Jahre.',
            'Gelöschte Anzeigen mit Fotos: 12 Monate, länger nur, solange eine Meldung, eine Moderationsentscheidung oder eine Bestellung darauf verweist.',
            'Nachrichten: 90 Tage, nachdem einer der beiden Gesprächspartner sein Konto gelöscht hat; länger nur, solange eine Meldung oder Entscheidung darauf verweist.',
            'Unterhaltungen zu einer gelöschten Anzeige: mit der Anzeige, 12 Monate nach ihrer Löschung.',
            'E-Mail-Adressen auf der Warteliste einer Stadt und die Belohnung für frühe Anmeldungen: unbestätigt 30 Tage; bestätigt bis 90 Tage nach der Eröffnung der Stadt oder bis Sie sich austragen.',
            'Hashwerte und Tagesschlüssel der Besucherzählung: drei Tage; die Tagessummen enthalten keine personenbezogenen Daten.',
            'Kontaktformular und E-Mails an uns: bis Ihr Anliegen erledigt ist; eine Nachricht ohne Anmeldung, die Sie nicht bestätigen: 24 Stunden (Ziffer 3.7).',
            'Meldungen und Moderationsentscheidungen: zwei Jahre nach der Entscheidung.',
            'Sicherheitsprotokoll: zwei Jahre; IP-Adressen und Browserangaben darin 90 Tage.',
            'Bestellungen, Zahlungen und Abonnements als Aufzeichnungen der Buchführung: zehn Jahre; Rechnungen und andere Buchungsbelege: acht Jahre (§ 147 AO, § 14b UStG), jeweils ab dem Ende des Kalenderjahres und auch nach Löschung des Kontos.',
            'Fehlerberichte bei Sentry: 30 Tage.',
            'Verbindungsdaten bei Cloudflare (Ziffer 3.1): nach den Löschfristen von Cloudflare; wir selbst speichern keine Zugriffsprotokolle mit IP-Adressen.',
            'Verschlüsselte Sicherungskopien: bis zu sechs Monate (tägliche für eine Woche, wöchentliche für einen Monat, monatliche für sechs Monate).',
          ],
        },
      ],
    },
    {
      id: '10',
      heading: '10. Ihre Rechte',
      body: [
        'Sie haben das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21, Ziffer 10.1) sowie das Recht, nicht einer ausschließlich automatisierten Entscheidung unterworfen zu werden, die Ihnen gegenüber rechtliche Wirkung entfaltet oder Sie erheblich beeinträchtigt, ohne dass ein Mensch sie auf Ihren Wunsch überprüft (Art. 22, Ziffer 7.1). Unter „Mein Konto“ („حساب من“) → „Meine Daten und Konto löschen“ („داده‌های من و حذف حساب“) können Sie Ihre Daten selbst herunterladen und Ihr Konto löschen. Für alles andere schreiben Sie uns.',
        'Sie können sich bei einer Datenschutz-Aufsichtsbehörde beschweren (Art. 77 DSGVO), zum Beispiel bei der für uns zuständigen:',
        { list: ['Berliner Beauftragte für Datenschutz und Informationsfreiheit, Alt-Moabit 59–61, 10555 Berlin, www.datenschutz-berlin.de'] },
      ],
    },
    {
      id: '10.1',
      heading: '10.1 Widerspruchsrecht nach Art. 21 DSGVO',
      body: [
        'Sie haben das Recht, aus Gründen, die sich aus Ihrer besonderen Situation ergeben, jederzeit gegen die Verarbeitung Sie betreffender personenbezogener Daten Widerspruch einzulegen, die auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse) erfolgt; das gilt auch für ein darauf gestütztes Profiling. Wir verarbeiten diese Daten dann nicht mehr, es sei denn, wir können zwingende schutzwürdige Gründe für die Verarbeitung nachweisen, die Ihre Interessen, Rechte und Freiheiten überwiegen, oder die Verarbeitung dient der Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen.',
        'Den Widerspruch können Sie formlos an die E-Mail-Adresse in Ziffer 1 oder über das Kontaktformular richten.',
      ],
    },
    {
      id: '10.2',
      heading: '10.2 Widerruf einer Einwilligung',
      body: [
        'Beruht eine Verarbeitung auf Ihrer Einwilligung (derzeit nur der Eintrag in eine Warteliste, Ziffer 3.6), können Sie die Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen (Art. 7 Abs. 3 DSGVO). Die Rechtmäßigkeit der Verarbeitung bis zum Widerruf bleibt davon unberührt.',
      ],
    },
    {
      id: '10.3',
      heading: '10.3 Wie wir Anträge bearbeiten',
      body: [
        'Anträge nach dieser Ziffer 10 bearbeiten wir kostenlos. Ist ein Antrag offenkundig unbegründet oder, etwa weil er immer wieder gestellt wird, exzessiv, können wir ein angemessenes Entgelt verlangen oder ihn ablehnen (Art. 12 Abs. 5 DSGVO).',
        'Haben wir begründete Zweifel, ob ein Antrag wirklich von Ihnen kommt, können wir zusätzliche Angaben verlangen, um Ihre Identität zu bestätigen (Art. 12 Abs. 6 DSGVO). Auskünfte und Daten zu einem Konto geben wir deshalb nur an die E-Mail-Adresse dieses Kontos oder nach der Anmeldung heraus.',
      ],
    },
    {
      id: '11',
      heading: '11. Pflicht zur Angabe',
      body: ['Ohne E-Mail-Adresse können Sie kein Konto anlegen, ohne bestätigte Telefonnummer nichts veröffentlichen und keine Nachrichten senden (mit einer iranischen Nummer nur Nachrichten senden). Zum Stöbern brauchen Sie kein Konto.'],
    },
    {
      id: '12',
      heading: '12. Änderungen',
      body: [
        'Wenn wir neue Dienste einsetzen oder Funktionen ändern, passen wir diese Erklärung an. Über wesentliche Änderungen informieren wir angemeldete Nutzer per E-Mail.',
        'Übernimmt eine Gesellschaft den Betrieb von Peydoo (Nutzungsbedingungen Ziffer 1.3), wird sie Verantwortliche für Ihre Daten. Wir nennen sie Ihnen in der Ankündigung vorher.',
      ],
    },
  ],
};

export const legalDe = {
  terms,
  privacy,
  // Shared labels on the German pages
  draft: 'Entwurf – wird vor dem Start anwaltlich geprüft.',
  persianVersion: 'Persische Fassung (فارسی)',
  binding: 'Die deutsche und die persische Fassung sind gleichermaßen verbindlich (Ziffer 13.2 der Nutzungsbedingungen).',
  contents: 'Inhalt',
  // A new version waiting for its day (src/modules/legal/versions.ts)
  upcoming: (day: string) => `Ab dem ${day} gilt eine neue Fassung.`,
  readUpcoming: 'Neue Fassung lesen',
  isUpcoming: (day: string) => `Dies ist die neue Fassung; sie gilt ab dem ${day}. Bis dahin gilt die aktuelle Fassung.`,
  readCurrent: 'Aktuelle Fassung lesen',
} as const;

/**
 * The German part of the email before the terms of use or the privacy policy change (terms 12,
 * privacy 12; src/modules/legal/notices.ts). Both language versions of the terms are binding
 * (terms 13.2), so the notice of a change carries the German text too.
 */
export const legalNoticeMailDe = {
  subject: (docs: 'terms' | 'privacy' | 'both', day: string) =>
    docs === 'terms'
      ? `Änderung unserer Nutzungsbedingungen zum ${day}`
      : docs === 'privacy'
        ? `Änderung unserer Datenschutzerklärung zum ${day}`
        : `Änderung unserer Nutzungsbedingungen und Datenschutzerklärung zum ${day}`,
  intro: (docs: 'terms' | 'privacy' | 'both', day: string) =>
    docs === 'terms'
      ? `Unsere Nutzungsbedingungen ändern sich zum ${day}.`
      : docs === 'privacy'
        ? `Unsere Datenschutzerklärung ändert sich zum ${day}.`
        : `Unsere Nutzungsbedingungen und unsere Datenschutzerklärung ändern sich zum ${day}.`,
  what: 'Was sich ändert:',
  terms: (url: string) => `Neue Nutzungsbedingungen: ${url}`,
  privacy: (url: string) => `Neue Datenschutzerklärung: ${url}`,
  disagree: (url: string) => `Sind Sie nicht einverstanden, können Sie Ihr Konto jederzeit löschen: ${url}`,
  why: 'Diese E-Mail erhalten alle Konten bei Peydoo (Ziffer 12 der Nutzungsbedingungen). Sie ist keine Werbung.',
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

/** The German names of the one-time products, for the withdrawal receipt */
const PRODUCTS_DE: Record<string, string> = {
  'bump-1': 'Hochschieben einer Anzeige',
  'bump-3': 'Drei Hochschiebungen innerhalb von sieben Tagen',
  'featured-7d': 'Hervorhebung einer Anzeige für sieben Tage',
  'featured-event': 'Hervorhebung einer Veranstaltung',
};

/**
 * The binding German confirmation of receipt of a withdrawal (§ 356a BGB), sent with the Persian
 * receipt on a durable medium (src/modules/payments/notices.ts): the content, date and time.
 */
export function withdrawalReceiptDe(w: { productCode: string; totalMinor: number; currency: string; paidAt: Date; receivedAt: Date; timeZone: string }): string {
  const at = (d: Date) => new Intl.DateTimeFormat('de-DE', { dateStyle: 'long', timeStyle: 'short', timeZone: w.timeZone }).format(d);
  const amount = new Intl.NumberFormat('de-DE', { style: 'currency', currency: w.currency }).format(w.totalMinor / 100);
  return `Eingangsbestätigung: Ihren Widerruf des Vertrags „${PRODUCTS_DE[w.productCode] ?? w.productCode}“ (${amount}, geschlossen am ${at(w.paidAt)}) haben wir am ${at(w.receivedAt)} erhalten. Den Betrag für den bis dahin nicht erbrachten Teil der Leistung erstatten wir über das ursprüngliche Zahlungsmittel innerhalb von 14 Tagen.`;
}
