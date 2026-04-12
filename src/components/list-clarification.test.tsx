import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ListClarification } from "./list-clarification";
import type { ParsedGroceryItem } from "@/lib/carrefour/types";

function makeItem(partial: Partial<ParsedGroceryItem>): ParsedGroceryItem {
  return {
    query: partial.query ?? "lait",
    originalText: partial.originalText ?? "du lait",
    status: partial.status ?? "clear",
    clarificationQuestion: partial.clarificationQuestion,
    suggestions: partial.suggestions,
    quantity: partial.quantity,
    unit: partial.unit,
    brand: partial.brand,
  };
}

describe("ListClarification", () => {
  it("affiche items ambigus/unrecognized AVANT les items clear", () => {
    const items: ParsedGroceryItem[] = [
      makeItem({ originalText: "2L lait demi-écrémé", status: "clear" }),
      makeItem({
        originalText: "du fromage",
        status: "ambiguous",
        clarificationQuestion: "Quel fromage ?",
        suggestions: ["emmental", "comté"],
      }),
      makeItem({ originalText: "pâtes penne", status: "clear" }),
    ];
    render(
      <ListClarification
        items={items}
        onUpdate={() => {}}
        onValidate={() => {}}
      />
    );

    const listItems = screen.getAllByRole("listitem");
    // Le 1er <li> doit être l'ambigu, pas l'item clear
    expect(listItems[0].textContent).toContain("du fromage");
    expect(listItems[0].textContent).toContain("Quel fromage");
  });

  it("désactive 'Lancer la recherche' tant qu'un item n'est pas clear", () => {
    const items = [
      makeItem({ status: "clear", originalText: "lait" }),
      makeItem({
        status: "ambiguous",
        originalText: "du fromage",
        suggestions: ["emmental"],
      }),
    ];
    render(
      <ListClarification
        items={items}
        onUpdate={() => {}}
        onValidate={() => {}}
      />
    );

    const btn = screen.getByRole("button", {
      name: /Précisez les 1 produits restants/i,
    });
    expect(btn).toBeDisabled();
  });

  it("active 'Lancer la recherche' quand tous sont clear", () => {
    const items = [
      makeItem({ status: "clear", originalText: "lait" }),
      makeItem({ status: "clear", originalText: "pain" }),
    ];
    render(
      <ListClarification
        items={items}
        onUpdate={() => {}}
        onValidate={() => {}}
      />
    );

    const btn = screen.getByRole("button", {
      name: /Lancer la recherche/i,
    });
    expect(btn).toBeEnabled();
  });

  it("clic sur une suggestion appelle onUpdate avec status clear", async () => {
    const onUpdate = vi.fn();
    const items = [
      makeItem({
        originalText: "du fromage",
        status: "ambiguous",
        clarificationQuestion: "Quel fromage ?",
        suggestions: ["emmental", "comté"],
      }),
    ];
    render(
      <ListClarification items={items} onUpdate={onUpdate} onValidate={() => {}} />
    );

    await userEvent.click(
      screen.getByRole("button", { name: /choisir : emmental/i })
    );

    expect(onUpdate).toHaveBeenCalledWith(
      0,
      expect.objectContaining({ query: "emmental", status: "clear" })
    );
  });

  it("champ 'Autre réponse' accepte une saisie libre et valide", async () => {
    const onUpdate = vi.fn();
    const items = [
      makeItem({
        originalText: "passes pen",
        status: "unrecognized",
        suggestions: ["pâtes penne"],
      }),
    ];
    render(
      <ListClarification items={items} onUpdate={onUpdate} onValidate={() => {}} />
    );

    const input = screen.getByLabelText(/Autre réponse pour passes pen/i);
    await userEvent.type(input, "fusilli");
    await userEvent.click(
      screen.getByRole("button", { name: /Valider la correction/i })
    );

    expect(onUpdate).toHaveBeenCalledWith(
      0,
      expect.objectContaining({ query: "fusilli", status: "clear" })
    );
  });

  it("bouton Retirer appelle onRemove avec l'index original", async () => {
    const onRemove = vi.fn();
    const items = [
      makeItem({ originalText: "premier clair", status: "clear" }),
      makeItem({
        originalText: "xxxx inconnu",
        status: "unrecognized",
        suggestions: [],
      }),
    ];
    render(
      <ListClarification
        items={items}
        onUpdate={() => {}}
        onValidate={() => {}}
        onRemove={onRemove}
      />
    );

    await userEvent.click(
      screen.getByRole("button", { name: /Retirer xxxx inconnu/i })
    );

    // Index ORIGINAL (1), pas l'index après tri (0)
    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it("bouton 'Modifier ma liste' appelle onEditList", async () => {
    const onEditList = vi.fn();
    const items = [makeItem({ status: "clear" })];
    render(
      <ListClarification
        items={items}
        onUpdate={() => {}}
        onValidate={() => {}}
        onEditList={onEditList}
      />
    );

    await userEvent.click(
      screen.getByRole("button", { name: /Modifier ma liste/i })
    );
    expect(onEditList).toHaveBeenCalledTimes(1);
  });

  it("n'affiche pas 'Modifier ma liste' si onEditList absent", () => {
    const items = [makeItem({ status: "clear" })];
    render(
      <ListClarification items={items} onUpdate={() => {}} onValidate={() => {}} />
    );
    expect(
      screen.queryByRole("button", { name: /Modifier ma liste/i })
    ).toBeNull();
  });
});
