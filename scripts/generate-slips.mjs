// One-off generator for Inkly bottle slips. The API key is read from the environment and is
// never written to disk. Usage: GEMINI_KEY=... node generate.mjs <outdir>
import { writeFileSync, mkdirSync } from 'node:fs';

const KEY = process.env.GEMINI_KEY;
const OUT = process.argv[2];
const MODEL = process.env.GEMINI_MODEL ?? 'gemini-flash-latest';
mkdirSync(OUT, { recursive: true });

const EMOTIONS = {
  senang: 'senang / bahagia — sedang merasa ringan, gembira, bersyukur atas hari ini',
  semangat: 'semangat / termotivasi — punya energi, ingin mencoba hal baru, bersemangat',
  tenang: 'tenang / damai — santai, cukup, sedang menikmati momen pelan',
  rindu: 'rindu / kangen — merindukan seseorang, tempat, atau masa lalu',
  lelah: 'lelah / capek — kehabisan tenaga, butuh istirahat, jenuh',
  cemas: 'cemas / khawatir — overthinking, gelisah, takut akan sesuatu yang belum terjadi',
  sedih: 'sedih / murung — sedang patah hati, kecewa, atau ingin menangis',
  marah: 'marah / kesal — frustrasi, merasa tidak adil, emosi sedang naik'
};

const schema = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      kind: { type: 'STRING', enum: ['afirmasi', 'pertanyaan', 'penyemangat', 'langkah'] },
      text: { type: 'STRING' }
    },
    required: ['kind', 'text']
  }
};

const prompt = (emotion, desc) => `Kamu menulis isi gulungan kertas kecil untuk sebuah "botol perasaan" di aplikasi jurnal pribadi berbahasa Indonesia.
Pemilik jurnal mengambil kertas berwarna sesuai perasaannya saat ini, lalu membaca isinya dan menulis jurnal.

Perasaan untuk warna kertas ini: ${desc}.

Tulis 48 isi kertas yang berbeda-beda, dengan komposisi:
- 14 "afirmasi": kalimat afirmasi diri orang pertama ("Aku ...") yang hangat dan realistis, cocok untuk perasaan ini.
- 14 "pertanyaan": pertanyaan refleksi untuk dijawab di jurnal, menyapa dengan "kamu".
- 10 "penyemangat": kata-kata lembut untuk pembaca, seperti pesan dari sahabat, menyapa dengan "kamu".
- 10 "langkah": satu tindakan kecil yang bisa dilakukan dalam 5 menit untuk merawat diri atau menyalurkan perasaan ini.

Aturan:
- Bahasa Indonesia sehari-hari yang hangat dan santai, tidak kaku, tidak menggurui, tidak puitis berlebihan.
- Netral gender. Jangan menyebut agama tertentu.
- Maksimal 120 karakter per isi. Tanpa emoji, tanpa tanda pagar.
- Untuk perasaan berat (sedih, cemas, marah, lelah): validasi dulu perasaannya, jangan memaksa positif (hindari toxic positivity), jangan memberi nasihat medis. Boleh 1 isi yang lembut mengingatkan untuk bercerita ke orang yang dipercaya.
- Untuk "marah": salurkan dengan aman, jangan menyarankan konfrontasi.
- Setiap isi harus unik, jangan mengulang pola kalimat yang sama.`;

async function generate(emotion, desc) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt(emotion, desc) }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 1 }
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${emotion}: ${JSON.stringify(data.error ?? data).slice(0, 300)}`);
  return JSON.parse(data.candidates[0].content.parts[0].text);
}

const only = process.argv[3]?.split(',');
const results = [];
for (const [e, d] of Object.entries(EMOTIONS).filter(([e]) => !only || only.includes(e))) results.push(await (async () => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const items = await generate(e, d);
        writeFileSync(`${OUT}/${e}.json`, JSON.stringify(items, null, 1));
        return `${e}: ${items.length}`;
      } catch (err) {
        if (attempt === 3) return `${e}: FAILED ${err.message}`;
        await new Promise((r) => setTimeout(r, 15000 * attempt));
      }
    }
  })());
console.log(results.join('\n'));
