type EmailMarkdownBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "quote"; text: string }
  | { type: "ul" | "ol"; items: string[] };

const MAX_POLL_EMAIL_SUBJECT_LENGTH = 120;
const INLINE_BOUNDARY_CHARS = ["`", "*", "["];

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function stripMarkdownForSubject(value: string) {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[\.)]\s+/gm, "")
    .replace(/[`*_#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildPollEmailSubject(prefix: string, question: string) {
  const normalizedQuestion = stripMarkdownForSubject(question) || "Poll";
  const subject = `${prefix} · ${normalizedQuestion}`;

  if (subject.length <= MAX_POLL_EMAIL_SUBJECT_LENGTH) {
    return subject;
  }

  return `${subject.slice(0, MAX_POLL_EMAIL_SUBJECT_LENGTH - 3).trimEnd()}...`;
}

function isSafeHref(href: string) {
  const trimmed = href.trim();

  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("mailto:")
  ) {
    return true;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function findNextInlineBoundary(value: string, start: number) {
  const positions = INLINE_BOUNDARY_CHARS.map((char) => value.indexOf(char, start))
    .filter((position) => position !== -1);

  return positions.length ? Math.min(...positions) : value.length;
}

function renderInlineEmailMarkdown(value: string, allowLinks = true): string {
  let html = "";
  let cursor = 0;

  while (cursor < value.length) {
    if (value.startsWith("`", cursor)) {
      const end = value.indexOf("`", cursor + 1);

      if (end > cursor + 1) {
        html += `<code style="border:1px solid rgba(127,92,46,0.18);border-radius:5px;background:#fff8ec;padding:1px 5px;font-family:Arial,sans-serif;font-size:0.9em;">${escapeHtml(value.slice(cursor + 1, end))}</code>`;
        cursor = end + 1;
        continue;
      }
    }

    if (value.startsWith("**", cursor)) {
      const end = value.indexOf("**", cursor + 2);

      if (end > cursor + 2) {
        html += `<strong>${renderInlineEmailMarkdown(value.slice(cursor + 2, end), allowLinks)}</strong>`;
        cursor = end + 2;
        continue;
      }
    }

    if (value.startsWith("*", cursor) && !value.startsWith("**", cursor)) {
      const end = value.indexOf("*", cursor + 1);

      if (end > cursor + 1) {
        html += `<em>${renderInlineEmailMarkdown(value.slice(cursor + 1, end), allowLinks)}</em>`;
        cursor = end + 1;
        continue;
      }
    }

    if (allowLinks && value.startsWith("[", cursor)) {
      const textEnd = value.indexOf("]", cursor + 1);
      const hrefStart = textEnd === -1 ? -1 : textEnd + 1;

      if (textEnd > cursor + 1 && value.startsWith("(", hrefStart)) {
        const hrefEnd = value.indexOf(")", hrefStart + 1);

        if (hrefEnd > hrefStart + 1) {
          const href = value.slice(hrefStart + 1, hrefEnd).trim();
          const label = value.slice(cursor + 1, textEnd);

          if (isSafeHref(href)) {
            html += `<a href="${escapeHtml(href)}" style="color:#4d6d47;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:2px;">${renderInlineEmailMarkdown(label, false)}</a>`;
          } else {
            html += renderInlineEmailMarkdown(label, false);
          }

          cursor = hrefEnd + 1;
          continue;
        }
      }
    }

    const next = findNextInlineBoundary(value, cursor + 1);
    html += escapeHtml(value.slice(cursor, next));
    cursor = next;
  }

  return html;
}

function isBlockStart(line: string) {
  return (
    /^(#{1,3})\s+\S/.test(line.trim()) ||
    /^\s*>\s?\S/.test(line) ||
    /^\s*[-*+]\s+\S/.test(line) ||
    /^\s*\d+[\.)]\s+\S/.test(line)
  );
}

