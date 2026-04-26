import {
  buildPollEmailSubject,
  buildPollQuestionEmailHtml
} from "@/lib/email/content";

describe("email content helpers", () => {
  it("keeps long poll subjects bounded while preserving the body elsewhere", () => {
    const subject = buildPollEmailSubject(
      "Vote invitation",
      `# ${"Long governance detail ".repeat(20)}`
    );

    expect(subject).toMatch(/^Vote invitation · Long governance detail/);
    expect(subject.length).toBeLessThanOrEqual(120);
    expect(subject).toMatch(/\.\.\.$/);
  });

  it("renders safe markdown for poll question email HTML", () => {
    const html = buildPollQuestionEmailHtml(
      [
        "# Funding path",
        "",
        "Choose **one** option with `shielded` receipts.",
        "",
        "- Preserve privacy",
        "- Publish audit events",
        "",
        "[Portal](https://voting.zkglobalcredit.tech/polls)"
      ].join("\n")
    );

    expect(html).toContain("Funding path");
    expect(html).toContain("<strong>one</strong>");
    expect(html).toContain("<code");
    expect(html).toContain("<ul");
    expect(html).toContain('href="https://voting.zkglobalcredit.tech/polls"');
  });

  it("escapes raw html and removes unsafe markdown links", () => {
    const html = buildPollQuestionEmailHtml(
      '<script>alert("x")</script> [bad](javascript:alert(1))'
    );

    expect(html).not.toContain("<script>");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<a ");
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(html).toContain("bad");
  });
});
