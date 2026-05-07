import {
  buildRssFeed,
  readPublicNotificationFeedItems
} from "@/lib/services/public-notification-feed";

export async function GET() {
  const items = await readPublicNotificationFeedItems();

  return new Response(buildRssFeed(items), {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=60, stale-while-revalidate=300"
    }
  });
}
