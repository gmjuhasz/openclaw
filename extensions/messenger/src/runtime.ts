// Messenger plugin module implements runtime behavior.
import type { PluginRuntime } from "openclaw/plugin-sdk/core";
import { createPluginRuntimeStore } from "openclaw/plugin-sdk/runtime-store";

const {
  setRuntime: setMessengerRuntime,
  clearRuntime: clearMessengerRuntime,
  getRuntime: getMessengerRuntime,
} = createPluginRuntimeStore<PluginRuntime>({
  pluginId: "messenger",
  errorMessage: "Messenger runtime not initialized - plugin not registered",
});
export { clearMessengerRuntime, getMessengerRuntime, setMessengerRuntime };
