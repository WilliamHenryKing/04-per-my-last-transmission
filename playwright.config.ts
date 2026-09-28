import { defineConfig } from "@playwright/test";

// End-to-end check against the production build (bun run test:e2e).
// Software WebGL (SwiftShader) is enough; no GPU needed.
export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  // SwiftShader renders the full material set on the CPU (~0.3 s a frame, plus ~30 s of first
  // shader compilation), so the one gameplay test gets a generous budget.
  timeout: 300_000,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4614",
    // Small viewport: SwiftShader renders every frame on the CPU.
    viewport: { width: 640, height: 400 },
    launchOptions: {
      args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
  },
  webServer: {
    command: "bun run build && bun run preview",
    url: "http://127.0.0.1:4614",
    reuseExistingServer: true,
    // SwiftShader renders the full material set on the CPU (~0.3 s a frame, plus ~30 s of first
    // shader compilation), so the one gameplay test gets a generous budget.
    timeout: 300_000,
  },
});
