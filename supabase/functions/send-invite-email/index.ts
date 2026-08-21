import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
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

    const { invitationId } = await req.json()
    if (!invitationId) {
      return json({ error: 'invitationId is required' }, 400)
    }

    // Service-role client to read the invitation + workspace + inviter regardless of RLS,
    // since this function already re-verifies the caller owns the invitation below.
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: invitation, error: invitationError } = await adminClient
      .from('invitations')
      .select('id, email, invited_by, workspaces (name), profiles!invitations_invited_by_fkey (full_name)')
      .eq('id', invitationId)
      .single()

    if (invitationError || !invitation) {
      return json({ error: 'Invitation not found' }, 404)
    }

    if (invitation.invited_by !== callerData.user.id) {
      return json({ error: 'You do not own this invitation' }, 403)
    }

    const workspaceName = invitation.workspaces?.name ?? 'a TeamHub workspace'
    const inviterName = invitation.profiles?.full_name ?? 'A teammate'

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'TeamHub <onboarding@resend.dev>',
        to: [invitation.email],
        subject: `${inviterName} invited you to ${workspaceName} on TeamHub`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #0f172a;">You've been invited to TeamHub</h2>
            <p style="color: #334155; line-height: 1.6;">
              <strong>${inviterName}</strong> invited you to join <strong>${workspaceName}</strong> on TeamHub.
            </p>
            <p style="color: #334155; line-height: 1.6;">
              Log in to TeamHub with this email address (<strong>${invitation.email}</strong>) to join automatically.
              If you don't have an account yet, sign up with this same email.
            </p>
          </div>
        `,
      }),
    })

    if (!emailResponse.ok) {
      const errorBody = await emailResponse.text()
      return json({ error: `Resend error: ${errorBody}` }, 502)
    }

    return json({ ok: true })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
