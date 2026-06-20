// Messenger plugin module implements setup surface behavior.
import {
  createAllowFromSection,
  createSetupTranslator,
  createStandardChannelSetupStatus,
  mergeAllowFromEntries,
} from "openclaw/plugin-sdk/setup";
import { normalizeOptionalString } from "openclaw/plugin-sdk/string-coerce-runtime";
import { resolveDefaultMessengerAccountId } from "./accounts.js";
import {
  isMessengerConfigured,
  listMessengerAccountIds,
  parseMessengerAllowFromId,
  patchMessengerAccountConfig,
} from "./setup-core.js";
import {
  DEFAULT_ACCOUNT_ID,
  formatDocsLink,
  resolveMessengerAccount,
  setSetupChannelEnabled,
  splitSetupEntries,
  type ChannelSetupDmPolicy,
  type ChannelSetupWizard,
} from "./setup-runtime-api.js";

const t = createSetupTranslator();

const channel = "messenger" as const;

const MESSENGER_PLATFORM_TITLE = "Meta Messenger Platform";
const MESSENGER_DOCS_LINK = formatDocsLink("/channels/messenger", "channels/messenger");

const MESSENGER_SETUP_HELP_LINES = [
  "1) Open https://developers.facebook.com and create an app",
  "2) Add the Messenger product to your app",
  "3) Generate a Page Access Token for your Facebook Page",
  "4) Copy the App Secret from Settings > Basic",
  "5) Choose any Verify Token string for webhook verification",
  "6) Point the webhook at https://<gateway-host>/messenger/webhook",
  t("wizard.channels.docs", { link: MESSENGER_DOCS_LINK }),
];

const MESSENGER_ALLOW_FROM_HELP_LINES = [
  "Allowlist Messenger DMs by Page-Scoped User ID (PSID).",
  "Send a message to your Page, then read the sender PSID from the webhook logs.",
  "Examples:",
  "- 1234567890",
  "- messenger:1234567890",
  "Multiple entries: comma-separated.",
  t("wizard.channels.docs", { link: MESSENGER_DOCS_LINK }),
];

const messengerDmPolicy: ChannelSetupDmPolicy = {
  label: "Messenger",
  channel,
  policyKey: "channels.messenger.dmPolicy",
  allowFromKey: "channels.messenger.allowFrom",
  resolveConfigKeys: (cfg, accountId) => {
    const resolvedAccountId = accountId ?? resolveDefaultMessengerAccountId(cfg);
    return resolvedAccountId !== DEFAULT_ACCOUNT_ID
      ? {
          policyKey: `channels.messenger.accounts.${resolvedAccountId}.dmPolicy`,
          allowFromKey: `channels.messenger.accounts.${resolvedAccountId}.allowFrom`,
        }
      : {
          policyKey: "channels.messenger.dmPolicy",
          allowFromKey: "channels.messenger.allowFrom",
        };
  },
  getCurrent: (cfg, accountId) =>
    resolveMessengerAccount({ cfg, accountId: accountId ?? resolveDefaultMessengerAccountId(cfg) })
      .config.dmPolicy ?? "pairing",
  setPolicy: (cfg, policy, accountId) =>
    patchMessengerAccountConfig({
      cfg,
      accountId: accountId ?? resolveDefaultMessengerAccountId(cfg),
      enabled: true,
      patch:
        policy === "open"
          ? {
              dmPolicy: "open",
              allowFrom: mergeAllowFromEntries(
                resolveMessengerAccount({
                  cfg,
                  accountId: accountId ?? resolveDefaultMessengerAccountId(cfg),
                }).config.allowFrom,
                ["*"],
              ),
            }
          : { dmPolicy: policy },
      clearFields: policy === "pairing" || policy === "disabled" ? ["allowFrom"] : undefined,
    }),
};

