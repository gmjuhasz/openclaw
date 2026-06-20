// Messenger plugin entrypoint registers its OpenClaw integration.
import { defineBundledChannelEntry } from "openclaw/plugin-sdk/channel-entry-contract";

export default defineBundledChannelEntry({
  id: "messenger",
  name: "Messenger",
  description: "Facebook Messenger channel plugin",
  importMetaUrl: import.meta.url,
  plugin: {
    specifier: "./channel-plugin-api.js",
    exportName: "messengerPlugin",
  },
  runtime: {
    specifier: "./runtime-api.js",
    exportName: "setMessengerRuntime",
  },
});
