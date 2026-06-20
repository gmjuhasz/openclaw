// Messenger plugin module implements gateway behavior.
import { resolveMessengerAccount } from "./accounts.js";
import {
  clearAccountEntryFields,
  DEFAULT_ACCOUNT_ID,
  type ChannelPlugin,
  type MessengerConfig,
  type OpenClawConfig,
  type ResolvedMessengerAccount,
} from "./channel-api.js";
import { monitorMessengerProvider } from "./monitor.js";
import { probeMessengerPage } from "./probe.js";
import { getMessengerRuntime } from "./runtime.js";

export const messengerGatewayAdapter: NonNullable<
  ChannelPlugin<ResolvedMessengerAccount>["gateway"]
> = {
  startAccount: async (ctx) => {
    const account = ctx.account;
    const token = account.pageAccessToken?.trim();
    const secret = account.appSecret?.trim();
    const verify = account.verifyToken?.trim();
    if (!token || !secret || !verify) {
      const missing = [
        !token && "pageAccessToken",
        !secret && "appSecret",
        !verify && "verifyToken",
      ]
        .filter(Boolean)
        .join(", ");
      throw new Error(`[${account.accountId}] cannot start Messenger provider: missing ${missing}`);
    }

    let pageLabel = "";
    try {
      const probe = await probeMessengerPage(token, 2500);
      const pageName = probe.ok ? probe.page?.name?.trim() : null;
      if (pageName) {
        pageLabel = ` (${pageName})`;
      }
    } catch (err) {
      if (getMessengerRuntime().logging.shouldLogVerbose()) {
        ctx.log?.debug?.(`[${account.accountId}] page probe failed: ${String(err)}`);
      }
    }

    ctx.log?.info(`[${account.accountId}] starting Messenger provider${pageLabel}`);

    return await monitorMessengerProvider({
      pageAccessToken: token,
      appSecret: secret,
      verifyToken: verify,
      accountId: account.accountId,
      config: ctx.cfg,
      runtime: ctx.runtime,
      abortSignal: ctx.abortSignal,
      webhookPath: account.config.webhookPath,
    });
  },
  logoutAccount: async ({ accountId, cfg }) => {
    const envToken = process.env.MESSENGER_PAGE_ACCESS_TOKEN?.trim() ?? "";
    const nextCfg = { ...cfg } as OpenClawConfig;
    const messengerConfig = (cfg.channels?.messenger ?? {}) as MessengerConfig;
    const nextMessenger = { ...messengerConfig };
    let cleared = false;
    let changed = false;

    if (accountId === DEFAULT_ACCOUNT_ID) {
      if (
        nextMessenger.pageAccessToken ||
        nextMessenger.appSecret ||
        nextMessenger.verifyToken ||
        nextMessenger.tokenFile ||
        nextMessenger.secretFile
      ) {
        delete nextMessenger.pageAccessToken;
        delete nextMessenger.appSecret;
        delete nextMessenger.verifyToken;
        delete nextMessenger.tokenFile;
        delete nextMessenger.secretFile;
        cleared = true;
        changed = true;
      }
    }

    const accountCleanup = clearAccountEntryFields({
      accounts: nextMessenger.accounts,
      accountId,
      fields: ["pageAccessToken", "appSecret", "verifyToken", "tokenFile", "secretFile"],
      markClearedOnFieldPresence: true,
    });
    if (accountCleanup.changed) {
      changed = true;
      if (accountCleanup.cleared) {
        cleared = true;
      }
      if (accountCleanup.nextAccounts) {
        nextMessenger.accounts = accountCleanup.nextAccounts;
      } else {
        delete nextMessenger.accounts;
      }
    }

    if (changed) {
      if (Object.keys(nextMessenger).length > 0) {
        nextCfg.channels = { ...nextCfg.channels, messenger: nextMessenger };
      } else {
        const nextChannels = { ...nextCfg.channels };
        delete (nextChannels as Record<string, unknown>).messenger;
        if (Object.keys(nextChannels).length > 0) {
          nextCfg.channels = nextChannels;
        } else {
          delete nextCfg.channels;
        }
      }
      await getMessengerRuntime().config.replaceConfigFile({
        nextConfig: nextCfg,
        afterWrite: { mode: "auto" },
      });
    }

    const resolved = resolveMessengerAccount({
      cfg: changed ? nextCfg : cfg,
      accountId,
    });
    const loggedOut = resolved.tokenSource === "none";

    return { cleared, envToken: Boolean(envToken), loggedOut };
  },
};
