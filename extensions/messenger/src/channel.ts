// Messenger plugin module implements channel behavior.
import { createChatChannelPlugin } from "openclaw/plugin-sdk/channel-core";
import { createPairingPrefixStripper } from "openclaw/plugin-sdk/channel-pairing";
import { createRestrictSendersChannelSecurity } from "openclaw/plugin-sdk/channel-policy";
import { createEmptyChannelDirectoryAdapter } from "openclaw/plugin-sdk/directory-runtime";
import { resolveMessengerAccount } from "./accounts.js";
import type { ChannelPlugin, ResolvedMessengerAccount } from "./channel-api.js";
import { messengerChannelPluginCommon } from "./channel-shared.js";
import { messengerGatewayAdapter } from "./gateway.js";
import { messengerOutboundAdapter } from "./outbound.js";
import { sendMessageMessenger } from "./send.js";
import { messengerSetupAdapter } from "./setup-core.js";
import { messengerSetupWizard } from "./setup-surface.js";
import { messengerStatusAdapter } from "./status.js";

const messengerSecurityAdapter = createRestrictSendersChannelSecurity<ResolvedMessengerAccount>({
  channelKey: "messenger",
  resolveDmPolicy: (account) => account.config.dmPolicy,
  resolveDmAllowFrom: (account) => account.config.allowFrom,
  resolveGroupPolicy: () => undefined,
  surface: "Messenger",
  openScope: "anyone who messages the page",
  groupPolicyPath: "channels.messenger.groupPolicy",
  groupAllowFromPath: "channels.messenger.groupAllowFrom",
  mentionGated: false,
  policyPathSuffix: "dmPolicy",
  defaultDmPolicy: "pairing",
  approveHint: "openclaw pairing approve messenger <code>",
  normalizeDmEntry: (raw) => raw.replace(/^messenger:/i, ""),
});

export const messengerPlugin: ChannelPlugin<ResolvedMessengerAccount> = createChatChannelPlugin({
  base: {
    id: "messenger",
    ...messengerChannelPluginCommon,
    setupWizard: messengerSetupWizard,
    messaging: {
      targetPrefixes: ["messenger"],
      normalizeTarget: (target) => {
        const trimmed = target.trim();
        if (!trimmed) {
          return undefined;
        }
        return trimmed.replace(/^messenger:/i, "");
      },
      targetResolver: {
        looksLikeId: (id) => {
          const trimmed = id?.trim();
          if (!trimmed) {
            return false;
          }
          // Messenger PSIDs are numeric strings.
          return /^\d+$/.test(trimmed) || /^messenger:/i.test(trimmed);
        },
        hint: "<PSID>",
      },
    },
    directory: createEmptyChannelDirectoryAdapter(),
    setup: messengerSetupAdapter,
    status: messengerStatusAdapter,
    gateway: messengerGatewayAdapter,
  },
  pairing: {
    text: {
      idLabel: "messengerUserId",
      message: "OpenClaw: your access has been approved.",
      normalizeAllowEntry: createPairingPrefixStripper(/^messenger:/i),
      notify: async ({ cfg, id, message }) => {
        const account = resolveMessengerAccount({ cfg });
        if (!account.pageAccessToken) {
          throw new Error("Messenger page access token not configured");
        }
        await sendMessageMessenger(id, message, {
          accountId: account.accountId,
          pageAccessToken: account.pageAccessToken,
        });
      },
    },
  },
  security: messengerSecurityAdapter,
  outbound: messengerOutboundAdapter,
});
