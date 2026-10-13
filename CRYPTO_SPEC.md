# CRYPTO_SPEC.md --- Inkly Cryptographic Specification & Key Management

**Version:** 1.0  
**Date:** October 13, 2026  
**Status:** Approved Technical Specification  
**Compliance:** RFC 8439 (ChaCha20-Poly1305), RFC 5869 (HKDF), RFC 9106 (Argon2id), BIP-39 (Mnemonic Codes)  

---

## 1. Principles & Cryptographic Mandates

1. **Zero Proprietary Cryptography:** Only standard, peer-reviewed, RFC-specified primitives and audited implementations (libsodium / WebCrypto / standard Node crypto) are permitted.
2. **Authenticated Encryption Exclusively (AEAD):** Every ciphertext payload MUST be authenticated with an integrity MAC tag prior to processing plaintext. Decryption fails immediately and atomically upon MAC verification failure.
3. **Collision-Resistant Nonce Safety:** All nonces generated across distributed, offline-first mobile devices MUST use algorithms immune to random collision. `XChaCha20-Poly1305` with 192-bit (24-byte) CSPRNG nonces is the primary AEAD standard.
4. **Zero Plaintext Key Exfiltration:** Plaintext keys (`RK`, `VMK`, `OK`, `DPK`) must never be transmitted to the backend, never written to disk unencrypted, and never logged or included in crash telemetry.

---

## 2. Cryptographic Primitive Selection

| Primitive Role | Algorithm Standard | Parameters | Implementation Library | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **Symmetric AEAD (Primary)** | `XChaCha20-Poly1305` | Key: 256 bits (32 bytes)<br>Nonce: 192 bits (24 bytes)<br>Tag: 128 bits (16 bytes) | `libsodium` (`crypto_aead_xchacha20poly1305_ietf`) / `@noble/ciphers` | Extended 192-bit nonce permits stateless random generation across multiple offline devices without birthday-bound collision risk ($2^{96}$ collision threshold vs $2^{32}$ in 96-bit AES-GCM). Constant time on all ARM CPUs. |
| **Symmetric AEAD (Streaming Blobs)** | `crypto_secretstream_xchacha20poly1305` (or 64KB Chunked AEAD) | Chunk Size: 65,536 bytes<br>Header: 24-byte subkey/nonce state | `libsodium` / Chunked AEAD | Secure streaming of large photos/audio without loading full file into memory; protects against chunk reordering, truncation, and splicing attacks. |
| **Key Derivation (High Entropy)** | `HKDF-SHA256` (RFC 5869) | Hash: SHA-256<br>Salt: 32 bytes CSPRNG<br>Info: Domain-specific tag | Standard crypto library / RFC 5869 | Optimal, lightweight, standards-compliant pseudorandom expansion for 256-bit uniform random keys (Recovery Key -> Wrapping Key). |
| **Password/PIN KDF (Low Entropy)** | `Argon2id` (RFC 9106) | Memory: 19,456 KiB (19 MiB)<br>Iterations: 2<br>Parallelism: 1 | `libsodium` / `argon2` | OWASP recommended minimum for memory-hard defense against GPU/ASIC brute forcing of user PINs/passwords. |
| **Random Number Generation** | CSPRNG | 256-bit entropy | `crypto.getRandomValues()` / `SecRandomCopyBytes` / `SecureRandom` | Cryptographically secure platform PRNG. |
| **Mnemonic Wordlist** | BIP-39 English (24 words) | 256 bits entropy + 8 bits checksum = 264 bits | Audited BIP-39 implementation | Human-readable backup with built-in error detection preventing user transcription mistakes. |

---

## 3. Key Hierarchy & Cryptographic Architecture

