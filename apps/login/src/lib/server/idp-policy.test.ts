import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { loadIdpPolicies, parseIdpPolicies } from "./idp-policy";

const temporaryDirectories: string[] = [];

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("IDP_POLICY_FILE", "");
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function temporaryConfig(contents: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "zitadel-login-idp-policy-"));
  temporaryDirectories.push(directory);
  const path = join(directory, "idp-policy.json");
  await writeFile(path, contents, "utf8");
  return path;
}

describe("parseIdpPolicies", () => {
  test("parses separate allowlists for each configured country", () => {
    expect(
      parseIdpPolicies({
        policies: {
          US: { allowedIdps: ["google-id", "github-id"] },
          DE: { allowedIdps: ["google-id"] },
        },
      }),
    ).toEqual({
      policies: {
        US: { allowedIdps: ["google-id", "github-id"] },
        DE: { allowedIdps: ["google-id"] },
      },
    });
  });

  test("accepts an empty allowlist for a configured country", () => {
    expect(parseIdpPolicies({ policies: { US: { allowedIdps: [] } } })).toEqual({
      policies: { US: { allowedIdps: [] } },
    });
  });

  test.each([
    ["lowercase country code", { policies: { us: { allowedIdps: [] } } }],
    ["invalid country code", { policies: { USA: { allowedIdps: [] } } }],
    ["unknown root field", { policies: {}, providers: [] }],
    ["unknown policy field", { policies: { US: { allowedIdps: [], providers: [] } } }],
    ["empty id", { policies: { US: { allowedIdps: [""] } } }],
    ["padded id", { policies: { US: { allowedIdps: ["google-id "] } } }],
    ["non-string id", { policies: { US: { allowedIdps: [42] } } }],
  ])("rejects %s", (_name, input) => {
    expect(() => parseIdpPolicies(input)).toThrow(/IDP policy/i);
  });

  test("rejects duplicate provider ids within one country", () => {
    expect(() => parseIdpPolicies({ policies: { US: { allowedIdps: ["same-id", "same-id"] } } })).toThrow(
      /duplicate.*same-id/i,
    );
  });

  test.each([null, [], {}, { policies: null }, { policies: [] }, { policies: { US: null } }])(
    "rejects malformed root value %#",
    (input) => {
      expect(() => parseIdpPolicies(input)).toThrow(/IDP policy/i);
    },
  );
});

describe("loadIdpPolicies", () => {
  test("loads policies for multiple countries", async () => {
    const path = await temporaryConfig(
      JSON.stringify({
        policies: {
          US: { allowedIdps: ["google-id"] },
          DE: { allowedIdps: ["github-id"] },
        },
      }),
    );

    expect(loadIdpPolicies(path)).toEqual({
      policies: {
        US: { allowedIdps: ["google-id"] },
        DE: { allowedIdps: ["github-id"] },
      },
    });
  });

  test("includes the path when JSON is invalid", async () => {
    const path = await temporaryConfig("not-json");

    expect(() => loadIdpPolicies(path)).toThrow(path);
  });

  test("fails when the configured file is missing", () => {
    const path = join(tmpdir(), "missing-zitadel-login-idp-policy.json");

    expect(() => loadIdpPolicies(path)).toThrow(path);
  });
});

describe("getIdpPolicy", () => {
  test("returns the matching country policy after normalizing its code", async () => {
    const path = await temporaryConfig(
      JSON.stringify({
        policies: {
          US: { allowedIdps: ["google-id"] },
          DE: { allowedIdps: ["github-id"] },
        },
      }),
    );
    vi.stubEnv("IDP_POLICY_FILE", path);
    const { getIdpPolicy, isIdentityProviderAllowed } = await import("./idp-policy");

    expect(getIdpPolicy("US")).toEqual({ allowedIdps: ["google-id"] });
    expect(getIdpPolicy("de")).toEqual({ allowedIdps: ["github-id"] });
    expect(isIdentityProviderAllowed(getIdpPolicy("US"), "github-id")).toBe(false);
  });

  test("fails open when configuration or the country policy is absent", async () => {
    const { getIdpPolicies, getIdpPolicy, isIdentityProviderAllowed } = await import("./idp-policy");

    expect(getIdpPolicies()).toBeUndefined();
    expect(getIdpPolicy("US")).toBeUndefined();
    expect(isIdentityProviderAllowed(getIdpPolicy("US"), "google-id")).toBe(true);
  });

  test("fails open for a country without a configured policy", async () => {
    const path = await temporaryConfig(JSON.stringify({ policies: { US: { allowedIdps: ["google-id"] } } }));
    vi.stubEnv("IDP_POLICY_FILE", path);
    const { getIdpPolicy, isIdentityProviderAllowed } = await import("./idp-policy");

    expect(getIdpPolicy("DE")).toBeUndefined();
    expect(isIdentityProviderAllowed(getIdpPolicy("DE"), "github-id")).toBe(true);
  });

  test("fails when an explicitly configured file is missing", async () => {
    const path = join(tmpdir(), "missing-configured-zitadel-login-idp-policy.json");
    vi.stubEnv("IDP_POLICY_FILE", path);
    const { getIdpPolicies } = await import("./idp-policy");

    expect(() => getIdpPolicies()).toThrow(path);
  });
});
