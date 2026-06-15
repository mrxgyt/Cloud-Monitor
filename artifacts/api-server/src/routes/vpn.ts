import { Router, type Request, type Response } from "express";
import { readFile } from "fs/promises";
import path from "path";

const router = Router();

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
router.get("/vpn/connection", async (_req: Request, res: Response) => {
  try {
    const configPath =
      process.env.V2RAY_CONFIG_PATH || "/app/v2ray-config.json";
    const configData = await readFile(configPath, "utf-8");
    const config: V2RayConfig = JSON.parse(configData);

    const inbound = config.inbounds[0];
    if (!inbound) {
      return res.status(500).json({ error: "No inbound configuration found" });
    }

    const uuid = inbound.settings.clients[0]?.id;
    const wsPath = inbound.streamSettings.wsSettings.path;
    const port = inbound.port;
    const host = process.env.VPN_HOST || "localhost";

    if (!uuid || !wsPath) {
      return res.status(500).json({ error: "Invalid V2Ray configuration" });
    }

    // Format: vless://[UUID]@[HOST]:[PORT]?type=ws&path=[PATH]&security=none#[NAME]
    const connectionString = `vless://${uuid}@${host}:${port}?type=ws&path=${encodeURIComponent(wsPath)}&security=none#CloudMonitorVPN`;

    res.json({
      connectionString,
      uuid,
      host,
      port,
      path: wsPath,
      protocol: "vless",
      network: "ws",
      security: "none",
    });
  } catch (error) {
    console.error("Error reading V2Ray config:", error);
    res.status(500).json({
      error: "Failed to read V2Ray configuration",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// GET /api/vpn/status - Check V2Ray service status
router.get("/vpn/status", async (_req: Request, res: Response) => {
  try {
    const configPath =
      process.env.V2RAY_CONFIG_PATH || "/app/v2ray-config.json";
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
