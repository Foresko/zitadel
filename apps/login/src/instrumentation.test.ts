import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  getIdpLogos: vi.fn(),
  getIdpPolicies: vi.fn(),
}));

vi.mock("./lib/server/idp-logos", () => ({
  getIdpLogos: runtime.getIdpLogos,
}));

vi.mock("./lib/server/idp-policy", () => ({
  getIdpPolicies: runtime.getIdpPolicies,
}));

describe("instrumentation register", () => {
  let exit: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    runtime.getIdpLogos.mockReset().mockReturnValue({ providers: [] });
    runtime.getIdpPolicies.mockReset().mockReturnValue({ policies: {} });
    process.env.NEXT_RUNTIME = "nodejs";
    process.env.OTEL_SDK_DISABLED = "true";
    exit = vi.spyOn(process, "exit").mockImplementation(((code?: string | number | null) => {
      throw new Error(`PROCESS_EXIT:${code}`);
    }) as never);
  });

  afterEach(() => {
    delete process.env.NEXT_RUNTIME;
    delete process.env.OTEL_SDK_DISABLED;
    exit.mockRestore();
  });

  test("loads IDP runtime configuration even when OTEL is disabled", async () => {
    const { register } = await import("./instrumentation");

    await register();

    expect(runtime.getIdpLogos).toHaveBeenCalledOnce();
    expect(runtime.getIdpPolicies).toHaveBeenCalledOnce();
  });

  test("terminates startup for invalid logo configuration", async () => {
    runtime.getIdpLogos.mockImplementation(() => {
      throw new Error("invalid logos");
    });
    const { register } = await import("./instrumentation");

    await expect(register()).rejects.toThrow("PROCESS_EXIT:1");
    expect(exit).toHaveBeenCalledWith(1);
  });

  test("terminates startup for invalid IDP policy", async () => {
    runtime.getIdpPolicies.mockImplementation(() => {
      throw new Error("invalid policy");
    });
    const { register } = await import("./instrumentation");

    await expect(register()).rejects.toThrow("PROCESS_EXIT:1");
    expect(exit).toHaveBeenCalledWith(1);
  });
});
