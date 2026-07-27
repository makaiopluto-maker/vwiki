export const ADMIN_EMAILS = ["makaio.pluto@gmail.com"];

export function isAdmin(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email);
}
