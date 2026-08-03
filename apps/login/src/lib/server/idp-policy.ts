import "server-only";

import { readFileSync } from "node:fs";

export interface IdpPolicy {
  allowedIdps: readonly string[];
}

export interface IdpPolicies {
  policies: Readonly<Record<string, IdpPolicy>>;
}

const ROOT_FIELDS = new Set(["policies"]);
const POLICY_FIELDS = new Set(["allowedIdps"]);
const COUNTRY_CODE = /^[A-Z]{2}$/;

let cachedPolicies: IdpPolicies | null | undefined;

function invalid(message: string): never {
  throw new Error(`Invalid IDP policy: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseAllowedIdps(value: Record<string, unknown>, countryCode: string): IdpPolicy {
  const unknown = Object.keys(value).find((field) => !POLICY_FIELDS.has(field));
  if (unknown) {
    invalid(`policies.${countryCode}.${unknown} is not allowed`);
  }
  if (!Array.isArray(value.allowedIdps)) {
    invalid(`policies.${countryCode}.allowedIdps must be an array`);
  }

  const ids = new Set<string>();
  const allowedIdps = value.allowedIdps.map((id, index) => {
    if (typeof id !== "string" || id.length === 0 || id.trim() !== id) {
      invalid(`policies.${countryCode}.allowedIdps[${index}] must be a non-empty string without surrounding whitespace`);
    }
    if (ids.has(id)) {
      invalid(`duplicate provider id ${id} in ${countryCode}`);
    }
    ids.add(id);
    return id;
  });

  return { allowedIdps };
}

export function parseIdpPolicies(value: unknown): IdpPolicies {
  if (!isRecord(value)) {
    invalid("root must be an object");
  }

  const unknown = Object.keys(value).find((field) => !ROOT_FIELDS.has(field));
  if (unknown) {
    invalid(`root.${unknown} is not allowed`);
  }
  if (!isRecord(value.policies)) {
    invalid("policies must be an object");
  }

  const policies: Record<string, IdpPolicy> = {};
  for (const [countryCode, policy] of Object.entries(value.policies)) {
    if (!COUNTRY_CODE.test(countryCode)) {
      invalid(`policies.${countryCode} must be an uppercase two-letter country code`);
    }
    if (!isRecord(policy)) {
      invalid(`policies.${countryCode} must be an object`);
    }
    policies[countryCode] = parseAllowedIdps(policy, countryCode);
  }

  return { policies };
}

export function loadIdpPolicies(path: string): IdpPolicies {
  try {
    const contents = readFileSync(path, "utf8");
    return parseIdpPolicies(JSON.parse(contents));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load IDP policy from ${path}: ${message}`, { cause: error });
  }
}

export function getIdpPolicies(): IdpPolicies | undefined {
  if (cachedPolicies === undefined) {
    const path = process.env.IDP_POLICY_FILE;
    cachedPolicies = path ? loadIdpPolicies(path) : null;
  }
  return cachedPolicies ?? undefined;
}

export function getIdpPolicy(countryCode: string | undefined): IdpPolicy | undefined {
  if (!countryCode) {
    return undefined;
  }
  return getIdpPolicies()?.policies[countryCode.toUpperCase()];
}

export function isIdentityProviderAllowed(idpPolicy: IdpPolicy | undefined, idpId: string): boolean {
  return !idpPolicy || idpPolicy.allowedIdps.includes(idpId);
}