export const messengerSetupWizard: ChannelSetupWizard = {
  channel,
  status: createStandardChannelSetupStatus({
    channelLabel: "Messenger",
    configuredLabel: t("wizard.channels.statusConfigured"),
    unconfiguredLabel: t("wizard.channels.statusNeedsTokenSecret"),
    configuredHint: t("wizard.channels.statusConfigured"),
    unconfiguredHint: t("wizard.channels.statusNeedsTokenSecret"),
    configuredScore: 1,
    unconfiguredScore: 0,
    includeStatusLine: true,
    resolveConfigured: ({ cfg, accountId }) =>
      isMessengerConfigured(cfg, accountId ?? resolveDefaultMessengerAccountId(cfg)),
    resolveExtraStatusLines: ({ cfg }) => [`Accounts: ${listMessengerAccountIds(cfg).length || 0}`],
  }),
  introNote: {
    title: MESSENGER_PLATFORM_TITLE,
    lines: MESSENGER_SETUP_HELP_LINES,
    shouldShow: ({ cfg, accountId }) =>
      !isMessengerConfigured(cfg, accountId ?? resolveDefaultMessengerAccountId(cfg)),
  },
  credentials: [
    {
      inputKey: "token",
      providerHint: channel,
      credentialLabel: "page access token",
      preferredEnvVar: "MESSENGER_PAGE_ACCESS_TOKEN",
      helpTitle: MESSENGER_PLATFORM_TITLE,
      helpLines: MESSENGER_SETUP_HELP_LINES,
      envPrompt: "MESSENGER_PAGE_ACCESS_TOKEN detected. Use env var?",
      keepPrompt: "Messenger page access token already configured. Keep it?",
      inputPrompt: "Enter Messenger page access token",
      allowEnv: ({ accountId }) => accountId === DEFAULT_ACCOUNT_ID,
      inspect: ({ cfg, accountId }) => {
        const resolved = resolveMessengerAccount({ cfg, accountId });
        return {
          accountConfigured: Boolean(
            normalizeOptionalString(resolved.pageAccessToken) &&
            normalizeOptionalString(resolved.appSecret),
          ),
          hasConfiguredValue: Boolean(
            normalizeOptionalString(resolved.config.pageAccessToken) ??
            normalizeOptionalString(resolved.config.tokenFile),
          ),
          resolvedValue: normalizeOptionalString(resolved.pageAccessToken),
          envValue:
            accountId === DEFAULT_ACCOUNT_ID
              ? normalizeOptionalString(process.env.MESSENGER_PAGE_ACCESS_TOKEN)
              : undefined,
        };
      },
      applyUseEnv: ({ cfg, accountId }) =>
        patchMessengerAccountConfig({
          cfg,
          accountId,
          enabled: true,
          clearFields: ["pageAccessToken", "tokenFile"],
          patch: {},
        }),
      applySet: ({ cfg, accountId, resolvedValue }) =>
        patchMessengerAccountConfig({
          cfg,
          accountId,
          enabled: true,
          clearFields: ["tokenFile"],
          patch: { pageAccessToken: resolvedValue },
        }),
    },
    {
      inputKey: "password",
      providerHint: "messenger-secret",
      credentialLabel: "app secret",
      preferredEnvVar: "MESSENGER_APP_SECRET",
      helpTitle: MESSENGER_PLATFORM_TITLE,
      helpLines: MESSENGER_SETUP_HELP_LINES,
      envPrompt: "MESSENGER_APP_SECRET detected. Use env var?",
      keepPrompt: "Messenger app secret already configured. Keep it?",
      inputPrompt: "Enter Messenger app secret",
      allowEnv: ({ accountId }) => accountId === DEFAULT_ACCOUNT_ID,
      inspect: ({ cfg, accountId }) => {
        const resolved = resolveMessengerAccount({ cfg, accountId });
        return {
          accountConfigured: Boolean(
            normalizeOptionalString(resolved.pageAccessToken) &&
            normalizeOptionalString(resolved.appSecret),
          ),
          hasConfiguredValue: Boolean(
            normalizeOptionalString(resolved.config.appSecret) ??
            normalizeOptionalString(resolved.config.secretFile),
          ),
          resolvedValue: normalizeOptionalString(resolved.appSecret),
          envValue:
            accountId === DEFAULT_ACCOUNT_ID
              ? normalizeOptionalString(process.env.MESSENGER_APP_SECRET)
              : undefined,
        };
      },
      applyUseEnv: ({ cfg, accountId }) =>
        patchMessengerAccountConfig({
          cfg,
          accountId,
          enabled: true,
          clearFields: ["appSecret", "secretFile"],
          patch: {},
        }),
      applySet: ({ cfg, accountId, resolvedValue }) =>
        patchMessengerAccountConfig({
          cfg,
          accountId,
          enabled: true,
          clearFields: ["secretFile"],
          patch: { appSecret: resolvedValue },
        }),
    },
  ],
  allowFrom: createAllowFromSection({
    helpTitle: "Messenger allowlist",
    helpLines: MESSENGER_ALLOW_FROM_HELP_LINES,
    message: "Messenger allowFrom (PSID)",
    placeholder: "1234567890",
    invalidWithoutCredentialNote:
      "Messenger allowFrom requires numeric Page-Scoped User IDs (PSIDs) like 1234567890.",
    parseInputs: splitSetupEntries,
    parseId: parseMessengerAllowFromId,
    apply: ({ cfg, accountId, allowFrom }) =>
      patchMessengerAccountConfig({
        cfg,
        accountId,
        enabled: true,
        patch: { dmPolicy: "allowlist", allowFrom },
      }),
  }),
  dmPolicy: messengerDmPolicy,
  completionNote: {
    title: "Messenger webhook",
    lines: [
      "Set the verify token via the MESSENGER_VERIFY_TOKEN env var (or channels.messenger.verifyToken).",
      "Configure the webhook in the Facebook Developer Console.",
      "Callback URL: https://<gateway-host>/messenger/webhook",
      "Verify Token: must match MESSENGER_VERIFY_TOKEN / channels.messenger.verifyToken.",
      "Subscribe to: messages, messaging_postbacks.",
      t("wizard.channels.docs", { link: MESSENGER_DOCS_LINK }),
    ],
  },
  disable: (cfg) => setSetupChannelEnabled(cfg, channel, false),
};