```
                               +-----------------------------+
                               |     USER RECOVERY KEY       |
                               | (RK: 256-bit CSPRNG Entropy)|
                               |   Encoded as 24 BIP-39 words|
                               |     *NEVER SENT TO CLOUD*   |
                               +-----------------------------+
                                              |
                                              | HKDF-SHA256
                                              | Salt: 32 bytes (cloud stored)
                                              | Info: "Inkly-VMK-Wrapping-v1"
                                              v
                               +-----------------------------+
                               |       WRAPPING KEY          |
                               |      (WK: 256 bits)         |
                               +-----------------------------+
                                              |
                                              | XChaCha20-Poly1305 Encrypt
                                              v
+-------------------------------+      +-----------------------------+
|    DEVICE HARDWARE ENCLAVE    |      |         WRAPPED VMK         |
| (Android Keystore / StrongBox)|      |  Ciphertext + 24B Nonce     |
| (iOS Keychain / Secure Enclave|      |  *Safe to store on Cloud*   |
+-------------------------------+      +-----------------------------+
               |                                      |
               | Protects local copy                  | Restores VMK on new device
               v                                      v
+--------------------------------------------------------------------+
|                      VAULT MASTER KEY (VMK)                        |
|                     (256-bit random symmetric key)                 |
|             Kept in RAM only while vault is unlocked               |
+--------------------------------------------------------------------+
                                  |
                                  | Wraps individual Object Keys
                                  | XChaCha20-Poly1305
                                  v
+--------------------------------------------------------------------+
|                        OBJECT KEY (OK)                             |
|          Unique 256-bit random symmetric key per entry/blob        |
+--------------------------------------------------------------------+
                                  |
                                  | Encrypts payload / attachment
                                  | XChaCha20-Poly1305
                                  v
+--------------------------------------------------------------------+
|                  CIPHERTEXT JOURNAL PAYLOAD / BLOB                 |
|       (Title, Body, Mood, Stickers, Coordinates, Photos, Audio)     |
+--------------------------------------------------------------------+
```

---

## 4. Binary Wire & Storage Serialization Format

All encrypted records (entries, configuration items, attachments) adhere to a strict, self-describing binary format to guarantee authenticated parsing and future format versioning.

### 4.1 Encrypted Object Record Format (Version 1)

