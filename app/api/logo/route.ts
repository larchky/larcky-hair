import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

const LOGO_PATH = join(process.cwd(), "public", "dolapo-logo.png");
const FALLBACK_LOGO_PATH = join(process.cwd(), "public", "dolapo-logo.svg");

export async function GET() {
  try {
    const logo = await readFile(LOGO_PATH);

    return new Response(logo, {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Content-Type": "image/png",
      },
    });
  } catch {
    const fallbackLogo = await readFile(FALLBACK_LOGO_PATH);

    return new Response(fallbackLogo, {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Content-Type": "image/svg+xml",
      },
    });
  }
}
