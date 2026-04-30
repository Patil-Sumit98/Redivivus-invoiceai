/**
 * Resolve a file_url from the API into a fully-qualified URL.
 *
 * If the value is already absolute (starts with http/https), return it as-is.
 * Otherwise, prefix with the API base so relative paths like
 * `/invoices/abc/file` resolve correctly.
 */
export function resolveFileUrl(fileUrl: string | null | undefined): string {
  if (!fileUrl) return '';
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) return fileUrl;
  const base = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8001';
  return `${base.replace(/\/+$/, '')}${fileUrl}`;
}
