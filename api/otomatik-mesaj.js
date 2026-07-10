export default async function handler(req, res) {
  try {
    // 1. GÖNDERİLECEK NUMARA VE API BİLGİLERİ
    const adminPhone = "905424081899";
    const ULTRAMSG_INSTANCE_ID = "instance184322";
    const ULTRAMSG_TOKEN = "r61y4pgaeu93vu7p";

    // 2. FİREBASE VERİTABANINDAN VERİLERİ ÇEKME (REST API)
    const fbUrl = "https://firestore.googleapis.com/v1/projects/mete-73d7c/databases/(default)/documents/araclar";
    const response = await fetch(fbUrl);
    const fbData = await response.json();

    if (!fbData.documents) {
      return res.status(200).json({ message: "Araç bulunamadı." });
    }

    // Bugünü ayarla
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let yaklasanAraclar = [];
    
    // En yakın aracı bulmak için kullanacağımız değişkenler
    let enYakinArac = null; 
    let minGun = Infinity; 

    // 3. TARİH HESAPLAMALARI
    fbData.documents.forEach(doc => {
      const fields = doc.fields;
      const plaka = fields.plaka?.stringValue || "";
      const sorumlu = fields.sorumluAdi?.stringValue || "";
      const muayene = fields.muayeneTarihi?.stringValue || "";
      const sigorta = fields.sigortaTarihi?.stringValue || "";

      let islemler = [];

      // Muayene Kontrolü
      if (muayene) {
        const mDate = new Date(muayene); 
        mDate.setHours(0, 0, 0, 0);
        const diff = Math.ceil((mDate - today) / (1000 * 60 * 60 * 24));
        
        if (diff >= 0 && diff <= 7) {
          islemler.push(`Muayene (${diff} gün kaldı)`);
        }
        // Eğer bu tarih bugüne kadarki en yakın tarihse, kaydet
        if (diff >= 0 && diff < minGun) {
          minGun = diff;
          enYakinArac = { plaka, sorumlu, islem: "Muayene", gun: diff, tarih: muayene };
        }
      }

      // Sigorta Kontrolü
      if (sigorta) {
        const sDate = new Date(sigorta); 
        sDate.setHours(0, 0, 0, 0);
        const diff = Math.ceil((sDate - today) / (1000 * 60 * 60 * 24));
        
        if (diff >= 0 && diff <= 7) {
          islemler.push(`Sigorta (${diff} gün kaldı)`);
        }
        // Eğer bu tarih bugüne kadarki en yakın tarihse, kaydet
        if (diff >= 0 && diff < minGun) {
          minGun = diff;
          enYakinArac = { plaka, sorumlu, islem: "Sigorta", gun: diff, tarih: sigorta };
        }
      }

      // Acil olanları listeye ekle
      if (islemler.length > 0) {
        yaklasanAraclar.push(`🚗 *${plaka}* - ${sorumlu}\n⚠️ *İşlem:* ${islemler.join(' / ')}`);
      }
    });

    // 4. MESAJ ŞABLONUNU BELİRLE VE WHATSAPP'A GÖNDER
    let mesaj = "";

    if (yaklasanAraclar.length > 0) {
      // SENARYO 1: Acil (7 gün veya altı) araç varsa
      mesaj = `🔔 *Taşdoğan Unlu Mamulleri - Günlük Otomatik Rapor*\n\nİyi akşamlar, sistemimizde süresine 7 gün veya daha az kalmış araçlar tespit edilmiştir:\n\n`;
      mesaj += yaklasanAraclar.join('\n\n');
    } else if (enYakinArac) {
      // SENARYO 2: Acil araç yok, en yakın tarihi gönder
      mesaj = `🔔 *Taşdoğan Unlu Mamulleri - Günlük Otomatik Rapor*\n\nİyi akşamlar. Filomuzda şu an için acil (7 gün veya daha az kalmış) bir işlem bulunmamaktadır.\n\n*Takip Edilecek İlk İşlem:*\n🚗 *${enYakinArac.plaka}* (${enYakinArac.sorumlu})\n🗓️ *${enYakinArac.islem}:* ${enYakinArac.tarih} (${enYakinArac.gun} gün sonra)`;
    } else {
      // Hiç geçerli tarih yoksa sistemi yorma
      return res.status(200).json({ success: true, message: "İleri tarihli hiçbir işlem bulunamadı." });
    }

    // İmza ekle
    mesaj += `\n\n_Bu rapor sistem tarafından her akşam 21:45'te otomatik iletilmektedir._`;

    // API İstegi
    const ultraUrl = `https://api.ultramsg.com/${ULTRAMSG_INSTANCE_ID}/messages/chat`;
    const formData = new URLSearchParams();
    formData.append("token", ULTRAMSG_TOKEN);
    formData.append("to", `+${adminPhone}`);
    formData.append("body", mesaj);

    await fetch(ultraUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData
    });

    return res.status(200).json({ success: true, durum: yaklasanAraclar.length > 0 ? "Acil Durum Bildirildi" : "En Yakın Tarih Bildirildi" });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
