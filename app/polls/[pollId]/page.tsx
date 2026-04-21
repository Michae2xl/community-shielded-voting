import PollVotePageClient from "./poll-vote-page-client";

export default async function PollVotePage({
  params
}: {
  params: Promise<{
    pollId: string;
  }>;
}) {
  const { pollId } = await params;

  return <PollVotePageClient pollId={pollId} />;
}
