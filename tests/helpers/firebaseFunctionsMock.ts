/**
 * tests/helpers/firebaseFunctionsMock.ts
 * Lightweight mock for firebase-functions HttpsError used in isolated unit tests
 */

export class HttpsError extends Error {
  code: string;
  details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpsError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, HttpsError.prototype);
  }
}

export default {
  HttpsError,
};
