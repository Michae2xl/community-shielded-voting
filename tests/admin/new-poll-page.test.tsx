import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NewPollPage from "@/app/admin/polls/new/page";

const { pushMock } = vi.hoisted(() => ({
  pushMock: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock
  }),
  usePathname: () => "/admin/polls/new"
}));

function localDateTimeToIso(value: string) {
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);

  return new Date(year, month - 1, day, hour, minute).toISOString();
}

describe("NewPollPage", () => {
  beforeEach(() => {
    pushMock.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("publishes ISO timestamps from the browser-local datetime inputs", () => {
    const { container } = render(<NewPollPage />);

    fireEvent.change(screen.getByLabelText(/^opens at$/i), {
      target: { value: "2026-05-01T10:00" }
    });
    fireEvent.change(screen.getByLabelText(/^closes at$/i), {
      target: { value: "2026-05-03T10:00" }
    });

    expect(
      (container.querySelector('input[name="opensAt"]') as HTMLInputElement).value
    ).toBe(localDateTimeToIso("2026-05-01T10:00"));
    expect(
      (container.querySelector('input[name="closesAt"]') as HTMLInputElement).value
    ).toBe(localDateTimeToIso("2026-05-03T10:00"));
    expect(
      (screen.getByLabelText(/^opens at$/i) as HTMLInputElement).name
    ).toBe("opensAtLocal");
  });

  it("redirects to the created poll dashboard after a successful submit", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ pollId: "poll_1" }), { status: 200 })
    );

    render(<NewPollPage />);

    fireEvent.change(screen.getByLabelText(/^question$/i), {
      target: { value: "Which option should we fund?" }
    });
    fireEvent.change(screen.getByLabelText(/^a label$/i), {
      target: { value: "Approve" }
    });
    fireEvent.change(screen.getByLabelText(/^b label$/i), {
      target: { value: "Reject" }
    });
    fireEvent.change(screen.getByLabelText(/^voter nick 1$/i), {
      target: { value: "michae2xl" }
    });
    fireEvent.change(screen.getByLabelText(/^voter email 1$/i), {
      target: { value: "michaelguima@proton.me" }
    });
    fireEvent.change(screen.getByLabelText(/^opens at$/i), {
      target: { value: "2026-05-01T10:00" }
    });
    fireEvent.change(screen.getByLabelText(/^closes at$/i), {
      target: { value: "2026-05-03T10:00" }
    });

    fireEvent.submit(screen.getByRole("button", { name: /create review draft/i }));

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/admin/polls/poll_1")
    );
  });

  it("ignores fully blank extra voter rows on submit", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ pollId: "poll_1" }), { status: 200 })
    );

    render(<NewPollPage />);

    fireEvent.change(screen.getByLabelText(/^question$/i), {
      target: { value: "Which option should we fund?" }
    });
    fireEvent.change(screen.getByLabelText(/^a label$/i), {
      target: { value: "Approve" }
    });
    fireEvent.change(screen.getByLabelText(/^b label$/i), {
      target: { value: "Reject" }
    });
    fireEvent.change(screen.getByLabelText(/^voter nick 1$/i), {
      target: { value: "michae2xl" }
    });
    fireEvent.change(screen.getByLabelText(/^voter email 1$/i), {
      target: { value: "michaelguima@proton.me" }
    });
    fireEvent.click(screen.getByRole("button", { name: /add voter/i }));
    fireEvent.change(screen.getByLabelText(/^opens at$/i), {
      target: { value: "2026-05-01T10:00" }
    });
    fireEvent.change(screen.getByLabelText(/^closes at$/i), {
      target: { value: "2026-05-03T10:00" }
    });

    fireEvent.submit(screen.getByRole("button", { name: /create review draft/i }));

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));

    const requestInit = vi.mocked(globalThis.fetch).mock.calls[0]?.[1] as
      | RequestInit
      | undefined;
    const body = requestInit?.body as FormData;
    expect(body.get("voters")).toBe("michae2xl,michaelguima@proton.me");
  });

  it("blocks submit when a voter row is only partially filled", async () => {
    render(<NewPollPage />);

    fireEvent.change(screen.getByLabelText(/^question$/i), {
      target: { value: "Which option should we fund?" }
    });
    fireEvent.change(screen.getByLabelText(/^a label$/i), {
      target: { value: "Approve" }
    });
    fireEvent.change(screen.getByLabelText(/^b label$/i), {
      target: { value: "Reject" }
    });
    fireEvent.change(screen.getByLabelText(/^voter nick 1$/i), {
      target: { value: "michae2xl" }
    });
    fireEvent.change(screen.getByLabelText(/^voter email 1$/i), {
      target: { value: "michaelguima@proton.me" }
    });
    fireEvent.click(screen.getByRole("button", { name: /add voter/i }));
    fireEvent.change(screen.getByLabelText(/^voter nick 2$/i), {
      target: { value: "alice" }
    });
    fireEvent.change(screen.getByLabelText(/^opens at$/i), {
      target: { value: "2026-05-01T10:00" }
    });
    fireEvent.change(screen.getByLabelText(/^closes at$/i), {
      target: { value: "2026-05-03T10:00" }
    });

    fireEvent.submit(screen.getByRole("button", { name: /create review draft/i }));

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(
      screen.getByText(/complete both nick and email for voter row 2/i)
    ).toBeInTheDocument();
  });
});
