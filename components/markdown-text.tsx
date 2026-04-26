import type { ReactNode } from "react";

type MarkdownBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "quote"; text: string }
  | { type: "ul" | "ol"; items: string[] };

type MarkdownInlineProps = {
  value: string;
  allowLinks?: boolean;
  className?: string;
};

type MarkdownTextProps = MarkdownInlineProps & {
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
};

const SPECIAL_INLINE_CHARS = ["`", "*", "["];

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
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
  const positions = SPECIAL_INLINE_CHARS.map((char) => value.indexOf(char, start))
    .filter((position) => position !== -1);

  return positions.length ? Math.min(...positions) : value.length;
}

function renderInline(value: string, allowLinks: boolean): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  while (cursor < value.length) {
    if (value.startsWith("`", cursor)) {
      const end = value.indexOf("`", cursor + 1);

      if (end > cursor + 1) {
        nodes.push(<code key={`code-${key++}`}>{value.slice(cursor + 1, end)}</code>);
        cursor = end + 1;
        continue;
      }
    }

    if (value.startsWith("**", cursor)) {
      const end = value.indexOf("**", cursor + 2);

      if (end > cursor + 2) {
        nodes.push(
          <strong key={`strong-${key++}`}>
            {renderInline(value.slice(cursor + 2, end), allowLinks)}
          </strong>
        );
        cursor = end + 2;
        continue;
      }
    }

    if (value.startsWith("*", cursor) && !value.startsWith("**", cursor)) {
      const end = value.indexOf("*", cursor + 1);

      if (end > cursor + 1) {
        nodes.push(
          <em key={`em-${key++}`}>
            {renderInline(value.slice(cursor + 1, end), allowLinks)}
          </em>
        );
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
            const isExternal = href.startsWith("http://") || href.startsWith("https://");

            nodes.push(
              <a
                key={`link-${key++}`}
                href={href}
                rel={isExternal ? "noreferrer" : undefined}
                target={isExternal ? "_blank" : undefined}
              >
                {renderInline(label, false)}
              </a>
            );
          } else {
            nodes.push(...renderInline(label, false));
          }

          cursor = hrefEnd + 1;
          continue;
        }
      }
    }

    const next = findNextInlineBoundary(value, cursor + 1);
    nodes.push(value.slice(cursor, next));
    cursor = next;
  }

  return nodes;
}

function isBlockStart(line: string) {
  return (
    /^(#{1,3})\s+\S/.test(line.trim()) ||
    /^\s*>\s?\S/.test(line) ||
    /^\s*[-*+]\s+\S/.test(line) ||
    /^\s*\d+[\.)]\s+\S/.test(line)
  );
}

function parseBlocks(value: string): MarkdownBlock[] {
  const lines = value.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
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

function renderBlock(
  block: MarkdownBlock,
  index: number,
  allowLinks: boolean,
  flattenHeadings = false
) {
  switch (block.type) {
    case "heading": {
      if (flattenHeadings) {
        return <p key={`heading-${index}`}>{renderInline(block.text, allowLinks)}</p>;
      }

      const Heading = `h${block.level}` as const;

      return (
        <Heading key={`heading-${index}`} className="markdown-heading">
          {renderInline(block.text, allowLinks)}
        </Heading>
      );
    }
    case "quote":
      return <blockquote key={`quote-${index}`}>{renderInline(block.text, allowLinks)}</blockquote>;
    case "ul":
      return (
        <ul key={`ul-${index}`}>
          {block.items.map((item, itemIndex) => (
            <li key={`ul-${index}-${itemIndex}`}>{renderInline(item, allowLinks)}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol key={`ol-${index}`}>
          {block.items.map((item, itemIndex) => (
            <li key={`ol-${index}-${itemIndex}`}>{renderInline(item, allowLinks)}</li>
          ))}
        </ol>
      );
    case "paragraph":
      return <p key={`paragraph-${index}`}>{renderInline(block.text, allowLinks)}</p>;
  }
}

export function MarkdownInline({
  value,
  allowLinks = true,
  className
}: MarkdownInlineProps) {
  return (
    <span className={classNames("markdown-inline", className)}>
      {renderInline(value, allowLinks)}
    </span>
  );
}

export function MarkdownText({
  value,
  allowLinks = true,
  className,
  headingLevel
}: MarkdownTextProps) {
  const blocks = parseBlocks(value);

  return (
    <div
      aria-level={headingLevel}
      className={classNames(
        "markdown-text",
        headingLevel ? "markdown-text--heading" : false,
        className
      )}
      role={headingLevel ? "heading" : undefined}
    >
      {blocks.map((block, index) =>
        renderBlock(block, index, allowLinks, Boolean(headingLevel))
      )}
    </div>
  );
}
