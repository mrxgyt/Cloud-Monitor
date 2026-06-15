import { Router, type IRouter } from "express";
import dns from "dns";
import { promisify } from "util";

const router: IRouter = Router();
const dnsResolve = promisify(dns.resolve);

const TEST_HOSTS = [
  "1.1.1.1",
  "8.8.8.8",
  "google.com",
  "github.com",
  "cloudflare.com",
];

async function timeRequest(url: string, options?: RequestInit): Promise<{ ok: boolean; ms: number }> {
  const start = Date.now();
  try {
    const resp = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(8000),
    });
    return { ok: resp.ok || resp.status < 500, ms: Date.now() - start };
  } catch {
    return { ok: false, ms: Date.now() - start };
  }
}

// GET /connectivity
router.get("/network/connectivity", async (req, res) => {
  try {
    const { ok, ms } = await timeRequest("https://1.1.1.1", { method: "HEAD" });
    res.json({
      online: ok,
      responseTime: ok ? ms : null,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "connectivity check failed");
    res.json({
      online: false,
      responseTime: null,
      checkedAt: new Date().toISOString(),
    });
  }
});

// GET /speedtest
router.get("/network/speedtest", async (req, res) => {
  const testedAt = new Date().toISOString();
  try {
    // --- Ping: time a HEAD request to Cloudflare
    const pingStart = Date.now();
    try {
      await fetch("https://1.1.1.1", { method: "HEAD", signal: AbortSignal.timeout(5000) });
    } catch {
      // ignore
    }
    const pingMs = Date.now() - pingStart;

    // --- Download test: download 25MB from Cloudflare speed test endpoint
    const dlStart = Date.now();
    let downloadMbps: number | null = null;
    try {
      const dlResp = await fetch(
        "https://speed.cloudflare.com/__down?bytes=25000000",
        { signal: AbortSignal.timeout(30000) }
      );
      const buf = await dlResp.arrayBuffer();
      const dlTime = (Date.now() - dlStart) / 1000; // seconds
      const bytes = buf.byteLength;
      downloadMbps = parseFloat(((bytes * 8) / (dlTime * 1_000_000)).toFixed(2));
    } catch {
      downloadMbps = null;
    }

    // --- Upload test: POST 10MB of data to Cloudflare
    const ulStart = Date.now();
    let uploadMbps: number | null = null;
    const uploadSize = 10 * 1024 * 1024; // 10 MB
    try {
      const body = new Uint8Array(uploadSize);
      await fetch("https://speed.cloudflare.com/__up", {
        method: "POST",
        body,
        headers: { "Content-Type": "application/octet-stream" },
        signal: AbortSignal.timeout(30000),
      });
      const ulTime = (Date.now() - ulStart) / 1000;
      uploadMbps = parseFloat(((uploadSize * 8) / (ulTime * 1_000_000)).toFixed(2));
    } catch {
      uploadMbps = null;
    }

    res.json({
      downloadMbps,
      uploadMbps,
      pingMs,
      jitterMs: null,
      server: "Cloudflare",
      testedAt,
      error: null,
    });
  } catch (err) {
    req.log.error({ err }, "speedtest failed");
    res.json({
      downloadMbps: null,
      uploadMbps: null,
      pingMs: null,
      jitterMs: null,
      server: null,
      testedAt,
      error: "Speed test failed",
    });
  }
});

// GET /ip-info
router.get("/network/ip-info", async (req, res) => {
  try {
    const response = await fetch("https://ipinfo.io/json", {
      signal: AbortSignal.timeout(8000),
    });
    const data = await response.json() as Record<string, unknown>;
    const loc = typeof data.loc === "string" ? data.loc.split(",") : [];
    const latitude = loc[0] ? parseFloat(loc[0]) : null;
    const longitude = loc[1] ? parseFloat(loc[1]) : null;
    res.json({
      ip: (data.ip as string) ?? "Unknown",
      city: (data.city as string | null) ?? null,
      region: (data.region as string | null) ?? null,
      country: (data.country as string | null) ?? null,
      isp: (data.org as string | null) ?? null,
      latitude,
      longitude,
      timezone: (data.timezone as string | null) ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "ip-info fetch failed");
    res.json({
      ip: "Unknown",
      city: null,
      region: null,
      country: null,
      isp: null,
      latitude: null,
      longitude: null,
      timezone: null,
    });
  }
});

// GET /latency
router.get("/network/latency", async (req, res) => {
  const measuredAt = new Date().toISOString();
  const hostTargets = [
    { host: "1.1.1.1", url: "https://1.1.1.1" },
    { host: "8.8.8.8", url: "https://8.8.8.8" },
    { host: "google.com", url: "https://google.com" },
    { host: "github.com", url: "https://github.com" },
    { host: "cloudflare.com", url: "https://cloudflare.com" },
  ];

  const results = await Promise.all(
    hostTargets.map(async ({ host, url }) => {
      const { ok, ms } = await timeRequest(url, { method: "HEAD" });
      return {
        host,
        latencyMs: ok ? ms : null,
        reachable: ok,
      };
    })
  );

  res.json({ hosts: results, measuredAt });
});

// GET /dns-lookup
router.get("/network/dns-lookup", async (req, res) => {
  const host = req.query.host as string;
  const resolvedAt = new Date().toISOString();

  if (!host) {
    res.status(400).json({ error: "host query param required" });
    return;
  }

  const sanitizedHost = host.replace(/[^a-zA-Z0-9.\-]/g, "").slice(0, 253);

  try {
    const addresses = await dnsResolve(sanitizedHost);
    res.json({
      host: sanitizedHost,
      addresses: Array.isArray(addresses) ? addresses : [addresses],
      resolvedAt,
      error: null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "DNS resolution failed";
    res.json({
      host: sanitizedHost,
      addresses: [],
      resolvedAt,
      error: message,
    });
  }
});

// GET /status-summary
router.get("/network/status-summary", async (req, res) => {
  try {
    const [connectResult, ipResult] = await Promise.all([
      fetch(`http://localhost:${process.env.PORT}/api/network/connectivity`).then(r => r.json()) as Promise<Record<string, unknown>>,
      fetch(`http://localhost:${process.env.PORT}/api/network/ip-info`).then(r => r.json()) as Promise<Record<string, unknown>>,
    ]);

    res.json({
      online: connectResult.online ?? false,
      publicIp: ipResult.ip ?? null,
      isp: ipResult.isp ?? null,
      country: ipResult.country ?? null,
      lastDownloadMbps: null,
      lastUploadMbps: null,
      lastPingMs: null,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "status-summary failed");
    res.json({
      online: false,
      publicIp: null,
      isp: null,
      country: null,
      lastDownloadMbps: null,
      lastUploadMbps: null,
      lastPingMs: null,
      checkedAt: new Date().toISOString(),
    });
  }
});

export default router;
