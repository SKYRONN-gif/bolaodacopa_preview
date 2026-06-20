const DEFAULT_ADMIN_EMAILS = ['nahanmiguelbarbosa@gmail.com'];

function parseAdminEmails(value?: string): string[] {
  if (!value) return [];

  return value
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function getEnvValue(key: string) {
  const viteEnv = import.meta.env as Record<string, string | undefined> | undefined;

  return viteEnv?.[key] || process.env[key];
}

export const ADMIN_EMAILS = [
  ...parseAdminEmails(getEnvValue('VITE_ADMIN_EMAILS')),
  ...parseAdminEmails(getEnvValue('VITE_ADMIN_EMAIL')),
  ...DEFAULT_ADMIN_EMAILS,
].filter((email, index, emails) => emails.indexOf(email) === index);

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;

  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
