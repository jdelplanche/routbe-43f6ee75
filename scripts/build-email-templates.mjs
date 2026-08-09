/**
 * Generates the six Supabase auth e-mail templates from one shared layout.
 *
 * Run with:  bun scripts/build-email-templates.mjs
 *
 * Design rules baked in here:
 *  - Hybrid logo: absolute https://rout.be/img/logo.png as <img src>, with the
 *    optimised base64 data-URI painted as CSS background underneath, so the
 *    mark still shows when a client blocks remote images (Gmail proxy off,
 *    Outlook image blocking, offline reading).
 *  - Outlook: VML roundrect buttons + bulletproof table layout, so no square
 *    hard-edged boxes and no collapsed columns.
 *  - Mobile: the 3-column footer stays a real table (2 columns under 420px),
 *    never an endless vertical list.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "../supabase/email-templates");

const LOGO_DATA_URI = readFileSync(resolve(outDir, "logo.base64.txt"), "utf8").trim();
const LOGO_URL = "https://rout.be/img/logo.png";

const INK = "#1A1A1A";
const MUTED = "#5C574F";
const FAINT = "#9A948A";
const HAIR = "#A8A299";
const PAPER = "#FBF9F5";
const CARD = "#FFFFFF";
const GREEN = "#2D4A3E";
const SAND = "#F4F1EA";

const SANS =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "'DM Mono',Menlo,Consolas,'Courier New',monospace";

// Every link (bar the mailto) is built from {{ .SiteURL }} so the same
// generated HTML routes correctly in the Supabase preview environment and in
// production, instead of a hand-picked "https://rout.be" host.
const SITE = "{{ .SiteURL }}";

const FOOTER_COLUMNS = [
  {
    title: "Platform",
    links: [
      ["Studio", `${SITE}/studio`],
      ["Dashboard", `${SITE}/dashboard`],
      ["Manifest", `${SITE}/manifesto`],
    ],
  },
  {
    title: "Juridisch",
    links: [
      ["Privacy", `${SITE}/privacy`],
      ["Voorwaarden", `${SITE}/terms`],
      ["Status", `${SITE}/status`],
    ],
  },
  {
    title: "Support",
    links: [
      ["Contact", "mailto:hallo@rout.be"],
      ["Help center", `${SITE}/support`],
      ["Developers", `${SITE}/developers`],
    ],
  },
];

/** Bulletproof CTA: VML roundrect for Outlook, padded anchor everywhere else. */
const cta = (label, href) => `
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="rout-cta" style="margin:0 0 18px;border-collapse:separate;">
                  <tr>
                    <td align="center" bgcolor="${GREEN}" style="background-color:${GREEN};border-radius:14px;mso-padding-alt:0;">
                      <!--[if mso]>
                      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:46px;v-text-anchor:middle;width:260px;" arcsize="30%" stroke="f" fillcolor="${GREEN}">
                        <w:anchorlock/>
                        <center style="color:${PAPER};font-family:${SANS};font-size:15px;font-weight:600;">${label}</center>
                      </v:roundrect>
                      <![endif]-->
                      <!--[if !mso]><!-->
                      <a href="${href}" style="display:inline-block;padding:13px 28px;font-family:${SANS};font-size:15px;line-height:20px;font-weight:600;color:${PAPER};text-decoration:none;border-radius:14px;">${label}</a>
                      <!--<![endif]-->
                    </td>
                  </tr>
                </table>`;

const fallbackLink = (href) => `
                <p style="margin:0 0 6px;font-size:12px;line-height:19px;color:${FAINT};">Werkt de knop niet? Kopieer deze link:</p>
                <p style="margin:0;font-size:12px;line-height:19px;word-break:break-all;"><a href="${href}" style="color:${GREEN};text-decoration:none;">${href}</a></p>`;

const tokenBlock = (intro) => `
                <p style="margin:0 0 8px;font-size:12px;line-height:19px;color:${FAINT};">${intro}</p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0;border-collapse:separate;">
                  <tr>
                    <td bgcolor="${SAND}" style="background-color:${SAND};border-radius:14px;padding:14px 22px;font-family:${MONO};font-size:26px;line-height:32px;letter-spacing:0.26em;color:${INK};">{{ .Token }}</td>
                  </tr>
                </table>`;

const footer = () => `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:520px;border-collapse:collapse;table-layout:fixed;">
                  <tr>
${FOOTER_COLUMNS.map(
  (col) => `                    <td class="rout-col" width="33%" valign="top" style="width:33%;padding:0 8px 0 0;font-family:${SANS};">
                      <p style="margin:0 0 6px;font-size:10px;line-height:16px;letter-spacing:0.14em;text-transform:uppercase;color:${HAIR};">${col.title}</p>
${col.links
  .map(
    ([label, href]) =>
      `                      <a href="${href}" style="display:block;margin:0 0 4px;font-size:12px;line-height:18px;color:${MUTED};text-decoration:none;">${label}</a>`,
  )
  .join("\n")}
                    </td>`,
).join("\n")}
                  </tr>
                </table>`;

