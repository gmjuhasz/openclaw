// Private runtime barrel for the bundled Messenger extension.
// Keep this barrel thin and aligned with the local extension surface.
export type { ResolvedMessengerAccount } from "./src/types.js";
export { setMessengerRuntime } from "./src/runtime.js";
export {
  listMessengerAccountIds,
  normalizeAccountId,
  resolveDefaultMessengerAccountId,
  resolveMessengerAccount,
} from "./src/accounts.js";
export { probeMessengerPage } from "./src/probe.js";
export { monitorMessengerProvider } from "./src/monitor.js";
export { sendMediaMessenger, sendMessageMessenger } from "./src/send.js";
export { validateMessengerSignature } from "./src/signature.js";
