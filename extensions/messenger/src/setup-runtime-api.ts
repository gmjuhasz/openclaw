// Messenger API module exposes the plugin public contract.
export {
  DEFAULT_ACCOUNT_ID,
  formatDocsLink,
  setSetupChannelEnabled,
  splitSetupEntries,
} from "openclaw/plugin-sdk/setup";
export type { ChannelSetupDmPolicy, ChannelSetupWizard } from "openclaw/plugin-sdk/setup";
export {
  listMessengerAccountIds,
  normalizeAccountId,
  resolveMessengerAccount,
} from "./accounts.js";
export type { MessengerConfig } from "./types.js";
