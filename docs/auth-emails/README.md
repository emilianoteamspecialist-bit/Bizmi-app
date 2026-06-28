# Supabase auth emails (via Resend)

Supabase sends the auth emails (confirm signup, password reset, magic link, etc.) —
not our app code. To send them through Resend with the Bizimi brand, do two things:

1. Point Supabase Auth at Resend's SMTP (so the mail goes out via your domain).
2. Paste the branded HTML templates in this folder into the Supabase dashboard.

---

## 1. Custom SMTP → Resend

First, in **Resend** verify your sending domain (e.g. `bizimii.com`) under
**Domains** and add the DNS records it gives you. Wait for "Verified".

Then in **Supabase Dashboard → Project Settings → Authentication → SMTP Settings**,
turn on **Enable Custom SMTP** and enter:

| Field            | Value                                            |
| ---------------- | ------------------------------------------------ |
| Sender email     | `noreply@bizimii.com` (a verified-domain address) |
| Sender name      | `Bizimi Team`                                     |
| Host             | `smtp.resend.com`                                 |
| Port             | `465` (SSL) — or `587` (TLS)                       |
| Username         | `resend`                                          |
| Password         | your `RESEND_API_KEY` (the `re_…` value)          |

> Use the **same domain** here as `EMAIL_FROM` in `.env.local` so transactional
> and auth emails come from one consistent sender.

Optionally raise the rate limits under **Authentication → Rate Limits** (the
default Supabase mailer caps are low; with your own SMTP you can lift them).

---

## 2. Brand templates

In **Supabase Dashboard → Authentication → Email Templates**, pick each template,
set the **Subject**, and paste the matching HTML file's full contents into the
message body (replace what's there).

| Supabase template      | File in this folder     | Suggested subject              |
| ---------------------- | ----------------------- | ------------------------------ |
| Confirm signup         | `confirm-signup.html`   | `Confirm your Bizimi email`    |
| Reset password         | `reset-password.html`   | `Reset your Bizimi password`   |
| Magic Link             | `magic-link.html`       | `Sign in to Bizimi`            |

These use Supabase's `{{ .ConfirmationURL }}` variable for the action link, so the
button and the copy-paste fallback link both work automatically. (Other variables
Supabase exposes if you need them: `{{ .Token }}`, `{{ .TokenHash }}`,
`{{ .SiteURL }}`, `{{ .Email }}`, `{{ .NewEmail }}`, `{{ .RedirectTo }}`.)

The "Change Email Address" and "Invite" templates also use `{{ .ConfirmationURL }}`
— you can reuse `confirm-signup.html` for those, tweaking the heading/copy.

---

## Notes

- The markup matches the transactional emails (`lib/email.ts` `emailLayout`):
  centered `<table>` layout, full doctype + charset, and a VML button fallback so
  it renders correctly in Outlook desktop too.
- Test from **Authentication → Users → invite/magic-link**, or just run the signup
  / password-reset flows against a real inbox after configuring SMTP.
