import { render, screen } from "@testing-library/react";
import { MarkdownInline, MarkdownText } from "@/components/markdown-text";

describe("MarkdownText", () => {
  it("renders a safe markdown subset", () => {
    render(
      <MarkdownText
        value={[
          "# Funding decision",
          "",
          "Choose **one** path with `shielded` receipts.",
          "",
          "- Preserve privacy",
          "- Publish audit events",
          "",
          "[Read more](https://example.com/poll)"
        ].join("\n")}
      />
    );

    expect(
      screen.getByRole("heading", { name: "Funding decision" })
    ).toBeInTheDocument();
    expect(screen.getByText("one")).toHaveTextContent("one");
    expect(screen.getByText("shielded")).toBeInTheDocument();
    expect(screen.getByText("Preserve privacy")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Read more" })).toHaveAttribute(
      "href",
      "https://example.com/poll"
    );
  });

  it("does not turn raw html or unsafe links into elements", () => {
    const { container } = render(
      <MarkdownText value={'<script>alert("x")</script> [bad](javascript:alert(1))'} />
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    expect(container).toHaveTextContent('<script>alert("x")</script> bad');
  });
});

describe("MarkdownInline", () => {
  it("can suppress links when rendered inside existing links", () => {
    const { container } = render(
      <MarkdownInline value="[Admin row](/admin/polls/poll_1)" allowLinks={false} />
    );

    expect(container.querySelector("a")).toBeNull();
    expect(screen.getByText("[Admin row](/admin/polls/poll_1)")).toBeInTheDocument();
  });
});
