import React from "react";
import { render, screen } from "@testing-library/react";
import { HomePage } from "@/app/page";

describe("HomePage", () => {
  it("renders the MVP landing copy", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", { name: /sign in to continue/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/access live polls, voting qr requests/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      "/login"
    );
    expect(screen.getByRole("link", { name: /view polls/i })).toHaveAttribute(
      "href",
      "/polls"
    );
    expect(screen.queryByRole("link", { name: /^polls$/i })).not.toBeInTheDocument();
  });
});
