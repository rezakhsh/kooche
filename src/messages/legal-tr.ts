import type { LegalDoc } from './legal-types';
import { operator } from './operator';

// The Turkish privacy notice (Aydınlatma Metni, Art. 10 KVKK) at /privacy/tr, linked from privacy
// policy 13.3 (Turkey plan, owner Nov 5, 2026). A draft for the Turkish adviser (docs/progress.md):
// the banner says so until the adviser has checked it and the representative is appointed. Facts
// follow the privacy policy (fa.ts, legal-de.ts): change them together.

const REPRESENTATIVE = operator.turkeyRepresentative
  ? `${operator.turkeyRepresentative.name}, ${operator.turkeyRepresentative.address}, e-posta: ${operator.turkeyRepresentative.email}`
  : '[Türkiye temsilcisinin adı ve adresi: henüz atanmadı]';

export const aydinlatma: LegalDoc = {
  title: 'Kişisel Verilerin İşlenmesine İlişkin Aydınlatma Metni',
  updated: 'Güncelleme: 5 Kasım 2026',
  draft: true,
  intro: [
    'Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu’nun (KVKK) 10. maddesi uyarınca, Peydoo’nun Türkiye’deki kullanıcılarının kişisel verilerini hangi amaçlarla, hangi hukuki sebeplere dayanarak ve kimlere aktararak işlediğini açıklar. Ayrıntılar Farsça ve Almanca Gizlilik Politikamızdadır.',
  ],
  sections: [
    {
      id: '1',
      heading: '1. Veri sorumlusu ve temsilcisi',
      body: [
        'Veri sorumlusu:',
        { operator: true },
        'Türkiye’deki veri sorumlusu temsilcimiz (KVKK m. 16):',
        REPRESENTATIVE,
        operator.verbisNumber ? `VERBIS kayıt numarası: ${operator.verbisNumber}` : 'Peydoo Türkiye’de açılmadan önce Veri Sorumluları Siciline (VERBIS) kaydolacaktır.',
      ],
    },
    {
      id: '2',
      heading: '2. İşlenen kişisel veriler',
      body: [
        {
          list: [
            'Kimlik ve iletişim: görünen ad, e-posta adresi, doğrulanmış telefon numarası;',
            'İlan, etkinlik ve mesaj içerikleri, fotoğraflar;',
            'Konum: posta kodu, şehir, isteğe bağlı olarak yaklaşık konum (yaklaşık 500 m’ye yuvarlanır);',
            'İşlem güvenliği: IP adresi, oturum çerezleri, giriş ve güvenlik kayıtları;',
            'Ücretli hizmetlerde ödeme kayıtları (kart bilgileri Stripe’ta kalır, bizde tutulmaz);',
            'İşletme hesaplarında ticari bilgiler ve doğrulama belgesi.',
          ],
        },
      ],
    },
    {
      id: '3',
      heading: '3. İşleme amaçları ve hukuki sebepler',
      body: [
        {
          list: [
            'Hesabın açılması ve yönetimi, ilan ve etkinliklerin yayınlanması, kullanıcılar arasında mesajlaşma, ücretli hizmetlerin sunulması: sözleşmenin kurulması ve ifası (KVKK m. 5/2-c);',
            'Dolandırıcılığın ve kötüye kullanımın önlenmesi, içerik denetimi, bilgi güvenliği: meşru menfaat (m. 5/2-f) ve bir hakkın korunması (m. 5/2-e);',
            'Yetkili kurumların talepleri, saklama ve bildirim yükümlülükleri: hukuki yükümlülük (m. 5/2-ç);',
            'Bekleme listesi bildirimleri: açık rıza (m. 5/1); rızanızı her zaman geri alabilirsiniz.',
          ],
        },
        'Verileri, web sitemizdeki formlar, Telegram veya WhatsApp üzerinden telefon doğrulaması ve çerezler aracılığıyla, kısmen otomatik yollarla doğrudan sizden toplarız.',
      ],
    },
    {
      id: '4',
      heading: '4. Aktarım',
      body: [
        'Peydoo Almanya’dan işletilir; verileriniz Avrupa Birliği’ndeki sunucularda tutulur. Hizmet sağlayıcılarımız (barındırma Hetzner, güvenlik ve içerik dağıtımı Cloudflare, e-posta Amazon Web Services ve Zoho, ödeme Stripe, hata takibi Sentry, doğrulama ve bildirimler Telegram ve WhatsApp) verileri yalnızca bu hizmetler için işler. Tam liste Gizlilik Politikamızın 8. maddesindedir.',
        'Türkiye’den yurt dışına aktarım için Kişisel Verileri Koruma Kurulu’nun standart sözleşmelerini yapar ve süresi içinde Kurum’a bildiririz (KVKK m. 9). Yetkili kamu kurum ve kuruluşlarına veri yalnızca kanunen zorunlu olduğunda aktarılır.',
      ],
    },
    {
      id: '5',
      heading: '5. Saklama süresi',
      body: ['Verileri yalnızca amaç için gerekli olduğu süre ve kanuni saklama süreleri boyunca saklarız; süreler Gizlilik Politikamızın 9. maddesindedir. Süre dolunca silinir, yok edilir veya anonim hâle getirilir.'],
    },
    {
      id: '6',
      heading: '6. KVKK m. 11 kapsamındaki haklarınız',
      body: [
        {
          list: [
            'kişisel verilerinizin işlenip işlenmediğini öğrenme;',
            'işlenmişse buna ilişkin bilgi talep etme;',
            'işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme;',
            'yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme;',
            'eksik veya yanlış işlenmişse düzeltilmesini isteme;',
            'KVKK m. 7 çerçevesinde silinmesini veya yok edilmesini isteme;',
            'düzeltme, silme ve yok etme işlemlerinin aktarılan üçüncü kişilere bildirilmesini isteme;',
            'münhasıran otomatik sistemlerle analiz edilmesi sonucu aleyhinize bir sonuç çıkmasına itiraz etme;',
            'kanuna aykırı işleme nedeniyle zarara uğramanız hâlinde zararın giderilmesini talep etme.',
          ],
        },
      ],
    },
    {
      id: '7',
      heading: '7. Başvuru',
      body: [
        `Başvurularınızı ${operator.email} adresine veya Türkiye temsilcimize yazılı olarak iletebilirsiniz. Başvurunuzu en geç 30 gün içinde ücretsiz olarak sonuçlandırırız (KVKK m. 13). Başvurunuzun reddedilmesi veya cevabı yetersiz bulmanız hâlinde Kişisel Verileri Koruma Kurulu’na (kvkk.gov.tr) şikâyette bulunabilirsiniz (KVKK m. 14).`,
      ],
    },
  ],
};

/** The page's own labels, in Turkish */
export const aydinlatmaPage = {
  draft: 'Taslak: Bu metin, Peydoo Türkiye’de açılmadan önce bir Türk hukuk danışmanı tarafından kontrol edilecektir.',
  contents: 'İçindekiler',
  note: 'Ayrıntılar Gizlilik Politikamızda:',
  persian: 'Gizlilik Politikası (Farsça)',
  german: 'Datenschutzerklärung (Deutsch)',
  operator: { name: 'Ad', address: 'Adres', email: 'E-posta' },
};
