import { sendResendEmail } from '../src/lib/notifications.server.ts';
const ok = await sendResendEmail({
  to: 'hallo@rout.be',
  subject: 'ROUT notification test',
  html: '<p>Notification pipeline test</p>',
});
console.log('sent:', ok);
