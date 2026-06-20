import { recordChannelActivity } from "openclaw/plugin-sdk/channel-activity-runtime";
import type { OpenClawConfig } from "openclaw/plugin-sdk/config-contracts";
import { chunkText } from "openclaw/plugin-sdk/reply-runtime";
import { logVerbose } from "openclaw/plugin-sdk/runtime-env";
import { resolveMessengerAccount } from "./accounts.js";
import { GRAPH_API_BASE, type MessengerSendResult } from "./types.js";

interface MessengerSendOpts {
  /** Explicit token; required unless `cfg` is provided to resolve it from the account. */
  pageAccessToken?: string;
  /** Config used to resolve the account token when `pageAccessToken` is omitted. */
  cfg?: OpenClawConfig;
  accountId?: string;
  verbose?: boolean;
  mediaUrl?: string;
  mediaType?: "image" | "video" | "audio" | "file";
}

function resolveToken(opts: {
  pageAccessToken?: string;
  cfg?: OpenClawConfig;
  accountId?: string;
}): {
  token: string;
  accountId: string;
} {
  if (opts.pageAccessToken?.trim()) {
    return { token: opts.pageAccessToken.trim(), accountId: opts.accountId ?? "default" };
  }
  if (opts.cfg) {
    const account = resolveMessengerAccount({ cfg: opts.cfg, accountId: opts.accountId });
    if (account.pageAccessToken) {
      return { token: account.pageAccessToken, accountId: account.accountId };
    }
  }
  throw new Error(
    `Messenger page access token missing for account "${opts.accountId ?? "default"}" (set channels.messenger.pageAccessToken or MESSENGER_PAGE_ACCESS_TOKEN).`,
  );
}

function normalizeTarget(to: string): string {
  const trimmed = to.trim();
  if (!trimmed) {
    throw new Error("Recipient is required for Messenger sends");
  }
  return trimmed.replace(/^messenger:/i, "");
}

async function graphApiSend(
  token: string,
  body: Record<string, unknown>,
): Promise<{ message_id?: string }> {
  const res = await fetch(`${GRAPH_API_BASE}/me/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Messenger API ${res.status}: ${text.slice(0, 500)}`);
  }

  return (await res.json()) as { message_id?: string };
}

export async function sendMessageMessenger(
  to: string,
  text: string,
  opts: MessengerSendOpts = {},
): Promise<MessengerSendResult> {
  const { token, accountId } = resolveToken(opts);
  const chatId = normalizeTarget(to);
  const mediaUrl = opts.mediaUrl?.trim();
  const messageText = text?.trim();

  // Send media if provided
  if (mediaUrl) {
    await sendMediaMessenger(chatId, mediaUrl, {
      pageAccessToken: token,
      accountId,
      mediaType: opts.mediaType ?? "image",
    });
  }

  // Send text message
  if (messageText) {
    // Split text into 2000-char chunks (Messenger limit)
    const chunks = chunkText(messageText, 2000);

    let lastResult: { message_id?: string } = {};
    for (const chunk of chunks) {
      lastResult = await graphApiSend(token, {
        recipient: { id: chatId },
        messaging_type: "RESPONSE",
        message: { text: chunk },
      });
    }

    recordChannelActivity({
      channel: "messenger",
      accountId,
      direction: "outbound",
    });

    if (opts.verbose) {
      logVerbose(`messenger: sent message to ${chatId}`);
    }

    return {
      messageId: lastResult.message_id ?? "sent",
      chatId,
    };
  }

  if (!mediaUrl) {
    throw new Error("Message must be non-empty for Messenger sends");
  }

  return { messageId: "media", chatId };
}

export async function sendMediaMessenger(
  to: string,
  mediaUrl: string,
  opts: {
    pageAccessToken?: string;
    cfg?: OpenClawConfig;
    accountId?: string;
    mediaType?: "image" | "video" | "audio" | "file";
  } = {},
): Promise<MessengerSendResult> {
  const normalizedMediaUrl = mediaUrl.trim();
  if (!normalizedMediaUrl) {
    throw new Error("mediaUrl must be non-empty for Messenger sends");
  }

  const { token, accountId } = resolveToken(opts);
  const chatId = normalizeTarget(to);
  const attachmentType = opts.mediaType ?? "image";

  const result = await graphApiSend(token, {
    recipient: { id: chatId },
    messaging_type: "RESPONSE",
    message: {
      attachment: {
        type: attachmentType,
        payload: {
          url: normalizedMediaUrl,
          is_reusable: true,
        },
      },
    },
  });

  recordChannelActivity({
    channel: "messenger",
    accountId,
    direction: "outbound",
  });

  return {
    messageId: result.message_id ?? "media",
    chatId,
  };
}

export async function sendSenderAction(
  to: string,
  action: "mark_seen" | "typing_on" | "typing_off",
  opts: { pageAccessToken?: string; cfg?: OpenClawConfig; accountId?: string } = {},
): Promise<void> {
  const { token } = resolveToken(opts);
  const chatId = normalizeTarget(to);

  try {
    await fetch(`${GRAPH_API_BASE}/me/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        recipient: { id: chatId },
        sender_action: action,
      }),
    });
  } catch (err) {
    logVerbose(`messenger: sender action ${action} failed (non-fatal): ${String(err)}`);
  }
}
