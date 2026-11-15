# Onboarding Portal — v2'de Yapılacaklar

v1 = IHK teslimi. Aşağıdakiler bilerek v1 dışında bırakıldı; v1 altyapısı bunlara uygun kurulur ama kendileri yapılmaz.

## Giriş ve entegrasyon
- [ ] SSO ile giriş (Microsoft Entra / Google Workspace) — Antrag "Anbindung an bestehende Systeme"yi kapsam dışı tutuyor

## Bildirimler
- [ ] E-posta bildirimleri (yeni adım, sayfa güncellendi, onboarding tamamlandı, etkinlik duyurusu)
- [ ] Anlık bildirim (SSE) — v1'de 60 sn polling + sekme odağında yenileme

## İçerik
- [ ] Ekip liderinin kendi ekibinin içeriğini düzenleyebilmesi
- [ ] Sayfalara PDF / video eki
- [ ] İçerik sürüm geçmişi (eski sürümü görme / geri alma)
- [ ] İçerik büyük ölçüde değişince zorunlu yeniden onay
- [ ] Görseller için S3 uyumlu depolama (StorageAdapter hazır)

## Planlar ve şablonlar
- [ ] Okuma dışı görevler (checklist: "laptop teslim alındı" vb.)
- [ ] Plana serbest metinli özel adım ("Max ile tanış")
- [ ] Şablon değişikliğini aktif planlara uygulama seçeneği
- [ ] Başlangıç tarihine göre son tarihler ve gecikme uyarıları

## Organizasyon ve yönetim
- [ ] İkiden fazla organizasyon seviyesi (Departman → Ekip ötesi hiyerarşi)
- [ ] Tam audit log — v1'de yalnızca "son düzenleyen + tarih"
- [ ] Arşivlenmiş kullanıcı verisinin 6 ay sonra otomatik silinmesi
- [ ] Ayarlar sayfası (v1'de sabitler `src/config/app.ts`'te)

## Etkinlikler
- [ ] Tekrarlayan etkinlikler (yıllık Hackathon, Company Week)

## Altyapı
- [ ] Şirket sunucusuna kurulum ve otomatik deploy
- [ ] Yedekleme ve geri yükleme prosedürü
