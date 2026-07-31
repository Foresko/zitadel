import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  getIdpLogos: vi.fn(),
}));

vi.mock("./lib/server/idp-logos", () => ({
  getIdpLogos: runtime.getIdpLogos,
}));

describe("instrumentation register", () => {
  let exit: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    runtime.getIdpLogos.mockReset().mockReturnValue({ providers: [] });
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

  test("loads IDP logos even when OTEL is disabled", async () => {
    const { register } = await import("./instrumentation");

    await register();

    expect(runtime.getIdpLogos).toHaveBeenCalledOnce();
  });

  test("terminates startup for invalid logo configuration", async () => {
    runtime.getIdpLogos.mockImplementation(() => {
      throw new Error("invalid logos");
    });
    const { register } = await import("./instrumentation");

    await expect(register()).rejects.toThrow("PROCESS_EXIT:1");
    expect(exit).toHaveBeenCalledWith(1);
  });
});
