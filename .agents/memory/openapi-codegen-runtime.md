---
name: OpenAPI codegen runtime
description: Compatibility quirks when regenerating OpenAPI outputs in this workspace.
---

The Replit shell's Node 20 runtime lacks `Map.groupBy`, which the current Orval Zod generator uses. Run codegen with Node 22 or a temporary `Map.groupBy` polyfill; do not add a permanent project polyfill just for code generation.

The current Orval generator also emits `zod.int()` for OpenAPI `integer` fields, but the workspace uses Zod 3, which does not provide that helper. For JSON numeric counters, use OpenAPI `number` unless the Zod/codegen versions are intentionally upgraded together.

**Why:** Regenerating API outputs exposed both a runtime-method mismatch and a generated schema incompatible with the installed Zod major version.

**How to apply:** Check the Node and Zod versions before running codegen. Keep temporary runtime workarounds outside the project and verify generated Zod code with the workspace library typecheck.
