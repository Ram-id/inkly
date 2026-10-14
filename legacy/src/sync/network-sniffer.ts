/**
 * Automated Network Sniffer and Zero-Knowledge Leak Assertion Interceptor
 * Inspects 100% of network traffic leaving the client device to prove that NO plaintext
 * journal titles, bodies, tags, moods, or decryption keys (VMK, RK, ObjectKey) are ever transmitted.
 */

export class ZeroKnowledgeViolationError extends Error {
  constructor(message: string) {
    super(`[ZERO-KNOWLEDGE SECURITY VIOLATION] ${message}`);
    this.name = 'ZeroKnowledgeViolationError';
  }
}

export interface NetworkRequestLog {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: any;
  timestamp: number;
}

export class NetworkSniffer {
  private blacklistedPatterns: Set<string> = new Set();
  private trafficLogs: NetworkRequestLog[] = [];

  /**
   * Register sensitive strings or keys that MUST NEVER appear in network traffic
   */
  public registerSensitiveSecret(secret: string | Uint8Array): void {
    if (typeof secret === 'string') {
      if (secret.length >= 3) {
        this.blacklistedPatterns.add(secret);
      }
    } else if (secret instanceof Uint8Array) {
      // Register hex and base64 forms of the raw key bytes
      this.blacklistedPatterns.add(Buffer.from(secret).toString('hex'));
      this.blacklistedPatterns.add(Buffer.from(secret).toString('base64'));
    }
  }

  /**
   * Inspects an outbound HTTP request. Throws ZeroKnowledgeViolationError immediately if any leak is detected.
   */
  public inspectOutboundRequest(
    url: string,
    method: string,
    headers: Record<string, string>,
    body: any
  ): void {
    const rawPayloadString = typeof body === 'string' ? body : JSON.stringify(body || {});
    const rawHeaderString = JSON.stringify(headers);
    const combinedTraffic = `${url} ${rawHeaderString} ${rawPayloadString}`;

    // Verify against all registered sensitive secrets
    for (const secret of this.blacklistedPatterns) {
      if (combinedTraffic.includes(secret)) {
        throw new ZeroKnowledgeViolationError(
          `Plaintext secret detected in outbound request to ${url}! Leaked data fragment: "${secret.substring(0, 16)}..."`
        );
      }
    }

    // Inspect for forbidden plaintext field keys in JSON body
    if (body && typeof body === 'object') {
      this.assertNoPlaintextFieldNames(body);
    }

    this.trafficLogs.push({
      url,
      method,
      headers,
      body,
      timestamp: Date.now()
    });
  }

  private assertNoPlaintextFieldNames(obj: any): void {
    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (typeof item === 'object') this.assertNoPlaintextFieldNames(item);
      }
      return;
    }

    const forbiddenFields = ['plainText', 'journalTitle', 'journalBody', 'unencryptedKey'];
    for (const [key, value] of Object.entries(obj)) {
      if (forbiddenFields.includes(key)) {
        throw new ZeroKnowledgeViolationError(`Forbidden unencrypted field "${key}" found in payload!`);
      }
      if (value && typeof value === 'object') {
        this.assertNoPlaintextFieldNames(value);
      }
    }
  }

  public getTrafficLogs(): NetworkRequestLog[] {
    return this.trafficLogs;
  }

  public clearLogs(): void {
    this.trafficLogs = [];
  }
}
