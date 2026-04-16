"use client";

import dynamic from "next/dynamic";

// SSR désactivé : @elevenlabs/react utilise des hooks nécessitant un
// Provider monté côté client. Identique au pattern de /transport/conversation.
const PosteConversationPage = dynamic(() => import("./page-client"), {
  ssr: false,
  loading: () => (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center text-[var(--text-muted)]">
      Chargement du mode conversation Poste…
    </div>
  ),
});

export default function Page() {
  return <PosteConversationPage />;
}
