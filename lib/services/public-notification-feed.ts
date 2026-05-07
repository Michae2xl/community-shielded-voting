import { db } from "@/lib/db";
import {
  calculateSingleChoiceOutcome,
  presentGovernanceOutcome
} from "@/lib/domain/governance";
import { splitPollReferences } from "@/lib/domain/poll-references";

type PublicNotificationFeedItem = {
  id: string;
  title: string;
  summary: string;
  url: string;
  publishedAt: Date;
  updatedAt: Date;
};

const PUBLIC_FEED_TITLE = "ZK Global Credit voting notifications";
const PUBLIC_FEED_DESCRIPTION =
  "Public poll notifications for opened polls, closed polls, and published results.";

function getBaseUrl() {
  return (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/+$/g, "");
}

function xmlEscape(value: string | number) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatRssDate(value: Date) {
  return value.toUTCString();
}

function isClosedPoll(status: string) {
  return status === "CLOSED" || status === "FINALIZED" || status === "ARCHIVED";
}

function formatTurnout(totalConfirmed: number, totalEligible: number) {
  const percent = totalEligible > 0 ? Math.round((totalConfirmed / totalEligible) * 100) : 0;

  return `${percent}% (${totalConfirmed}/${totalEligible} voted)`;
}

export async function readPublicNotificationFeedItems(limit = 40) {
  const now = new Date();
  const baseUrl = getBaseUrl();
  const polls = await db.poll.findMany({
    where: {
      status: {
        in: ["OPEN", "CLOSED", "FINALIZED", "ARCHIVED"]
      }
    },
    orderBy: [
      {
        updatedAt: "desc"
      },
      {
        createdAt: "desc"
      }
    ],
    take: Math.max(limit, 20),
    select: {
      id: true,
      question: true,
      status: true,
      opensAt: true,
      closesAt: true,
      updatedAt: true,
      voteModel: true,
      quorumPercent: true,
      passingThresholdPercent: true,
      tally: {
        select: {
          countA: true,
          totalConfirmed: true,
          updatedAt: true
        }
      },
      _count: {
        select: {
          eligibility: true,
          voterAccesses: true
        }
      }
    }
  });
  const items: PublicNotificationFeedItem[] = [];

  for (const poll of polls) {
    const title = splitPollReferences(poll.question, `Poll ${poll.id}`).title;
    const pollUrl = `${baseUrl}/polls`;
    const totalEligible = poll._count.eligibility + poll._count.voterAccesses;
    const totalConfirmed = poll.tally?.totalConfirmed ?? 0;
    const opened = poll.opensAt.getTime() <= now.getTime();
    const closed = isClosedPoll(poll.status);

    if (opened) {
      items.push({
        id: `poll-opened:${poll.id}`,
        title: `Poll opened: ${title}`,
        summary: `Poll ${poll.id} is open for voting.`,
        url: pollUrl,
        publishedAt: poll.opensAt,
        updatedAt: poll.updatedAt
      });
    }

    if (closed) {
      items.push({
        id: `poll-closed:${poll.id}`,
        title: `Poll closed: ${title}`,
        summary: `Poll ${poll.id} is closed. Final public results are available on the poll board.`,
        url: pollUrl,
        publishedAt: poll.closesAt,
        updatedAt: poll.updatedAt
      });

      const outcome = calculateSingleChoiceOutcome({
        isClosed: true,
        totalEligible,
        totalConfirmed,
        countA: poll.tally?.countA ?? 0,
        voteModel: poll.voteModel,
        quorumPercent: poll.quorumPercent,
        passingThresholdPercent: poll.passingThresholdPercent
      });

      items.push({
        id: `result-published:${poll.id}:${poll.tally?.updatedAt?.toISOString() ?? poll.updatedAt.toISOString()}`,
        title: `Result published: ${title}`,
        summary: [
          `Decision: ${presentGovernanceOutcome(outcome.outcome)}.`,
          `${totalConfirmed} valid vote${totalConfirmed === 1 ? "" : "s"}.`,
          `Turnout ${formatTurnout(totalConfirmed, totalEligible)}.`,
          `Approval ${outcome.approvalPercent}% / ${outcome.passingThresholdPercent}%.`
        ].join(" "),
        url: pollUrl,
        publishedAt: poll.tally?.updatedAt ?? poll.updatedAt,
        updatedAt: poll.tally?.updatedAt ?? poll.updatedAt
      });
    }
  }

  return items
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, limit);
}

export function buildAtomFeed(items: PublicNotificationFeedItem[]) {
  const baseUrl = getBaseUrl();
  const updatedAt = items[0]?.updatedAt ?? new Date();

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${xmlEscape(PUBLIC_FEED_TITLE)}</title>
  <subtitle>${xmlEscape(PUBLIC_FEED_DESCRIPTION)}</subtitle>
  <id>${xmlEscape(`${baseUrl}/atom.xml`)}</id>
  <link href="${xmlEscape(`${baseUrl}/atom.xml`)}" rel="self" />
  <link href="${xmlEscape(`${baseUrl}/polls`)}" />
  <updated>${xmlEscape(updatedAt.toISOString())}</updated>
${items
  .map(
    (item) => `  <entry>
    <title>${xmlEscape(item.title)}</title>
    <id>${xmlEscape(item.id)}</id>
    <link href="${xmlEscape(item.url)}" />
    <updated>${xmlEscape(item.updatedAt.toISOString())}</updated>
    <published>${xmlEscape(item.publishedAt.toISOString())}</published>
    <summary>${xmlEscape(item.summary)}</summary>
  </entry>`
  )
  .join("\n")}
</feed>
`;
}

export function buildRssFeed(items: PublicNotificationFeedItem[]) {
  const baseUrl = getBaseUrl();
  const updatedAt = items[0]?.updatedAt ?? new Date();

  return `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <title>${xmlEscape(PUBLIC_FEED_TITLE)}</title>
    <description>${xmlEscape(PUBLIC_FEED_DESCRIPTION)}</description>
    <link>${xmlEscape(`${baseUrl}/polls`)}</link>
    <lastBuildDate>${xmlEscape(formatRssDate(updatedAt))}</lastBuildDate>
${items
  .map(
    (item) => `    <item>
      <title>${xmlEscape(item.title)}</title>
      <description>${xmlEscape(item.summary)}</description>
      <link>${xmlEscape(item.url)}</link>
      <guid isPermaLink="false">${xmlEscape(item.id)}</guid>
      <pubDate>${xmlEscape(formatRssDate(item.publishedAt))}</pubDate>
    </item>`
  )
  .join("\n")}
  </channel>
</rss>
`;
}
