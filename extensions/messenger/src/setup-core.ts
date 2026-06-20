// Messenger plugin module implements setup core behavior.
import type { ChannelSetupAdapter, OpenClawConfig } from "openclaw/plugin-sdk/setup";
import { createSetupInputPresenceValidator } from "openclaw/plugin-sdk/setup";
import { hasMessengerCredentials, parseMessengerAllowFromId } from "./account-helpers.js";
import {
  DEFAULT_ACCOUNT_ID,
  listMessengerAccountIds,
  normalizeAccountId,
  resolveMessengerAccount,
  type MessengerConfig,
} from "./setup-runtime-api.js";

export function patchMessengerAccountConfig(params: {
  cfg: OpenClawConfig;
  accountId: string;
  patch: Record<string, unknown>;
  clearFields?: string[];
  enabled?: boolean;
}): OpenClawConfig {
  const accountId = normalizeAccountId(params.accountId);
  const messengerConfig = (params.cfg.channels?.messenger ?? {}) as MessengerConfig;
  const clearFields = params.clearFields ?? [];

  if (accountId === DEFAULT_ACCOUNT_ID) {
    const nextMessenger = { ...messengerConfig } as Record<string, unknown>;
    for (const field of clearFields) {
      delete nextMessenger[field];
    }
    return {
      ...params.cfg,
      channels: {
        ...params.cfg.channels,
        messenger: {
          ...nextMessenger,
          ...(params.enabled ? { enabled: true } : {}),
          ...params.patch,
        },
      },
    };
  }

  const nextAccount = { ...messengerConfig.accounts?.[accountId] } as Record<string, unknown>;
  for (const field of clearFields) {
    delete nextAccount[field];
  }
  return {
    ...params.cfg,
    channels: {
      ...params.cfg.channels,
      messenger: {
        ...messengerConfig,
        ...(params.enabled ? { enabled: true } : {}),
        accounts: {
          ...messengerConfig.accounts,
          [accountId]: {
            ...nextAccount,
            ...(params.enabled ? { enabled: true } : {}),
            ...params.patch,
          },
        },
      },
    },
  };
}

export function isMessengerConfigured(cfg: OpenClawConfig, accountId: string): boolean {
  return hasMessengerCredentials(resolveMessengerAccount({ cfg, accountId }));
}

export { parseMessengerAllowFromId };

export const messengerSetupAdapter: ChannelSetupAdapter = {
  resolveAccountId: ({ accountId }) => normalizeAccountId(accountId),
  applyAccountName: ({ cfg, accountId, name }) =>
    patchMessengerAccountConfig({
      cfg,
      accountId,
      patch: name?.trim() ? { name: name.trim() } : {},
    }),
  validateInput: createSetupInputPresenceValidator({
    defaultAccountOnlyEnvError:
      "MESSENGER_PAGE_ACCESS_TOKEN can only be used for the default account.",
    whenNotUseEnv: [
      {
        someOf: ["pageAccessToken", "tokenFile"],
        message: "Messenger requires pageAccessToken or --token-file (or --use-env).",
      },
      {
        someOf: ["appSecret", "secretFile"],
        message: "Messenger requires appSecret or --secret-file (or --use-env).",
      },
    ],
  }),
  applyAccountConfig: ({ cfg, accountId, input }) => {
    const typedInput = input as {
      useEnv?: boolean;
      pageAccessToken?: string;
      appSecret?: string;
      verifyToken?: string;
      tokenFile?: string;
      secretFile?: string;
    };
    const normalizedAccountId = normalizeAccountId(accountId);
    const credentialPatch = {
      ...(typedInput.tokenFile
        ? { tokenFile: typedInput.tokenFile }
        : typedInput.pageAccessToken
          ? { pageAccessToken: typedInput.pageAccessToken }
          : {}),
      ...(typedInput.secretFile
        ? { secretFile: typedInput.secretFile }
        : typedInput.appSecret
          ? { appSecret: typedInput.appSecret }
          : {}),
      ...(typedInput.verifyToken ? { verifyToken: typedInput.verifyToken } : {}),
    };

    if (normalizedAccountId === DEFAULT_ACCOUNT_ID) {
      return patchMessengerAccountConfig({
        cfg,
        accountId: normalizedAccountId,
        enabled: true,
        clearFields: typedInput.useEnv
          ? ["pageAccessToken", "appSecret", "verifyToken", "tokenFile", "secretFile"]
          : undefined,
        patch: typedInput.useEnv ? {} : credentialPatch,
      });
    }
    return patchMessengerAccountConfig({
      cfg,
      accountId: normalizedAccountId,
      enabled: true,
      patch: credentialPatch,
    });
  },
};

export { listMessengerAccountIds };
