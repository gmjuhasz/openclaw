// Messenger plugin module implements bot handler behavior.
import type { OpenClawConfig } from "openclaw/plugin-sdk/config-contracts";
import { danger, logVerbose, type RuntimeEnv } from "openclaw/plugin-sdk/runtime-env";
import {
  buildMessengerMessageContext,
  type MessengerInboundContext,
} from "./bot-message-context.js";
import { getMessengerRuntime } from "./runtime.js";
import { sendMessageMessenger } from "./send.js";
import type {
  MessengerAttachment,
  MessengerMessagingEvent,
  ResolvedMessengerAccount,
} from "./types.js";

// Mirrors the historic 5MB inbound cap (old media/store MEDIA_MAX_BYTES default).
const MESSENGER_MEDIA_MAX_BYTES = 5 * 1024 * 1024;

export interface MessengerHandlerContext {
  cfg: OpenClawConfig;
  account: ResolvedMessengerAccount;
  runtime: RuntimeEnv;
  processMessage: (ctx: MessengerInboundContext) => Promise<void>;
}

type NormalizedAllowFrom = {
  entries: string[];
  hasWildcard: boolean;
  hasEntries: boolean;
};

function normalizeAllowEntry(value: string | number): string {
  const trimmed = String(value).trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed === "*") {
    return "*";
  }
  return trimmed.replace(/^messenger:/i, "");
}

function normalizeAllowFrom(list?: Array<string | number>): NormalizedAllowFrom {
  const entries = (list ?? []).map((value) => normalizeAllowEntry(value)).filter(Boolean);
  const hasWildcard = entries.includes("*");
  return {
    entries,
    hasWildcard,
    hasEntries: entries.length > 0,
  };
}

function normalizeAllowFromWithStore(params: {
  allowFrom?: Array<string | number>;
  storeAllowFrom?: string[];
}): NormalizedAllowFrom {
  const combined = [...(params.allowFrom ?? []), ...(params.storeAllowFrom ?? [])];
  return normalizeAllowFrom(combined);
}

function isSenderAllowed(params: { allow: NormalizedAllowFrom; senderId?: string }): boolean {
  const { allow, senderId } = params;
  if (!allow.hasEntries) {
    return false;
  }
  if (allow.hasWildcard) {
    return true;
  }
  if (!senderId) {
    return false;
  }
  return allow.entries.includes(senderId);
}

async function sendMessengerPairingReply(params: {
  senderId: string;
  context: MessengerHandlerContext;
}): Promise<void> {
  const { senderId, context } = params;
  const pairing = getMessengerRuntime().channel.pairing;
  const { code, created } = await pairing.upsertPairingRequest({
    channel: "messenger",
    id: senderId,
    accountId: context.account.accountId,
  });
  if (!created) {
    return;
  }
  logVerbose(`messenger pairing request sender=${senderId}`);
  const text = pairing.buildPairingReply({
    channel: "messenger",
    idLine: `Your messengerUserId: ${senderId}`,
    code,
  });
  try {
    await sendMessageMessenger(`messenger:${senderId}`, text, {
      cfg: context.cfg,
      accountId: context.account.accountId,
      pageAccessToken: context.account.pageAccessToken,
    });
  } catch (err) {
    logVerbose(`messenger pairing reply failed for ${senderId}: ${String(err)}`);
  }
}

async function shouldProcessMessengerEvent(
  event: MessengerMessagingEvent,
  context: MessengerHandlerContext,
): Promise<boolean> {
  const { account } = context;
  const senderId = event.sender.id;

  const storeAllowFrom = await getMessengerRuntime()
    .channel.pairing.readAllowFromStore({
      channel: "messenger",
      accountId: account.accountId,
    })
    .catch(() => [] as string[]);
  const effectiveDmAllow = normalizeAllowFromWithStore({
    allowFrom: account.config.allowFrom,
    storeAllowFrom,
  });
  const dmPolicy = account.config.dmPolicy ?? "pairing";

  if (dmPolicy === "disabled") {
    logVerbose("Blocked messenger sender (dmPolicy: disabled)");
    return false;
  }

  const dmAllowed = dmPolicy === "open" || isSenderAllowed({ allow: effectiveDmAllow, senderId });
  if (!dmAllowed) {
    if (dmPolicy === "pairing") {
      if (!senderId) {
        logVerbose("Blocked messenger sender (dmPolicy: pairing, no sender ID)");
        return false;
      }
      await sendMessengerPairingReply({
        senderId,
        context,
      });
    } else {
      logVerbose(`Blocked messenger sender ${senderId || "unknown"} (dmPolicy: ${dmPolicy})`);
    }
    return false;
  }

  return true;
}

function isDownloadableAttachment(att: MessengerAttachment): boolean {
  return (
    (att.type === "image" || att.type === "video" || att.type === "audio" || att.type === "file") &&
    Boolean(att.payload.url)
  );
}

async function resolveMessengerMedia(
  event: MessengerMessagingEvent,
): Promise<Array<{ path: string; contentType?: string }>> {
  const attachments = event.message?.attachments;
  if (!attachments || attachments.length === 0) {
    return [];
  }
  const media = getMessengerRuntime().channel.media;
  const out: Array<{ path: string; contentType?: string }> = [];
  for (const att of attachments) {
    if (!isDownloadableAttachment(att)) {
      continue;
    }
    const url = att.payload.url!;
    try {
      const fetched = await media.fetchRemoteMedia({ url });
      const saved = await media.saveMediaBuffer(
        fetched.buffer,
        fetched.contentType,
        "inbound",
        MESSENGER_MEDIA_MAX_BYTES,
        fetched.fileName,
      );
      out.push({ path: saved.path, contentType: saved.contentType });
    } catch (err) {
      logVerbose(`messenger: failed to download attachment ${url}: ${String(err)}`);
    }
  }
  return out;
}

async function handleMessagingEvent(
  event: MessengerMessagingEvent,
  context: MessengerHandlerContext,
): Promise<void> {
  // Ignore echo events (messages sent by the page itself) to prevent reply loops
  if (event.message?.is_echo) {
    logVerbose(`messenger: ignoring echo event mid=${event.message.mid}`);
    return;
  }

  // Only handle message and postback events
  if (!event.message && !event.postback) {
    if (event.read) {
      logVerbose(`messenger: message read by ${event.sender.id}`);
    } else if (event.delivery) {
      logVerbose(`messenger: message delivered to ${event.sender.id}`);
    }
    return;
  }

  if (!(await shouldProcessMessengerEvent(event, context))) {
    return;
  }

  const allMedia = await resolveMessengerMedia(event);

  const messageContext = await buildMessengerMessageContext({
    event,
    allMedia,
    cfg: context.cfg,
    account: context.account,
  });

  if (!messageContext) {
    logVerbose("messenger: skipping empty message");
    return;
  }

  await context.processMessage(messageContext);
}

export async function handleMessengerWebhookEvents(
  events: MessengerMessagingEvent[],
  context: MessengerHandlerContext,
): Promise<void> {
  for (const event of events) {
    try {
      await handleMessagingEvent(event, context);
    } catch (err) {
      context.runtime.error?.(danger(`messenger: event handler failed: ${String(err)}`));
    }
  }
}
