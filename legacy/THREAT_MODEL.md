# THREAT_MODEL.md --- Inkly Zero-Knowledge Threat Model

**Version:** 1.0  
**Date:** October 13, 2026  
**Status:** Approved Security Specification  
**Methodology:** STRIDE / OWASP Mobile Application Security Verification Standard (MASVS v2.0)  

---

## 1. Scope & System Definition

This Threat Model defines the security boundaries, assets, threat actors, attack vectors, and defensive countermeasures for the **Inkly** digital journaling system.

The core promise of Inkly is **Zero-Knowledge Privacy**: content created by the user (written journals, scrapbooks, photos, mood logs, tags, audio) is end-to-end encrypted on the client device before persistence or transmission. No operator, developer, database administrator, or cloud intermediary possesses the keys or capability to inspect user content in plaintext.

---

## 2. Protected Assets & Data Classification

| Classification | Asset Description | Confidentiality Requirement | Integrity Requirement | Availability Requirement |
| :--- | :--- | :--- | :--- | :--- |
| **Tier 1: Highly Confidential** | Plaintext journal text, scrapbook coordinates, sticker placements | Absolute (Client-only) | Absolute | High |
| **Tier 1: Highly Confidential** | Private photo attachments, thumbnails, audio memos, EXIF data | Absolute (Client-only) | Absolute | High |
| **Tier 1: Highly Confidential** | Mood ratings, private tags, personalized calendar notes | Absolute (Client-only) | Absolute | High |
| **Tier 1: Cryptographic Secrets** | Recovery Key (RK, 256-bit entropy, 24-word BIP-39 mnemonic) | Absolute (User-held only, NEVER sent to server) | Absolute | High |
| **Tier 1: Cryptographic Secrets** | Vault Master Key (VMK, 256-bit symmetric key) | Absolute (Device Keystore / RAM only) | Absolute | High |
| **Tier 1: Cryptographic Secrets** | Object Keys (OK, 256-bit symmetric keys per entry/blob) | Absolute (Encrypted by VMK) | Absolute | High |
| **Tier 2: Sensitive Operational** | Device Protection Key (DPK, Keystore-backed) | Device-bound | Absolute | High |
| **Tier 2: Sensitive Operational** | Session Bearer Tokens (JWT / Opaque tokens) | Transport confidential (TLS) | High | Medium |
| **Tier 2: Sensitive Operational** | Account identifier, email hash, device registration records | Transport confidential (TLS) | High | High |
| **Tier 3: Public / Low Impact** | Built-in sticker pack art, default templates | Public | High | High |

---

## 3. Threat Actors & Capabilities

### 3.1 Actor Profiles

1. **A1: Compromised Cloud Operator / Rogue DBA / Cloud Intruders**
   - *Capabilities:* Full root access to backend databases, server filesystems, S3 object storage buckets, administrative network logs, and database backups.
   - *Goal:* Eavesdrop on user journal entries, extract private photos, harvest emotional mood data.
   - *Assumed Posture:* Honest-but-curious or actively hostile insider with full server-side read/write capability.
2. **A2: Network Eavesdropper & Man-in-the-Middle (MitM)**
   - *Capabilities:* Intercepts packets on public Wi-Fi, malicious cellular towers, or compromised internet routing.
   - *Goal:* Decrypt payloads, inject tampered ciphertext, or replay old sync states.
3. **A3: Physical Device Interceptor (Thief / Casual Snooper)**
   - *Capabilities:* Has physical custody of unlocked or locked user smartphone.
   - *Goal:* Read diary entries, inspect app switcher thumbnails, or extract SQLite databases via USB/ADB.
4. **A4: Compromised / Malicious Developer Build Pipeline**
   - *Capabilities:* Injects malicious code into client updates or dependencies.
   - *Goal:* Exfiltrate keys or plaintext.
5. **A5: Local Device Malware / Rooted OS / Jailbreak**
   - *Capabilities:* Runs arbitrary code on the same operating system with root/superuser privileges, memory inspection capabilities.
   - *Goal:* Read memory buffers, keylog keystrokes, hook system APIs.

---

## 4. STRIDE Threat Analysis & Mitigations

### 4.1 Spoofing (Identity & Authenticity)
- **Threat S1: Attacker impersonates legitimate user to download ciphertext objects.**
  - *Risk:* Low confidentiality impact (data is ciphertext), but privacy breach of access frequency.
  - *Mitigation:* Secure token authentication with cryptographically random session tokens (minimum 128-bit entropy), rate limiting, and device revocation APIs.
- **Threat S2: Attacker crafts forged sync payload claiming to be Device A.**
  - *Risk:* Ciphertext corruption or replacement.
  - *Mitigation:* Authenticated Encryption (AEAD with Poly1305 MAC tag). Any payload not signed/encrypted with the user's valid Object Key or VMK fails client verification upon download and is rejected.

### 4.2 Tampering (Data Integrity)
- **Threat T1: Server or MitM modifies ciphertext bits or appends malicious payload.**
  - *Risk:* Corrupted data or chosen-ciphertext attacks (CCA).
  - *Mitigation:* `XChaCha20-Poly1305` authenticated encryption. Any bit flip in the ciphertext or associated data invalidates the 128-bit MAC tag; decryption terminates immediately and returns an explicit integrity error without processing partial plaintext.
