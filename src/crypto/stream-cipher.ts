import {
  encryptAead,
  decryptAead,
  generateRandomBytes,
  NONCE_LENGTH,
  TAG_LENGTH
} from './primitives.ts';

export const CHUNK_SIZE = 64 * 1024; // 64 KiB chunks

export interface EncryptedChunk {
  sequenceNumber: number;
  isFinal: boolean;
  nonce: string;
  ciphertext: string;
  macTag: string;
}

export class StreamCipher {
  /**
   * Encrypts a binary stream/buffer into authenticated chunks
   */
  public static encryptStream(
    key: Uint8Array,
    data: Uint8Array
  ): EncryptedChunk[] {
    const chunks: EncryptedChunk[] = [];
    const totalBytes = data.length;
    let offset = 0;
    let seq = 0;

    if (totalBytes === 0) {
      // Empty file case
      const nonce = generateRandomBytes(NONCE_LENGTH);
      const aad = Buffer.from(`CHUNK:${seq}:FINAL`);
      const { ciphertext, tag } = encryptAead(key, nonce, new Uint8Array(0), aad);
      chunks.push({
        sequenceNumber: 0,
        isFinal: true,
        nonce: Buffer.from(nonce).toString('base64'),
        ciphertext: Buffer.from(ciphertext).toString('base64'),
        macTag: Buffer.from(tag).toString('base64')
      });
      return chunks;
    }

    while (offset < totalBytes) {
      const end = Math.min(offset + CHUNK_SIZE, totalBytes);
      const chunkData = data.subarray(offset, end);
      const isFinal = end === totalBytes;

      const nonce = generateRandomBytes(NONCE_LENGTH);
      const aad = Buffer.from(`CHUNK:${seq}:${isFinal ? 'FINAL' : 'PART'}`);

      const { ciphertext, tag } = encryptAead(key, nonce, chunkData, aad);

      chunks.push({
        sequenceNumber: seq,
        isFinal,
        nonce: Buffer.from(nonce).toString('base64'),
        ciphertext: Buffer.from(ciphertext).toString('base64'),
        macTag: Buffer.from(tag).toString('base64')
      });

      offset = end;
      seq++;
    }

    return chunks;
  }

  /**
   * Decrypts authenticated chunks back into the original binary stream.
   * Throws if chunks are reordered, missing, truncated, or tampered.
   */
  public static decryptStream(
    key: Uint8Array,
    chunks: EncryptedChunk[]
  ): Uint8Array {
    if (chunks.length === 0) {
      throw new Error('No chunks provided for stream decryption');
    }

    const decryptedBuffers: Uint8Array[] = [];
    let expectedSeq = 0;
    let foundFinal = false;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      if (chunk.sequenceNumber !== expectedSeq) {
        throw new Error(
          `Chunk sequencing violation: expected chunk ${expectedSeq}, got ${chunk.sequenceNumber}. Possible reordering or chunk deletion attack.`
        );
      }

      if (foundFinal) {
        throw new Error('Illegal chunk encountered after final chunk flag. Stream splicing detected.');
      }

      if (chunk.isFinal) {
        foundFinal = true;
      }

      const nonce = new Uint8Array(Buffer.from(chunk.nonce, 'base64'));
      const ciphertext = new Uint8Array(Buffer.from(chunk.ciphertext, 'base64'));
      const tag = new Uint8Array(Buffer.from(chunk.macTag, 'base64'));
      const aad = Buffer.from(`CHUNK:${chunk.sequenceNumber}:${chunk.isFinal ? 'FINAL' : 'PART'}`);

      const decrypted = decryptAead(key, nonce, ciphertext, tag, aad);
      decryptedBuffers.push(decrypted);

      expectedSeq++;
    }

    if (!foundFinal) {
      throw new Error('Incomplete stream: final chunk flag was never received. Possible truncation attack.');
    }

    // Concatenate all decrypted chunks
    const totalLength = decryptedBuffers.reduce((acc, curr) => acc + curr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of decryptedBuffers) {
      result.set(buf, offset);
      offset += buf.length;
    }

    return result;
  }
}
