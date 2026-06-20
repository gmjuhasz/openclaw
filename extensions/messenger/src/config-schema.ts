// Messenger helper module supports config schema behavior.
import {
  buildChannelConfigSchema,
  requireOpenAllowFrom,
} from "openclaw/plugin-sdk/channel-config-schema";
import { requireChannelOpenAllowFrom } from "openclaw/plugin-sdk/extension-shared";
import { z } from "zod";

const DmPolicySchema = z.enum(["open", "allowlist", "pairing", "disabled"]);

const MessengerCommonConfigSchemaBase = z.object({
  enabled: z.boolean().optional(),
  pageAccessToken: z.string().optional(),
  appSecret: z.string().optional(),
  verifyToken: z.string().optional(),
  tokenFile: z.string().optional(),
  secretFile: z.string().optional(),
  name: z.string().optional(),
  allowFrom: z.array(z.union([z.string(), z.number()])).optional(),
  dmPolicy: DmPolicySchema.optional().default("pairing"),
  responsePrefix: z.string().optional(),
  webhookPath: z.string().optional(),
});

const MessengerAccountConfigSchema = MessengerCommonConfigSchemaBase.strict().superRefine(
  (value, ctx) => {
    requireChannelOpenAllowFrom({
      channel: "messenger",
      policy: value.dmPolicy,
      allowFrom: value.allowFrom,
      ctx,
      requireOpenAllowFrom,
    });
  },
);

export const MessengerConfigSchema = MessengerCommonConfigSchemaBase.extend({
  accounts: z.record(z.string(), MessengerAccountConfigSchema.optional()).optional(),
})
  .strict()
  .superRefine((value, ctx) => {
    requireChannelOpenAllowFrom({
      channel: "messenger",
      policy: value.dmPolicy,
      allowFrom: value.allowFrom,
      ctx,
      requireOpenAllowFrom,
    });
  });

export const MessengerChannelConfigSchema = buildChannelConfigSchema(MessengerConfigSchema);

export type MessengerConfigSchemaType = z.infer<typeof MessengerConfigSchema>;
