// Messenger API module exposes the plugin public contract.
export type {
  ChannelAccountSnapshot,
  ChannelPlugin,
  OpenClawConfig,
  OpenClawPluginApi,
  PluginRuntime,
} from "openclaw/plugin-sdk/core";
export type { ReplyPayload } from "openclaw/plugin-sdk/reply-runtime";
export type { ResolvedMessengerAccount } from "./runtime-api.js";
export { messengerPlugin } from "./src/channel.js";
export { messengerSetupPlugin } from "./src/channel.setup.js";
