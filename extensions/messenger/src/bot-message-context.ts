// Messenger plugin module implements bot message context behavior.
import { recordChannelActivity } from "openclaw/plugin-sdk/channel-activity-runtime";
import {
  formatInboundEnvelope,
  formatLocationText,
  resolveInboundSessionEnvelopeContext,
  toLocationContext,
} from "openclaw/plugin-sdk/channel-inbound";
import { shouldComputeCommandAuthorized } from "openclaw/plugin-sdk/command-auth-native";
import type { OpenClawConfig } from "openclaw/plugin-sdk/config-contracts";
import { finalizeInboundContext } from "openclaw/plugin-sdk/reply-dispatch-runtime";
import { resolveAgentRoute } from "openclaw/plugin-sdk/routing";
import { logVerbose, shouldLogVerbose } from "openclaw/plugin-sdk/runtime-env";
import { getMessengerRuntime } from "./runtime.js";
import type { MessengerMessagingEvent, ResolvedMessengerAccount } from "./types.js";

interface MediaRef {
  path: string;
  contentType?: string;
}

interface BuildMessengerMessageContextParams {
  event: MessengerMessagingEvent;
  allMedia: MediaRef[];
  cfg: OpenClawConfig;
  account: ResolvedMessengerAccount;
}

function extractMessageText(event: MessengerMessagingEvent): string {
  if (event.message?.text) {
    return event.message.text;
  }
  if (event.postback) {
    return event.postback.payload || event.postback.title;
  }
  // Check for location attachment
  if (event.message?.attachments) {
    for (const att of event.message.attachments) {
      if (att.type === "location" && att.payload.coordinates) {
        return (
          formatLocationText({
            latitude: att.payload.coordinates.lat,
            longitude: att.payload.coordinates.long,
            name: att.payload.title,
          }) ?? ""
        );
      }
    }
  }
  return "";
}

function extractMediaPlaceholder(event: MessengerMessagingEvent): string {
  if (!event.message?.attachments) {
    return "";
  }
  for (const att of event.message.attachments) {
    switch (att.type) {
      case "image":
        return "<media:image>";
      case "video":
        return "<media:video>";
      case "audio":
        return "<media:audio>";
      case "file":
        return "<media:document>";
    }
  }
  return "";
}

export async function buildMessengerMessageContext(params: BuildMessengerMessageContextParams) {
  const { event, allMedia, cfg, account } = params;

  recordChannelActivity({
    channel: "messenger",
    accountId: account.accountId,
    direction: "inbound",
  });

  const senderId = event.sender.id;
  const peerId = senderId;

  const route = resolveAgentRoute({
    cfg,
    channel: "messenger",
    accountId: account.accountId,
    peer: {
      kind: "direct",
      id: peerId,
    },
  });

  const messageId = event.message?.mid ?? `postback:${event.timestamp}`;
  const timestamp = event.timestamp;

  const textContent = extractMessageText(event);
  const placeholder = extractMediaPlaceholder(event);

  let rawBody = textContent || placeholder;
  if (!rawBody && allMedia.length > 0) {
    rawBody = `<media:image>${allMedia.length > 1 ? ` (${allMedia.length} images)` : ""}`;
  }

  if (!rawBody && allMedia.length === 0) {
    return null;
  }

  // Sender already DM-authorized by shouldProcessMessengerEvent in bot-handlers.ts
  const commandAuthorized = shouldComputeCommandAuthorized(rawBody, cfg) ? true : undefined;

  const conversationLabel = `user:${senderId}`;

  // Bundles store path + envelope options + previous timestamp (replaces the old
  // resolveStorePath + resolveEnvelopeFormatOptions + readSessionUpdatedAt trio).
  const { storePath, envelopeOptions, previousTimestamp } = resolveInboundSessionEnvelopeContext({
    cfg,
    agentId: route.agentId,
    sessionKey: route.sessionKey,
  });

  const body = formatInboundEnvelope({
    channel: "Messenger",
    from: conversationLabel,
    timestamp,
    body: rawBody,
    chatType: "direct",
    sender: {
      id: senderId,
    },
    previousTimestamp,
    envelope: envelopeOptions,
  });

  // Build location context if applicable
  let locationContext: ReturnType<typeof toLocationContext> | undefined;
  if (event.message?.attachments) {
    for (const att of event.message.attachments) {
      if (att.type === "location" && att.payload.coordinates) {
        locationContext = toLocationContext({
          latitude: att.payload.coordinates.lat,
          longitude: att.payload.coordinates.long,
          name: att.payload.title,
        });
        break;
      }
    }
  }

  const fromAddress = `messenger:${senderId}`;
  const toAddress = fromAddress;

  const ctxPayload = finalizeInboundContext({
    Body: body,
    RawBody: rawBody,
    BodyForAgent: rawBody,
    CommandBody: rawBody,
    From: fromAddress,
    To: toAddress,
    SessionKey: route.sessionKey,
    AccountId: route.accountId,
    ChatType: "direct",
    ConversationLabel: conversationLabel,
    GroupSubject: undefined,
    SenderId: senderId,
    CommandAuthorized: commandAuthorized,
    Provider: "messenger",
    Surface: "messenger",
    MessageSid: messageId,
    Timestamp: timestamp,
    MediaPath: allMedia[0]?.path,
    MediaType: allMedia[0]?.contentType,
    MediaUrl: allMedia[0]?.path,
    MediaPaths: allMedia.length > 0 ? allMedia.map((m) => m.path) : undefined,
    MediaUrls: allMedia.length > 0 ? allMedia.map((m) => m.path) : undefined,
    MediaTypes:
      allMedia.length > 0
        ? (allMedia.map((m) => m.contentType).filter(Boolean) as string[])
        : undefined,
    ...locationContext,
    OriginatingChannel: "messenger" as const,
    OriginatingTo: fromAddress,
  });

  const session = getMessengerRuntime().channel.session;

  void session
    .recordSessionMetaFromInbound({
      storePath,
      sessionKey: ctxPayload.SessionKey ?? route.sessionKey,
      ctx: ctxPayload,
    })
    .catch((err) => {
      logVerbose(`messenger: failed updating session meta: ${String(err)}`);
    });

  await session.updateLastRoute({
    storePath,
    sessionKey: route.mainSessionKey,
    deliveryContext: {
      channel: "messenger",
      to: senderId,
      accountId: route.accountId,
    },
    ctx: ctxPayload,
  });

  if (shouldLogVerbose()) {
    const preview = body.slice(0, 200).replace(/\n/g, "\\n");
    const mediaInfo = allMedia.length > 1 ? ` mediaCount=${allMedia.length}` : "";
    logVerbose(
      `messenger inbound: from=${ctxPayload.From} len=${body.length}${mediaInfo} preview="${preview}"`,
    );
  }

  return {
    ctxPayload,
    event,
    userId: senderId,
    route,
    accountId: account.accountId,
  };
}

export type MessengerInboundContext = NonNullable<
  Awaited<ReturnType<typeof buildMessengerMessageContext>>
>;
