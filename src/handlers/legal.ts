import type { Env } from "../worker";

// Legal documents — bundled as text at build time via wrangler `[[rules]]`.
// Single source of truth stays in `docs/*.md`. Do NOT duplicate content here.
import tosMd from "../../docs/tos.md";
import privacyMd from "../../docs/privacy.md";
import disclaimerMd from "../../docs/disclaimer.md";
import noticesMd from "../../docs/notices.md";

/**
 * Minimal Markdown → HTML converter, scoped to the subset of Markdown we
 * actually use in our legal docs: ATX headings (# ##), paragraphs, unordered
 * lists (`- `), fenced code blocks (```), inline `code`, and **bold**. Not a
 * general-purpose renderer. Good enough to serve the four legal pages.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInline(s: string): string {
  // Escape first, then apply inline formatting on the escaped text so that
  // literal HTML in the source stays literal.
  let out = escapeHtml(s);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return out;
}

function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let inList = false;
  let inCode = false;
  let paragraph: string[] = [];

  const flushParagraph = (): void => {
    if (paragraph.length) {
      out.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };
  const closeList = (): void => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  for (const raw of lines) {
    const line = raw;

    if (line.trim().startsWith("```")) {
      flushParagraph();
      closeList();
      if (inCode) {
        out.push("</code></pre>");
        inCode = false;
      } else {
        out.push('<pre><code>');
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      out.push(escapeHtml(line));
      continue;
    }

    if (/^#{1,6}\s/.test(line)) {
      flushParagraph();
      closeList();
      const level = (line.match(/^#+/)?.[0] ?? "#").length;
      const text = line.replace(/^#+\s*/, "");
      out.push(`<h${level}>${renderInline(text)}</h${level}>`);
      continue;
    }

    if (/^\s*-\s+/.test(line)) {
      flushParagraph();
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      const text = line.replace(/^\s*-\s+/, "");
      out.push(`<li>${renderInline(text)}</li>`);
      continue;
    }

    if (line.trim() === "") {
      flushParagraph();
      closeList();
      continue;
    }

    // Horizontal rule.
    if (/^\s*---+\s*$/.test(line)) {
      flushParagraph();
      closeList();
      out.push("<hr />");
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  closeList();
  if (inCode) out.push("</code></pre>");

  return out.join("\n");
}

function page(title: string, body: string): Response {
  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<title>${escapeHtml(title)} — cron-explainer</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:760px;margin:2.5rem auto;padding:0 1rem;color:#111;line-height:1.6}
  h1{font-size:1.8rem;margin-bottom:.5rem}
  h2{font-size:1.2rem;margin-top:1.75rem;border-bottom:1px solid #eee;padding-bottom:.2rem}
  h3{font-size:1.05rem;margin-top:1.25rem}
  code{background:#f3f3f3;padding:.1rem .35rem;border-radius:4px;font-size:.92em}
  pre{background:#111;color:#eee;padding:1rem;border-radius:8px;overflow-x:auto;font-size:.88rem;line-height:1.45}
  pre code{background:transparent;color:inherit;padding:0}
  ul{padding-left:1.25rem}
  li{margin:.2rem 0}
  hr{border:0;border-top:1px solid #ddd;margin:1.5rem 0}
  a{color:#0a7}
  .back{display:inline-block;margin-top:2rem;color:#777;font-size:.9em}
</style></head><body>
${body}
<p class="back"><a href="/">← back to cron-explainer</a></p>
</body></html>`;
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export function handleTos(_request: Request, _env: Env): Response {
  return page("Terms of Service", markdownToHtml(tosMd));
}
export function handlePrivacy(_request: Request, _env: Env): Response {
  return page("Privacy Notice", markdownToHtml(privacyMd));
}
export function handleDisclaimer(_request: Request, _env: Env): Response {
  return page("Accuracy & Warranty Disclaimer", markdownToHtml(disclaimerMd));
}
export function handleNotices(_request: Request, _env: Env): Response {
  return page("Third-Party OSS Notices", markdownToHtml(noticesMd));
}
