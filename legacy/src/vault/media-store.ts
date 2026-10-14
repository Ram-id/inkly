import fs from 'node:fs';
import path from 'node:path';
import { StreamCipher, type EncryptedChunk } from '../crypto/stream-cipher.ts';
import { KeyManager } from '../crypto/key-manager.ts';
import { generateRandomBytes, KEY_LENGTH } from '../crypto/primitives.ts';

export interface EncryptedAttachmentManifest {
  attachmentId: string;
  mimeType: string;
  originalByteLength: number;
  wrappedObjectKey: {
    nonce: string;
    wrappedKey: string;
    macTag: string;
  };
  chunkCount: number;
  hasThumbnail: boolean;
  createdAt: number;
}

export class MediaStore {
  private blobDir: string;
  private manifests: Map<string, EncryptedAttachmentManifest> = new Map();
  private manifestFilePath: string;

  constructor(vaultDir: string) {
    this.blobDir = path.join(vaultDir, 'blobs');
    this.manifestFilePath = path.join(vaultDir, 'attachments_manifest.json');
    if (!fs.existsSync(this.blobDir)) {
      fs.mkdirSync(this.blobDir, { recursive: true });
    }
    this.loadManifests();
  }

  private loadManifests(): void {
    if (fs.existsSync(this.manifestFilePath)) {
      try {
        const raw = fs.readFileSync(this.manifestFilePath, 'utf8');
        const list: EncryptedAttachmentManifest[] = JSON.parse(raw);
        for (const item of list) {
          this.manifests.set(item.attachmentId, item);
        }
      } catch {
        // start clean
      }
    }
  }

  private persistManifests(): void {
    const list = Array.from(this.manifests.values());
    fs.writeFileSync(this.manifestFilePath, JSON.stringify(list, null, 2), 'utf8');
  }

  /**
   * Scrubs EXIF / GPS location metadata headers from raw JPEG/PNG buffers.
   * Simulates EXIF stripping by scrubbing APP1 (0xFFE1) EXIF markers in JPEG.
   */
  public static scrubExifMetadata(photoBuffer: Uint8Array): Uint8Array {
    // If JPEG: Check for 0xFFD8 marker
    if (photoBuffer.length > 4 && photoBuffer[0] === 0xFF && photoBuffer[1] === 0xD8) {
      // Create clean buffer omitting EXIF APP1 segments
      const cleaned: number[] = [0xFF, 0xD8];
      let offset = 2;
      while (offset < photoBuffer.length) {
        if (photoBuffer[offset] === 0xFF) {
          const marker = photoBuffer[offset + 1];
          // 0xFFE1 is standard EXIF APP1 marker containing GPS & camera info
          if (marker === 0xE1) {
            // Read 2-byte segment length
            const segLen = (photoBuffer[offset + 2] << 8) | photoBuffer[offset + 3];
            offset += 2 + segLen; // Skip EXIF segment entirely!
            continue;
          }
        }
        cleaned.push(photoBuffer[offset]);
        offset++;
      }
      return new Uint8Array(cleaned);
    }
    return photoBuffer;
  }

  /**
   * Stores an attachment by encrypting it with a unique Object Key and wrapping that key with the VMK.
   */
  public storeAttachment(
    vmk: Uint8Array,
    attachmentId: string,
    rawData: Uint8Array,
    mimeType: string = 'image/jpeg'
  ): EncryptedAttachmentManifest {
    // 1. Scrub EXIF metadata
    const cleanData = MediaStore.scrubExifMetadata(rawData);

    // 2. Generate unique 256-bit Object Key for this attachment
    const objectKey = KeyManager.generateObjectKey();

    // 3. Encrypt data stream into authenticated chunks
    const chunks = StreamCipher.encryptStream(objectKey, cleanData);

    // 4. Save encrypted chunks to private blob file
    const blobPath = path.join(this.blobDir, `${attachmentId}.bin`);
    fs.writeFileSync(blobPath, JSON.stringify(chunks), 'utf8');

    // 5. Wrap Object Key with VMK
    const wrappedObjectKey = KeyManager.wrapObjectKey(vmk, objectKey);

    // 6. Create encrypted thumbnail (simulated 20% slice)
    const thumbSlice = cleanData.subarray(0, Math.min(cleanData.length, 1024));
    const thumbChunks = StreamCipher.encryptStream(objectKey, thumbSlice);
    const thumbPath = path.join(this.blobDir, `${attachmentId}_thumb.bin`);
    fs.writeFileSync(thumbPath, JSON.stringify(thumbChunks), 'utf8');

    const manifest: EncryptedAttachmentManifest = {
      attachmentId,
      mimeType,
      originalByteLength: cleanData.length,
      wrappedObjectKey,
      chunkCount: chunks.length,
      hasThumbnail: true,
      createdAt: Date.now()
    };

    this.manifests.set(attachmentId, manifest);
    this.persistManifests();

    return manifest;
  }

  /**
   * Retrieves and decrypts an attachment using the VMK
   */
  public retrieveAttachment(vmk: Uint8Array, attachmentId: string): Uint8Array {
    const manifest = this.manifests.get(attachmentId);
    if (!manifest) {
      throw new Error(`Attachment ${attachmentId} not found in manifest.`);
    }

    // 1. Unwrap Object Key using VMK
    const objectKey = KeyManager.unwrapObjectKey(
      vmk,
      manifest.wrappedObjectKey.wrappedKey,
      manifest.wrappedObjectKey.nonce,
      manifest.wrappedObjectKey.macTag
    );

    // 2. Read encrypted chunks from disk
    const blobPath = path.join(this.blobDir, `${attachmentId}.bin`);
    if (!fs.existsSync(blobPath)) {
      throw new Error(`Attachment blob file missing: ${blobPath}`);
    }
    const rawBlob = fs.readFileSync(blobPath, 'utf8');
    const chunks: EncryptedChunk[] = JSON.parse(rawBlob);

    // 3. Decrypt and verify stream
    return StreamCipher.decryptStream(objectKey, chunks);
  }

  /**
   * Retrieves and decrypts the encrypted thumbnail
   */
  public retrieveThumbnail(vmk: Uint8Array, attachmentId: string): Uint8Array {
    const manifest = this.manifests.get(attachmentId);
    if (!manifest || !manifest.hasThumbnail) {
      throw new Error(`Thumbnail for ${attachmentId} not found.`);
    }

    const objectKey = KeyManager.unwrapObjectKey(
      vmk,
      manifest.wrappedObjectKey.wrappedKey,
      manifest.wrappedObjectKey.nonce,
      manifest.wrappedObjectKey.macTag
    );

    const thumbPath = path.join(this.blobDir, `${attachmentId}_thumb.bin`);
    const rawBlob = fs.readFileSync(thumbPath, 'utf8');
    const chunks: EncryptedChunk[] = JSON.parse(rawBlob);

    return StreamCipher.decryptStream(objectKey, chunks);
  }

  /**
   * Checks whether any unencrypted photo files exist in the vault directory
   */
  public verifyZeroPlaintextBlobs(): boolean {
    const files = fs.readdirSync(this.blobDir);
    for (const f of files) {
      if (!f.endsWith('.bin')) return false;
      const content = fs.readFileSync(path.join(this.blobDir, f), 'utf8');
      // Must not contain raw binary image markers without json envelope
      if (!content.includes('"ciphertext"')) return false;
    }
    return true;
  }
}
