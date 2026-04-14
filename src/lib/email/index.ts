import fs from "fs";
import path from "path";

const TEMPLATES_DIR = path.join(__dirname, "templates");

export type EmailTemplateId = "bienvenue-j0" | "astuces-j2" | "referral-j7";

export interface EmailVariables {
  PRENOM: string;
  CODE_REFERRAL?: string;
  EMAIL?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
}

const SUBJECTS: Record<EmailTemplateId, (vars: EmailVariables) => string> = {
  "bienvenue-j0": () =>
    "Bienvenue sur VoixCourses — faites vos courses sans les mains",
  "astuces-j2": (vars) =>
    `${vars.PRENOM}, 5 phrases que Koraly comprend parfaitement`,
  "referral-j7": () =>
    "Quelqu'un de votre entourage pourrait bénéficier de VoixCourses",
};

function loadTemplate(templateId: EmailTemplateId): string {
  const filePath = path.join(TEMPLATES_DIR, `${templateId}.html`);
  return fs.readFileSync(filePath, "utf-8");
}

function applyVariables(html: string, vars: EmailVariables): string {
  let result = html;
  result = result.replaceAll("[PRENOM]", escapeHtml(vars.PRENOM));
  result = result.replaceAll(
    "[CODE_REFERRAL]",
    vars.CODE_REFERRAL ? encodeURIComponent(vars.CODE_REFERRAL) : ""
  );
  result = result.replaceAll(
    "[EMAIL]",
    vars.EMAIL ? encodeURIComponent(vars.EMAIL) : ""
  );
  return result;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderEmailTemplate(
  templateId: EmailTemplateId,
  vars: EmailVariables
): RenderedEmail {
  const rawHtml = loadTemplate(templateId);
  const html = applyVariables(rawHtml, vars);
  const subject = SUBJECTS[templateId](vars);
  return { subject, html };
}

export const EMAIL_SEQUENCE: Array<{
  id: EmailTemplateId;
  delayDays: number;
  description: string;
}> = [
  {
    id: "bienvenue-j0",
    delayDays: 0,
    description: "Bienvenue + guide démarrage rapide",
  },
  {
    id: "astuces-j2",
    delayDays: 2,
    description: "5 commandes vocales essentielles",
  },
  {
    id: "referral-j7",
    delayDays: 7,
    description: "Referral — inviter un proche",
  },
];
