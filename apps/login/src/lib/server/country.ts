import "server-only";

import { isIP } from "node:net";
import { createLogger } from "../logger";

export const COUNTRY_CODE_HEADER = "x-zitadel-country";

const logger = createLogger("country-resolver");
const COUNTRY_DATABASE_RETRY_MS = 5 * 60 * 1000;

type CountryLookupResult = { country?: string } | null;
export type CountryLookup = (ip: string) => CountryLookupResult | Promise<CountryLookupResult>;

interface IpLocationApi {
  lookup: CountryLookup;
  reload(settings: Record<string, unknown>): Promise<void>;
}

let lookupCountry: CountryLookup | undefined;
let apiPromise: Promise<IpLocationApi> | undefined;
let initializationPromise: Promise<void> | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;

export function getCountryCode(requestHeaders: Pick<Headers, "get">): string | undefined {
  const country = requestHeaders.get(COUNTRY_CODE_HEADER);
  return country && /^[A-Z]{2}$/.test(country) ? country : undefined;
}

function loadIpLocationApi(): Promise<IpLocationApi> {
  process.env.ILA_SKIP_INITIAL_RELOAD = "true";
  apiPromise ??= import("ip-location-api").then((api) => ({
    lookup: api.lookup as CountryLookup,
    reload: async (settings) => {
      await api.reload(settings);
    },
  }));
  return apiPromise;
}

function countryDatabaseSettings(): Record<string, unknown> {
  return {
    fields: "country",
    ipLocationDb: "user",
    dataDir: process.env.ILA_DATA_DIR ?? "/var/lib/zitadel-login/ip-location",
    tmpDataDir: process.env.ILA_TMP_DATA_DIR ?? "/var/lib/zitadel-login/ip-location-tmp",
    autoUpdate: process.env.ILA_AUTO_UPDATE ?? "0 3 * * *",
    smallMemory: false,
    silent: true,
    skipInitialReload: true,
  };
}

function scheduleRetry(): void {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = undefined;
    void initializeCountryResolver();
  }, COUNTRY_DATABASE_RETRY_MS);
  if (typeof retryTimer === "object" && "unref" in retryTimer) {
    retryTimer.unref();
  }
}

async function loadCountryDatabase(): Promise<void> {
  try {
    const api = await loadIpLocationApi();
    await api.reload(countryDatabaseSettings());
    lookupCountry = api.lookup;
    logger.info("IP country database initialized");
  } catch (error) {
    lookupCountry = undefined;
    logger.error("IP country database initialization failed", {
      errorType: error instanceof Error ? error.name : typeof error,
    });
    scheduleRetry();
  }
}

async function initializeCountryResolver(): Promise<void> {
  if (lookupCountry || retryTimer) return;
  initializationPromise ??= loadCountryDatabase().finally(() => {
    initializationPromise = undefined;
  });
  await initializationPromise;
}

export async function resolveCountryWithLookup(xRealIp: string | null, lookup: CountryLookup): Promise<string | undefined> {
  if (!xRealIp || isIP(xRealIp) === 0) {
    return undefined;
  }
  try {
    const result = await lookup(xRealIp);
    return result?.country && /^[A-Z]{2}$/.test(result.country) ? result.country : undefined;
  } catch {
    return undefined;
  }
}

export async function resolveCountry(xRealIp: string | null): Promise<string | undefined> {
  if (!xRealIp || isIP(xRealIp) === 0) {
    return undefined;
  }

  // Next.js Proxy does not share module globals with the render runtime, so
  // ensure this runtime loads its own in-memory country database on demand.
  if (!lookupCountry) {
    await initializeCountryResolver();
  }

  return lookupCountry ? resolveCountryWithLookup(xRealIp, lookupCountry) : undefined;
}
