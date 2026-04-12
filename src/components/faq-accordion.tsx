const FAQS = [
  {
    q: "Faut-il installer quelque chose ?",
    a: "Non. VoixCourses fonctionne dans votre navigateur. Pour certaines enseignes, une extension Chrome optionnelle améliore la finalisation du panier — son installation se fait en un clic, et elle est elle-même accessible au clavier.",
  },
  {
    q: "Koraly comprend-elle mon accent ?",
    a: "Oui. Koraly est entraînée sur toutes les variations du français (métropolitain, régional, ultramarin, et les accents d'origine non-francophone). Si elle se trompe, vous pouvez toujours corriger — à la voix ou au clavier.",
  },
  {
    q: "Mon lecteur d'écran est-il compatible ?",
    a: "Nous testons à chaque sortie NVDA (Windows), JAWS (Windows), VoiceOver (macOS, iOS) et TalkBack (Android). Si vous utilisez autre chose, dites-le-nous — nous ajoutons les compatibilités au fur et à mesure.",
  },
  {
    q: "Combien ça coûte ?",
    a: "Gratuit pour les particuliers. Les enseignes partenaires financent le service (c'est leur engagement accessibilité). Vous payez vos courses au prix catalogue de l'enseigne, rien de plus.",
  },
  {
    q: "Qu'en est-il de mes données personnelles ?",
    a: "Votre voix n'est jamais stockée. Votre liste de courses reste sur votre appareil. Seul le panier final est transmis à l'enseigne — comme si vous aviez rempli son site vous-même. RGPD conforme, serveurs français.",
  },
];

export function FaqAccordion() {
  return (
    <section className="py-24 lg:py-28" style={{ background: "var(--bg)" }}>
      <div className="max-w-[1200px] mx-auto px-10">
        <span className="vc-eyebrow">Questions fréquentes</span>
        <h2 className="vc-h2 mt-4" style={{ color: "var(--text)" }}>
          Accessibilité, technique, tarification.
        </h2>
        <p
          className="mt-2 text-[17px] max-w-[640px] mb-12"
          style={{ color: "var(--text-soft)" }}
        >
          Les questions qu&apos;on nous pose le plus souvent. Si la vôtre n&apos;y est pas,{" "}
          <a
            href="mailto:contact@voixcourses.fr"
            className="underline"
            style={{ color: "var(--accent)" }}
          >
            écrivez-nous
          </a>
          .
        </p>
        <div>
          {FAQS.map((f, i) => (
            <details
              key={f.q}
              className="px-7 py-6 border-b"
              style={{
                borderColor: "var(--border)",
                borderTop: i === 0 ? "1px solid var(--border)" : undefined,
              }}
            >
              <summary
                className="text-[19px] font-bold flex justify-between items-center cursor-pointer"
                style={{ color: "var(--text)" }}
              >
                {f.q}
                <span
                  aria-hidden="true"
                  className="text-2xl ml-4 flex-shrink-0"
                  style={{ color: "var(--brass)" }}
                >
                  +
                </span>
              </summary>
              <p
                className="mt-3 text-base leading-[1.65]"
                style={{ color: "var(--text-soft)" }}
              >
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
