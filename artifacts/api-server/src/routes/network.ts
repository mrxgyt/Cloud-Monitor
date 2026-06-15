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

// ---- Speed test server definitions ----

const SPEED_SERVERS = [
  {
    id: "cloudflare",
    name: "Cloudflare",
    location: "Global (Auto)",
    pingUrl: "https://speed.cloudflare.com/__down?bytes=0",
    downloadUrl: (bytes: number) => `https://speed.cloudflare.com/__down?bytes=${bytes}`,
    uploadUrl: "https://speed.cloudflare.com/__up",
    maxDownloadBytes: 50_000_000,
  },
  {
    id: "akamai-dallas",
    name: "Akamai",
    location: "Dallas, US",
    pingUrl: "http://speedtest.dallas.linode.com",
    downloadUrl: (_: number) => "http://speedtest.dallas.linode.com/100MB-dallas.bin",
    uploadUrl: "https://speed.cloudflare.com/__up",
    maxDownloadBytes: 104_857_600,
  },
  {
    id: "akamai-london",
    name: "Akamai",
    location: "London, UK",
    pingUrl: "http://speedtest.london.linode.com",
    downloadUrl: (_: number) => "http://speedtest.london.linode.com/100MB-london.bin",
    uploadUrl: "https://speed.cloudflare.com/__up",
    maxDownloadBytes: 104_857_600,
  },
  {
    id: "akamai-singapore",
    name: "Akamai",
    location: "Singapore",
    pingUrl: "http://speedtest.singapore.linode.com",
    downloadUrl: (_: number) => "http://speedtest.singapore.linode.com/100MB-singapore.bin",
    uploadUrl: "https://speed.cloudflare.com/__up",
    maxDownloadBytes: 104_857_600,
  },
  {
    id: "akamai-tokyo",
    name: "Akamai",
    location: "Tokyo, JP",
    pingUrl: "http://speedtest.tokyo2.linode.com",
    downloadUrl: (_: number) => "http://speedtest.tokyo2.linode.com/100MB-tokyo2.bin",
    uploadUrl: "https://speed.cloudflare.com/__up",
    maxDownloadBytes: 104_857_600,
  },
] as const;

type ServerId = typeof SPEED_SERVERS[number]["id"];

// GET /network/speedtest/servers
router.get("/network/speedtest/servers", async (_req, res) => {
  const results = await Promise.all(
    SPEED_SERVERS.map(async (s) => {
      const { ok, ms } = await timeRequest(s.pingUrl, { method: "HEAD" });
      return { id: s.id, name: s.name, location: s.location, latencyMs: ok ? ms : null };
    })
  );
  res.json(results);
});

