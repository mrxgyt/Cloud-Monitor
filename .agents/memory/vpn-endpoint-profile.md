---
name: Public VLESS endpoint
description: Distinguishes the confirmed working external client profile from the internal V2Ray listener.
---

The user confirmed that their working client profile uses VLESS over TLS and WebSocket on public port 443, with ALPN `h3` and a random TLS fingerprint. The public endpoint is not the same as the internal V2Ray listener.

**Why:** The hosting layer can terminate TLS and forward WebSocket traffic to an internal listener on a different port.

**How to apply:** When generating client links or changing deployment networking, treat the public host, port, and TLS options as deployment settings; do not infer them from the internal inbound port.
