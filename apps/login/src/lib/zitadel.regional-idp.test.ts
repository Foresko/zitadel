import { IdentityProviderType } from "@zitadel/proto/zitadel/settings/v2/login_settings_pb";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getActiveIdentityProviders, listIDPLinks, type ServiceConfig } from "./zitadel";

const services = vi.hoisted(() => ({
  getActiveIdentityProviders: vi.fn(),
  listIDPLinks: vi.fn(),
}));

vi.mock("./service", () => ({
  createServiceForHost: vi.fn().mockResolvedValue(services),
}));

vi.mock("./server/idp-logos", () => ({
  getIdpLogos: () => ({ providers: [] }),
}));

vi.mock("./server/idp-policy", () => ({
  getIdpPolicy: (country: string | undefined) => (country === "US" ? { allowedIdps: ["idp123"] } : undefined),
  isIdentityProviderAllowed: (policy: { allowedIdps: readonly string[] } | undefined, idpId: string) =>
    !policy || policy.allowedIdps.includes(idpId),
}));

const serviceConfig: ServiceConfig = { baseUrl: "https://zitadel.example.com" };
const identityProviders = [
  { id: "idp123", type: IdentityProviderType.OIDC },
  { id: "idp456", type: IdentityProviderType.OIDC },
  { id: "ldap-id", type: IdentityProviderType.LDAP },
];
const idpLinks = [{ idpId: "idp123" }, { idpId: "idp456" }];
const allProviderIds = ["idp123", "idp456", "ldap-id"];

beforeEach(() => {
  services.getActiveIdentityProviders.mockReset().mockResolvedValue({ identityProviders, details: "active-details" });
  services.listIDPLinks.mockReset().mockResolvedValue({ result: idpLinks, details: "link-details" });
});

describe("raw ZITADEL identity provider data access", () => {
  test("returns every active provider without applying regional policy", async () => {
    const response = await getActiveIdentityProviders({ serviceConfig });

    expect(response.identityProviders.map(({ id }) => id)).toEqual(allProviderIds);
  });

  test("filters restricted providers when a configured country is supplied", async () => {
    const response = await getActiveIdentityProviders({ serviceConfig, country: "US" });

    expect(response.identityProviders.map(({ id }) => id)).toEqual(["idp123"]);
  });

  test("returns every provider for a country without a policy", async () => {
    const response = await getActiveIdentityProviders({ serviceConfig, country: "DE" });

    expect(response.identityProviders.map(({ id }) => id)).toEqual(allProviderIds);
  });

  test("returns every user IDP link without applying regional policy", async () => {
    const response = await listIDPLinks({ serviceConfig, userId: "user-1" });

    expect(response.result.map(({ idpId }) => idpId)).toEqual(["idp123", "idp456"]);
  });
});
