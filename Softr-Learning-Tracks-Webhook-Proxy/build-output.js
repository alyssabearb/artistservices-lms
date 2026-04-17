/**
 * Build script for Vercel Build Output API.
 * Creates .vercel/output so Vercel deploys static + serverless functions
 * and ignores the locked "Output Directory: public" setting.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname);
const OUT = path.join(ROOT, ".vercel", "output");
// Build into a temp dir then replace OUT in one step to avoid cache conflicts
const OUT_TMP = path.join(ROOT, ".vercel", "output." + Date.now());

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  mkdirp(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  mkdirp(dest);
  fs.cpSync(src, dest, { recursive: true });
}

// 1. Static
const staticDir = path.join(OUT_TMP, "static");
mkdirp(staticDir);
const publicIndex = path.join(ROOT, "public", "index.html");
if (fs.existsSync(publicIndex)) {
  fs.copyFileSync(publicIndex, path.join(staticDir, "index.html"));
} else {
  fs.writeFileSync(
    path.join(staticDir, "index.html"),
    "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Progress API</title></head><body><p>Use /api/progress and /api/section-view</p></body></html>"
  );
}

// 2. Config: .vercel/output/config.json (routes use src regex + dest)
const config = {
  version: 3,
  routes: [
    { src: "^/api/progress$", dest: "/api" },
    { src: "^/api/section-view$", dest: "/api" },
  ],
};
mkdirp(OUT_TMP);
fs.writeFileSync(path.join(OUT_TMP, "config.json"), JSON.stringify(config, null, 2));

// 3. Serverless function at /api (path functions/api.func -> URL /api)
const funcDir = path.join(OUT_TMP, "functions", "api.func");
mkdirp(funcDir);

// serve.js = same handler as api/index.js
const apiIndex = path.join(ROOT, "api", "index.js");
const serveJs = fs.readFileSync(apiIndex, "utf8");
fs.writeFileSync(path.join(funcDir, "serve.js"), serveJs);

// .vc-config.json for Node.js
const vcConfig = {
  runtime: "nodejs20.x",
  handler: "serve.js",
  launcherType: "Nodejs",
  shouldAddHelpers: true,
};
fs.writeFileSync(path.join(funcDir, ".vc-config.json"), JSON.stringify(vcConfig, null, 2));

// node_modules so @upstash/redis is available
const nodeModulesSrc = path.join(ROOT, "node_modules");
const nodeModulesDest = path.join(funcDir, "node_modules");
if (fs.existsSync(nodeModulesSrc)) {
  copyDir(nodeModulesSrc, nodeModulesDest);
}

// Replace .vercel/output in one step so cached output never causes "already exists"
if (fs.existsSync(OUT)) {
  fs.rmSync(OUT, { recursive: true });
}
fs.renameSync(OUT_TMP, OUT);
console.log("Build Output API: .vercel/output created (static + config + functions/api.func)");
