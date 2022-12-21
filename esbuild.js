const esbuild = require("esbuild");
const { readdirSync, statSync } = require("node:fs");
const { join } = require("node:path");

// Select all typescript files of src directory as entry points
// console.log(readdirSync(join(process.cwd(), "src")));
// const entryPoints = readdirSync(join(process.cwd(), "src"))
//   .filter(
//     (file) =>
//       file.endsWith(".ts") &&
//       statSync(join(process.cwd(), "src", file)).isFile()
//   )
//   .map((file) => `src/${file}`);

let entryPoints = [];

const getFilesRecursively = (directory) => {
  const filesInDirectory = readdirSync(directory);
  for (const file of filesInDirectory) {
    const absolute = join(directory, file);
    if (statSync(absolute).isDirectory()) {
      getFilesRecursively(absolute);
    } else {
      if (file.endsWith(".ts")) {
        entryPoints.push(absolute);
      }
    }
  }
};

getFilesRecursively(join(process.cwd(), "src"));

const browserConfig = {
  entryPoints: ["src/browser/index.ts"],
  bundle: true,
  sourcemap: true,
  minify: true,
  splitting: false,
  platform: "browser",
  target: ["esnext"],
};
// Browser: esm output bundles with code splitting
esbuild
  .build({
    ...browserConfig,
    outfile: "dist/index.esm.js",
    format: "esm",
  })
  .catch(() => process.exit(1));

// // // Browser: esm output bundles with code splitting
// esbuild
//   .build({
//     ...browserConfig,
//     outfile: "dist/index.cjs.js",
//     format: "cjs",
//   })
//   .catch(() => process.exit(1));

console.log("entrypoints", entryPoints);
const serverConfig = {
  // entryPoints,
  entryPoints: ["src/node/index.ts"],
  sourcemap: false,
  // mainFields: ["module", "main"],
  minify: false,
  packages: "external",
  bundle: true,
  platform: "node",
  // external: []
  target: ["node18"],
};

// Node.js cjs output bundle
esbuild
  .build({
    ...serverConfig,
    format: "cjs",
    // outExtension: { ".js": ".cjs" },
    outfile: "dist/node/server.js",
    // outdir: "dist",
  })
  .catch(() => process.exit(1));

// Node.js esm output bundle
esbuild
  .build({
    ...serverConfig,
    outfile: "dist/node/server.mjs",
    // outdir: "dist",
    // outExtension: { ".js": ".mjs" },
    format: "esm",
  })
  .catch(() => process.exit(1));
