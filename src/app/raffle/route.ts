import { readFileSync } from "fs";
import { join } from "path";

const html = readFileSync(join(process.cwd(), "staffva-candidate-landing.html"), "utf-8")
  .replace(
    "<head>",
    '<head>\n<meta name="robots" content="noindex, nofollow">'
  );

export async function GET() {
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
