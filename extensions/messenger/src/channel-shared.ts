// Messenger plugin module implements channel shared behavior.
import { describeWebhookAccountSnapshot } from "openclaw/plugin-sdk/account-helpers";
import { hasMessengerCredentials } from "./account-helpers.js";
import type { ChannelPlugin, ResolvedMessengerAccount } from "./channel-api.js";
import { messengerConfigAdapter } from "./config-adapter.js";
import { MessengerChannelConfigSchema } from "./config-schema.js";

const messengerChannelMeta = {
  id: "messenger",
  label: "Messenger",
  selectionLabel: "Facebook Messenger (Graph API)",
  detailLabel: "Messenger Bot",
  docsPath: "/channels/messenger",
  docsLabel: "messenger",
  blurb: "Facebook Messenger bot via Meta Graph API.",
  systemImage: "message.fill",
} as const;

export const messengerChannelPluginCommon = {
  meta: {
    ...messengerChannelMeta,
    quickstartAllowFrom: true,
  },
  capabilities: {
    chatTypes: ["direct"],
    reactions: false,
    threads: false,
    media: true,
    nativeCommands: false,
    blockStreaming: true,
  },
  reload: { configPrefixes: ["channels.messenger"] },
  configSchema: MessengerChannelConfigSchema,
  config: {
    ...messengerConfigAdapter,
    isConfigured: (account: ResolvedMessengerAccount) => hasMessengerCredentials(account),
    describeAccount: (account: ResolvedMessengerAccount) =>
      describeWebhookAccountSnapshot({
        account,
        configured: hasMessengerCredentials(account),
        extra: {
          tokenSource: account.tokenSource ?? undefined,
        },
      }),
  },
} satisfies Pick<
  ChannelPlugin<ResolvedMessengerAccount>,
  "meta" | "capabilities" | "reload" | "configSchema" | "config"
>;