const layout = ({ title, preview, heading, intro, body }) => `<!doctype html>
<html lang="nl" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="color-scheme" content="light only" />
    <meta name="supported-color-schemes" content="light only" />
    <title>${title}</title>
    <!--[if mso]>
    <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
    <![endif]-->
    <style>
      html, body { margin:0 !important; padding:0 !important; width:100% !important; }
      table { border-collapse:collapse; mso-table-lspace:0; mso-table-rspace:0; }
      img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
      a { text-decoration:none; }
      @media only screen and (max-width: 600px) {
        .rout-shell { padding:18px 10px !important; }
        .rout-card { padding:22px 18px !important; border-radius:18px !important; }
        .rout-h1 { font-size:21px !important; line-height:28px !important; }
        .rout-cta a { display:block !important; text-align:center !important; }
      }
      @media only screen and (max-width: 420px) {
        .rout-col { display:inline-block !important; width:50% !important; padding:0 8px 10px 0 !important; vertical-align:top !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background-color:${PAPER};-webkit-font-smoothing:antialiased;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${preview}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAPER}" style="background-color:${PAPER};">
      <tr>
        <td align="center" class="rout-shell" style="padding:24px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:520px;">
            <tr>
              <td align="center" style="padding:0 0 14px;font-family:${SANS};">
                <a href="${SITE}" style="text-decoration:none;color:${INK};">
                  <!--[if !mso]><!-->
                  <img src="${LOGO_URL}" width="34" height="34" alt="ROUT" style="display:inline-block;vertical-align:middle;width:34px;height:34px;border:0;border-radius:50%;background-color:${PAPER};background-image:url('${LOGO_DATA_URI}');background-size:34px 34px;background-position:center center;background-repeat:no-repeat;" />
                  <!--<![endif]-->
                  <!--[if mso]>
                  <img src="${LOGO_URL}" width="34" height="34" alt="ROUT" style="border:0;" />
                  <![endif]-->
                  <span style="display:inline-block;vertical-align:middle;margin-left:9px;font-family:${MONO};font-size:14px;font-weight:700;letter-spacing:0.22em;color:${INK};">ROUT</span>
                </a>
              </td>
            </tr>
            <tr>
              <td class="rout-card" bgcolor="${CARD}" style="background-color:${CARD};border-radius:20px;padding:26px 28px;font-family:${SANS};color:${INK};">
                <h1 class="rout-h1" style="margin:0 0 8px;font-family:${SANS};font-size:23px;line-height:30px;font-weight:600;letter-spacing:-0.015em;color:${INK};">${heading}</h1>
                <p style="margin:0 0 18px;font-size:15px;line-height:24px;color:${MUTED};">${intro}</p>
${body}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 4px 0;font-family:${SANS};">
${footer()}
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:12px 4px 0;font-family:${SANS};">
                <p style="margin:0 0 4px;font-size:11px;line-height:18px;color:${HAIR};">Heb je dit niet aangevraagd? Dan kun je deze e-mail negeren.</p>
                <p style="margin:0;font-size:11px;line-height:18px;color:${HAIR};">&copy; ROUT &middot; <a href="${SITE}" style="color:${HAIR};text-decoration:none;">rout.be</a> &middot; Soeverein, zonder ruis.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

const URL_VAR = "{{ .ConfirmationURL }}";

const templates = {
  "confirmation.html": {
    title: "Bevestig je e-mailadres",
    preview: "Bevestig je e-mailadres — rout.be",
    heading: "Bevestig je e-mailadres",
    intro: "Welkom bij ROUT. Bevestig je adres en claim meteen je handle.",
    body: cta("Bevestig e-mailadres", URL_VAR) + fallbackLink(URL_VAR),
  },
  "magic-link.html": {
    title: "Je inloglink",
    preview: "Je inloglink voor rout.be",
    heading: "Log in bij ROUT",
    intro:
      "Klik op de knop hieronder om in te loggen. De link is eenmalig en verloopt na korte tijd.",
    body: cta("Inloggen", URL_VAR) + fallbackLink(URL_VAR),
  },
  "recovery.html": {
    title: "Wachtwoord opnieuw instellen",
    preview: "Stel je wachtwoord opnieuw in — rout.be",
    heading: "Nieuw wachtwoord instellen",
    intro:
      "Vraag je een nieuw wachtwoord aan? Gebruik de knop hieronder om er een in te stellen.",
    body: cta("Wachtwoord instellen", URL_VAR) + fallbackLink(URL_VAR),
  },
  "invite.html": {
    title: "Je bent uitgenodigd",
    preview: "Je bent uitgenodigd voor ROUT",
    heading: "Je bent uitgenodigd",
    intro:
      "Iemand nodigde je uit voor ROUT. Accepteer de uitnodiging en kies je eigen handle.",
    body: cta("Uitnodiging accepteren", URL_VAR) + fallbackLink(URL_VAR),
  },
  "email-change.html": {
    title: "Bevestig je nieuwe e-mailadres",
    preview: "Bevestig je nieuwe e-mailadres — rout.be",
    heading: "Bevestig je nieuwe adres",
    intro: "Bevestig de wijziging van {{ .Email }} naar {{ .NewEmail }}.",
    body: cta("Wijziging bevestigen", URL_VAR) + fallbackLink(URL_VAR),
  },
  "reauthentication.html": {
    title: "Bevestig dat jij het bent",
    preview: "Bevestig dat jij het bent — rout.be",
    heading: "Bevestig dat jij het bent",
    intro: "Voor deze gevoelige actie hebben we een extra bevestiging nodig.",
    body: tokenBlock("Voer deze code in op rout.be:"),
  },
};

for (const [file, spec] of Object.entries(templates)) {
  writeFileSync(resolve(outDir, file), layout(spec), "utf8");
  console.log("wrote", file);
}