```
0                   1                   2                   3
0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                       Magic: "INKL" (0x49 0x4E 0x4B 0x4C)     |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
| Version (0x01)| Cipher (0x01) |          Reserved (0x0000)    |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                                                               |
+                       Nonce (24 Bytes)                        +
|                                                               |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                                                               |
+                   Wrapped Object Key (48 Bytes)               +
|           (32B Key + 16B Poly1305 Tag, encrypted by VMK)      |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                                                               |
+                   Ciphertext Payload (Variable)               +
|                 Encrypted JSON Entry / Metadata               |
|                                                               |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                                                               |
+                   Authentication Tag (16 Bytes)               +
|                   Poly1305 MAC over (Header + Payload)        |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

### 4.2 Stream-Encrypted Attachment Chunking Format
For large photos, videos, and audio memos exceeding 1MB:
- **Chunk Size:** 64 KiB ($65,536$ bytes).
- **Sub-header per chunk:**
  - `Chunk Sequence Number`: 32-bit unsigned big-endian integer ($0, 1, 2, \dots$).
  - `Chunk Flag`: `0x00` = intermediate chunk, `0x01` = final chunk.
  - `Chunk Length`: 16-bit unsigned integer.
- **AEAD Additional Data (AAD):** The binary concatenation of `[FileUUID (16 bytes)] [Chunk Sequence (4 bytes)] [Chunk Flag (1 byte)]`.
- **Integrity Guarantee:** Any reordering of chunks, deletion of the final chunk, or truncation of the stream results in MAC verification failure on the tampered chunk.

---

## 5. Protocols & Key Lifecycle Workflows

### 5.1 Vault Initialization & Recovery Key Generation
1. Client generates 32 bytes (256 bits) of CSPRNG entropy: `VMK`.
2. Client generates 32 bytes (256 bits) of CSPRNG entropy: `RK`.
3. Client converts `RK` to 24-word BIP-39 mnemonic string with 8-bit checksum.
4. Client generates 32 bytes random salt: `RecoverySalt`.
5. Client derives `WrappingKey = HKDF-SHA256(secret = RK, salt = RecoverySalt, info = "Inkly-VMK-Wrapping-v1", length = 32)`.
6. Client generates 24 bytes random nonce: `Nonce_Wrap`.
7. Client computes `WrappedVMK = XChaCha20Poly1305_Encrypt(key = WrappingKey, nonce = Nonce_Wrap, plaintext = VMK)`.
8. **UI Confirmation Gate:**
   - Client renders the 24 words in the secure UI.
   - User writes down or confirms words via interactive verification challenge (e.g., verifying word #3, #12, #18).
   - Only after local confirmation is the vault marked `RecoveryConfirmed = true`.
9. If cloud sync is opted-in: Client uploads `{ recovery_salt, wrapped_vmk, nonce_wrap }` to the backend. Plaintext `RK` and `VMK` are NEVER uploaded.

### 5.2 Cross-Device Vault Restoration Protocol
1. User installs Inkly on Device B and logs into cloud account.
2. Device B downloads `{ recovery_salt, wrapped_vmk, nonce_wrap }` from the server.
3. User enters the 24 BIP-39 words on Device B.
4. Device B validates BIP-39 wordlist and checksum locally. If checksum is invalid, rejects immediately with typo warning.
5. Device B derives `WrappingKey = HKDF-SHA256(secret = RK_bytes, salt = recovery_salt, info = "Inkly-VMK-Wrapping-v1", length = 32)`.
6. Device B attempts decryption:
   - `VMK = XChaCha20Poly1305_Decrypt(key = WrappingKey, nonce = nonce_wrap, ciphertext = wrapped_vmk)`.
7. **Integrity Validation:**
   - If Poly1305 authentication fails $\implies$ User entered incorrect recovery words. Device B displays clear error message. Zero network requests made.
   - If authentication succeeds $\implies$ `VMK` is verified authentic!
8. Device B stores `VMK` into local OS Keystore / Keychain protected by local biometric / PIN.
9. Device B proceeds to download and decrypt the cloud journal records.

### 5.3 Key Rotation & Revocation Protocol

#### Scenario A: Recovery Key Rotation (User requests new recovery phrase)
1. User provides local biometrics / PIN to unlock `VMK`.
2. Client generates new 256-bit `RK_new` and new 32-byte `RecoverySalt_new`.
3. Client derives `WrappingKey_new = HKDF-SHA256(RK_new, RecoverySalt_new, "Inkly-VMK-Wrapping-v1", 32)`.
4. Client encrypts existing `VMK` with `WrappingKey_new` $\implies$ `WrappedVMK_new`.
5. Client updates `{ recovery_salt: RecoverySalt_new, wrapped_vmk: WrappedVMK_new }` on cloud backend.
6. **Efficiency Benefit:** Because the underlying `VMK` did not change, NO journal entries or attachments need to be re-encrypted!

#### Scenario B: VMK Rotation (Suspected Device Compromise)
1. User initiates full vault key rotation from an authorized trusted device.
2. Client generates new `VMK_new`.
3. For each active journal entry:
   - Client decrypts entry's `ObjectKey` with `VMK_old`.
   - Client re-encrypts `ObjectKey` with `VMK_new`.
   - Increments object revision counter.
4. Client re-wraps `VMK_new` under current `RK`.
5. Client atomically commits updated records to local vault and schedules cloud outbox sync.

---

## 6. Zero Plaintext Infiltration / Exfiltration Checklist

- [x] Plaintext titles, bodies, tags, moods are never transmitted in network requests.
- [x] Decryption keys (`VMK`, `RK`, `ObjectKey`) are never transmitted in network requests.
- [x] Image attachments are stripped of EXIF metadata before encryption.
- [x] Thumbnails are encrypted with the same Object Key as the source photo.
- [x] Memory containing decrypted buffers is overwritten with zeros when closing the editor or locking the app.
- [x] Network payloads are tested with automated assert sniffers to fail builds if any plaintext string or key appears in outbound packets.
