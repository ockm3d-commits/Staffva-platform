import { readFileSync } from "fs";
import { join } from "path";

const floatingButton = `
<a href="https://staffva.com/signup/candidate" style="
  position:fixed;bottom:32px;right:32px;z-index:999;
  background:#FE6E3E;color:#fff;font-weight:600;font-family:'DM Sans',sans-serif;
  font-size:16px;text-decoration:none;
  padding:14px 28px;border-radius:100px;
  box-shadow:0 4px 20px rgba(254,110,62,0.35);
  transition:all 0.2s ease;
" onmouseover="this.style.background='#FF8D67';this.style.transform='translateY(-2px)'"
   onmouseout="this.style.background='#FE6E3E';this.style.transform='translateY(0)'"
>Apply Now →</a>
<style>@media(max-width:768px){a[href='https://staffva.com/signup/candidate'][style*='position:fixed']{padding:12px 22px!important;font-size:14px!important;}}</style>
`;

const html = readFileSync(join(process.cwd(), "staffva-candidate-landing.html"), "utf-8")
  .replace(
    "<head>",
    '<head>\n<meta name="robots" content="noindex, nofollow">'
  )
  .replace(
    "</body>",
    floatingButton + "</body>"
  );

export async function GET() {
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
