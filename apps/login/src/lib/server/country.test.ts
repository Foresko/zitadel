import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const ipLocation = vi.hoisted(() => ({
  lookup: vi.fn(),
  reload: vi.fn(),
}));

vi.mock("ip-location-api/pack", () => ipLocation);

vi.mock("../logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

describe("getCountryCode", () => {
  test("reads the sanitized internal country header", async () => {
    const { getCountryCode } = await import("./country");

    expect(getCountryCode(new Headers({ "x-zitadel-country": "RU" }))).toBe("RU");
  });

  test.each([undefined, "", "Russia", "ru", "R1"])("returns undefined for %s", async (country) => {
    const { getCountryCode } = await import("./country");
    const headers = new Headers();
    if (country !== undefined) headers.set("x-zitadel-country", country);

    expect(getCountryCode(headers)).toBeUndefined();
  });
});

describe("resolveCountryWithLookup", () => {
  test.each([
    ["203.0.113.42", "RU"],
    ["2001:db8::42", "DE"],
  ])("resolves a valid address %s", async (ip, expected) => {
    const { resolveCountryWithLookup } = await import("./country");
    const lookup = vi.fn().mockReturnValue({ country: expected });

    expect(await resolveCountryWithLookup(ip, lookup)).toBe(expected);
    expect(lookup).toHaveBeenCalledWith(ip);
  });

  test("supports a Promise lookup result", async () => {
    const { resolveCountryWithLookup } = await import("./country");

    await expect(resolveCountryWithLookup("203.0.113.42", vi.fn().mockResolvedValue({ country: "RU" }))).resolves.toBe("RU");
  });

  test.each([null, "", "not-an-ip", "203.0.113.1, 198.51.100.2", "203.0.113.1:443", "[2001:db8::1]:443"])(
    "returns undefined without lookup for invalid input %s",
    async (ip) => {
      const { resolveCountryWithLookup } = await import("./country");
      const lookup = vi.fn();

      expect(await resolveCountryWithLookup(ip, lookup)).toBeUndefined();
      expect(lookup).not.toHaveBeenCalled();
    },
  );

  test.each([null, {}, { country: "" }, { country: "ru" }, { country: "RUS" }])(
    "returns undefined for invalid lookup result %#",
    async (result) => {
      const { resolveCountryWithLookup } = await import("./country");

      expect(await resolveCountryWithLookup("203.0.113.42", vi.fn().mockReturnValue(result))).toBeUndefined();
    },
  );

  test("contains lookup exceptions", async () => {
    const { resolveCountryWithLookup } = await import("./country");

    expect(
      await resolveCountryWithLookup(
        "203.0.113.42",
        vi.fn(() => {
          throw new Error("database unavailable");
        }),
      ),
    ).toBeUndefined();
  });
});

describe("country database lifecycle", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    ipLocation.lookup.mockReset();
    ipLocation.reload.mockReset();
    process.env.ILA_DATA_DIR = "/tmp/country-data";
    process.env.ILA_TMP_DATA_DIR = "/tmp/country-tmp";
    process.env.ILA_AUTO_UPDATE = "0 3 * * *";
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.ILA_DATA_DIR;
    delete process.env.ILA_TMP_DATA_DIR;
    delete process.env.ILA_AUTO_UPDATE;
    delete process.env.ILA_SKIP_INITIAL_RELOAD;
  });

  test("loads user-country into memory before enabling lookup", async () => {
    ipLocation.reload.mockResolvedValue(undefined);
    ipLocation.lookup.mockReturnValue({ country: "RU" });
    const { resolveCountry } = await import("./country");

    await expect(resolveCountry("203.0.113.42")).resolves.toBe("RU");

    expect(process.env.ILA_SKIP_INITIAL_RELOAD).toBe("true");
    expect(ipLocation.reload).toHaveBeenCalledWith({
      fields: "country",
      ipLocationDb: "user",
      dataDir: "/tmp/country-data",
      tmpDataDir: "/tmp/country-tmp",
      autoUpdate: "0 3 * * *",
      smallMemory: false,
      silent: true,
      skipInitialReload: true,
    });
  });

  test("fails open and retries outside the request after initial reload failure", async () => {
    ipLocation.reload.mockRejectedValueOnce(new Error("download failed")).mockResolvedValueOnce(undefined);
    ipLocation.lookup.mockReturnValue({ country: "RU" });
    const { resolveCountry } = await import("./country");

    await expect(resolveCountry("203.0.113.42")).resolves.toBeUndefined();

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(ipLocation.reload).toHaveBeenCalledTimes(2);
    await expect(resolveCountry("203.0.113.42")).resolves.toBe("RU");
  });
});
