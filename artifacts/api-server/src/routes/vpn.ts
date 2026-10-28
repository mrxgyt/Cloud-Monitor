import { Router, type Request, type Response } from "express";
import { readFile } from "fs/promises";
import path from "path";

const router = Router();

const getV2RayConfigPath = () =>
  process.env.V2RAY_CONFIG_PATH ||
  path.resolve(process.cwd(), "../../v2ray-config.json");

const firstConfiguredHost = (value?: string) =>
  value
    ?.split(",")
    .map((host) => host.trim())
    .find(Boolean);

interface V2RayConfig {
  inbounds: Array<{
    port: number;
    protocol: string;
    settings: {
      clients: Array<{
        id: string;
        level: number;
      }>;
      decryption: string;
    };
    streamSettings: {
      network: string;
      wsSettings: {
        path: string;
      };
    };
  }>;
}

// GET /api/vpn/connection - Get VLESS connection string
router.get("/vpn/connection", async (req: Request, res: Response): Promise<void> => {
  try {
    const configPath = getV2RayConfigPath();
    const configData = await readFile(configPath, "utf-8");
    const config: V2RayConfig = JSON.parse(configData);

    const inbound = config.inbounds[0];
    if (!inbound) {
      res.status(500).json({ error: "No inbound configuration found" });
      return;
    }

    const uuid = inbound.settings.clients[0]?.id;
    const network = inbound.streamSettings.network;
    const wsPath = inbound.streamSettings.wsSettings.path;
    const host =
      process.env.VPN_HOST?.trim() ||
      firstConfiguredHost(process.env.NF_HOSTS_CUSTOM) ||
      firstConfiguredHost(process.env.NF_HOSTS) ||
      req.hostname ||
      "localhost";
    const security = (process.env.VPN_SECURITY || "tls").trim().toLowerCase();

    if (!uuid || !wsPath) {
      res.status(500).json({ error: "Invalid V2Ray configuration" });
      return;
    }

    if (security !== "tls" && security !== "none") {
      res.status(500).json({
        error: "VPN_SECURITY must be either tls or none",
      });
      return;
    }

    const defaultPort = security === "tls" ? 443 : inbound.port;
    const port = Number(process.env.VPN_PUBLIC_PORT || defaultPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      res.status(500).json({
        error: "VPN_PUBLIC_PORT must be an integer between 1 and 65535",
      });
      return;
    }

    const params = new URLSearchParams({
      encryption: "none",
      security,
      type: network,
    });

    let fingerprint: string | undefined;
    let alpn: string | undefined;
    let sni: string | undefined;
    let websocketHost: string | undefined;

    if (security === "tls") {
      fingerprint = process.env.VPN_FINGERPRINT?.trim() || "random";
      alpn = process.env.VPN_ALPN?.trim() || "h3";
      sni = process.env.VPN_SNI?.trim() || undefined;

      params.set("fp", fingerprint);
      params.set("alpn", alpn);
      if (sni) params.set("sni", sni);
    }

    if (network === "ws") {
      params.set("path", wsPath);
      websocketHost = process.env.VPN_WS_HOST?.trim() || undefined;
      if (websocketHost) params.set("host", websocketHost);
    }

    const uriHost =
      host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
    const connectionString = `vless://${encodeURIComponent(uuid)}@${uriHost}:${port}?${params.toString()}#CloudMonitorVPN`;

    res.json({
      connectionString,
      uuid,
      host,
      port,
      path: wsPath,
      protocol: "vless",
      network,
      security,
      fingerprint,
      alpn,
      sni,
      websocketHost,
    });
  } catch (error) {
    req.log.error({ error }, "Failed to generate VLESS connection");
    res.status(500).json({
      error: "Failed to read V2Ray configuration",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// GET /api/vpn/status - Check V2Ray service status
router.get("/vpn/status", async (_req: Request, res: Response) => {
  try {
    const configPath = getV2RayConfigPath();
    const configData = await readFile(configPath, "utf-8");
    const config: V2RayConfig = JSON.parse(configData);

    const port = config.inbounds[0]?.port || 10808;

    // In a real implementation, you would check if V2Ray is actually running
    // For now, we just verify the config is readable
    res.json({
      status: "up",
      port,
      lastChecked: new Date().toISOString(),
    });
  } catch (error) {
    res.json({
      status: "down",
      port: 10808,
      lastChecked: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
