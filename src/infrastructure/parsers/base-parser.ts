export function htmlToPlainText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\t+/g, '\t')
    .replace(/(\r\n|\r|\n){3,}/g, '\n\n')
    .trim();
}

export function parsePyAmount(amountStr: string | null): { currency: string; amount: number } {
  if (!amountStr) return { currency: 'PYG', amount: 0 };
  const cleaned = amountStr.trim();
  const currency = cleaned.toUpperCase().includes('USD') ? 'USD' : 'PYG';
  const numericPart = cleaned.replace(/[^0-9]/g, '');
  const amount = parseInt(numericPart, 10);
  return { currency, amount: isNaN(amount) ? 0 : amount };
}
