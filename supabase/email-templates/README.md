# ROUT — Supabase Auth e-mailtemplates

Flat-UI templates in de huisstijl van rout.be (warm papier `#FBF9F5`, inkt `#1A1A1A`,
matcha accent `#2D4A3E`), verstuurd via de custom SMTP-afzender `hallo@rout.be`.

| Bestand | Supabase-template |
| --- | --- |
| `confirmation.html` | Confirm signup |
| `magic-link.html` | Magic Link |
| `recovery.html` | Reset Password |
| `invite.html` | Invite user |
| `email-change.html` | Change Email Address |
| `reauthentication.html` | Reauthentication |

## Toepassen

1. Supabase → Authentication → Emails → Templates.
2. Plak de HTML van het betreffende bestand in het overeenkomstige template.
3. Zet bij Authentication → URL Configuration de redirect-URL `https://rout.be/claim`
   op de allowlist (alle auth-mails landen nu op `/claim`).
4. SMTP: afzender `hallo@rout.be`, naam `ROUT`.

Alle templates gebruiken `{{ .ConfirmationURL }}` en waar relevant `{{ .Token }}`,
`{{ .Email }}` en `{{ .NewEmail }}`. Het logo wordt geladen via de absolute productie-URL
`https://rout.be/img/logo.png` — dat pad moet publiek bereikbaar blijven.

De code uit `{{ .Token }}` kan de gebruiker handmatig invoeren op `/auth`
(veld "Or enter the code from the e-mail") als de link openen lastig is.
