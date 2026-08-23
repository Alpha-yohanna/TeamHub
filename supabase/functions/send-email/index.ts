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
// The dashboard prints the hook secret as "v1,whsec_..." — "v1," is a format version marker, not
// part of the key the standardwebhooks verifier expects.
const hookSecret = (Deno.env.get('SEND_EMAIL_HOOK_SECRET') || '').replace('v1,', '')

const TEMPLATES = {
  signup: {
    subject: 'Verify your TeamHub account',
    heading: 'Welcome to TeamHub 👋',
    intro:
      "You're almost ready to start collaborating with your team. Please confirm your email address to activate your TeamHub account.",
    cta: 'Verify my TeamHub account',
  },
  magiclink: {
    subject: 'Your TeamHub sign-in link',
    heading: 'Sign in to TeamHub',
    intro: 'Use the button below to securely sign in to your TeamHub account.',
    cta: 'Sign in to TeamHub',
  },
  recovery: {
    subject: 'Reset your TeamHub password',
    heading: 'Reset your password',
    intro:
      'We received a request to reset the password for your TeamHub account. If this was you, choose a new password using the button below.',
    cta: 'Reset my password',
  },
  invite: {
    subject: "You've been invited to TeamHub",
    heading: "You're invited to TeamHub",
    intro: 'Someone invited you to join their team on TeamHub. Accept the invitation to get started.',
    cta: 'Accept invitation',
  },
  email_change: {
    subject: 'Confirm your new TeamHub email address',
    heading: 'Confirm your new email',
    intro: 'Confirm this email address to finish updating your TeamHub account.',
    cta: 'Confirm new email',
  },
  reauthentication: {
    subject: 'Confirm it’s you — TeamHub',
    heading: 'Confirm your identity',
    intro: 'Please confirm this request to continue with your TeamHub account.',
    cta: 'Confirm',
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
}

function buildEmailHtml({ heading, intro, cta, confirmationUrl }) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
            <tr>
              <td style="padding:32px 32px 0;text-align:center;">
                <span style="font-size:20px;font-weight:800;color:#0f172a;letter-spacing:-0.01em;">TeamHub</span>
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
              <td style="padding:0 32px 32px;">
                <p style="margin:0;font-size:13px;line-height:1.6;color:#94a3b8;">If you didn't request this, you can safely ignore this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
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
  const template = TEMPLATES[email_data.email_action_type] ?? FALLBACK_TEMPLATE
  const confirmationUrl = `${supabaseUrl}/auth/v1/verify?token=${email_data.token_hash}&type=${email_data.email_action_type}&redirect_to=${email_data.redirect_to}`

  const emailResponse = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress,
      to: [user.email],
      subject: template.subject,
      html: buildEmailHtml({ heading: template.heading, intro: template.intro, cta: template.cta, confirmationUrl }),
    }),
  })

  if (!emailResponse.ok) {
    const errorBody = await emailResponse.text()
    console.error('send-email: Resend API error', emailResponse.status, errorBody)
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
