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

// ---- Speed test helpers ----

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile90(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * 0.9) - 1;
  return sorted[Math.max(0, idx)];
}

function jitter(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

async function measurePing(url: string, samples: number): Promise<number[]> {
  const results: number[] = [];
  for (let i = 0; i < samples; i++) {
    const t = Date.now();
    try {
      await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(4000) });
      results.push(Date.now() - t);
    } catch {
      // skip failed pings
    }
    // small gap between samples
    await new Promise(r => setTimeout(r, 20));
  }
  return results;
}

async function measureDownload(bytes: number): Promise<number | null> {
  try {
    const t = Date.now();
    const resp = await fetch(
      `https://speed.cloudflare.com/__down?bytes=${bytes}`,
      { signal: AbortSignal.timeout(20000) }
    );
    const buf = await resp.arrayBuffer();
    const elapsed = (Date.now() - t) / 1000;
    if (buf.byteLength < bytes * 0.9) return null; // incomplete
    return (buf.byteLength * 8) / (elapsed * 1_000_000); // Mbps
  } catch {
    return null;
  }
}

async function measureUpload(bytes: number): Promise<number | null> {
  try {
    const body = new Uint8Array(bytes);
    const t = Date.now();
    await fetch("https://speed.cloudflare.com/__up", {
      method: "POST",
      body,
      headers: { "Content-Type": "application/octet-stream" },
      signal: AbortSignal.timeout(20000),
    });
    const elapsed = (Date.now() - t) / 1000;
    return (bytes * 8) / (elapsed * 1_000_000); // Mbps
  } catch {
    return null;
  }
}

// GET /speedtest
router.get("/network/speedtest", async (req, res) => {
  const testedAt = new Date().toISOString();
  try {
    // --- Phase 1: Ping — 20 samples, derive median ping + jitter
    const pingUrl = "https://speed.cloudflare.com/__down?bytes=0";
    const pingSamples = await measurePing(pingUrl, 20);
    const pingMs = pingSamples.length > 0 ? parseFloat(median(pingSamples).toFixed(1)) : null;
    const jitterMs = pingSamples.length > 1 ? parseFloat(jitter(pingSamples).toFixed(1)) : null;

    // --- Phase 2: Download — 5 runs with increasing sizes, take 90th percentile
    const dlSizes = [1_000_000, 5_000_000, 10_000_000, 25_000_000, 25_000_000];
    const dlSamples: number[] = [];
    for (const size of dlSizes) {
      const mbps = await measureDownload(size);
      if (mbps !== null) dlSamples.push(mbps);
    }
    const downloadMbps = dlSamples.length > 0
      ? parseFloat(percentile90(dlSamples).toFixed(2))
      : null;

    // --- Phase 3: Upload — 4 runs with increasing sizes, take 90th percentile
    const ulSizes = [500_000, 2_000_000, 5_000_000, 10_000_000];
    const ulSamples: number[] = [];
    for (const size of ulSizes) {
      const mbps = await measureUpload(size);
      if (mbps !== null) ulSamples.push(mbps);
    }
    const uploadMbps = ulSamples.length > 0
      ? parseFloat(percentile90(ulSamples).toFixed(2))
      : null;

    res.json({
      downloadMbps,
      uploadMbps,
      pingMs,
      jitterMs,
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
