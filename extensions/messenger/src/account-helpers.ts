// Messenger helper module supports account helpers behavior.
type MessengerCredentialAccount = {
  pageAccessToken?: string;
  appSecret?: string;
  verifyToken?: string;
};

// Messenger needs all three: page token (send), app secret (signature verify),
// and verify token (webhook GET handshake). Missing any one breaks the channel.
export function hasMessengerCredentials(account: MessengerCredentialAccount): boolean {
  return Boolean(
    account.pageAccessToken?.trim() && account.appSecret?.trim() && account.verifyToken?.trim(),
  );
}

// Messenger allowFrom entries are numeric Page-Scoped User IDs (PSIDs), with an
// optional `messenger:` / `messenger:user:` prefix that we strip before storing.
export function parseMessengerAllowFromId(raw: string): string | null {
  const trimmed = raw.trim().replace(/^messenger:(?:user:)?/i, "");
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}
