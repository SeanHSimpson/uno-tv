import { cloudflare } from "@cloudflare/vite-plugin";
import { networkInterfaces } from "node:os";
import { defineConfig } from "vite";

/** Your computer's Wi-Fi address, so the TV's QR code works for phones during local dev. */
function lanIp(): string {
  for (const list of Object.values(networkInterfaces())) {
    for (const i of list ?? []) {
      if (i.family === "IPv4" && !i.internal && !i.address.startsWith("169.254.")) return i.address;
    }
  }
  return "";
}

export default defineConfig({
  plugins: [cloudflare()],
  define: { __LAN_IP__: JSON.stringify(lanIp()) },
  // Video projects (explainroo) and production builds shouldn't trigger dev reloads.
  server: { host: true, watch: { ignored: ["**/videos/**", "**/dist/**"] } },
  preview: { host: true },
});
