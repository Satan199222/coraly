import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FaqAccordion } from "./faq-accordion";

describe("FaqAccordion", () => {
  it("rend toutes les questions", () => {
    const { container } = render(<FaqAccordion />);
    expect(container.querySelectorAll("details").length).toBeGreaterThanOrEqual(5);
  });

  it("permet d'ouvrir une réponse au clic", async () => {
    const user = userEvent.setup();
    const { container } = render(<FaqAccordion />);
    const first = container.querySelectorAll("details")[0]!;
    const summary = first.querySelector("summary")!;
    await user.click(summary);
    expect(first).toHaveAttribute("open");
  });
});
