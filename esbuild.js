#!/usr/bin/env node

require("esbuild").build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  outdir: "build"
}).catch(() => process.exit(1))
