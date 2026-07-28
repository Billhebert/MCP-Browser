import * as crypto from "node:crypto";

export function generateRequestId(): string {
  return crypto.randomUUID();
}
