import crypto from "node:crypto";

// Meta signs webhook POST bodies with `X-Hub-Signature-256: sha256=<hex>` where
// the HMAC-SHA256 key is the app secret. Verify with a constant-time compare so
// forged events cannot reach the agent. Messenger-specific (LINE uses base64),
// so this stays plugin-local with no SDK equivalent.
export function validateMessengerSignature(
  body: string,
  signature: string,
  appSecret: string,
): boolean {
  const expectedPrefix = "sha256=";
  if (!signature.startsWith(expectedPrefix)) {
    return false;
  }

  const receivedHash = signature.slice(expectedPrefix.length);
  const computedHash = crypto.createHmac("sha256", appSecret).update(body).digest("hex");

  const receivedBuffer = Buffer.from(receivedHash, "hex");
  const computedBuffer = Buffer.from(computedHash, "hex");

  if (receivedBuffer.length !== computedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(receivedBuffer, computedBuffer);
}
