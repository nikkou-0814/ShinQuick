import { readFileSync } from "fs";
import path from "path";

export async function GET() {
  const packageJsonPath = path.join(process.cwd(), "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const currentVersion = packageJson.version;

  return new Response(JSON.stringify({ version: currentVersion }), {
    headers: { "Content-Type": "application/json" },
  });
}
