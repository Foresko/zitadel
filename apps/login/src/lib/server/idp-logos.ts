import "server-only";

import { type IdentityProvider } from "@zitadel/proto/zitadel/settings/v2/login_settings_pb";
import { readFileSync } from "node:fs";
import { isGenericIdpProviderType } from "../idp";
import { type IdpLogo } from "../idp-logo";

export interface ConfiguredIdpLogo {
  id: string;
  logo: string;
}

export interface IdpLogosConfig {
  providers: readonly ConfiguredIdpLogo[];
}

const ROOT_FIELDS = new Set(["providers"]);
const PROVIDER_FIELDS = new Set(["id", "logo"]);
const SVG_DATA_URI = /^data:image\/svg\+xml;base64,(?=.+$)(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/i;

function invalid(message: string): never {
  throw new Error(`Invalid IDP logos: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejectUnknownFields(value: Record<string, unknown>, allowed: Set<string>, path: string): void {
  const unknown = Object.keys(value).find((field) => !allowed.has(field));
  if (unknown) {
    invalid(`${path}.${unknown} is not allowed`);
  }
}

function parseProvider(value: unknown, index: number): ConfiguredIdpLogo {
  const path = `providers[${index}]`;
  if (!isRecord(value)) {
    invalid(`${path} must be an object`);
  }
  rejectUnknownFields(value, PROVIDER_FIELDS, path);

  const { id, logo } = value;
  if (typeof id !== "string" || id.length === 0 || id.trim() !== id) {
    invalid(`${path}.id must be a non-empty string without surrounding whitespace`);
  }
  if (typeof logo !== "string" || !SVG_DATA_URI.test(logo)) {
    invalid(`${path}.logo must be a base64-encoded SVG data URI`);
  }

  return { id, logo };
}

export function parseIdpLogos(value: unknown): IdpLogosConfig {
  if (!isRecord(value)) {
    invalid("root must be an object");
  }
  rejectUnknownFields(value, ROOT_FIELDS, "root");
  if (!Array.isArray(value.providers)) {
    invalid("providers must be an array");
  }

  const ids = new Set<string>();
  const providers = value.providers.map((provider, index) => {
    const parsed = parseProvider(provider, index);
    if (ids.has(parsed.id)) {
      invalid(`duplicate provider id ${parsed.id}`);
    }
    ids.add(parsed.id);
    return parsed;
  });

  return { providers };
}

let cachedConfig: IdpLogosConfig | undefined;

export function loadIdpLogos(path: string): IdpLogosConfig {
  try {
    const contents = readFileSync(path, "utf8");
    return parseIdpLogos(JSON.parse(contents));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load IDP logos from ${path}: ${message}`, { cause: error });
  }
}

export function getIdpLogos(): IdpLogosConfig {
  if (!cachedConfig) {
    const path = process.env.IDP_LOGOS_FILE;
    cachedConfig = path ? loadIdpLogos(path) : { providers: [] };
  }
  return cachedConfig;
}

export function getGenericIdpLogos(providers: readonly IdentityProvider[]): Record<string, IdpLogo> {
  const configuredById = new Map(getIdpLogos().providers.map((provider) => [provider.id, provider.logo]));
  return Object.fromEntries(
    providers
      .filter(({ id, type }) => isGenericIdpProviderType(type) && configuredById.has(id))
      .map(({ id }) => [id, { url: configuredById.get(id)! }] as const),
  );
}