- **Threat T2: Malicious server rolls back user vault to a prior revision (Rollback / Downgrade Attack).**
  - *Risk:* Loss of user journal edits or un-deletion of intentionally purged entries.
  - *Mitigation:* Strictly monotonic revision counters (`revision` integer) validated locally. Client detects if downloaded revision is strictly lower than local known sequence and flags a sync divergence warning.

### 4.3 Repudiation
- **Threat R1: Client claims sync succeeded when server rejected it.**
  - *Mitigation:* Two-phase sync confirmation with explicit atomic transactions and local status state machine (`pending_upload` -> `synced` -> `tombstone_acknowledged`).

### 4.4 Information Disclosure (Confidentiality - Core Focus)
- **Threat I1: Backend DB leak exposes journal text, photos, and moods.**
  - *Risk:* Catastrophic user privacy disaster.
  - *Mitigation:* End-to-End Encryption. Only opaque ciphertexts, random UUIDs, format versions, and nonces reside on the backend. No decryption key ever leaves the client device.
- **Threat I2: Recovery Key intercepted during onboarding or sync.**
  - *Risk:* Complete vault compromise across all devices.
  - *Mitigation:* The Recovery Key (RK) is NEVER sent over the wire, never hashed for server login, and never stored in cloud databases. The client generates the RK locally, displays it to the user, and uses HKDF locally to produce a VMK Wrapping Key. Only the `wrapped_vmk` is uploaded to the cloud.
- **Threat I3: Local cache or OS backup leaks plaintext.**
  - *Risk:* ADB backup or iOS iCloud backup copies unencrypted SQLite files to desktop or cloud.
  - *Mitigation:* Disable OS backup (`android:allowBackup="false"`, `NSURLIsExcludedFromBackupKey = true`). Store media attachments only in encrypted form (`local_vault/blobs/{id}.bin`).
- **Threat I4: App Switcher screenshot leaks journal text.**
  - *Risk:* Anyone viewing multitasking screen sees private diary.
  - *Mitigation:* Secure window flag (`FLAG_SECURE` on Android) and blank privacy overlay covering UI on `AppState` transitions to background on iOS.
- **Threat I5: Metadata leakage via payload size analysis.**
  - *Risk:* Server infers journal length or photo dimensions by observing exact byte size.
  - *Mitigation:* Padding of journal ciphertext records to nearest 512-byte block boundary before encryption to disguise exact character lengths.

### 4.5 Denial of Service (Availability)
- **Threat D1: Malicious server withholds or deletes user ciphertext.**
  - *Risk:* Data loss.
  - *Mitigation:* Local-first design. All entries remain fully persistent and accessible in the device's local vault. Cloud loss does not destroy local data. User can export encrypted offline backup bundles at any time.

### 4.6 Elevation of Privilege
- **Threat E1: Backend admin creates "super-admin" role to view user vaults.**
  - *Risk:* Admin snooping.
  - *Mitigation:* Cryptographic impossibility. The backend architecture does not possess the keys. No admin console or privilege escalation in server code can yield plaintext because the mathematical keys exist only on the user's phones.

---

## 5. Security Boundaries: What Zero-Knowledge Does and Does Not Guarantee

### 5.1 Guarantees Provided (In-Scope Defenses)
1. **Cloud Security:** Complete confidentiality against cloud infrastructure breach, subpoena of cloud host, malicious database administrators, and third-party cloud hosting providers.
2. **Network Security:** Complete confidentiality against MitM network eavesdroppers and rogue TLS cert authorities.
3. **Resting Device Theft (When Locked):** Protection against physical device theft when app lock is engaged and OS hardware encryption is active.
4. **Zero Knowledge Proof:** Neither Inkly engineers nor any automated server system can read journals, scrape keywords, train AI models on user entries, or serve targeted ads based on diary text.

### 5.2 Explicit Non-Guarantees (Out-of-Scope / Environmental Limits)
1. **Active Endpoint Malware / Keyloggers:** If the user's operating system is infected with an active rootkit, kernel exploit, or physical screen-recording spyware, memory buffers can be read while the app is in foreground and unlocked.
2. **Voluntary User Sharing:** If the user takes a manual screenshot of an open journal or exports unencrypted text, the app cannot prevent subsequent sharing.
3. **Total Loss of Recovery Key Without Active Devices:** If the user loses their Recovery Key AND destroys all previously authorized local devices, the vault contents are mathematically unrecoverable. Inkly customer support CANNOT recover the data. This consequence is explicitly disclosed in onboarding UX.

---

## 6. OWASP MASVS v2.0 Compliance Checklist

- **MASVS-STORAGE-1 (Sensitive Data Storage):** All user content stored with object-level authenticated encryption. No plaintext logs.
- **MASVS-CRYPTO-1 (Standard Cryptography):** XChaCha20-Poly1305, HKDF-SHA256, Argon2id. No bespoke ciphers.
- **MASVS-CRYPTO-2 (Key Generation & Storage):** CSPRNG keys, Android Keystore StrongBox/TEE, iOS Secure Enclave Keychain.
- **MASVS-NETWORK-1 (Secure Network Comms):** TLS 1.3 only, certificate validation, ciphertext payload verification.
- **MASVS-PLATFORM-1 (Platform Interaction):** `FLAG_SECURE` / background blur, no plaintext clipboard leakage, OS backups disabled for sensitive stores.
- **MASVS-CODE-1 (Code Quality & Sanitization):** Automated CI leak tests verifying zero plaintext in network payloads and log streams.