// GET /network/speedtest/stream?server=cloudflare  (SSE)
router.get("/network/speedtest/stream", async (req, res) => {
  const serverId = (req.query.server as string) || "cloudflare";
  const server = SPEED_SERVERS.find(s => s.id === serverId) ?? SPEED_SERVERS[0];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let closed = false;
  req.on("close", () => { closed = true; });

  const send = (data: object) => {
    if (!closed) res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const abort = new AbortController();
  req.on("close", () => abort.abort());

  try {
    // ---- PHASE: PING ----
    send({ type: "phase", phase: "ping" });
    const pingSamples: number[] = [];
    for (let i = 0; i < 20 && !closed; i++) {
      const t = Date.now();
      try {
        await fetch(server.pingUrl, { method: "HEAD", signal: AbortSignal.timeout(3000) });
        const ms = Date.now() - t;
        pingSamples.push(ms);
        send({ type: "ping_sample", ms, sample: i + 1, total: 20 });
      } catch { /* ignore failed pings */ }
      await new Promise(r => setTimeout(r, 15));
    }

    let pingMs: number | null = null;
    let jitterMs: number | null = null;
    if (pingSamples.length > 0) {
      const sorted = [...pingSamples].sort((a, b) => a - b);
      pingMs = parseFloat((sorted[Math.floor(sorted.length / 2)]).toFixed(1));
      const avg = pingSamples.reduce((s, v) => s + v, 0) / pingSamples.length;
      const variance = pingSamples.reduce((s, v) => s + (v - avg) ** 2, 0) / pingSamples.length;
      jitterMs = parseFloat(Math.sqrt(variance).toFixed(1));
    }
    send({ type: "ping_done", pingMs, jitterMs });

    // ---- PHASE: DOWNLOAD ----
    if (!closed) {
      send({ type: "phase", phase: "download" });
      const dlSpeeds: number[] = [];
      const dlUrl = server.downloadUrl(server.maxDownloadBytes);

      try {
        const dlResp = await fetch(dlUrl, { signal: abort.signal });
        if (!dlResp.body) throw new Error("no body");
        const reader = dlResp.body.getReader();
        let totalBytes = 0;
        const dlStart = Date.now();
        let lastEmit = dlStart;

        while (!closed) {
          const { done, value } = await reader.read();
          if (done) break;
          totalBytes += value.byteLength;
          const now = Date.now();
          const elapsed = (now - dlStart) / 1000;
          const currentMbps = (totalBytes * 8) / (elapsed * 1_000_000);
          if (now - lastEmit >= 200) {
            dlSpeeds.push(currentMbps);
            send({ type: "download_progress", mbps: parseFloat(currentMbps.toFixed(2)), bytes: totalBytes });
            lastEmit = now;
          }
          // stop after maxDownloadBytes to avoid long waits on large files
          if (totalBytes >= server.maxDownloadBytes) {
            reader.cancel();
            break;
          }
        }

        if (totalBytes > 0) {
          const finalElapsed = (Date.now() - dlStart) / 1000;
          const finalMbps = (totalBytes * 8) / (finalElapsed * 1_000_000);
          dlSpeeds.push(finalMbps);
        }
      } catch (err) {
        if (!closed) req.log.warn({ err }, "download stream error");
      }

      // Take 90th percentile of samples for best sustained speed
      const sortedDl = [...dlSpeeds].sort((a, b) => a - b);
      const downloadMbps = sortedDl.length > 0
        ? parseFloat(sortedDl[Math.ceil(sortedDl.length * 0.9) - 1].toFixed(2))
        : null;
      send({ type: "download_done", downloadMbps });
    }

    // ---- PHASE: UPLOAD ----
    if (!closed) {
      send({ type: "phase", phase: "upload" });
      const ulSizes = [500_000, 2_000_000, 5_000_000, 10_000_000];
      const ulSpeeds: number[] = [];

      for (const size of ulSizes) {
        if (closed) break;
        try {
          const body = new Uint8Array(size);
          const t = Date.now();
          await fetch(server.uploadUrl, {
            method: "POST",
            body,
            headers: { "Content-Type": "application/octet-stream" },
            signal: AbortSignal.timeout(15000),
          });
          const elapsed = (Date.now() - t) / 1000;
          const mbps = (size * 8) / (elapsed * 1_000_000);
          ulSpeeds.push(mbps);
          send({ type: "upload_progress", mbps: parseFloat(mbps.toFixed(2)), bytes: size });
        } catch { /* ignore failed chunks */ }
      }

      const sortedUl = [...ulSpeeds].sort((a, b) => a - b);
      const uploadMbps = sortedUl.length > 0
        ? parseFloat(sortedUl[Math.ceil(sortedUl.length * 0.9) - 1].toFixed(2))
        : null;
      send({ type: "upload_done", uploadMbps });
      send({ type: "complete", server: `${server.name} — ${server.location}`, testedAt: new Date().toISOString() });
    }
  } catch (err) {
    if (!closed) {
      req.log.error({ err }, "speedtest stream failed");
      send({ type: "error", message: "Speed test failed" });
    }
  } finally {
    if (!closed) res.end();
  }
});

export default router;
