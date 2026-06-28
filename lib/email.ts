import "server-only"
import { Resend } from "resend"

// Resend wrapper. Server-only — never import into client code.
//
// Configuration (env):
//   RESEND_API_KEY  – your Resend API key (required to actually send).
//   EMAIL_FROM      – verified sender, e.g. "Bizimi Team <noreply@bizimii.com>".
//                     Defaults to Resend's sandbox sender, which can only
//                     deliver to your own Resend account email until you
//                     verify a domain.
//
// Every send is fail-soft: a missing key or a Resend error is logged and
// swallowed so a notification can never break the user action that triggered
// it (placing a bid, getting paid, etc.).

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM = process.env.EMAIL_FROM || "Bizimi Team <onboarding@resend.dev>"

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null

type SendArgs = {
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
}

export async function sendEmail({ to, subject, html, text, replyTo }: SendArgs) {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipped: "${subject}"`)
    return { skipped: true as const }
  }
  const recipients = Array.isArray(to) ? to.filter(Boolean) : to
  if (!recipients || (Array.isArray(recipients) && recipients.length === 0)) {
    return { skipped: true as const }
  }
  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: recipients,
      subject,
      html,
      // Plain-text alternative improves deliverability and renders in clients
      // that prefer/only show text. Falls back to a stripped version of the HTML.
      text: text ?? htmlToText(html),
      replyTo,
    })
    if (error) {
      console.error(`[email] send failed ("${subject}"):`, error)
      return { error }
    }
    return { id: data?.id }
  } catch (e) {
    console.error(`[email] send threw ("${subject}"):`, e)
    return { error: e }
  }
}

const escHtml = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

// Rough HTML → text fallback for the plain-text alternative part.
function htmlToText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\/(p|div|tr|h1|h2|td)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<a [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim()
}

// Brand palette (hex — email clients need literal colours, not CSS vars).
const BRAND = {
  cream: "#fcf5ee",
  card: "#ffffff",
  border: "#efe7dd",
  hair: "#f1eae2",
  ink: "#1b1020",
  body: "#5b5160",
  muted: "#9a8f99",
  aubergine: "#1b0e2f",
  gold: "#fbbd23",
  orange: "#f97316",
}
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

// The "B" mark + wordmark, rebuilt in HTML so it renders without an external
// image (no hosting, no broken-image risk). Mirrors the site nav: aubergine
// rounded tile, gold "B", "Bizimi" wordmark.
const LOGO = `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td width="40" height="40" align="center" valign="middle" bgcolor="${BRAND.aubergine}" style="border-radius:11px;font-family:Georgia,'Times New Roman',serif;font-size:23px;font-weight:700;color:${BRAND.gold};line-height:40px;">B</td>
      <td width="10" style="font-size:0;line-height:0;">&nbsp;</td>
      <td valign="middle" style="font-family:${FONT};font-size:19px;font-weight:800;letter-spacing:-0.02em;color:${BRAND.aubergine};">Bizimi</td>
    </tr>
  </table>`

// Brand-tinted, Outlook-safe HTML shell. Built on nested centered <table>s
// (Outlook's Word engine ignores div max-width / margin:auto), a full doctype
// + charset head, a top accent bar + logo lockup, and a table-cell CTA wrapped
// in VML so the button renders with a solid rounded fill even in Outlook.
//
// `heading`, `cta.label` and `cta.url` are escaped here. `body` is raw HTML —
// callers MUST escape user-controlled values they interpolate (see
// lib/notifications.ts).
export function emailLayout(opts: { heading: string; body: string; cta?: { label: string; url: string } }) {
  const { heading, body, cta } = opts
  const url = cta ? escHtml(cta.url) : ""
  const label = cta ? escHtml(cta.label) : ""

  const button = cta
    ? `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px;">
                <tr>
                  <td bgcolor="${BRAND.orange}" style="border-radius:9999px;box-shadow:0 2px 6px rgba(249,115,22,0.30);">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:44px;v-text-anchor:middle;width:220px;" arcsize="50%" fillcolor="${BRAND.orange}" stroke="f">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-family:${FONT};font-size:15px;font-weight:bold;">${label}</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${url}" style="display:inline-block;background:${BRAND.orange};color:#ffffff;text-decoration:none;font-family:${FONT};font-weight:700;font-size:15px;line-height:44px;padding:0 30px;border-radius:9999px;">${label}</a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>`
    : ""

  return `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
  <title>Bizimi</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.cream};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.cream};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:18px;overflow:hidden;">
          <tr><td style="height:4px;line-height:4px;font-size:0;background:${BRAND.orange};">&nbsp;</td></tr>
          <tr>
            <td style="padding:26px 32px 22px;border-bottom:1px solid ${BRAND.hair};">${LOGO}</td>
          </tr>
          <tr>
            <td style="padding:34px 32px 36px;font-family:${FONT};">
              <h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:${BRAND.ink};font-weight:800;letter-spacing:-0.01em;">${escHtml(heading)}</h1>
              <p style="margin:0 0 8px;font-size:15px;line-height:1.65;color:${BRAND.body};">${body}</p>
              ${button}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid ${BRAND.hair};background:${BRAND.cream};font-family:${FONT};">
              <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:${BRAND.aubergine};">Bizimi</p>
              <p style="margin:0;font-size:12px;line-height:1.6;color:${BRAND.muted};">Hire vetted Nigerian talent, with payments held safely in escrow.<br>You're receiving this because you have a Bizimi account.</p>
            </td>
          </tr>
        </table>
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;">
          <tr><td align="center" style="padding:16px 8px 0;font-family:${FONT};font-size:11px;color:${BRAND.muted};">© Bizimi · Lagos, Nigeria</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
