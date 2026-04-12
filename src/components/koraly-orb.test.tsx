import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KoralyOrb } from "./koraly-orb";

describe("KoralyOrb", () => {
  it("affiche le nom Koraly comme label visuel", () => {
    render(<KoralyOrb />);
    expect(screen.getByText("Koraly")).toBeInTheDocument();
  });

  it("expose un label SR-only qui décrit l'état d'écoute", () => {
    render(<KoralyOrb status="listening" />);
    expect(screen.getByRole("status")).toHaveTextContent(/écoute/i);
  });

  it("annonce l'état prête par défaut", () => {
    render(<KoralyOrb status="idle" />);
    expect(screen.getByRole("status")).toHaveTextContent(/prête/i);
  });

  it("annonce l'état parlant quand Koraly répond", () => {
    render(<KoralyOrb status="speaking" />);
    expect(screen.getByRole("status")).toHaveTextContent(/parle/i);
  });
});
