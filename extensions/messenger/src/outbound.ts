// Messenger plugin module implements outbound behavior.
import {
  createAttachedChannelResultAdapter,
  createEmptyChannelResult,
} from "openclaw/plugin-sdk/channel-send-result";
import { resolveOutboundMediaUrls } from "openclaw/plugin-sdk/reply-payload";
import type { ChannelPlugin, ResolvedMessengerAccount } from "./channel-api.js";
import { getMessengerRuntime } from "./runtime.js";
import { sendMediaMessenger, sendMessageMessenger } from "./send.js";

export const messengerOutboundAdapter: NonNullable<
  ChannelPlugin<ResolvedMessengerAccount>["outbound"]
> = {
  deliveryMode: "direct",
  chunker: (text, limit) => getMessengerRuntime().channel.text.chunkMarkdownText(text, limit),
  textChunkLimit: 2000, // Messenger allows up to 2000 characters per text message
  sendPayload: async ({ to, payload, accountId, cfg }) => {
    const runtime = getMessengerRuntime();
    const chunkLimit =
      runtime.channel.text.resolveTextChunkLimit?.(cfg, "messenger", accountId ?? undefined, {
        fallbackLimit: 2000,
      }) ?? 2000;

    const text = payload.text?.trim() ?? "";
    const mediaUrls = resolveOutboundMediaUrls(payload);

    let lastResult: { messageId: string; chatId: string } | null = null;

    for (const url of mediaUrls) {
      const trimmed = url?.trim();
      if (trimmed) {
        lastResult = await sendMediaMessenger(to, trimmed, {
          cfg,
          accountId: accountId ?? undefined,
        });
      }
    }

    if (text) {
      const chunks = runtime.channel.text.chunkMarkdownText(text, chunkLimit);
      for (const chunk of chunks) {
        lastResult = await sendMessageMessenger(to, chunk, {
          cfg,
          accountId: accountId ?? undefined,
        });
      }
    }

    if (lastResult) {
      return createEmptyChannelResult("messenger", { ...lastResult });
    }
    return createEmptyChannelResult("messenger", { messageId: "empty", chatId: to });
  },
  ...createAttachedChannelResultAdapter({
    channel: "messenger",
    sendText: async ({ cfg, to, text, accountId }) =>
      await sendMessageMessenger(to, text, { cfg, accountId: accountId ?? undefined }),
    sendMedia: async ({ cfg, to, text, mediaUrl, accountId }) =>
      await sendMessageMessenger(to, text, { cfg, mediaUrl, accountId: accountId ?? undefined }),
  }),
};
