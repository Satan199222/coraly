import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FaqAccordion } from "./faq-accordion";

describe("FaqAccordion", () => {
  it("rend toutes les questions", () => {
    render(<FaqAccordion />);
    expect(screen.getAllByRole("group").length).toBeGreaterThanOrEqual(5);
  });

  it("permet d'ouvrir une réponse au clic", async () => {
    const user = userEvent.setup();
    render(<FaqAccordion />);
    const first = screen.getAllByRole("group")[0];
    const summary = first.querySelector("summary")!;
    await user.click(summary);
    expect(first).toHaveAttribute("open");
  });
});
