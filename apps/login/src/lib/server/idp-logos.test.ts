import { create } from "@zitadel/client";
import { IdentityProviderSchema, IdentityProviderType } from "@zitadel/proto/zitadel/settings/v2/login_settings_pb";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { loadIdpLogos, parseIdpLogos } from "./idp-logos";

const temporaryDirectories: string[] = [];
const validConfig = {
  providers: [{ id: "idp123", logo: "data:image/svg+xml;base64,PHN2Zy8+" }],
};

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("IDP_LOGOS_FILE", "");
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function temporaryConfig(contents: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "zitadel-login-idp-logos-"));
  temporaryDirectories.push(directory);
  const path = join(directory, "idp-logos.json");
  await writeFile(path, contents, "utf8");
  return path;
}

describe("loadIdpLogos", () => {
  test("loads and validates a JSON file", async () => {
    const path = await temporaryConfig(`{
      "providers": [
        {"id":"idp123","logo":"data:image/svg+xml;base64,PHN2Zy8+"}
      ]
    }`);

    expect(loadIdpLogos(path)).toEqual({
      providers: [{ id: "idp123", logo: "data:image/svg+xml;base64,PHN2Zy8+" }],
    });
  });

  test("includes the path when JSON is invalid", async () => {
    const path = await temporaryConfig("not-json");

    expect(() => loadIdpLogos(path)).toThrow(/^Failed to load IDP logos/);
    expect(() => loadIdpLogos(path)).toThrow(path);
  });

  test("fails when the configured file is missing", () => {
    const path = join(tmpdir(), "missing-zitadel-login-idp-logos.json");

    expect(() => loadIdpLogos(path)).toThrow(/^Failed to load IDP logos/);
    expect(() => loadIdpLogos(path)).toThrow(path);
  });
});

describe("getIdpLogos", () => {
  test("returns no logo overrides when no file is configured", async () => {
    const { getIdpLogos } = await import("./idp-logos");

    expect(getIdpLogos()).toEqual({ providers: [] });
  });

  test("fails when an explicitly configured file is missing", async () => {
    const path = join(tmpdir(), "missing-configured-zitadel-login-idp-logos.json");
    vi.stubEnv("IDP_LOGOS_FILE", path);
    const { getIdpLogos } = await import("./idp-logos");

    expect(() => getIdpLogos()).toThrow(/^Failed to load IDP logos/);
    expect(() => getIdpLogos()).toThrow(path);
  });
});

describe("getGenericIdpLogos", () => {
  test("uses configured logos only for active generic identity providers", async () => {
    const path = await temporaryConfig(`{
      "providers": [
        {"id":"idp123","logo":"data:image/svg+xml;base64,PHN2Zy8+"},
        {"id":"google-id","logo":"data:image/svg+xml;base64,PHN2Zy8+"},
        {"id":"missing-id","logo":"data:image/svg+xml;base64,PHN2Zy8+"}
      ]
    }`);
    vi.stubEnv("IDP_LOGOS_FILE", path);
    const { getGenericIdpLogos } = await import("./idp-logos");
    const providers = [
      create(IdentityProviderSchema, { id: "idp123", name: "idp123", type: IdentityProviderType.OIDC }),
      create(IdentityProviderSchema, { id: "google-id", name: "Google", type: IdentityProviderType.GOOGLE }),
    ];

    expect(getGenericIdpLogos(providers)).toEqual({
      idp123: { url: "data:image/svg+xml;base64,PHN2Zy8+" },
    });
  });
});

describe("parseIdpLogos", () => {
  test("parses strict provider logo metadata", () => {
    expect(parseIdpLogos(validConfig)).toEqual(validConfig);
  });

  test("accepts an empty provider list", () => {
    expect(parseIdpLogos({ providers: [] })).toEqual({ providers: [] });
  });

  test.each([
    ["empty id", { providers: [{ id: "", logo: "https://static.example.com/idp123.svg" }] }],
    ["padded id", { providers: [{ id: " idp123", logo: "https://static.example.com/idp123.svg" }] }],
    ["HTTP logo", { providers: [{ id: "idp123", logo: "https://static.example.com/idp123.svg" }] }],
    ["non-SVG data URI", { providers: [{ id: "idp123", logo: "data:image/png;base64,iVBORw0KGgo=" }] }],
    ["non-base64 SVG data URI", { providers: [{ id: "idp123", logo: "data:image/svg+xml,%3Csvg%2F%3E" }] }],
    ["malformed base64 SVG data URI", { providers: [{ id: "idp123", logo: "data:image/svg+xml;base64,PHN2Zy8" }] }],
    [
      "unknown provider field",
      { providers: [{ id: "idp123", logo: "data:image/svg+xml;base64,PHN2Zy8+", label: "idp123" }] },
    ],
    ["unknown root field", { ...validConfig, version: 1 }],
  ])("rejects %s", (_name, input) => {
    expect(() => parseIdpLogos(input)).toThrow(/IDP logos/i);
  });

  test("rejects duplicate provider ids", () => {
    expect(() =>
      parseIdpLogos({
        providers: [
          { id: "same-id", logo: "data:image/svg+xml;base64,PHN2Zy8+" },
          { id: "same-id", logo: "data:image/svg+xml;base64,PHN2Zy8+" },
        ],
      }),
    ).toThrow(/duplicate.*same-id/i);
  });

  test.each([null, [], {}, { providers: null }, { providers: {} }])("rejects malformed root value %#", (input) => {
    expect(() => parseIdpLogos(input)).toThrow(/IDP logos/i);
  });
});
