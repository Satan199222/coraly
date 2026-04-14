// @vitest-environment node
import { describe, it, expect } from "vitest";
import { renderEmailTemplate, EMAIL_SEQUENCE } from "./index";

describe("renderEmailTemplate — bienvenue-j0", () => {
  it("injecte le prénom dans le HTML et le sujet", () => {
    const { subject, html } = renderEmailTemplate("bienvenue-j0", {
      PRENOM: "Marie",
    });

    expect(subject).toBe(
      "Bienvenue sur VoixCourses — faites vos courses sans les mains"
    );
    expect(html).toContain("Marie");
    expect(html).not.toContain("[PRENOM]");
  });

  it("échappe le HTML dans le prénom pour éviter l'injection", () => {
    const { html } = renderEmailTemplate("bienvenue-j0", {
      PRENOM: "<script>alert('xss')</script>",
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("ne contient pas de variable [CODE_REFERRAL] non résolue", () => {
    const { html } = renderEmailTemplate("bienvenue-j0", { PRENOM: "Jean" });
    expect(html).not.toContain("[CODE_REFERRAL]");
  });

  it("contient le CTA Démarrer mes courses", () => {
    const { html } = renderEmailTemplate("bienvenue-j0", { PRENOM: "Jean" });
    expect(html).toContain("Démarrer mes courses");
  });

  it("contient le rôle lang=fr pour l'accessibilité", () => {
    const { html } = renderEmailTemplate("bienvenue-j0", { PRENOM: "Jean" });
    expect(html).toContain('lang="fr"');
  });
});

describe("renderEmailTemplate — astuces-j2", () => {
  it("injecte le prénom dans le sujet et le HTML", () => {
    const { subject, html } = renderEmailTemplate("astuces-j2", {
      PRENOM: "Sophie",
    });

    expect(subject).toBe("Sophie, 5 phrases que Koraly comprend parfaitement");
    expect(html).toContain("Sophie");
    expect(html).not.toContain("[PRENOM]");
  });

  it("contient le tableau ARIA accessible avec role=table", () => {
    const { html } = renderEmailTemplate("astuces-j2", { PRENOM: "Sophie" });
    expect(html).toContain('role="table"');
    expect(html).toContain('role="columnheader"');
    expect(html).toContain('role="row"');
    expect(html).toContain('role="cell"');
  });

  it("contient aria-label sur le tableau", () => {
    const { html } = renderEmailTemplate("astuces-j2", { PRENOM: "Sophie" });
    expect(html).toContain('aria-label="5 commandes vocales Koraly"');
  });

  it("contient les 5 commandes vocales", () => {
    const { html } = renderEmailTemplate("astuces-j2", { PRENOM: "Sophie" });
    expect(html).toContain("Deux packs de lait");
    expect(html).toContain("Marque pas chère");
    expect(html).toContain("Sans gluten");
    expect(html).toContain("Répète la liste");
    expect(html).toContain("Envoie sur Carrefour");
  });

  it("contient le CTA voir toutes les commandes vocales", () => {
    const { html } = renderEmailTemplate("astuces-j2", { PRENOM: "Sophie" });
    expect(html).toContain("Voir toutes les commandes vocales");
  });
});

describe("renderEmailTemplate — referral-j7", () => {
  it("injecte le prénom et le code referral", () => {
    const { subject, html } = renderEmailTemplate("referral-j7", {
      PRENOM: "Pierre",
      CODE_REFERRAL: "PIERRE2025",
    });

    expect(subject).toBe(
      "Quelqu'un de votre entourage pourrait bénéficier de VoixCourses"
    );
    expect(html).toContain("Pierre");
    expect(html).not.toContain("[PRENOM]");
    expect(html).not.toContain("[CODE_REFERRAL]");
  });

  it("encode le code referral dans les URLs des boutons de partage", () => {
    const { html } = renderEmailTemplate("referral-j7", {
      PRENOM: "Pierre",
      CODE_REFERRAL: "PIERRE2025",
    });

    expect(html).toContain("PIERRE2025");
  });

  it("contient les 3 boutons de partage avec aria-label", () => {
    const { html } = renderEmailTemplate("referral-j7", {
      PRENOM: "Pierre",
      CODE_REFERRAL: "CODE123",
    });

    expect(html).toContain('aria-label="Partager sur WhatsApp"');
    expect(html).toContain('aria-label="Partager par email"');
    expect(html).toContain('aria-label="Partager par SMS"');
  });

  it("contient le CTA Partager mon lien", () => {
    const { html } = renderEmailTemplate("referral-j7", {
      PRENOM: "Pierre",
      CODE_REFERRAL: "CODE123",
    });

    expect(html).toContain("Partager mon lien");
  });

  it("encode le code referral sans < > pour éviter l'injection", () => {
    const { html } = renderEmailTemplate("referral-j7", {
      PRENOM: "Pierre",
      CODE_REFERRAL: "<evil>",
    });

    expect(html).not.toContain("<evil>");
    expect(html).toContain("%3Cevil%3E");
  });
});

describe("EMAIL_SEQUENCE", () => {
  it("contient 3 emails dans l'ordre correct", () => {
    expect(EMAIL_SEQUENCE).toHaveLength(3);
    expect(EMAIL_SEQUENCE[0].id).toBe("bienvenue-j0");
    expect(EMAIL_SEQUENCE[1].id).toBe("astuces-j2");
    expect(EMAIL_SEQUENCE[2].id).toBe("referral-j7");
  });

  it("respecte les délais J+0, J+2, J+7", () => {
    expect(EMAIL_SEQUENCE[0].delayDays).toBe(0);
    expect(EMAIL_SEQUENCE[1].delayDays).toBe(2);
    expect(EMAIL_SEQUENCE[2].delayDays).toBe(7);
  });
});
