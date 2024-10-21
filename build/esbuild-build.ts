import esbuild, { BuildOptions } from "esbuild";
import { config } from "dotenv";

config();

const ENTRY_POINTS = {
  typescript: ["static/main.ts", "static/script/*.ts"],
  // css: ["static/style.css"],
};

const DATA_URL_LOADERS = [".png", ".woff", ".woff2", ".eot", ".ttf", ".svg"];

export const esbuildOptions: BuildOptions = {
  sourcemap: true,
  entryPoints: [...ENTRY_POINTS.typescript /* ...ENTRY_POINTS.css */],
  bundle: true,
  minify: false,
  loader: Object.fromEntries(DATA_URL_LOADERS.map((ext) => [ext, "dataurl"])),
  outdir: "static/dist",
  define: createEnvDefines(["SUPABASE_URL", "SUPABASE_ANON_KEY"]),
};

function createEnvDefines(environmentVariables: string[]): Record<string, string> {
  const defines: Record<string, string> = {};
  for (const name of environmentVariables) {
    const envVar = process.env[name];
    if (envVar !== undefined) {
      defines[name] = JSON.stringify(envVar);
    } else {
      throw new Error(`Missing environment variable: ${name}`);
    }
  }

  return defines;
}

async function runBuild() {
  try {
    await esbuild.build(esbuildOptions);
    console.log("\tesbuild complete");
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

void runBuild();
