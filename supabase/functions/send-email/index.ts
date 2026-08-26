// Supabase Auth "Send Email" hook: Supabase calls this function instead of sending its own
// default email whenever it needs to deliver a signup confirmation, recovery, magic link, email
// change, invite, or reauthentication email. We never generate tokens ourselves — Supabase
// supplies the real token_hash for the action it already created, we just render TeamHub branding
// around the real confirmation URL and hand delivery off to Resend.
import { Webhook } from 'npm:standardwebhooks@1.0.0'

const RESEND_API_URL = 'https://api.resend.com/emails'

const resendApiKey = Deno.env.get('RESEND_API_KEY')
const fromAddress = Deno.env.get('TEAMHUB_FROM_EMAIL') || 'TeamHub <onboarding@resend.dev>'
const supabaseUrl = Deno.env.get('SUPABASE_URL')
// Where the TeamHub logo is hosted for the <img> tag — email clients can't load a relative path,
// they need an absolute, publicly reachable URL. Falls back to the known production deployment.
const appUrl = Deno.env.get('TEAMHUB_APP_URL') || 'https://team-hub-two-drab.vercel.app'
const logoUrl = `${appUrl}/teamhub-logo.svg`
// The dashboard prints the hook secret as "v1,whsec_..." — "v1," is a format version marker, not
// part of the key the standardwebhooks verifier expects.
const hookSecret = (Deno.env.get('SEND_EMAIL_HOOK_SECRET') || '').replace('v1,', '')

const TEMPLATES = {
  signup: {
    subject: 'Verify your TeamHub account',
    heading: 'Welcome to TeamHub',
    intro:
      "You're almost ready to start collaborating. Please verify your email address to activate your TeamHub account.",
    cta: 'Verify my email',
    ignore: "If you didn't create a TeamHub account, you can safely ignore this email.",
  },
  magiclink: {
    subject: 'Your TeamHub sign-in link',
    heading: 'Sign in to TeamHub',
    intro: 'Use the button below to securely sign in to your TeamHub account.',
    cta: 'Sign in to TeamHub',
    ignore: "If you didn't request this sign-in link, you can safely ignore this email.",
  },
  recovery: {
    subject: 'Reset your TeamHub password',
    heading: 'Reset your password',
    intro:
      'We received a request to reset the password for your TeamHub account. If this was you, choose a new password using the button below.',
    cta: 'Reset my password',
    ignore: "If you didn't request a password reset, you can safely ignore this email.",
  },
  invite: {
    subject: "You've been invited to TeamHub",
    heading: "You're invited to TeamHub",
    intro: 'Someone invited you to join their team on TeamHub. Accept the invitation to get started.',
    cta: 'Accept invitation',
    ignore: "If you weren't expecting this invitation, you can safely ignore this email.",
  },
  email_change: {
    subject: 'Confirm your new TeamHub email address',
    heading: 'Confirm your new email',
    intro: 'Confirm this email address to finish updating your TeamHub account.',
    cta: 'Confirm new email',
    ignore: "If you didn't request this change, you can safely ignore this email.",
  },
  reauthentication: {
    subject: 'Confirm it’s you — TeamHub',
    heading: 'Confirm your identity',
    intro: 'Please confirm this request to continue with your TeamHub account.',
    cta: 'Confirm',
    ignore: "If you didn't make this request, you can safely ignore this email.",
  },
}
// Supabase can send either depending on whether "double email confirmation" is enabled; both
// share the signup-a-new-address copy above.
TEMPLATES.email_change_current = TEMPLATES.email_change
TEMPLATES.email_change_new = TEMPLATES.email_change

const FALLBACK_TEMPLATE = {
  subject: 'Confirm your TeamHub request',
  heading: 'Confirm your request',
  intro: 'Please confirm this request to continue with your TeamHub account.',
  cta: 'Confirm',
  ignore: "If you didn't make this request, you can safely ignore this email.",
}

function buildEmailHtml({ heading, intro, cta, ignore, confirmationUrl }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>TeamHub</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
            <tr>
              <td style="padding:32px 32px 0;text-align:center;">
                <img src="${logoUrl}" width="32" height="32" alt="" style="vertical-align:middle;border-radius:8px;" />
                <span style="font-size:20px;font-weight:800;color:#0f172a;letter-spacing:-0.01em;vertical-align:middle;margin-left:8px;">TeamHub</span>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 8px;">
                <h1 style="margin:0 0 12px;font-size:20px;color:#0f172a;">${heading}</h1>
                <p style="margin:0;font-size:15px;line-height:1.6;color:#334155;">${intro}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px;text-align:center;">
                <a href="${confirmationUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;">${cta}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 24px;">
                <p style="margin:0;font-size:13px;line-height:1.6;color:#94a3b8;">
                  For your security, this link expires and can only be used once — never forward it to anyone. ${ignore}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;border-top:1px solid #f1f5f9;text-align:center;">
                <p style="margin:0;font-size:12px;color:#cbd5e1;">TeamHub — collaborate better, together.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function buildVerificationUrl(tokenHash, actionType, redirectTo) {
  return `${supabaseUrl}/auth/v1/verify?token=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(actionType)}&redirect_to=${encodeURIComponent(redirectTo)}`
}

async function sendViaResend({ to, subject, html }) {
  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: fromAddress, to: [to], subject, html }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Resend error (${response.status}): ${errorBody}`)
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  if (!resendApiKey || !hookSecret || !supabaseUrl) {
    console.error('send-email: missing RESEND_API_KEY, SEND_EMAIL_HOOK_SECRET, or SUPABASE_URL secret')
    return json({ error: { http_code: 500, message: 'Email delivery is not configured' } }, 500)
  }

  const payload = await req.text()
  const headers = Object.fromEntries(req.headers)

  let verified
  try {
    const wh = new Webhook(hookSecret)
    verified = wh.verify(payload, headers)
  } catch (error) {
    // Never log the payload/headers here — they carry the real confirmation token.
    console.error('send-email: webhook signature verification failed', error instanceof Error ? error.message : 'unknown error')
    return json({ error: { http_code: 401, message: 'Invalid webhook signature' } }, 401)
  }

  const { user, email_data } = verified
  const { token_hash, token_hash_new, redirect_to, email_action_type } = email_data
  const template = TEMPLATES[email_action_type] ?? FALLBACK_TEMPLATE

  try {
    if (email_action_type === 'email_change' && token_hash_new && user.new_email) {
      // "Secure email change" asks us to notify both addresses from one hook call. Supabase
      // reverses the token pairing for backward-compatibility reasons: the CURRENT address
      // confirms with token_hash_new, the NEW address confirms with token_hash.
      await sendViaResend({
        to: user.email,
        subject: template.subject,
        html: buildEmailHtml({ ...template, confirmationUrl: buildVerificationUrl(token_hash_new, email_action_type, redirect_to) }),
      })
      await sendViaResend({
        to: user.new_email,
        subject: template.subject,
        html: buildEmailHtml({ ...template, confirmationUrl: buildVerificationUrl(token_hash, email_action_type, redirect_to) }),
      })
    } else {
      const recipient = email_action_type === 'email_change' ? user.new_email || user.email : user.email
      await sendViaResend({
        to: recipient,
        subject: template.subject,
        html: buildEmailHtml({ ...template, confirmationUrl: buildVerificationUrl(token_hash, email_action_type, redirect_to) }),
      })
    }
  } catch (error) {
    console.error('send-email: failed to send via Resend', error instanceof Error ? error.message : 'unknown error')
    return json({ error: { http_code: 500, message: 'Failed to send email' } }, 500)
  }

  return json({}, 200)
})

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
