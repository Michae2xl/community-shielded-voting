export class ZcashConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZcashConfigError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function zcashMocksAllowed() {
  return process.env.NODE_ENV !== "production";
}
