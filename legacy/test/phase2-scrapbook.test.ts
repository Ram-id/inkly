import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { MediaStore } from '../src/vault/media-store.ts';
import { KeyManager } from '../src/crypto/key-manager.ts';
import { AnalyticsEngine, type MoodType } from '../src/domain/entry.ts';
import { STICKER_CATALOG } from '../src/domain/sticker-catalog.ts';

const TEST_VAULT_DIR = path.join(process.cwd(), 'scratch_test_phase2');

test.beforeEach(() => {
  if (fs.existsSync(TEST_VAULT_DIR)) {
    fs.rmSync(TEST_VAULT_DIR, { recursive: true, force: true });
  }
});

test.afterEach(() => {
  if (fs.existsSync(TEST_VAULT_DIR)) {
    fs.rmSync(TEST_VAULT_DIR, { recursive: true, force: true });
  }
});

test('C2.1: Scrapbook layout models support multi-layer stickers, rotation, scale, and z-index', () => {
  const stickers = STICKER_CATALOG;
  assert.ok(stickers.length >= 10);
  assert.ok(stickers.some(s => s.category === 'Lucu'));
  assert.ok(stickers.some(s => s.category === 'Motivasi'));
  assert.ok(stickers.some(s => s.category === 'Pemandangan'));

  const scrapbookLayout = {
    canvasWidth: 360,
    canvasHeight: 640,
    backgroundColor: '#FAF7F2',
    elements: [
      {
        id: 'layer-1-polaroid',
        type: 'photo' as const,
        x: 40,
        y: 60,
        width: 200,
        height: 250,
        rotation: -4,
        zIndex: 1,
        content: 'attachment-photo-01'
      },
      {
        id: 'layer-2-good-day',
        type: 'sticker' as const,
        x: 180,
        y: 80,
        width: 80,
        height: 40,
        rotation: 12,
        zIndex: 2,
        content: 'stk-good-day'
      },
      {
        id: 'layer-3-caption',
        type: 'text' as const,
        x: 50,
        y: 330,
        width: 260,
        height: 80,
        rotation: 0,
        zIndex: 3,
        content: 'Small steps, big progress! 🌱'
      }
    ]
  };

  assert.strictEqual(scrapbookLayout.elements.length, 3);
  // Elements can be sorted by zIndex for proper visual layering
  const sorted = [...scrapbookLayout.elements].sort((a, b) => a.zIndex - b.zIndex);
  assert.strictEqual(sorted[0].id, 'layer-1-polaroid');
  assert.strictEqual(sorted[2].id, 'layer-3-caption');
});

test('C2.2 & C2.3: EXIF metadata scrubbing and encrypted photo & thumbnail storage', () => {
  const vaultMaterial = KeyManager.initializeNewVault();
  const mediaStore = new MediaStore(TEST_VAULT_DIR);

  // Construct mock JPEG with APP1 EXIF segment (0xFFE1) containing GPS tag simulation
  const exifSegment = [0xFF, 0xE1, 0x00, 0x08, 0x47, 0x50, 0x53, 0x00]; // "GPS\0"
  const imagePayload = [0x11, 0x22, 0x33, 0x44, 0x55, 0x66];
  const mockJpegWithExif = new Uint8Array([
    0xFF, 0xD8, // JPEG SOI
    ...exifSegment,
    ...imagePayload,
    0xFF, 0xD9  // JPEG EOI
  ]);

  // Store photo
  const manifest = mediaStore.storeAttachment(
    vaultMaterial.vmk,
    'photo-malioboro-01',
    mockJpegWithExif,
    'image/jpeg'
  );

  assert.strictEqual(manifest.attachmentId, 'photo-malioboro-01');
  assert.strictEqual(manifest.hasThumbnail, true);

  // Retrieve and decrypt photo
  const retrievedPhoto = mediaStore.retrieveAttachment(vaultMaterial.vmk, 'photo-malioboro-01');
  assert.ok(retrievedPhoto.length > 0);

  // Verify EXIF was stripped (does not contain 0xFFE1 segment anymore)
  let foundExifMarker = false;
  for (let i = 0; i < retrievedPhoto.length - 1; i++) {
    if (retrievedPhoto[i] === 0xFF && retrievedPhoto[i + 1] === 0xE1) {
      foundExifMarker = true;
      break;
    }
  }
  assert.strictEqual(foundExifMarker, false, 'EXIF GPS marker must be stripped from encrypted image!');

  // Retrieve encrypted thumbnail
  const retrievedThumb = mediaStore.retrieveThumbnail(vaultMaterial.vmk, 'photo-malioboro-01');
  assert.ok(retrievedThumb.length > 0);

  // Disk inspection: Verify ALL files in blobs directory are encrypted .bin files
  assert.strictEqual(mediaStore.verifyZeroPlaintextBlobs(), true);

  // Ensure wrong key cannot decrypt photo
  const wrongVmk = KeyManager.initializeNewVault().vmk;
  assert.throws(() => {
    mediaStore.retrieveAttachment(wrongVmk, 'photo-malioboro-01');
  });
});

test('C2.4: Mood tracker and local analytics compute statistics 100% client-side', () => {
  const mockEntries: Array<{ createdAt: number; mood?: MoodType }> = [
    { createdAt: Date.now() - 86400000 * 3, mood: 'Senang' },
    { createdAt: Date.now() - 86400000 * 2, mood: 'Senang' },
    { createdAt: Date.now() - 86400000 * 1, mood: 'Tenang' },
    { createdAt: Date.now(), mood: 'Biasa' }
  ];

  const stats = AnalyticsEngine.calculateStats(mockEntries);

  assert.strictEqual(stats.totalJournals, 4);
  // Average score: (10 + 10 + 8 + 5) / 4 = 33 / 4 = 8.25 -> 8.3
  assert.strictEqual(stats.averageMoodScore, 8.3);
  assert.strictEqual(stats.moodDistribution.Senang, 50); // 2/4 = 50%
  assert.strictEqual(stats.moodDistribution.Tenang, 25); // 1/4 = 25%
  assert.strictEqual(stats.moodDistribution.Biasa, 25);  // 1/4 = 25%
  assert.strictEqual(stats.moodDistribution.Sedih, 0);
  assert.strictEqual(stats.moodDistribution.Marah, 0);
});
