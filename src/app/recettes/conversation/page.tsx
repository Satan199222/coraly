"use client";

import dynamic from "next/dynamic";

// SSR désactivé : @elevenlabs/react utilise des hooks nécessitant un
// Provider monté côté client. Identique au pattern /sante/conversation.
const RecettesConversationPage = dynamic(() => import("./page-client"), {
  ssr: false,
  loading: () => (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center text-[var(--text-muted)]">
      Chargement du mode conversation Recettes…
    </div>
  ),
});

export default function Page() {
  return <RecettesConversationPage />;
}
