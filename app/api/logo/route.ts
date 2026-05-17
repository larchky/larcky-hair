import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

const PROVIDED_LOGO_PATH =
  process.env.DOLAPO_LOGO_PATH ||
  "C:/Users/new user/Downloads/ChatGPT Image May 17, 2026, 04_31_15 PM.png";

export async function GET() {
  try {
    const logo = await readFile(PROVIDED_LOGO_PATH);

    return new Response(logo, {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Content-Type": "image/png",
      },
    });
  } catch {
    const fallbackLogo = await readFile(
      join(process.cwd(), "public", "dolapo-logo.svg")
    );

    return new Response(fallbackLogo, {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Content-Type": "image/svg+xml",
      },
    });
  }
}
