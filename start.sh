#!/bin/sh

# Start V2Ray in background
/usr/local/bin/v2ray run -config /etc/v2ray/config.json &

# Start Node.js API server
exec node --enable-source-maps ./dist/index.mjs
