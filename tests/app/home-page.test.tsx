import React from "react";
import { render, screen } from "@testing-library/react";
import { HomePageContent } from "@/app/page";

describe("HomePage", () => {
  it("renders the portal access copy and public audit feed", () => {
    render(
      <HomePageContent
        events={[
          {
            id: "poll-1",
            type: "poll_created",
            pollId: "poll_1",
            timestamp: "2026-04-21T12:00:00.000Z",
            summary: "Poll anchor recorded on the shielded rail.",
            txid: "abc123"
          },
          {
            id: "observed-1",
            type: "vote_observed",
            pollId: "poll_1",
            timestamp: "2026-04-21T12:05:00.000Z",
            summary: "Vote payment observed. Awaiting one-block confirmation.",
            txid: "def456",
            isLive: true
          }
        ]}
        allowSampleFallback
      />
    );

    expect(
      screen.getByRole("heading", { name: /sign in to continue/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /watch the shielded rail move/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      "/login"
    );
    expect(screen.getByRole("link", { name: /view polls/i })).toHaveAttribute(
      "href",
      "/polls"
    );
    expect(screen.getAllByText(/poll created/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/vote observed/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/poll poll_1/i)).toHaveLength(2);
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getAllByText("Example")).toHaveLength(3);
  });

  it("fills the audit panel with example events when the feed is empty", () => {
    render(<HomePageContent events={[]} allowSampleFallback />);

    expect(screen.getAllByText(/poll created/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/vote observed/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/vote confirmed/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Example")).toHaveLength(3);
    expect(screen.getAllByText(/poll demo_local_governance/i)).toHaveLength(3);
  });
});
