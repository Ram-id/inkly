import crypto from 'node:crypto';
import { zeroize } from '../crypto/primitives.ts';

export class VaultLockedError extends Error {
  constructor(message = 'Vault is locked. Biometric or PIN authentication required.') {
    super(message);
    this.name = 'VaultLockedError';
  }
}

export class AppLock {
  private isLocked: boolean = true;
  private privacyOverlayActive: boolean = false;
  private activeVmk: Uint8Array | null = null;
  private autoLockTimeoutMs: number;
  private lastActivityTimestamp: number = Date.now();
  private userPinHash: string | null = null;

  constructor(autoLockTimeoutSeconds: number = 60) {
    this.autoLockTimeoutMs = autoLockTimeoutSeconds * 1000;
  }

  /**
   * Set user PIN for local app lock
   */
  public setupPin(pin: string): void {
    if (!/^\d{4,8}$/.test(pin)) {
      throw new Error('PIN must be 4 to 8 digits.');
    }
    this.userPinHash = crypto.createHash('sha256').update(pin).digest('hex');
  }

  /**
   * Unlock vault with PIN and store unlocked VMK in memory
   */
  public unlockWithPin(pin: string, vmkBytes: Uint8Array): boolean {
    const hash = crypto.createHash('sha256').update(pin).digest('hex');
    if (this.userPinHash && hash !== this.userPinHash) {
      throw new Error('Incorrect PIN');
    }

    // Keep an active in-memory copy of the VMK
    this.activeVmk = new Uint8Array(vmkBytes);
    this.isLocked = false;
    this.lastActivityTimestamp = Date.now();
    return true;
  }

  /**
   * Unlock directly with biometrics (simulated)
   */
  public unlockWithBiometrics(vmkBytes: Uint8Array): void {
    this.activeVmk = new Uint8Array(vmkBytes);
    this.isLocked = false;
    this.lastActivityTimestamp = Date.now();
  }

  /**
   * Touch activity timestamp
   */
  public recordActivity(): void {
    if (this.isLocked) return;
    this.checkAutoLock();
    this.lastActivityTimestamp = Date.now();
  }

  /**
   * Checks whether the inactivity timeout expired
   */
  public checkAutoLock(): boolean {
    if (this.isLocked) return true;
    if (Date.now() - this.lastActivityTimestamp > this.autoLockTimeoutMs) {
      this.lock();
      return true;
    }
    return false;
  }

  /**
   * Locks the vault immediately and wipes VMK from memory
   */
  public lock(): void {
    if (this.activeVmk) {
      zeroize(this.activeVmk);
      this.activeVmk = null;
    }
    this.isLocked = true;
    this.privacyOverlayActive = true;
  }

  /**
   * Returns unlocked VMK or throws VaultLockedError
   */
  public getUnlockedVmk(): Uint8Array {
    this.checkAutoLock();
    if (this.isLocked || !this.activeVmk) {
      throw new VaultLockedError();
    }
    return this.activeVmk;
  }

  public getIsLocked(): boolean {
    this.checkAutoLock();
    return this.isLocked;
  }

  public setPrivacyOverlay(active: boolean): void {
    this.privacyOverlayActive = active;
  }

  public getIsPrivacyOverlayActive(): boolean {
    return this.privacyOverlayActive;
  }
}