function parseEmailMarkdownBlocks(value: string): EmailMarkdownBlock[] {
  const lines = value.replace(/\r\n?/g, "\n").split("\n");
  const blocks: EmailMarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);

    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length as 1 | 2 | 3,
        text: heading[2].trim()
      });
      index += 1;
      continue;
    }

    if (/^\s*>\s?\S/.test(line)) {
      const quoteLines: string[] = [];

      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^\s*>\s?/, "").trim());
        index += 1;
      }

      blocks.push({ type: "quote", text: quoteLines.join(" ") });
      continue;
    }

    if (/^\s*[-*+]\s+\S/.test(line)) {
      const items: string[] = [];

      while (index < lines.length) {
        const item = /^\s*[-*+]\s+(.+)$/.exec(lines[index]);

        if (!item) {
          break;
        }

        items.push(item[1].trim());
        index += 1;
      }

      blocks.push({ type: "ul", items });
      continue;
    }

    if (/^\s*\d+[\.)]\s+\S/.test(line)) {
      const items: string[] = [];

      while (index < lines.length) {
        const item = /^\s*\d+[\.)]\s+(.+)$/.exec(lines[index]);

        if (!item) {
          break;
        }

        items.push(item[1].trim());
        index += 1;
      }

      blocks.push({ type: "ol", items });
      continue;
    }

    const paragraphLines: string[] = [];

    while (index < lines.length) {
      const current = lines[index];

      if (!current.trim()) {
        break;
      }

      if (paragraphLines.length > 0 && isBlockStart(current)) {
        break;
      }

      paragraphLines.push(current.trim());
      index += 1;
    }

    blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
  }

  return blocks;
}

function renderEmailMarkdownBlock(block: EmailMarkdownBlock) {
  const baseTextStyle =
    "margin:0;color:#38281b;font-size:15px;line-height:1.72;font-family:Arial,sans-serif;word-break:break-word;overflow-wrap:anywhere;";

  switch (block.type) {
    case "heading":
      return `<p style="${baseTextStyle}font-weight:700;font-size:${block.level === 1 ? "18px" : "16px"};">${renderInlineEmailMarkdown(block.text)}</p>`;
    case "quote":
      return `<blockquote style="margin:0;border-left:3px solid rgba(127,92,46,0.22);padding-left:12px;color:#6b5843;font-size:15px;line-height:1.72;font-family:Arial,sans-serif;">${renderInlineEmailMarkdown(block.text)}</blockquote>`;
    case "ul":
      return `<ul style="margin:0;padding-left:20px;color:#38281b;font-size:15px;line-height:1.72;font-family:Arial,sans-serif;">${block.items
        .map((item) => `<li style="margin:0 0 4px;">${renderInlineEmailMarkdown(item)}</li>`)
        .join("")}</ul>`;
    case "ol":
      return `<ol style="margin:0;padding-left:20px;color:#38281b;font-size:15px;line-height:1.72;font-family:Arial,sans-serif;">${block.items
        .map((item) => `<li style="margin:0 0 4px;">${renderInlineEmailMarkdown(item)}</li>`)
        .join("")}</ol>`;
    case "paragraph":
      return `<p style="${baseTextStyle}">${renderInlineEmailMarkdown(block.text)}</p>`;
  }
}

export function buildPollQuestionEmailHtml(question: string) {
  const blocks = parseEmailMarkdownBlocks(question);
  const renderedBlocks = blocks.length
    ? blocks.map(renderEmailMarkdownBlock).join('<div style="height:10px;line-height:10px;">&nbsp;</div>')
    : `<p style="margin:0;color:#38281b;font-size:15px;line-height:1.72;font-family:Arial,sans-serif;">Poll</p>`;

  return `
    <div style="margin:0 0 14px;">
      <p style="margin:0 0 8px;color:#38281b;font-size:16px;line-height:1.6;font-family:Arial,sans-serif;"><strong>Question:</strong></p>
      <div style="padding:14px 16px;border-radius:18px;border:1px solid rgba(127,92,46,0.10);background:#fffaf2;">
        ${renderedBlocks}
      </div>
    </div>
  `.trim();
}
