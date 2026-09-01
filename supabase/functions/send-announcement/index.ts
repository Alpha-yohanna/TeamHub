// Admin -> all-users broadcast only. A later Support/Feedback/Bug Report inbox is
// the opposite direction (user -> admin) and would be its own function(s) — e.g.
// submit-support-request — sharing only the super_admins/is_super_admin() check
// this function re-verifies below, not this function itself.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RESEND_BATCH_URL = 'https://api.resend.com/emails/batch'
const FROM_ADDRESS = 'TeamHub <noreply@alphayohanna.com>'
const ALL_SEND_COOLDOWN_MINUTES = 10
const MAX_RECIPIENTS = 2000
const MAX_SUBJECT_LENGTH = 200
const MAX_MESSAGE_LENGTH = 20000
const RESEND_CHUNK_SIZE = 100

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Missing Authorization header' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    // Gmail (and several other clients) refuse to render inline SVG <img> tags, so the
    // previous `${appUrl}/teamhub-logo.svg` always showed as broken there even though the
    // URL itself was reachable. Using the JPEG already hosted in Supabase Storage instead.
    const logoUrl =
      'https://xyhufdnhpvxeypzfanqr.supabase.co/storage/v1/object/public/teamhub-assets/WhatsApp%20Image%202026-08-25%20at%203.26.10%20AM.jpeg'

    if (!resendApiKey) {
      return json({ error: 'RESEND_API_KEY is not configured' }, 500)
    }

    // Client scoped to the caller's own JWT, just to identify who is asking.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: callerData, error: callerError } = await callerClient.auth.getUser()
    if (callerError || !callerData.user) {
      return json({ error: 'Invalid session' }, 401)
    }
    const caller = callerData.user

    // Service-role client: independently re-verifies admin status (never trusts the
    // frontend) and is needed to list every registered user's email for "all" sends.
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: superAdminRow, error: superAdminError } = await adminClient
      .from('super_admins')
      .select('user_id')
      .eq('user_id', caller.id)
      .maybeSingle()

    if (superAdminError) {
      return json({ error: 'Could not verify admin status' }, 500)
    }
    if (!superAdminRow) {
      return json({ error: 'You are not authorized to send announcements' }, 403)
    }

    let body
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Invalid request body' }, 400)
    }

    const subject = typeof body?.subject === 'string' ? body.subject.trim() : ''
    const message = typeof body?.message === 'string' ? body.message.trim() : ''
    const mode = body?.mode === 'all' ? 'all' : 'test'

    if (!subject) {
      return json({ error: 'Subject is required' }, 400)
    }
    if (subject.length > MAX_SUBJECT_LENGTH) {
      return json({ error: `Subject must be ${MAX_SUBJECT_LENGTH} characters or fewer` }, 400)
    }
    if (!message) {
      return json({ error: 'Message is required' }, 400)
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return json({ error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer` }, 400)
    }

    let recipients

    if (mode === 'test') {
      if (!caller.email) {
        return json({ error: 'Your account has no email on file' }, 400)
      }
      recipients = [caller.email]
    } else {
      const { data: lastAllSend, error: lastSendError } = await adminClient
        .from('announcements')
        .select('created_at')
        .eq('scope', 'all')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (lastSendError) {
        return json({ error: 'Could not check announcement rate limit' }, 500)
      }

      if (lastAllSend) {
        const cooldownMs = ALL_SEND_COOLDOWN_MINUTES * 60 * 1000
        const elapsedMs = Date.now() - new Date(lastAllSend.created_at).getTime()
        if (elapsedMs < cooldownMs) {
          const waitMinutes = Math.ceil((cooldownMs - elapsedMs) / 60000)
          return json(
            { error: `Please wait ${waitMinutes} more minute(s) before sending another announcement to all users.` },
            429,
          )
        }
      }

      const emails = new Set()
      let page = 1
      const perPage = 200
      // deno-lint-ignore no-constant-condition
      while (true) {
        const { data: usersPage, error: listError } = await adminClient.auth.admin.listUsers({ page, perPage })
        if (listError) {
          return json({ error: 'Failed to list registered users' }, 500)
        }
        for (const user of usersPage.users) {
          if (user.email) emails.add(user.email.toLowerCase())
        }
        if (usersPage.users.length < perPage) break
        page += 1
      }

      // Reserved documentation domains (RFC 2606) can end up in auth.users from test/QA
      // fixtures (e.g. automated test accounts). Resend's batch endpoint validates the
      // whole request atomically, so a single such address rejects the entire "send to
      // all" batch — excluding them here keeps one bad address from blocking real
      // recipients. This is intentionally narrow (exact reserved domains only), not a
      // general malformed-email filter, and every exclusion is logged with a count and
      // reason (no email addresses) so it's never silent.
      const RESERVED_TEST_DOMAINS = new Set(['example.com', 'example.org', 'example.net', 'example.edu'])
      const allRecipients = Array.from(emails)
      recipients = allRecipients.filter((email) => !RESERVED_TEST_DOMAINS.has(email.split('@')[1]))
      const excludedCount = allRecipients.length - recipients.length
      if (excludedCount > 0) {
        console.log(`send-announcement: excluded ${excludedCount} recipient(s) with a reserved/test domain (example.com/.org/.net/.edu)`)
      }

      if (recipients.length === 0) {
        return json({ error: 'No registered users found to send to' }, 400)
      }
      if (recipients.length > MAX_RECIPIENTS) {
        return json(
          { error: `This would send to ${recipients.length} users, above the safety limit of ${MAX_RECIPIENTS}. Contact support to raise this limit.` },
          400,
        )
      }
    }

    const html = buildAnnouncementHtml({ subject, message, logoUrl })
    let failedCount = 0

    for (let i = 0; i < recipients.length; i += RESEND_CHUNK_SIZE) {
      const chunk = recipients.slice(i, i + RESEND_CHUNK_SIZE)
      const batchPayload = chunk.map((to) => ({ from: FROM_ADDRESS, to: [to], subject, html }))

      const response = await fetch(RESEND_BATCH_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batchPayload),
      })

      if (!response.ok) {
        failedCount += chunk.length
        const errorBody = await response.text()
        console.error('send-announcement: Resend batch error', response.status, errorBody)
      }
    }

    const sentCount = recipients.length - failedCount

    const { error: insertError } = await adminClient.from('announcements').insert({
      subject,
      message,
      scope: mode,
      recipient_count: sentCount,
      sent_by: caller.id,
    })
    if (insertError) {
      console.error('send-announcement: failed to record announcement history', insertError.message)
    }

    if (sentCount === 0) {
      return json({ error: 'Failed to send the announcement. Please check the Resend configuration and try again.' }, 502)
    }

    return json({ ok: true, mode, sentCount, failedCount })
  } catch (error) {
    console.error('send-announcement: unexpected error', error instanceof Error ? error.message : 'unknown error')
    return json({ error: 'Something went wrong while sending the announcement' }, 500)
  }
})

function buildAnnouncementHtml({ subject, message, logoUrl }) {
  const safeSubject = escapeHtml(subject)
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br />')

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
                <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#2563eb;">Announcement</p>
                <h1 style="margin:0 0 12px;font-size:20px;color:#0f172a;">${safeSubject}</h1>
                <p style="margin:0;font-size:15px;line-height:1.6;color:#334155;">${safeMessage}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 8px;">
                <p style="margin:0;font-size:13px;line-height:1.6;color:#94a3b8;">
                  You're receiving this because you have a TeamHub account.
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

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
