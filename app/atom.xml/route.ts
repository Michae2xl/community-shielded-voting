import {
  buildAtomFeed,
  readPublicNotificationFeedItems
} from "@/lib/services/public-notification-feed";

export async function GET() {
  const items = await readPublicNotificationFeedItems();

  return new Response(buildAtomFeed(items), {
    headers: {
      "content-type": "application/atom+xml; charset=utf-8",
      "cache-control": "public, max-age=60, stale-while-revalidate=300"
    }
  });
}
