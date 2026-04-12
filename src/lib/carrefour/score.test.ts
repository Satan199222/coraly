import { describe, it, expect } from "vitest";
import { rankProducts, scoreProduct } from "./score";
import type { CarrefourProduct } from "./types";

function makeProduct(partial: Partial<CarrefourProduct> = {}): CarrefourProduct {
  return {
    ean: partial.ean ?? "1234567890123",
    title: partial.title ?? "Produit",
    brand: partial.brand ?? "Generic",
    slug: "slug",
    price: partial.price ?? 2.5,
    perUnitLabel: null,
    unitOfMeasure: null,
    purchasable: partial.purchasable ?? true,
    nutriscore: partial.nutriscore ?? null,
    format: partial.format ?? null,
    packaging: partial.packaging ?? null,
    categories: [],
    imageUrl: null,
    offerServiceId: null,
  };
}

describe("scoreProduct", () => {
  it("favorise un match texte complet", () => {
    const matching = makeProduct({ title: "Lait demi-écrémé 1L" });
    const unrelated = makeProduct({ title: "Yaourt nature" });
    expect(scoreProduct(matching, "lait demi ecreme")).toBeGreaterThan(
      scoreProduct(unrelated, "lait demi ecreme")
    );
  });

  it("privilégie un produit qui respecte le régime", () => {
    const gf = makeProduct({ title: "Pâtes penne sans gluten Barilla" });
    const normal = makeProduct({ title: "Pâtes penne Barilla" });
    const s1 = scoreProduct(gf, "pâtes penne", { diet: ["sans-gluten"] });
    const s2 = scoreProduct(normal, "pâtes penne", { diet: ["sans-gluten"] });
    expect(s1).toBeGreaterThan(s2);
  });

  it("pénalise fortement un produit non-disponible", () => {
    const available = makeProduct({ title: "Lait Lactel", purchasable: true });
    const unavailable = makeProduct({
      title: "Lait Lactel",
      purchasable: false,
    });
    expect(scoreProduct(available, "lait")).toBeGreaterThan(
      scoreProduct(unavailable, "lait")
    );
  });

  it("donne un bonus à Nutriscore A vs C", () => {
    const a = makeProduct({ title: "Pain complet", nutriscore: "A" });
    const c = makeProduct({ title: "Pain complet", nutriscore: "C" });
    expect(scoreProduct(a, "pain")).toBeGreaterThan(scoreProduct(c, "pain"));
  });

  it("match la marque demandée", () => {
    const lactel = makeProduct({ title: "Lait", brand: "Lactel" });
    const candia = makeProduct({ title: "Lait", brand: "Candia" });
    expect(
      scoreProduct(lactel, "lait", { brand: "Lactel" })
    ).toBeGreaterThan(scoreProduct(candia, "lait", { brand: "Lactel" }));
  });

  it("match quantité + unité exactes", () => {
    const twoLiter = makeProduct({
      title: "Lait demi-écrémé 2L",
      format: "2L",
    });
    const oneLiter = makeProduct({
      title: "Lait demi-écrémé 1L",
      format: "1L",
    });
    expect(
      scoreProduct(twoLiter, "lait demi-écrémé", {
        targetQuantity: 2,
        targetUnit: "L",
      })
    ).toBeGreaterThan(
      scoreProduct(oneLiter, "lait demi-écrémé", {
        targetQuantity: 2,
        targetUnit: "L",
      })
    );
  });
});

describe("rankProducts", () => {
  it("remet en premier un match de régime plus profond dans la liste initiale", () => {
    const products = [
      makeProduct({ title: "Pâtes penne Barilla 500g", ean: "1" }),
      makeProduct({ title: "Pâtes fusilli 500g", ean: "2" }),
      makeProduct({
        title: "Pâtes penne sans gluten Barilla 400g",
        ean: "3",
      }),
    ];
    const ranked = rankProducts(products, "pâtes penne", {
      diet: ["sans-gluten"],
    });
    expect(ranked[0].ean).toBe("3");
  });

  it("est stable pour des produits de score égal (préserve ordre API)", () => {
    const products = [
      makeProduct({ title: "Yaourt nature A", ean: "1" }),
      makeProduct({ title: "Yaourt nature B", ean: "2" }),
      makeProduct({ title: "Yaourt nature C", ean: "3" }),
    ];
    const ranked = rankProducts(products, "yaourt nature");
    expect(ranked.map((p) => p.ean)).toEqual(["1", "2", "3"]);
  });

  it("ne mute pas le tableau d'entrée", () => {
    const products = [
      makeProduct({ title: "Lait entier", ean: "1" }),
      makeProduct({ title: "Lait demi-écrémé", ean: "2" }),
    ];
    const beforeOrder = products.map((p) => p.ean);
    rankProducts(products, "lait demi-écrémé");
    expect(products.map((p) => p.ean)).toEqual(beforeOrder);
  });
});
