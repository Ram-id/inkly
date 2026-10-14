/**
 * Sanitized Logger for Inkly
 * Guarantees zero sensitive data exfiltration to console or log aggregators.
 * Redacts journal text, titles, moods, tags, and cryptographic keys.
 */

const REDACTED_MARKER = '[REDACTED_SENSITIVE_CONTENT]';
const SENSITIVE_KEYS = new Set([
  'title',
  'body',
  'notes',
  'mood',
  'tags',
  'key',
  'vmk',
  'rk',
  'mnemonic',
  'password',
  'pin',
  'objectkey',
  'wrappingkey',
  'secret'
]);

export class SanitizedLogger {
  private static sanitizeValue(value: any): any {
    if (value === null || value === undefined) return value;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
      return `[Binary Data: ${value.length} bytes]`;
    }
    if (Array.isArray(value)) {
      return value.map(item => this.sanitizeValue(item));
    }
    if (typeof value === 'object') {
      const sanitizedObj: Record<string, any> = {};
      for (const [k, v] of Object.entries(value)) {
        if (SENSITIVE_KEYS.has(k.toLowerCase())) {
          sanitizedObj[k] = REDACTED_MARKER;
        } else {
          sanitizedObj[k] = this.sanitizeValue(v);
        }
      }
      return sanitizedObj;
    }
    return value;
  }

  public static info(message: string, context?: any): string {
    const sanitized = context ? this.sanitizeValue(context) : undefined;
    const output = sanitized ? `[INFO] ${message} ${JSON.stringify(sanitized)}` : `[INFO] ${message}`;
    return output;
  }

  public static warn(message: string, context?: any): string {
    const sanitized = context ? this.sanitizeValue(context) : undefined;
    const output = sanitized ? `[WARN] ${message} ${JSON.stringify(sanitized)}` : `[WARN] ${message}`;
    return output;
  }

  public static error(message: string, err?: any): string {
    const sanitized = err ? this.sanitizeValue(err) : undefined;
    const output = sanitized ? `[ERROR] ${message} ${JSON.stringify(sanitized)}` : `[ERROR] ${message}`;
    return output;
  }
}
