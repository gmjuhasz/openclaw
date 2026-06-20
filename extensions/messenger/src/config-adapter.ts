// Messenger helper module supports config adapter behavior.
import { createScopedChannelConfigAdapter } from "openclaw/plugin-sdk/channel-config-helpers";
import { normalizeStringEntries } from "openclaw/plugin-sdk/string-coerce-runtime";
import {
  listMessengerAccountIds,
  resolveDefaultMessengerAccountId,
  resolveMessengerAccount,
  type ResolvedMessengerAccount,
} from "./channel-api.js";

function normalizeMessengerAllowFrom(entry: string): string {
  return entry.replace(/^messenger:/i, "");
}

export const messengerConfigAdapter = createScopedChannelConfigAdapter<
  ResolvedMessengerAccount,
  ResolvedMessengerAccount
>({
  sectionKey: "messenger",
  listAccountIds: listMessengerAccountIds,
  resolveAccount: (cfg, accountId) =>
    resolveMessengerAccount({ cfg, accountId: accountId ?? undefined }),
  defaultAccountId: resolveDefaultMessengerAccountId,
  clearBaseFields: ["appSecret", "verifyToken", "tokenFile", "secretFile"],
  resolveAllowFrom: (account) => account.config.allowFrom,
  formatAllowFrom: (allowFrom) =>
    normalizeStringEntries(allowFrom).map(normalizeMessengerAllowFrom),
});
