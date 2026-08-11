import { authEmailCopy, asNotificationLocale, renderAuthEmail } from '../src/lib/auth-email-templates.ts';
const locale = asNotificationLocale('nl');
const copy = authEmailCopy('magiclink', locale);
const html = renderAuthEmail(copy, 'https://rout.be/auth/confirm?token=abc123&type=magiclink', '482913');
console.log('subject:', copy.subject);
console.log('html length:', html.length);
console.log('contains token:', html.includes('482913'));
