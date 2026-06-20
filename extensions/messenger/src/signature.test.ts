import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateMessengerSignature } from "./signature.js";

function sign(body: string, secret: string): string {
  return `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
}

describe("validateMessengerSignature", () => {
  const body = JSON.stringify({ object: "page", entry: [] });
  const secret = "app-secret-123";

  it("accepts a correct sha256 HMAC signature", () => {
    expect(validateMessengerSignature(body, sign(body, secret), secret)).toBe(true);
  });

  it("rejects a signature computed with the wrong secret", () => {
    expect(validateMessengerSignature(body, sign(body, "other-secret"), secret)).toBe(false);
  });

  it("rejects a signature over a different body", () => {
    expect(validateMessengerSignature("tampered", sign(body, secret), secret)).toBe(false);
  });

  it("rejects a signature missing the sha256= prefix", () => {
    const hex = crypto.createHmac("sha256", secret).update(body).digest("hex");
    expect(validateMessengerSignature(body, hex, secret)).toBe(false);
  });

  it("rejects a malformed (wrong-length) signature without throwing", () => {
    expect(validateMessengerSignature(body, "sha256=deadbeef", secret)).toBe(false);
  });
});
