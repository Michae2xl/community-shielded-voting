import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "@/app/login/page";
import PollVotePage from "@/app/polls/[pollId]/page";

const qrToDataUrlMock = vi.hoisted(() => vi.fn());

vi.mock("qrcode", () => ({
  default: {
    toDataURL: qrToDataUrlMock
  }
}));

beforeEach(() => {
  qrToDataUrlMock.mockReset();
  qrToDataUrlMock.mockResolvedValue("data:image/png;base64,qr");
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PollVotePage", () => {
  async function renderPollVotePage() {
    return render(
      await PollVotePage({ params: Promise.resolve({ pollId: "poll_1" }) })
    );
  }

  it("mentions invited voter credentials on the login screen", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));

    expect(
      screen.getByText(
        /Use your admin credentials or the temporary voter credentials from your invite email to enter the portal/i
      )
    ).toBeInTheDocument();
  });

  it("shows the route poll id while the vote page is still loading", async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async (input) => {
      const url = String(input);

      if (url.endsWith("/api/polls/poll_1")) {
        return new Response(
          JSON.stringify({
            poll: {
              id: "poll_1",
              question: "Which option should we fund?",
              activeOptions: ["A", "B"],
              optionLabels: {
                A: "Approve",
                B: "Reject",
                C: "Option C",
                D: "Option D",
                E: "Option E"
              },
              status: "OPEN",
              feeZec: "0.0001"
            }
          })
        );
      }

      if (url.endsWith("/api/polls/poll_1/my-ticket")) {
        return new Response(
          JSON.stringify({
            ticket: {
              id: "ticket_1",
              pollId: "poll_1",
              ticketPublicId: "ticket_public_1",
              status: "ISSUED",
              observedVote: false,
              lockedOptionLetter: null,
              lockedRequestId: null,
              lockedAt: null,
              lockedRequest: null,
              issuedAt: "2026-05-01T10:00:00.000Z",
              expiresAt: null
            }
          })
        );
      }

      return new Response(JSON.stringify({ requests: [] }));
    });

    await renderPollVotePage();

    expect(
      screen.getByRole("heading", { name: "Poll poll_1" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Loading access for poll_1/i)
    ).toBeInTheDocument();
  });

  it("shows a session access error instead of a fake closed state on unauthorized responses", async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async () =>
      new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 })
    );

    await renderPollVotePage();

    expect((await screen.findAllByText(/sign in again/i)).length).toBeGreaterThan(0);
    expect(
      screen.queryByText(/voting is not open for this poll/i)
    ).not.toBeInTheDocument();
  });

  it("does not render answer controls for a poll that is not open", async () => {
    vi.spyOn(Date, "now").mockReturnValue(new Date("2026-05-01T10:00:00.000Z").getTime());

    vi.mocked(globalThis.fetch).mockImplementation(async (input) => {
      const url = String(input);

      if (url.endsWith("/api/polls/poll_1")) {
        return new Response(
          JSON.stringify({
            poll: {
              id: "poll_1",
              question: "Which option should we fund?",
              activeOptions: ["A", "B"],
              optionLabels: {
                A: "Approve",
                B: "Reject",
                C: "Option C",
                D: "Option D",
                E: "Option E"
              },
              status: "SCHEDULED",
              feeZec: "0.0001",
              opensAt: "2026-05-01T10:30:00.000Z",
              closesAt: "2026-05-03T10:00:00.000Z"
            }
          })
        );
      }

      return new Response(JSON.stringify({ requests: [] }));
    });

    await renderPollVotePage();

    expect(
      await screen.findByText(/this poll opens in 30 minutes/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /approve/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByAltText(/vote a/i)).not.toBeInTheDocument();
  });

  it("shows a ticket pending state when the poll is open but requests are not ready", async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async (input) => {
      const url = String(input);

      if (url.endsWith("/api/polls/poll_1")) {
        return new Response(
          JSON.stringify({
            poll: {
              id: "poll_1",
              question: "Which option should we fund?",
              activeOptions: ["A", "B"],
              optionLabels: {
                A: "Approve",
                B: "Reject",
                C: "Option C",
                D: "Option D",
                E: "Option E"
              },
              status: "OPEN",
              feeZec: "0.0001"
            }
          })
        );
      }

      if (url.endsWith("/api/polls/poll_1/my-ticket")) {
        return new Response(
          JSON.stringify({
            ticket: {
              id: "ticket_1",
              pollId: "poll_1",
              ticketPublicId: "ticket_public_1",
              status: "ISSUED",
              observedVote: false,
              lockedOptionLetter: null,
              lockedRequestId: null,
              lockedAt: null,
              lockedRequest: null,
              issuedAt: "2026-05-01T10:00:00.000Z",
              expiresAt: null
            }
          })
        );
      }

      return new Response(JSON.stringify({ requests: [] }));
    });

    await renderPollVotePage();

    expect(
      await screen.findByText(/QR request is not ready yet/i)
    ).toBeInTheDocument();
    expect(screen.queryByAltText(/vote a/i)).not.toBeInTheDocument();
  });

  it("shows the chooser first and only renders a QR after lock confirmation", async () => {
    let locked = false;

    vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (method === "POST" && url.endsWith("/api/polls/poll_1/lock-choice")) {
        locked = true;
        return new Response(JSON.stringify({ ok: true }));
      }

      if (url.endsWith("/api/polls/poll_1")) {
        return new Response(
          JSON.stringify({
            poll: {
              id: "poll_1",
              question: "Which option should we fund?",
              activeOptions: ["A", "E"],
              optionLabels: {
                A: "Approve",
                B: "Reject",
                C: "Option C",
                D: "Option D",
                E: "Abstain"
              },
              status: "OPEN",
              feeZec: "0.0001"
            }
          })
        );
      }

      if (url.endsWith("/api/polls/poll_1/my-ticket")) {
        return new Response(
          JSON.stringify({
            ticket: locked
              ? {
                  id: "ticket_1",
                  pollId: "poll_1",
                  ticketPublicId: "ticket_public_1",
                  status: "LOCKED",
                  observedVote: false,
                  lockedOptionLetter: "A",
                  lockedRequestId: "req_1",
                  lockedAt: "2026-05-01T10:01:00.000Z",
                  lockedRequest: {
                    id: "req_1",
                    optionLetter: "A",
                    shieldedAddress: "utest1examplea",
                    zip321Uri: "zcash:utest1examplea?amount=0.0001&memo=QQ",
                    status: "ACTIVE"
                  },
                  issuedAt: "2026-05-01T10:00:00.000Z",
                  expiresAt: null
                }
              : {
                  id: "ticket_1",
                  pollId: "poll_1",
                  ticketPublicId: "ticket_public_1",
                  status: "ISSUED",
                  observedVote: false,
                  lockedOptionLetter: null,
                  lockedRequestId: null,
                  lockedAt: null,
                  lockedRequest: null,
                  issuedAt: "2026-05-01T10:00:00.000Z",
                  expiresAt: null
                }
          })
        );
      }

      if (url.endsWith("/api/polls/poll_1/my-vote-requests")) {
        return new Response(
          JSON.stringify({
            requests: locked
              ? [
                  {
                    id: "req_1",
                    optionLetter: "A",
                    shieldedAddress: "utest1examplea",
                    zip321Uri: "zcash:utest1examplea?amount=0.0001&memo=QQ",
                    status: "ACTIVE"
                  }
                ]
              : [
                  {
                    id: "req_1",
                    optionLetter: "A",
                    shieldedAddress: "utest1examplea",
                    zip321Uri: "zcash:utest1examplea?amount=0.0001&memo=QQ",
                    status: "ACTIVE"
                  },
                  {
                    id: "req_2",
                    optionLetter: "E",
                    shieldedAddress: "utest1examplee",
                    zip321Uri: "zcash:utest1examplee?amount=0.0001&memo=RQ",
                    status: "ACTIVE"
                  }
                ]
          })
        );
      }

      return new Response(JSON.stringify({}));
    });

    await renderPollVotePage();

    const approveButton = await screen.findByRole("button", { name: /approve/i });
    const confirmButton = screen.getByRole("button", {
      name: /lock choice and generate qr/i
    });

    expect(confirmButton).toBeDisabled();
    expect(screen.queryByAltText(/vote a/i)).not.toBeInTheDocument();

    fireEvent.click(approveButton);
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /after generating the qr code/i
      })
    );

    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);

    await waitFor(() =>
      expect(screen.getByAltText(/vote a · approve/i)).toBeInTheDocument()
    );
    expect(
      screen.getByText(/payment will be detected, waiting for one-block confirmation/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "https://demo.community-shielded-voting.example/polls"
      })
    ).toHaveAttribute("href", "/polls");
  });

  it("shows an awaiting confirmation state once payment has been observed", async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async (input) => {
      const url = String(input);

      if (url.endsWith("/api/polls/poll_1")) {
        return new Response(
          JSON.stringify({
            poll: {
              id: "poll_1",
              question: "Which option should we fund?",
              activeOptions: ["E"],
              optionLabels: {
                A: "Approve",
                B: "Reject",
                C: "Option C",
                D: "Option D",
                E: "Abstain"
              },
              status: "OPEN",
              feeZec: "0.0001"
            }
          })
        );
      }

      if (url.endsWith("/api/polls/poll_1/my-ticket")) {
        return new Response(
          JSON.stringify({
            ticket: {
              id: "ticket_1",
              pollId: "poll_1",
              ticketPublicId: "ticket_public_1",
              status: "LOCKED",
              observedVote: true,
              lockedOptionLetter: "E",
              lockedRequestId: "req_1",
              lockedAt: "2026-05-01T10:00:00.000Z",
              lockedRequest: {
                id: "req_1",
                optionLetter: "E",
                shieldedAddress: "utest1examplee",
                zip321Uri: "zcash:utest1examplee?amount=0.0001&memo=RQ",
                status: "ACTIVE"
              },
              issuedAt: "2026-05-01T10:00:00.000Z",
              expiresAt: null
            }
          })
        );
      }

      if (url.endsWith("/api/polls/poll_1/my-vote-requests")) {
        return new Response(
          JSON.stringify({
            requests: []
          })
        );
      }

      return new Response(JSON.stringify({}));
    });

    await renderPollVotePage();

    expect(
      await screen.findByText(/Payment detected. This ticket remains locked/i)
    ).toBeInTheDocument();
    expect(screen.queryByAltText(/vote e · abstain/i)).not.toBeInTheDocument();
  });

  it("shows a voted state once the ticket is already consumed", async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async (input) => {
      const url = String(input);

      if (url.endsWith("/api/polls/poll_1")) {
        return new Response(
          JSON.stringify({
            poll: {
              id: "poll_1",
              question: "Which option should we fund?",
              activeOptions: ["A", "B"],
              optionLabels: {
                A: "Approve",
                B: "Reject",
                C: "Option C",
                D: "Option D",
                E: "Option E"
              },
              status: "OPEN",
              feeZec: "0.0001"
            }
          })
        );
      }

      if (url.endsWith("/api/polls/poll_1/my-ticket")) {
        return new Response(
          JSON.stringify({
            ticket: {
              id: "ticket_1",
              pollId: "poll_1",
              ticketPublicId: "ticket_public_1",
              status: "VOTED",
              observedVote: true,
              lockedOptionLetter: "A",
              lockedRequestId: "req_1",
              lockedAt: "2026-05-01T10:00:00.000Z",
              lockedRequest: {
                id: "req_1",
                optionLetter: "A",
                shieldedAddress: "utest1examplea",
                zip321Uri: "zcash:utest1examplea?amount=0.0001&memo=QQ",
                status: "USED"
              },
              issuedAt: "2026-05-01T10:00:00.000Z",
              expiresAt: null
            }
          })
        );
      }

      return new Response(JSON.stringify({ requests: [] }));
    });

    await renderPollVotePage();

    expect(
      await screen.findByText(/vote has been confirmed on-chain/i)
    ).toBeInTheDocument();
    expect(screen.queryByAltText(/vote a/i)).not.toBeInTheDocument();
  });
});
