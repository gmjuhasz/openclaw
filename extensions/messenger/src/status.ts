// Messenger plugin module implements status behavior.
import type {
  ChannelAccountSnapshot,
  ChannelStatusIssue,
} from "openclaw/plugin-sdk/channel-contract";
import {
  buildTokenChannelStatusSummary,
  createComputedAccountStatusAdapter,
  createDefaultChannelRuntimeState,
} from "openclaw/plugin-sdk/status-helpers";
import { hasMessengerCredentials } from "./account-helpers.js";
import {
  DEFAULT_ACCOUNT_ID,
  type ChannelPlugin,
  type ResolvedMessengerAccount,
} from "./channel-api.js";
import { probeMessengerPage } from "./probe.js";

// The status collector receives final account snapshots (not resolved accounts),
// which only carry a single `configured` flag, so emit one issue per
// unconfigured account naming the three required credentials.
function collectMessengerStatusIssues(accounts: ChannelAccountSnapshot[]): ChannelStatusIssue[] {
  const issues: ChannelStatusIssue[] = [];
  for (const account of accounts) {
    if (!account.configured) {
      issues.push({
        channel: "messenger",
        accountId: account.accountId ?? DEFAULT_ACCOUNT_ID,
        kind: "config",
        message:
          "Messenger not fully configured (needs page access token, app secret, and verify token)",
      });
    }
  }
  return issues;
}

export const messengerStatusAdapter: NonNullable<
  ChannelPlugin<ResolvedMessengerAccount>["status"]
> = createComputedAccountStatusAdapter<ResolvedMessengerAccount>({
  defaultRuntime: createDefaultChannelRuntimeState(DEFAULT_ACCOUNT_ID),
  collectStatusIssues: collectMessengerStatusIssues,
  buildChannelSummary: ({ snapshot }) => buildTokenChannelStatusSummary(snapshot),
  probeAccount: async ({ account, timeoutMs }) =>
    await probeMessengerPage(account.pageAccessToken, timeoutMs),
  resolveAccountSnapshot: ({ account }) => ({
    accountId: account.accountId,
    name: account.name,
    enabled: account.enabled,
    configured: hasMessengerCredentials(account),
    extra: {
      tokenSource: account.tokenSource,
      mode: "webhook",
    },
  }),
});
