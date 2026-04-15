export interface ConversationMessage {
  role: "user" | "agent";
  text: string;
  at: number;
}

export interface ToolEvent {
  name: string;
  label: string;
  at: number;
}

export interface ConversationShellConfig {
  title: string;
  description: string;
  agentName: string;
  badge?: string;
  hintText?: string;
  backHref?: string;
  backLabel?: string;
}
