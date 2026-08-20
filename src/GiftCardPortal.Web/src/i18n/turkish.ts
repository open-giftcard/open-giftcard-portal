/**
 * Turkish for every English sentence the portal renders.
 *
 * Keyed on the English source string — see `translate.ts` for why. Entries are
 * grouped the way the screens are, and `turkish.test.ts` fails when a screen
 * uses a phrase that is missing here or when an entry no longer matches any
 * screen, so the two cannot drift apart quietly.
 *
 * Placeholders in braces are substituted after lookup and must survive
 * translation unchanged, including their spelling.
 */
export const turkish: Readonly<Record<string, string>> = {
  // -- shell, session and error fallbacks -----------------------------------
  "Loading your secure session…": "Güvenli oturumunuz yükleniyor…",
  "We could not sign you in. Check your details and try again.":
    "Oturum açılamadı. Bilgilerinizi kontrol edip yeniden deneyin.",
  "The portal is temporarily unavailable":
    "Portal geçici olarak kullanılamıyor",
  "We could not load your secure session. No sign-in information was exposed.":
    "Güvenli oturumunuz yüklenemedi. Hiçbir oturum açma bilgisi açığa çıkmadı.",
  "Your secure session expired. Sign in again to continue.":
    "Güvenli oturumunuzun süresi doldu. Devam etmek için yeniden oturum açın.",
  "The platform customer directory is temporarily unavailable.":
    "Platform müşteri dizini geçici olarak kullanılamıyor.",
  "The customer detail is temporarily unavailable.":
    "Müşteri ayrıntısı geçici olarak kullanılamıyor.",
  "Corporate-credit balances are temporarily unavailable.":
    "Kurumsal kredi bakiyeleri geçici olarak kullanılamıyor.",
  "Allocation history is temporarily unavailable.":
    "Tahsis geçmişi geçici olarak kullanılamıyor.",
  "Corporate credit could not be allocated.":
    "Kurumsal kredi tahsis edilemedi.",
  "The allocation could not be reversed.": "Tahsis geri alınamadı.",
  "Customer audit evidence is temporarily unavailable.":
    "Müşteri denetim kayıtları geçici olarak kullanılamıyor.",
  "More audit evidence could not be loaded. Current results are unchanged.":
    "Daha fazla denetim kaydı yüklenemedi. Mevcut sonuçlar değişmedi.",
  "The customer team roster is temporarily unavailable.":
    "Müşteri ekip listesi geçici olarak kullanılamıyor.",
  "POS payment reporting is temporarily unavailable.":
    "POS ödeme raporlaması geçici olarak kullanılamıyor.",
  "More payments could not be loaded. Current results are unchanged.":
    "Daha fazla ödeme yüklenemedi. Mevcut sonuçlar değişmedi.",
  "The payment receipt is temporarily unavailable.":
    "Ödeme fişi geçici olarak kullanılamıyor.",
  "Loading your organizations…": "Kuruluşlarınız yükleniyor…",
  "Organizations could not be loaded": "Kuruluşlar yüklenemedi",
  "The platform did not return your organization list.":
    "Platform kuruluş listenizi döndürmedi.",
  "No organizations are available": "Kullanılabilir kuruluş yok",
  "Your account is active, but the platform did not return an organization membership. Contact your administrator if this is unexpected.":
    "Hesabınız etkin, ancak platform bir kuruluş üyeliği döndürmedi. Bu beklenmedik bir durumsa yöneticinizle iletişime geçin.",
  "That organization could not be verified.": "Bu kuruluş doğrulanamadı.",
  "The organization context could not be cleared.":
    "Kuruluş bağlamı temizlenemedi.",
  "Sign out could not be completed.": "Oturum kapatma tamamlanamadı.",
  "Financial totals are temporarily unavailable.":
    "Finansal toplamlar geçici olarak kullanılamıyor.",
  "Recent financial activity is temporarily unavailable.":
    "Son finansal hareketler geçici olarak kullanılamıyor.",
  "More activity could not be loaded. Your current results are unchanged.":
    "Daha fazla hareket yüklenemedi. Mevcut sonuçlarınız değişmedi.",
  "Reconciliation is temporarily unavailable.":
    "Mutabakat geçici olarak kullanılamıyor.",
  "The card register is temporarily unavailable.":
    "Kart kütüğü geçici olarak kullanılamıyor.",
  "More cards could not be loaded.": "Daha fazla kart yüklenemedi.",
  "Gift card inventory is temporarily unavailable.":
    "Hediye kartı envanteri geçici olarak kullanılamıyor.",
  "More cards could not be loaded. Your current inventory is unchanged.":
    "Daha fazla kart yüklenemedi. Mevcut envanteriniz değişmedi.",
  "The gift card could not be issued.": "Hediye kartı düzenlenemedi.",
  "Gift card detail is temporarily unavailable.":
    "Hediye kartı ayrıntısı geçici olarak kullanılamıyor.",
  "The lifecycle action could not be completed.":
    "Yaşam döngüsü işlemi tamamlanamadı.",
  "The recipient delivery could not be completed.":
    "Alıcıya teslim tamamlanamadı.",
  "The asynchronous batch could not be queued.":
    "Eşzamansız toplu iş kuyruğa alınamadı.",
  "The current batch result could not be refreshed.":
    "Geçerli toplu iş sonucu yenilenemedi.",
  "The failed rows could not be queued for retry.":
    "Başarısız satırlar yeniden deneme için kuyruğa alınamadı.",
  "The organization structure is temporarily unavailable.":
    "Kuruluş yapısı geçici olarak kullanılamıyor.",
  "The subsidiary could not be created.": "Bağlı kuruluş oluşturulamadı.",
  "Team access information is temporarily unavailable.":
    "Ekip erişim bilgileri geçici olarak kullanılamıyor.",
  "The access change could not be completed.":
    "Erişim değişikliği tamamlanamadı.",
  "{member} was disabled.": "{member} devre dışı bırakıldı.",
  "The member": "Üye",
  "{member} was added to the team.": "{member} ekibe eklendi.",
  "The account": "Hesap",
  "{role} was created.": "{role} oluşturuldu.",
  "Permissions were added to {role}.": "{role} rolüne izinler eklendi.",
  "The role was assigned.": "Rol atandı.",
  "Organization audit evidence is temporarily unavailable.":
    "Kuruluş denetim kayıtları geçici olarak kullanılamıyor.",
  "Skip to main content": "Ana içeriğe geç",
  "Open Giftcard Portal · Secure organization access":
    "Open Giftcard Portal · Güvenli kuruluş erişimi",
  "Go to portal home": "Portal ana sayfasına git",
  "Open Giftcard Portal": "Open Giftcard Portal",

  // -- shared table furniture ------------------------------------------------
  Actions: "İşlemler",
  "No records match the current filters.":
    "Geçerli filtrelerle eşleşen kayıt yok.",

  // -- settings --------------------------------------------------------------
  Turkish: "Türkçe",
  English: "İngilizce",
  Light: "Açık",
  "Always the light palette.": "Her zaman açık renk paleti.",
  Dark: "Koyu",
  "Always the dark palette.": "Her zaman koyu renk paleti.",
  Device: "Cihaz",
  "Follow the device appearance setting.": "Cihazın görünüm ayarını izler.",
  "24-hour": "24 saat",
  "12-hour (AM/PM)": "12 saat (ÖÖ/ÖS)",
  Settings: "Ayarlar",
  "Portal settings": "Portal ayarları",
  "This browser only": "Yalnızca bu tarayıcı",
  Close: "Kapat",
  Language: "Dil",
  Appearance: "Görünüm",
  "Date and time": "Tarih ve saat",
  "These choices are remembered in this browser only. They are not part of your account and are never sent to the backend.":
    "Bu tercihler yalnızca bu tarayıcıda saklanır. Hesabınızın parçası değildir ve arka uca hiçbir zaman gönderilmez.",

  // -- audit -----------------------------------------------------------------
  "Audit investigation": "Denetim incelemesi",
  "Audit investigation access is unavailable":
    "Denetim incelemesi erişimi kullanılamıyor",
  "The backend did not grant audit-view permission for this workspace. Audit evidence remains protected and no records were requested.":
    "Arka uç bu çalışma alanı için denetim görüntüleme izni vermedi. Denetim kayıtları korunmaya devam ediyor ve hiçbir kayıt istenmedi.",
  "Operation: {value}": "İşlem: {value}",
  "Outcome: {value}": "Sonuç: {value}",
  "Correlation: {value}": "İlişki: {value}",
  "Enter a complete correlation reference.": "Tam bir ilişki referansı girin.",
  "Append-only evidence": "Yalnızca eklenen kayıtlar",
  "Showing organization-scoped records for {scope}, newest first in the exact order returned by the backend. This is not a global sign-in log.":
    "{scope} için kuruluş kapsamlı kayıtlar, arka ucun döndürdüğü sırayla ve en yeniler önce gösteriliyor. Bu genel bir oturum açma günlüğü değildir.",
  "Exact operation": "Tam işlem adı",
  "For example, authorization.denied": "Örneğin, authorization.denied",
  Outcome: "Sonuç",
  "All outcomes": "Tüm sonuçlar",
  Success: "Başarılı",
  Failure: "Başarısız",
  "Correlation reference": "İlişki referansı",
  "Searching…": "Aranıyor…",
  "Search audit records": "Denetim kayıtlarında ara",
  "Clear filters": "Filtreleri temizle",
  "{count} active audit filters": "{count} etkin denetim filtresi",
  "Active audit filters": "Etkin denetim filtreleri",
  "All available organization audit records":
    "Tüm kullanılabilir kuruluş denetim kayıtları",
  "— no exact filters are active.": "— etkin bir filtre yok.",
  "Loading protected audit evidence…": "Korumalı denetim kayıtları yükleniyor…",
  "Audit evidence could not be loaded": "Denetim kayıtları yüklenemedi",
  "Try again": "Yeniden dene",
  "No audit records match these exact filters":
    "Bu filtrelerle eşleşen denetim kaydı yok",
  "No organization audit records are available":
    "Kullanılabilir kuruluş denetim kaydı yok",
  "The authoritative backend returned no records for this organization-scoped investigation.":
    "Yetkili arka uç, bu kuruluş kapsamlı inceleme için hiçbir kayıt döndürmedi.",
  "Showing 1 backend-returned audit record":
    "Arka uçtan dönen 1 denetim kaydı gösteriliyor",
  "Showing {count} backend-returned audit records":
    "Arka uçtan dönen {count} denetim kaydı gösteriliyor",
  "Entity type": "Varlık türü",
  "Occurred (UTC)": "Gerçekleşme (UTC)",
  "Technical evidence": "Teknik kanıt",
  "Actor reference": "Aktör referansı",
  "Entity reference": "Varlık referansı",
  "Backend metadata": "Arka uç meta verileri",
  "No additional backend metadata was returned.":
    "Arka uçtan ek meta veri dönmedi.",
  "Loading more…": "Daha fazlası yükleniyor…",
  "Load more audit records": "Daha fazla denetim kaydı yükle",
  "You have reached the end of these backend audit results.":
    "Bu arka uç denetim sonuçlarının sonuna ulaştınız.",

  // -- sign in ---------------------------------------------------------------
  "Corporate services": "Kurumsal hizmetler",
  "Your gift card workspace, securely connected.":
    "Hediye kartı çalışma alanınız, güvenle bağlı.",
  "Sign in with your staff account. Your organizations and access are supplied directly by the platform.":
    "Personel hesabınızla oturum açın. Kuruluşlarınız ve erişiminiz doğrudan platformdan gelir.",
  "Security commitments": "Güvenlik taahhütleri",
  "No access tokens in browser storage":
    "Tarayıcı deposunda erişim jetonu tutulmaz",
  "No organization IDs to copy or paste":
    "Kopyalanacak veya yapıştırılacak kuruluş kimliği yok",
  "Access is always verified by the platform":
    "Erişim her zaman platform tarafından doğrulanır",
  "Secure access": "Güvenli erişim",
  "Sign in": "Oturum aç",
  "Use your staff email and password.":
    "Personel e-postanızı ve parolanızı kullanın.",
  "Email address": "E-posta adresi",
  "Enter a valid email address.": "Geçerli bir e-posta adresi girin.",
  Password: "Parola",
  "Enter your password.": "Parolanızı girin.",
  "Signing in…": "Oturum açılıyor…",
  "Sign in securely": "Güvenli oturum aç",

  // -- finance ---------------------------------------------------------------
  "Corporate credit": "Kurumsal kredi",
  "Gift card": "Hediye kartı",
  Distribution: "Dağıtım",
  Lifecycle: "Yaşam döngüsü",
  "The from date cannot be later than the through date.":
    "Başlangıç tarihi bitiş tarihinden sonra olamaz.",
  "Category: {value}": "Kategori: {value}",
  "Currency: {value}": "Para birimi: {value}",
  "Reference contains: {value}": "Referans şunu içerir: {value}",
  "From: {value} UTC": "Başlangıç: {value} UTC",
  "Through: {value} UTC": "Bitiş: {value} UTC",
  "Finance overview access is unavailable":
    "Finans özeti erişimi kullanılamıyor",
  "Your role does not include both corporate credit and gift card visibility. Ask an organization administrator if you need this workspace.":
    "Rolünüz hem kurumsal kredi hem de hediye kartı görünürlüğünü içermiyor. Bu çalışma alanına ihtiyacınız varsa bir kuruluş yöneticisine başvurun.",
  "Finance overview": "Finans özeti",
  "Balances by currency": "Para birimine göre bakiyeler",
  "Rebuilt from the platform’s authoritative financial records. Currencies stay separate.":
    "Platformun yetkili finansal kayıtlarından yeniden oluşturulur. Para birimleri ayrı tutulur.",
  "As of": "Şu ana göre:",
  "{timestamp} UTC": "{timestamp} UTC",
  "Loading financial totals…": "Finansal toplamlar yükleniyor…",
  "Financial totals could not be loaded": "Finansal toplamlar yüklenemedi",
  "No financial activity yet": "Henüz finansal hareket yok",
  "Totals will appear here after the organization receives corporate credit or issues gift cards.":
    "Kuruluş kurumsal kredi aldığında veya hediye kartı düzenlediğinde toplamlar burada görünür.",
  "Current position": "Güncel durum",
  "Backend reported": "Arka uç bildirimi",
  "Corporate credit available": "Kullanılabilir kurumsal kredi",
  "Gift card value remaining": "Kalan hediye kartı değeri",
  "Credit granted": "Verilen kredi",
  "Credit reversed": "Geri alınan kredi",
  "Gift cards issued": "Düzenlenen hediye kartları",
  "Value distributed": "Dağıtılan değer",
  "Cancelled value returned": "İptalden dönen değer",
  "Expired value returned": "Süre dolumundan dönen değer",
  "Financial activity report": "Finansal hareket raporu",
  "Search financial activity": "Finansal hareketlerde ara",
  "The backend searches the organization’s available history and returns stable, newest-first pages. The portal does not calculate totals from these results.":
    "Arka uç kuruluşun mevcut geçmişinde arama yapar ve en yeniler önce olacak şekilde tutarlı sayfalar döndürür. Portal bu sonuçlardan toplam hesaplamaz.",
  Category: "Kategori",
  "All categories": "Tüm kategoriler",
  "For example, Issued": "Örneğin, Issued",
  Currency: "Para birimi",
  "Business or card reference": "İş veya kart referansı",
  "Literal reference text": "Birebir referans metni",
  "From date (UTC)": "Başlangıç tarihi (UTC)",
  "Through date (UTC)": "Bitiş tarihi (UTC)",
  "Search activity": "Hareketlerde ara",
  "{count} active filters": "{count} etkin filtre",
  "Active financial activity filters": "Etkin finansal hareket filtreleri",
  "All financial activity": "Tüm finansal hareketler",
  "— no search filters are active.": "— etkin bir arama filtresi yok.",
  "Loading recent financial activity…": "Son finansal hareketler yükleniyor…",
  "Financial activity could not be loaded": "Finansal hareketler yüklenemedi",
  "No activity matches these filters": "Bu filtrelerle eşleşen hareket yok",
  "No financial activity": "Finansal hareket yok",
  "The authoritative backend returned no rows for this exact search. Adjust or clear the filters to try again.":
    "Yetkili arka uç bu arama için hiçbir satır döndürmedi. Filtreleri değiştirip veya temizleyip yeniden deneyin.",
  "Financial events will appear here when activity begins.":
    "Hareket başladığında finansal olaylar burada görünür.",
  "Showing 1 backend-returned event": "Arka uçtan dönen 1 olay gösteriliyor",
  "Showing {count} backend-returned events":
    "Arka uçtan dönen {count} olay gösteriliyor",
  "Reference {value}": "Referans {value}",
  "Try loading more again": "Daha fazlasını yeniden yüklemeyi dene",
  "Load more activity": "Daha fazla hareket yükle",
  "You have reached the end of these backend results.":
    "Bu arka uç sonuçlarının sonuna ulaştınız.",

  // -- reconciliation --------------------------------------------------------
  Expected: "Beklenen",
  Actual: "Gerçekleşen",
  "Technical reference": "Teknik referans",
  "Reconciliation access is unavailable": "Mutabakat erişimi kullanılamıyor",
  "Financial controls": "Finansal kontroller",
  "Financial reconciliation": "Finansal mutabakat",
  "Checking authoritative financial records…":
    "Yetkili finansal kayıtlar denetleniyor…",
  "Compare company financial records with immutable Ledger postings. This read-only check never changes or repairs history.":
    "Şirket finansal kayıtlarını değiştirilemez Ledger kayıtlarıyla karşılaştırır. Bu salt okunur denetim geçmişi hiçbir zaman değiştirmez veya onarmaz.",
  "Ready to verify financial records": "Finansal kayıtları doğrulamaya hazır",
  "The platform will check linked transactions, gift cards, amounts, currencies, account roles, balances, terminal values, share transfers, child card lineage, and active reservations.":
    "Platform; bağlı işlemleri, hediye kartlarını, tutarları, para birimlerini, hesap rollerini, bakiyeleri, nihai değerleri, pay transferlerini, alt kart soyağacını ve etkin rezervasyonları denetler.",
  "Run reconciliation": "Mutabakatı çalıştır",
  "A read-only result reported by the authoritative backend.":
    "Yetkili arka uç tarafından bildirilen salt okunur bir sonuç.",
  "Running again…": "Yeniden çalıştırılıyor…",
  "Run again": "Yeniden çalıştır",
  "The previous successful result remains below.":
    "Önceki başarılı sonuç aşağıda kalmaya devam ediyor.",
  "Backend result": "Arka uç sonucu",
  "No inconsistencies found": "Tutarsızlık bulunamadı",
  "1 finding needs review": "1 bulgu inceleme gerektiriyor",
  "{count} findings need review": "{count} bulgu inceleme gerektiriyor",
  Checked: "Denetlendi:",
  "Transactions checked": "Denetlenen işlemler",
  "Gift cards checked": "Denetlenen hediye kartları",
  "Shares checked": "Denetlenen paylar",
  "Active reservations checked": "Denetlenen etkin rezervasyonlar",
  "Backend findings": "Arka uç bulguları",
  "Review these records with an authorized support or finance administrator. The portal cannot repair financial history.":
    "Bu kayıtları yetkili bir destek veya finans yöneticisiyle birlikte inceleyin. Portal finansal geçmişi onaramaz.",

  // -- bulk upload -----------------------------------------------------------
  "This row is empty and will be ignored.":
    "Bu satır boş ve dikkate alınmayacak.",
  "Enter an item reference.": "Bir kalem referansı girin.",
  "Another row already uses this item reference.":
    "Bu kalem referansı başka bir satırda kullanılıyor.",
  "Enter a positive amount.": "Pozitif bir tutar girin.",
  "Enter a three-letter currency code.":
    "Üç harfli bir para birimi kodu girin.",
  "Enter a valid email address or international phone number.":
    "Geçerli bir e-posta adresi veya uluslararası telefon numarası girin.",
  "Enter a valid expiry date.": "Geçerli bir son kullanma tarihi girin.",
  "Enter a valid valid-from date or leave it blank.":
    "Geçerli bir başlangıç tarihi girin veya boş bırakın.",
  "Reading {file} took too long and was stopped. Re-save it from Excel as .xlsx and try again.":
    "{file} dosyasının okunması çok uzun sürdü ve durduruldu. Dosyayı Excel'den .xlsx olarak yeniden kaydedip tekrar deneyin.",
  "That worksheet has a header but no recipient rows to import.":
    "Bu çalışma sayfasında başlık var ancak içe aktarılacak alıcı satırı yok.",
  "That file has {rows} rows and this batch takes at most {maximum}. Split the file and upload it in parts.":
    "Bu dosyada {rows} satır var; bu toplu iş en fazla {maximum} satır alır. Dosyayı bölüp parçalar halinde yükleyin.",
  "That file could not be read as a spreadsheet. {detail}":
    "Bu dosya bir hesap tablosu olarak okunamadı. {detail}",
  "Map Amount, Expiry date, and Recipient before continuing.":
    "Devam etmeden önce Tutar, Son kullanma tarihi ve Alıcı sütunlarını eşleyin.",
  "Each spreadsheet column can map to only one gift card field.":
    "Her hesap tablosu sütunu yalnızca bir hediye kartı alanına eşlenebilir.",
  "That worksheet had no valid rows.":
    "Bu çalışma sayfasında geçerli satır yoktu.",
  "Add at least one row before reviewing the batch.":
    "Toplu işi incelemeden önce en az bir satır ekleyin.",
  "This batch takes at most {maximum} rows.":
    "Bu toplu iş en fazla {maximum} satır alır.",
  "Repair every highlighted spreadsheet row before continuing.":
    "Devam etmeden önce işaretli her satırı düzeltin.",
  "Enter a batch reference.": "Bir toplu iş referansı girin.",
  "{currency} {requested} requested but {available} available":
    "{currency} {requested} istendi ancak {available} kullanılabilir",
  "The batch exceeds the currently available corporate credit: {shortages}. Refresh Finance or reduce the batch before submitting.":
    "Toplu iş, şu anda kullanılabilir kurumsal krediyi aşıyor: {shortages}. Göndermeden önce Finans'ı yenileyin veya toplu işi küçültün.",
  "Asynchronous issue and delivery": "Eşzamansız düzenleme ve teslim",
  "Bulk gift card batch": "Toplu hediye kartı işi",
  "Submit up to {maximum} reviewed rows for {organization}. The backend processes each row independently, keeps per-row outcomes, and lets you retry only the failed rows after the batch completes.":
    "{organization} için en fazla {maximum} incelenmiş satır gönderin. Arka uç her satırı bağımsız işler, satır bazında sonuçları saklar ve toplu iş bittikten sonra yalnızca başarısız satırları yeniden denemenize izin verir.",
  "Open batch progress": "Toplu iş durumunu aç",
  "Batch upload": "Toplu yükleme",
  "Creating a batch requires both gift-card issue and distribution permission. The backend enforces both permissions for every request.":
    "Toplu iş oluşturmak hem hediye kartı düzenleme hem de dağıtım izni gerektirir. Arka uç her istekte iki izni de zorunlu tutar.",
  "Bulk gift card upload": "Toplu hediye kartı yükleme",
  "Close batch upload": "Toplu yüklemeyi kapat",
  "Backend batch result": "Arka uç toplu iş sonucu",
  "{succeeded} succeeded · {failed} failed":
    "{succeeded} başarılı · {failed} başarısız",
  completed: "tamamlandı",
  "{count} pending": "{count} bekliyor",
  "No row outcomes were returned.": "Satır sonuçları dönmedi.",
  "The batch was accepted. Row outcomes will appear as processing begins.":
    "Toplu iş kabul edildi. İşleme başladıkça satır sonuçları görünecek.",
  "Item {position}": "Kalem {position}",
  Card: "Kart",
  "Not issued": "Düzenlenmedi",
  Recipient: "Alıcı",
  Amount: "Tutar",
  "Card state": "Kart durumu",
  Delivery: "Teslim",
  "Not delivered": "Teslim edilmedi",
  "This row failed.": "Bu satır başarısız oldu.",
  "Results preserve backend order and show only masked recipients. Outcome pages are loaded directly from this batch; the portal does not store recipient files or expose a batch listing.":
    "Sonuçlar arka uç sırasını korur ve yalnızca maskelenmiş alıcıları gösterir. Sonuç sayfaları doğrudan bu toplu işten yüklenir; portal alıcı dosyası saklamaz ve bir toplu iş listesi sunmaz.",
  "Refreshing…": "Yenileniyor…",
  "Refresh batch result": "Toplu iş sonucunu yenile",
  "Load more outcomes": "Daha fazla sonuç yükle",
  "Starting retry…": "Yeniden deneme başlatılıyor…",
  "Retry failed rows": "Başarısız satırları yeniden dene",
  "Start another batch": "Yeni bir toplu iş başlat",
  "Bulk upload progress": "Toplu yükleme adımları",
  Upload: "Yükleme",
  Mapping: "Eşleme",
  "Repair and review": "Düzeltme ve inceleme",
  Import: "İçe aktarma",
  "Go to {step}": "{step} adımına git",
  "Review bulk gift card batch": "Toplu hediye kartı işini incele",
  "Review asynchronous batch": "Eşzamansız toplu işi incele",
  "Confirming queues the single row below. It settles on its own, so a failure here leaves nothing else to undo.":
    "Onaylamak aşağıdaki tek satırı kuyruğa alır. Satır kendi başına sonuçlanır; bu nedenle bir hata geri alınacak başka bir şey bırakmaz.",
  "Confirming queues all {count} rows. Each row settles independently, so successful cards remain issued when another row fails.":
    "Onaylamak {count} satırın tümünü kuyruğa alır. Her satır bağımsız sonuçlanır; bu nedenle bir satır başarısız olsa da başarılı kartlar düzenlenmiş kalır.",
  Email: "E-posta",
  Phone: "Telefon",
  "Valid from": "Başlangıç",
  "Backend posting time": "Arka uç kayıt zamanı",
  Expires: "Son kullanma",
  Capabilities: "Yetenekler",
  Transferable: "Devredilebilir",
  "Not transferable": "Devredilemez",
  Divisible: "Bölünebilir",
  "Not divisible": "Bölünemez",
  "Batch confirmation pages": "Toplu iş onay sayfaları",
  Previous: "Önceki",
  "Rows {from}–{to} of {total}": "{total} satırdan {from}–{to} arası",
  Next: "Sonraki",
  "Full contacts are shown only for this review and are cleared from the interface after the backend returns its masked result.":
    "Tam iletişim bilgileri yalnızca bu inceleme için gösterilir ve arka uç maskelenmiş sonucu döndürdükten sonra arayüzden temizlenir.",
  "Queueing batch…": "Toplu iş kuyruğa alınıyor…",
  "Queue entire batch": "Tüm toplu işi kuyruğa al",
  "Back to the spreadsheet": "Tabloya dön",
  "Start from a spreadsheet": "Bir hesap tablosuyla başlayın",
  "Upload the .xlsx you already keep. It is read in this browser and never sent anywhere; the rows fill the sheet on the next step, where you review them before anything is issued.":
    "Elinizdeki .xlsx dosyasını yükleyin. Dosya bu tarayıcıda okunur ve hiçbir yere gönderilmez; satırlar bir sonraki adımdaki tabloyu doldurur ve hiçbir şey düzenlenmeden önce orada incelenir.",
  "Before you upload": "Yüklemeden önce",
  "Use an unencrypted .xlsx workbook.":
    "Şifresiz bir .xlsx çalışma kitabı kullanın.",
  "The first row must contain column headings.":
    "İlk satır sütun başlıklarını içermelidir.",
  "Required columns are Amount, Expiry date, and Recipient (email or international phone number).":
    "Zorunlu sütunlar Tutar, Son kullanma tarihi ve Alıcı (e-posta veya uluslararası telefon numarası) sütunlarıdır.",
  "Use no more than {maximum} recipient rows.":
    "En fazla {maximum} alıcı satırı kullanın.",
  "Date-only values are accepted. Validity starts at 00:00 and expiry ends at 23:59 unless a time is supplied.":
    "Yalnızca tarih içeren değerler kabul edilir. Saat verilmezse geçerlilik 00:00'da başlar, son kullanma 23:59'da biter.",
  "A Name column is shown for checking and is discarded; the platform stores no recipient name.":
    "Ad sütunu yalnızca kontrol için gösterilir ve atılır; platform alıcı adı saklamaz.",
  "Spreadsheet of recipients": "Alıcı hesap tablosu",
  "Reading the workbook…": "Çalışma kitabı okunuyor…",
  "For a single gift card, close this window and use the manual issuance form. You can also enter a small batch by hand.":
    "Tek bir hediye kartı için bu pencereyi kapatıp elle düzenleme formunu kullanın. Küçük bir toplu işi elle de girebilirsiniz.",
  "Enter batch rows manually": "Toplu iş satırlarını elle gir",
  "Step 2": "2. adım",
  "Confirm column mapping": "Sütun eşlemesini onaylayın",
  "We matched familiar headings automatically. Confirm each field before validating {rows} rows. Optional fields may be left unused.":
    "Bilinen başlıkları otomatik eşleştirdik. {rows} satırı doğrulamadan önce her alanı onaylayın. İsteğe bağlı alanlar boş bırakılabilir.",
  "Gift card field": "Hediye kartı alanı",
  "Spreadsheet column": "Hesap tablosu sütunu",
  "Sample value": "Örnek değer",
  "{field} (required)": "{field} (zorunlu)",
  "Column for {field}": "{field} için sütun",
  "Not used": "Kullanılmıyor",
  "Column {number}": "Sütun {number}",
  Back: "Geri",
  "Validate rows": "Satırları doğrula",
  "{count} rows read from {file}. They are in the sheet below and nothing has been issued yet.":
    "{file} dosyasından {count} satır okundu. Satırlar aşağıdaki tabloda ve henüz hiçbir kart düzenlenmedi.",
  "{count} of them need a correction, marked in the sheet.":
    "Bunlardan {count} tanesi düzeltme gerektiriyor ve tabloda işaretlendi.",
  "Every row passed the file checks.":
    "Tüm satırlar dosya denetimlerinden geçti.",
  "Names read from the file ({count})": "Dosyadan okunan adlar ({count})",
  "Shown so you can confirm the right people were matched to the right addresses. Names are not submitted and not stored.":
    "Doğru kişilerin doğru adreslerle eşleştiğini doğrulayabilmeniz için gösterilir. Adlar gönderilmez ve saklanmaz.",
  "Batch reference": "Toplu iş referansı",
  "Campaign, payroll, or order reference":
    "Kampanya, bordro veya sipariş referansı",
  "1 row needs a correction before import.":
    "İçe aktarmadan önce 1 satır düzeltme gerektiriyor.",
  "{count} rows need a correction before import.":
    "İçe aktarmadan önce {count} satır düzeltme gerektiriyor.",
  "Add a row to get started.": "Başlamak için bir satır ekleyin.",
  "1 row is ready to import.": "1 satır içe aktarmaya hazır.",
  "{count} rows are ready to import.": "{count} satır içe aktarmaya hazır.",
  "{requested} to issue": "{requested} düzenlenecek",
  "{requested} to issue, over the {available} available":
    "{requested} düzenlenecek, kullanılabilir {available} tutarının üzerinde",
  "{requested} to issue, of {available} available":
    "{requested} düzenlenecek, kullanılabilir {available} tutarından",
  "Rows per page": "Sayfa başına satır",
  "Only show rows with problems": "Yalnızca sorunlu satırları göster",
  "Add item": "Kalem ekle",
  OK: "OK",
  "Item reference": "Kalem referansı",
  Name: "Ad",
  Time: "Saat",
  Remove: "Kaldır",
  "No rows with problems.": "Sorunlu satır yok.",
  "No rows yet.": "Henüz satır yok.",
  "Show all rows": "Tüm satırları göster",
  "Item {number}": "Kalem {number}",
  "Valid from date (optional)": "Başlangıç tarihi (isteğe bağlı)",
  "Valid from time (optional; defaults to 00:00)":
    "Başlangıç saati (isteğe bağlı; varsayılan 00:00)",
  "Expiry date": "Son kullanma tarihi",
  "Expiry time (optional; defaults to 23:59)":
    "Son kullanma saati (isteğe bağlı; varsayılan 23:59)",
  "Recipient phone (E.164)": "Alıcı telefonu (E.164)",
  "Recipient email": "Alıcı e-postası",
  SMS: "SMS",
  "Card capabilities": "Kart yetenekleri",
  "Remove row {number}": "{number}. satırı kaldır",
  "Showing no rows": "Gösterilen satır yok",
  "Showing {from}–{to} of {total} rows":
    "{total} satırdan {from}–{to} arası gösteriliyor",
  "Imported row pages": "İçe aktarılan satır sayfaları",
  "Page {page} of {pages}": "Sayfa {page} / {pages}",
  "Contacts remain only in this form and its review. XLSX files are read locally in the browser; CSV is out of scope, and no recipient file or display name is uploaded or retained.":
    "İletişim bilgileri yalnızca bu formda ve incelemesinde kalır. XLSX dosyaları tarayıcıda yerel olarak okunur; CSV kapsam dışıdır ve hiçbir alıcı dosyası veya görünen ad yüklenmez ya da saklanmaz.",
  "Review entire batch": "Tüm toplu işi incele",

  // -- card register ---------------------------------------------------------
  "In inventory": "Envanterde",
  "Sent, not claimed": "Gönderildi, alınmadı",
  "With recipient": "Alıcıda",
  "Not sent yet": "Henüz gönderilmedi",
  Ownership: "Sahiplik",
  State: "Durum",
  Funded: "Yüklenen",
  Remaining: "Kalan",
  "Held by the recipient": "Alıcıda tutuluyor",
  "Not shown": "Gösterilmiyor",
  Issued: "Düzenlenme",
  "Issued (UTC)": "Düzenlenme (UTC)",
  "Expires (UTC)": "Son kullanma (UTC)",
  "Every card this organization funded":
    "Bu kuruluşun karşılığını yatırdığı her kart",
  "Card register": "Kart kütüğü",
  "Inventory shows only cards still held by the organization, so a card disappears from it the moment it reaches someone. The register keeps all of them. Recipient contacts are masked, and the remaining balance of a card someone already owns is not reported.":
    "Envanter yalnızca hâlâ kuruluşta olan kartları gösterir; bir kart birine ulaştığı anda envanterden çıkar. Kütük ise hepsini saklar. Alıcı bilgileri maskelenir ve bir başkasına ait kartın kalan bakiyesi bildirilmez.",
  "All ownership": "Tüm sahiplik durumları",
  "Lifecycle state": "Yaşam döngüsü durumu",
  "All states": "Tüm durumlar",
  Active: "Etkin",
  "Awaiting claim": "Alınmayı bekliyor",
  Suspended: "Askıya alındı",
  Cancelled: "İptal edildi",
  Expired: "Süresi doldu",
  "Card reference": "Kart referansı",
  "For example, GC-": "Örneğin, GC-",
  "Search register": "Kütükte ara",
  "Newest first": "En yeniler önce",
  "Funded cards": "Karşılığı yatırılan kartlar",
  "{count} shown": "{count} gösteriliyor",
  "Loading the card register…": "Kart kütüğü yükleniyor…",
  "The card register could not be loaded": "Kart kütüğü yüklenemedi",
  "No cards match these filters": "Bu filtrelerle eşleşen kart yok",
  "Clear one or more filters and search again. A newly created organization has no funded cards until the first issuance.":
    "Bir veya daha fazla filtreyi temizleyip yeniden arayın. Yeni oluşturulan bir kuruluşun ilk düzenlemeye kadar kartı olmaz.",
  "Gift cards funded by this organization":
    "Bu kuruluşun karşılığını yatırdığı hediye kartları",
  "More cards could not be loaded": "Daha fazla kart yüklenemedi",
  "Loading…": "Yükleniyor…",
  "Load more cards": "Daha fazla kart yükle",

  // -- distribution ----------------------------------------------------------
  "Back to inventory": "Envantere dön",
  "Recipient delivery": "Alıcıya teslim",
  "Send {reference}": "{reference} gönder",
  "Deliver {amount} from {organization}. The backend changes ownership to awaiting claim; no card value moves.":
    "{organization} adına {amount} teslim edin. Arka uç sahipliği alınmayı bekliyor durumuna geçirir; kart değeri hareket etmez.",
  "Delivery created": "Teslim oluşturuldu",
  "Invitation is awaiting claim": "Davet alınmayı bekliyor",
  Channel: "Kanal",
  "Business reference": "İş referansı",
  "Invitation state": "Davet durumu",
  "Claim expires": "Alma süresi doluyor",
  Distributed: "Dağıtıldı",
  "Only the backend-masked recipient is retained in this portal view. Activation secrets are delivered outside the portal.":
    "Bu portal görünümünde yalnızca arka uç tarafından maskelenmiş alıcı saklanır. Etkinleştirme sırları portal dışında iletilir.",
  "Return to inventory": "Envantere dön",
  "Review recipient delivery": "Alıcıya teslimi incele",
  "Review delivery": "Teslimi incele",
  "Confirm recipient and ownership change":
    "Alıcıyı ve sahiplik değişikliğini onaylayın",
  Organization: "Kuruluş",
  Value: "Değer",
  "The card will leave organization inventory and wait for this recipient to claim it. This ownership-only operation does not move or recalculate value.":
    "Kart kuruluş envanterinden çıkacak ve bu alıcının almasını bekleyecek. Yalnızca sahipliği değiştiren bu işlem değeri taşımaz veya yeniden hesaplamaz.",
  "Sending…": "Gönderiliyor…",
  "Confirm delivery": "Teslimi onayla",
  "Delivery channel": "Teslim kanalı",
  "Delivery, campaign, or award reference":
    "Teslim, kampanya veya ödül referansı",
  "The full contact is sent only to the backend after confirmation. The portal does not store it in browser or session storage.":
    "Tam iletişim bilgisi yalnızca onaydan sonra arka uca gönderilir. Portal bunu tarayıcı veya oturum deposunda saklamaz.",

  // -- lifecycle -------------------------------------------------------------
  Suspend: "Askıya al",
  Reactivate: "Yeniden etkinleştir",
  Cancel: "İptal et",
  "Finalize expiry": "Süre dolumunu kesinleştir",
  "Loading gift card detail…": "Hediye kartı ayrıntısı yükleniyor…",
  "Gift card detail could not be loaded": "Hediye kartı ayrıntısı yüklenemedi",
  "Gift card detail": "Hediye kartı ayrıntısı",
  "Current backend detail for {organization}. The public reference is not a payment credential.":
    "{organization} için güncel arka uç ayrıntısı. Genel referans bir ödeme kimlik bilgisi değildir.",
  "Refresh detail": "Ayrıntıyı yenile",
  "Funded amount": "Yüklenen tutar",
  "{action} completed: {from} → {to}.": "{action} tamamlandı: {from} → {to}.",
  "The backend returned {amount}.": "Arka uç {amount} iade etti.",
  "Lifecycle controls": "Yaşam döngüsü denetimleri",
  "Manage current state": "Güncel durumu yönetin",
  "The backend decides whether an action is valid using its current state, server clock, ownership, permissions, and financial rules.":
    "Bir işlemin geçerli olup olmadığına arka uç; güncel durumu, sunucu saatini, sahipliği, izinleri ve finansal kuralları kullanarak karar verir.",
  "Your role can view lifecycle detail but cannot change it.":
    "Rolünüz yaşam döngüsü ayrıntısını görüntüleyebilir ancak değiştiremez.",
  "Review lifecycle action": "Yaşam döngüsü işlemini incele",
  "Confirm {action}": "{action} işlemini onayla",
  "Current state": "Güncel durum",
  Action: "İşlem",
  Reason: "Gerekçe",
  "This action is terminal. The backend will close any pending activation and return the exact remaining ledger-derived value at most once when applicable.":
    "Bu işlem nihaidir. Arka uç bekleyen etkinleştirmeyi kapatır ve uygun olduğunda defterden türetilen kalan değeri en fazla bir kez iade eder.",
  "This changes lifecycle state but does not move card value.":
    "Bu, yaşam döngüsü durumunu değiştirir ancak kart değerini taşımaz.",
  "Applying…": "Uygulanıyor…",
  "Selected action": "Seçilen işlem",
  "Choose another": "Başka birini seç",
  "Cancellation and expiration cannot be undone and may return remaining value through a compensating Ledger operation.":
    "İptal ve süre dolumu geri alınamaz ve kalan değeri dengeleyici bir Ledger işlemiyle iade edebilir.",
  "Explain why this lifecycle change is needed":
    "Bu yaşam döngüsü değişikliğinin neden gerektiğini açıklayın",
  "Review action": "İşlemi incele",
  "No lifecycle action is currently suggested for this card. Refresh detail if its state changed elsewhere.":
    "Bu kart için şu anda önerilen bir yaşam döngüsü işlemi yok. Durumu başka bir yerde değiştiyse ayrıntıyı yenileyin.",
  "Immutable history": "Değiştirilemez geçmiş",
  "Lifecycle events": "Yaşam döngüsü olayları",
  "No lifecycle changes have been recorded for this card.":
    "Bu kart için yaşam döngüsü değişikliği kaydedilmedi.",
  "Backend value return: {amount}": "Arka uç değer iadesi: {amount}",

  // -- gift card workspace ---------------------------------------------------
  "Gift cards": "Hediye kartları",
  "Gift card workspace access is unavailable":
    "Hediye kartı çalışma alanı erişimi kullanılamıyor",
  "Your role does not include card inventory or issuance. Ask an organization administrator if you need this workspace.":
    "Rolünüz kart envanterini veya düzenlemeyi içermiyor. Bu çalışma alanına ihtiyacınız varsa bir kuruluş yöneticisine başvurun.",
  "Gift card inventory": "Hediye kartı envanteri",
  "Organization-owned cards": "Kuruluşa ait kartlar",
  "Newest-first inventory returned for {organization}. Public references are for display and support, not payment credentials.":
    "{organization} için en yeniler önce gelen envanter. Genel referanslar görüntüleme ve destek içindir, ödeme kimlik bilgisi değildir.",
  "Card inventory is unavailable": "Kart envanteri kullanılamıyor",
  "Your role can issue cards but does not include inventory viewing. The backend continues to enforce this boundary.":
    "Rolünüz kart düzenleyebilir ancak envanter görüntülemeyi içermiyor. Arka uç bu sınırı uygulamaya devam ediyor.",
  "Loading gift card inventory…": "Hediye kartı envanteri yükleniyor…",
  "Card inventory could not be loaded": "Kart envanteri yüklenemedi",
  "No cards in inventory": "Envanterde kart yok",
  "This organization does not currently own any gift cards.":
    "Bu kuruluşun şu anda hiç hediye kartı yok.",
  "View lifecycle": "Yaşam döngüsünü görüntüle",
  "Send to recipient": "Alıcıya gönder",
  "You have reached the end of this inventory.":
    "Bu envanterin sonuna ulaştınız.",
  "Ledger-funded issuance": "Ledger karşılıklı düzenleme",
  "Issue a gift card": "Hediye kartı düzenle",
  "The backend verifies funding, tenant scope, permissions, validity, currency, ownership, ledger posting, and audit.":
    "Arka uç; karşılığı, kiracı kapsamını, izinleri, geçerliliği, para birimini, sahipliği, defter kaydını ve denetimi doğrular.",
  "{reference} was issued to {organization} for {amount}.":
    "{reference}, {organization} adına {amount} tutarıyla düzenlendi.",
  "Review gift card issuance": "Hediye kartı düzenlemesini incele",
  "Confirm issuance": "Düzenlemeyi onayla",
  "Issuing…": "Düzenleniyor…",
  "Award, campaign, or order reference":
    "Ödül, kampanya veya sipariş referansı",
  "Review issuance": "Düzenlemeyi incele",
  "Your role can view card inventory but cannot issue cards.":
    "Rolünüz kart envanterini görüntüleyebilir ancak kart düzenleyemez.",

  // -- organization chooser --------------------------------------------------
  "Signed in as {email}": "{email} olarak oturum açıldı",
  "Choose your organization": "Kuruluşunuzu seçin",
  "Your selection sets the verified organization context for this session. You can change it later.":
    "Seçiminiz bu oturum için doğrulanmış kuruluş bağlamını belirler. Daha sonra değiştirebilirsiniz.",
  "Your previous organization is no longer available. Choose another organization to continue.":
    "Önceki kuruluşunuz artık kullanılamıyor. Devam etmek için başka bir kuruluş seçin.",
  "Available organizations": "Kullanılabilir kuruluşlar",
  "Code {code}": "Kod {code}",
  "Verifying…": "Doğrulanıyor…",
  Continue: "Devam et",
  "Sign out": "Oturumu kapat",

  // -- organization structure ------------------------------------------------
  "Organization structure": "Kuruluş yapısı",
  "Organization workspace access is unavailable":
    "Kuruluş çalışma alanı erişimi kullanılamıyor",
  "Your role does not include organization structure access. Ask an organization administrator if you need this workspace.":
    "Rolünüz kuruluş yapısı erişimini içermiyor. Bu çalışma alanına ihtiyacınız varsa bir kuruluş yöneticisine başvurun.",
  "Direct subsidiaries": "Doğrudan bağlı kuruluşlar",
  "Direct children of the verified organization, in backend order.":
    "Doğrulanmış kuruluşun doğrudan alt kuruluşları, arka uç sırasıyla.",
  "Showing {from}–{to}": "{from}–{to} arası gösteriliyor",
  "Subsidiary listing is unavailable": "Bağlı kuruluş listesi kullanılamıyor",
  "Your role can create subsidiaries but does not include organization viewing. The backend continues to enforce this boundary.":
    "Rolünüz bağlı kuruluş oluşturabilir ancak kuruluş görüntülemeyi içermiyor. Arka uç bu sınırı uygulamaya devam ediyor.",
  "Loading direct subsidiaries…": "Doğrudan bağlı kuruluşlar yükleniyor…",
  "Subsidiaries could not be loaded": "Bağlı kuruluşlar yüklenemedi",
  "No direct subsidiaries": "Doğrudan bağlı kuruluş yok",
  "This organization has no direct subsidiaries in the platform.":
    "Bu kuruluşun platformda doğrudan bağlı kuruluşu yok.",
  Relationship: "İlişki",
  "Direct subsidiary": "Doğrudan bağlı kuruluş",
  "Added (UTC)": "Eklenme (UTC)",
  "Subsidiary pages": "Bağlı kuruluş sayfaları",
  "Structure management": "Yapı yönetimi",
  "Add a direct subsidiary": "Doğrudan bağlı kuruluş ekle",
  "The backend verifies hierarchy depth, tenant scope, permissions, and code uniqueness.":
    "Arka uç hiyerarşi derinliğini, kiracı kapsamını, izinleri ve kod benzersizliğini doğrular.",
  "{name} was created as a direct subsidiary.":
    "{name} doğrudan bağlı kuruluş olarak oluşturuldu.",
  "Subsidiary name": "Bağlı kuruluş adı",
  "For example, North Retail": "Örneğin, Kuzey Perakende",
  "Subsidiary code": "Bağlı kuruluş kodu",
  "For example, NORTH": "Örneğin, KUZEY",
  "Creating subsidiary…": "Bağlı kuruluş oluşturuluyor…",
  "Create subsidiary": "Bağlı kuruluş oluştur",
  "Your role can view the organization structure but cannot create subsidiaries.":
    "Rolünüz kuruluş yapısını görüntüleyebilir ancak bağlı kuruluş oluşturamaz.",

  // -- POS payments ----------------------------------------------------------
  "Store / terminal": "Mağaza / terminal",
  "POS client": "POS istemcisi",
  "Receipt reference": "Fiş referansı",
  "Not supplied": "Verilmedi",
  Confirmed: "Onaylandı",
  "Not confirmed": "Onaylanmadı",
  Refunded: "İade edildi",
  Net: "Net",
  "Created (UTC)": "Oluşturulma (UTC)",
  "Fully reversed": "Tamamen geri alındı",
  "POS payment reporting is unavailable":
    "POS ödeme raporlaması kullanılamıyor",
  "Your platform account does not have payment-report access. The backend controls this permission independently from customer and POS device administration.":
    "Platform hesabınızın ödeme raporu erişimi yok. Arka uç bu izni müşteri ve POS cihaz yönetiminden bağımsız olarak denetler.",
  "Read-only operations report": "Salt okunur operasyon raporu",
  "Find POS payments": "POS ödemelerini bulun",
  "Search by business references and UTC dates. Totals and reversal status come directly from the backend.":
    "İş referanslarına ve UTC tarihlerine göre arayın. Toplamlar ve geri alma durumu doğrudan arka uçtan gelir.",
  "Store reference": "Mağaza referansı",
  "For example, STORE-101": "Örneğin, STORE-101",
  "Payment state": "Ödeme durumu",
  "Receipt or card reference": "Fiş veya kart referansı",
  "Search payments": "Ödemelerde ara",
  "All matching records": "Eşleşen tüm kayıtlar",
  "Payment totals": "Ödeme toplamları",
  "{count} matching payments": "{count} eşleşen ödeme",
  Refunds: "İadeler",
  "Payment results": "Ödeme sonuçları",
  "Loading POS payments…": "POS ödemeleri yükleniyor…",
  "POS payments could not be loaded": "POS ödemeleri yüklenemedi",
  "No payments match these filters": "Bu filtrelerle eşleşen ödeme yok",
  "Clear one or more filters and search again.":
    "Bir veya daha fazla filtreyi temizleyip yeniden arayın.",
  "Payments matching the current filters":
    "Geçerli filtrelerle eşleşen ödemeler",
  "View receipt": "Fişi görüntüle",
  Receipt: "Fiş",
  "Load more payments": "Daha fazla ödeme yükle",
  "Receipt and immutable returns": "Fiş ve değiştirilemez iadeler",
  "Payment receipt": "Ödeme fişi",
  "Close receipt": "Fişi kapat",
  "Loading receipt…": "Fiş yükleniyor…",
  "Receipt could not be loaded": "Fiş yüklenemedi",
  "Refund history": "İade geçmişi",
  "No refunds were recorded for this payment.":
    "Bu ödeme için iade kaydedilmedi.",

  // -- platform funding ------------------------------------------------------
  "Funding operations": "Fonlama işlemleri",
  "Ledger-derived balances and immutable operations for {customer}.":
    "{customer} için defterden türetilen bakiyeler ve değiştirilemez işlemler.",
  "{amount} was reversed.": "{amount} geri alındı.",
  "Available balances": "Kullanılabilir bakiyeler",
  "Loading corporate-credit balances…": "Kurumsal kredi bakiyeleri yükleniyor…",
  "Balances could not be loaded": "Bakiyeler yüklenemedi",
  "No corporate credit is available.": "Kullanılabilir kurumsal kredi yok.",
  "Allocation history": "Tahsis geçmişi",
  "Loading allocation history…": "Tahsis geçmişi yükleniyor…",
  "Allocation history could not be loaded": "Tahsis geçmişi yüklenemedi",
  "No allocations have been recorded.": "Kaydedilmiş tahsis yok.",
  "Reversed: {reason}": "Geri alındı: {reason}",
  "Review reversal": "Geri almayı incele",
  "Load more allocations": "Daha fazla tahsis yükle",
  "Your role can perform a funding action but cannot view balances or history.":
    "Rolünüz bir fonlama işlemi yapabilir ancak bakiyeleri veya geçmişi görüntüleyemez.",
  "Allocate corporate credit": "Kurumsal kredi tahsis et",
  "{amount} was allocated to {customer}.":
    "{customer} kuruluşuna {amount} tahsis edildi.",
  "Review allocation": "Tahsisi incele",
  "Confirm {currency} {amount} for {customer}, reference":
    "{customer} için {currency} {amount} tutarını onaylayın, referans",
  "Allocating…": "Tahsis ediliyor…",
  "Confirm allocation": "Tahsisi onayla",
  "Contract or order reference": "Sözleşme veya sipariş referansı",
  "Reverse allocation": "Tahsisi geri al",
  "This creates a full immutable compensating operation. The original allocation remains in history.":
    "Bu, değiştirilemez ve tam bir dengeleyici işlem oluşturur. Özgün tahsis geçmişte kalır.",
  "Confirm full reversal of {amount} for {reference}.":
    "{reference} için {amount} tutarının tamamen geri alınmasını onaylayın.",
  "Reason:": "Gerekçe:",
  "Reversing…": "Geri alınıyor…",
  "Confirm full reversal": "Tam geri almayı onayla",
  "Reversal reason": "Geri alma gerekçesi",
  "Why is this correction required?": "Bu düzeltme neden gerekli?",
  "Review full reversal": "Tam geri almayı incele",

  // -- platform customers ----------------------------------------------------
  "Customer details": "Müşteri ayrıntıları",
  "Back to customer directory": "Müşteri dizinine dön",
  "Loading customer details…": "Müşteri ayrıntıları yükleniyor…",
  "Customer details could not be loaded": "Müşteri ayrıntıları yüklenemedi",
  "Platform customer record": "Platform müşteri kaydı",
  "Read directly from the platform organization service.":
    "Doğrudan platform kuruluş servisinden okunur.",
  "Customer code": "Müşteri kodu",
  "Organization type": "Kuruluş türü",
  "Root customer": "Kök müşteri",
  "Hierarchy level {depth}": "Hiyerarşi düzeyi {depth}",
  "Added to platform (UTC)": "Platforma eklenme (UTC)",
  "Customer administration remains permission-protected. This view does not enter or impersonate the customer organization.":
    "Müşteri yönetimi izinle korunmaya devam eder. Bu görünüm müşteri kuruluşuna girmez veya onun kimliğine bürünmez.",
  "Platform operator workspace": "Platform operatör çalışma alanı",
  "POS payments": "POS ödemeleri",
  "Customer organizations": "Müşteri kuruluşları",
  "Investigate cross-tenant checkout, receipt, and refund activity.":
    "Kiracılar arası ödeme, fiş ve iade hareketlerini inceleyin.",
  "Search the platform-authorized root customer directory by company name or code.":
    "Platform yetkili kök müşteri dizininde şirket adına veya koduna göre arayın.",
  "Signed in as": "Oturum açan",
  "Signing out…": "Oturum kapatılıyor…",
  "Platform workspace": "Platform çalışma alanı",
  Customers: "Müşteriler",
  "Customer directory access is unavailable":
    "Müşteri dizini erişimi kullanılamıyor",
  "Your platform account is active, but the backend did not grant customer-directory access. Contact a platform administrator if this is unexpected.":
    "Platform hesabınız etkin, ancak arka uç müşteri dizini erişimi vermedi. Bu beklenmedik bir durumsa bir platform yöneticisine başvurun.",
  "Directory filters": "Dizin filtreleri",
  "Find a customer": "Müşteri bulun",
  "Company name or code": "Şirket adı veya kodu",
  "For example, NORTH or North Retail": "Örneğin, KUZEY veya Kuzey Perakende",
  Status: "Durum",
  "All statuses": "Tüm durumlar",
  Disabled: "Devre dışı",
  Search: "Ara",
  "Platform customers": "Platform müşterileri",
  "Directory results": "Dizin sonuçları",
  "Loading customer organizations…": "Müşteri kuruluşları yükleniyor…",
  "Customer organizations could not be loaded":
    "Müşteri kuruluşları yüklenemedi",
  "No customers match these filters": "Bu filtrelerle eşleşen müşteri yok",
  "Try a different company name, code, or status. The search is matched literally by the platform.":
    "Farklı bir şirket adı, kodu veya durumu deneyin. Arama platform tarafından birebir eşleştirilir.",
  "View customer": "Müşteriyi görüntüle",
  "Customer pages": "Müşteri sayfaları",

  // -- application shell -----------------------------------------------------
  "Verified organization context": "Doğrulanmış kuruluş bağlamı",
  "Organization code {code}": "Kuruluş kodu {code}",
  Verified: "Doğrulandı",
  "Organization workspace": "Kuruluş çalışma alanı",
  Overview: "Genel bakış",
  Cards: "Kartlar",
  Register: "Kütük",
  Team: "Ekip",
  Reconciliation: "Mutabakat",
  Audit: "Denetim",
  "Clearing context…": "Bağlam temizleniyor…",
  "Change organization": "Kuruluşu değiştir",

  // -- team ------------------------------------------------------------------
  "Organization and subsidiaries": "Kuruluş ve bağlı kuruluşlar",
  "Current organization": "Geçerli kuruluş",
  "Customer access": "Müşteri erişimi",
  "Organization access": "Kuruluş erişimi",
  "Read-only membership roster for {organization}. This does not enter or impersonate the customer.":
    "{organization} için salt okunur üyelik listesi. Bu görünüm müşteriye girmez veya onun kimliğine bürünmez.",
  "Memberships and roles for {organization}. Authorization and tenant scope remain enforced by the backend. To prevent lockout, you cannot disable your current membership.":
    "{organization} için üyelikler ve roller. Yetkilendirme ve kiracı kapsamı arka uç tarafından uygulanmaya devam eder. Erişiminizi kaybetmemeniz için kendi üyeliğinizi devre dışı bırakamazsınız.",
  "Team roster access is unavailable": "Ekip listesi erişimi kullanılamıyor",
  "Your role does not include membership viewing.":
    "Rolünüz üyelik görüntülemeyi içermiyor.",
  "Loading team members…": "Ekip üyeleri yükleniyor…",
  "Team members could not be loaded": "Ekip üyeleri yüklenemedi",
  "No team members": "Ekip üyesi yok",
  "The backend returned no memberships for this organization.":
    "Arka uç bu kuruluş için üyelik döndürmedi.",
  "Email unavailable": "E-posta kullanılamıyor",
  "Your membership": "Sizin üyeliğiniz",
  "Role assignments for {member}": "{member} için rol atamaları",
  "this member": "bu üye",
  "Disable member": "Üyeyi devre dışı bırak",
  "Team member pages": "Ekip üyesi sayfaları",
  "Membership management": "Üyelik yönetimi",
  "Add an existing account": "Mevcut bir hesabı ekleyin",
  "This does not invite or create an account. The email must already belong to an active platform user.":
    "Bu işlem davet göndermez veya hesap oluşturmaz. E-posta zaten etkin bir platform kullanıcısına ait olmalıdır.",
  "Account email": "Hesap e-postası",
  "Review member": "Üyeyi incele",
  "Role management": "Rol yönetimi",
  "Roles and assignments": "Roller ve atamalar",
  "Permissions are additive. This slice does not revoke permissions, assignments, or memberships.":
    "İzinler eklemelidir. Bu bölüm izinleri, atamaları veya üyelikleri geri almaz.",
  "Your role can create roles but cannot list existing roles.":
    "Rolünüz rol oluşturabilir ancak mevcut rolleri listeleyemez.",
  "No roles are currently available.": "Şu anda kullanılabilir rol yok.",
  "No permissions granted": "Verilmiş izin yok",
  "1 current assignment": "1 güncel atama",
  "{count} current assignments": "{count} güncel atama",
  "New role name": "Yeni rol adı",
  "Review new role": "Yeni rolü incele",
  "Role to extend": "Genişletilecek rol",
  "Choose a role": "Bir rol seçin",
  "Permissions to add": "Eklenecek izinler",
  "Review permission grant": "İzin verilmesini incele",
  "Team member": "Ekip üyesi",
  "Choose a member": "Bir üye seçin",
  Role: "Rol",
  Scope: "Kapsam",
  "Review role assignment": "Rol atamasını incele",
  Confirmation: "Onay",
  "Review access change": "Erişim değişikliğini incele",
  "Add the existing account {email} to this organization.":
    "Mevcut {email} hesabını bu kuruluşa ekleyin.",
  "Disable {email}. They will lose this organization membership.":
    "{email} devre dışı bırakılacak. Bu kuruluş üyeliğini kaybedecek.",
  "Create the role “{name}”.": "“{name}” rolünü oluşturun.",
  "Add 1 permission to {role}.": "{role} rolüne 1 izin ekleyin.",
  "Add {count} permissions to {role}.": "{role} rolüne {count} izin ekleyin.",
  "the selected role": "seçilen rol",
  "Assign {role} to {member} for {scope}.":
    "{role} rolünü {scope} kapsamında {member} kullanıcısına atayın.",
  "the selected member": "seçilen üye",
  "the organization and its subsidiaries": "kuruluş ve bağlı kuruluşları",
  "the current organization": "geçerli kuruluş",
  "Applying change…": "Değişiklik uygulanıyor…",
  "Confirm access change": "Erişim değişikliğini onayla",
  "Go back": "Geri dön",
};
