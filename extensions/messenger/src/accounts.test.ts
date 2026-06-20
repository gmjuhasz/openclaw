import type { OpenClawConfig } from "openclaw/plugin-sdk/account-resolution";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_ACCOUNT_ID,
  listMessengerAccountIds,
  normalizeAccountId,
  resolveMessengerAccount,
} from "./accounts.js";

function cfg(messenger: Record<string, unknown>): OpenClawConfig {
  return { channels: { messenger } } as unknown as OpenClawConfig;
}

describe("messenger accounts", () => {
  beforeEach(() => {
    vi.stubEnv("MESSENGER_PAGE_ACCESS_TOKEN", "");
    vi.stubEnv("MESSENGER_APP_SECRET", "");
    vi.stubEnv("MESSENGER_VERIFY_TOKEN", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("resolves the default account from inline config", () => {
    const account = resolveMessengerAccount({
      cfg: cfg({ pageAccessToken: "PAT", appSecret: "SEC", verifyToken: "VT" }),
    });
    expect(account.accountId).toBe(DEFAULT_ACCOUNT_ID);
    expect(account.pageAccessToken).toBe("PAT");
    expect(account.appSecret).toBe("SEC");
    expect(account.verifyToken).toBe("VT");
    expect(account.tokenSource).toBe("config");
  });

  it("falls back to environment variables for the default account", () => {
    vi.stubEnv("MESSENGER_PAGE_ACCESS_TOKEN", "env-pat");
    vi.stubEnv("MESSENGER_APP_SECRET", "env-sec");
    vi.stubEnv("MESSENGER_VERIFY_TOKEN", "env-vt");
    const account = resolveMessengerAccount({ cfg: cfg({}) });
    expect(account.pageAccessToken).toBe("env-pat");
    expect(account.appSecret).toBe("env-sec");
    expect(account.verifyToken).toBe("env-vt");
    expect(account.tokenSource).toBe("env");
  });

  it("resolves a named account and does not read env for it", () => {
    vi.stubEnv("MESSENGER_PAGE_ACCESS_TOKEN", "env-pat");
    const account = resolveMessengerAccount({
      cfg: cfg({
        accounts: { page2: { pageAccessToken: "PAT2", appSecret: "S2", verifyToken: "V2" } },
      }),
      accountId: "page2",
    });
    expect(account.accountId).toBe("page2");
    expect(account.pageAccessToken).toBe("PAT2");
    expect(account.tokenSource).toBe("config");
  });

  it("lists configured account ids", () => {
    const ids = listMessengerAccountIds(
      cfg({ pageAccessToken: "PAT", accounts: { page2: { pageAccessToken: "PAT2" } } }),
    );
    expect(ids).toContain(DEFAULT_ACCOUNT_ID);
    expect(ids).toContain("page2");
  });

  it("normalizes account ids to the shared default", () => {
    expect(normalizeAccountId(undefined)).toBe(DEFAULT_ACCOUNT_ID);
    expect(normalizeAccountId("default")).toBe(DEFAULT_ACCOUNT_ID);
  });
});
