import { supabase } from "../lib/supabaseClient";

async function invokeSendAnnouncement({ subject, message, mode }) {
  const { data, error } = await supabase.functions.invoke("send-announcement", {
    body: { subject, message, mode },
  });

  if (error) {
    // Edge Function errors (4xx/5xx) surface the JSON body on error.context.
    let serverMessage = null;
    try {
      const body = await error.context?.json?.();
      serverMessage = body?.error;
    } catch {
      serverMessage = null;
    }
    throw new Error(serverMessage || error.message || "Failed to send announcement.");
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

/**
 * Sends the announcement only to the currently signed-in admin's own email —
 * required before "send to all" can be used.
 */
export async function sendTestAnnouncement({ subject, message }) {
  return invokeSendAnnouncement({ subject, message, mode: "test" });
}

/**
 * Sends the announcement to every registered TeamHub user. The backend independently
 * re-verifies admin status and enforces a cooldown between "all" sends.
 */
export async function sendAnnouncementToAll({ subject, message }) {
  return invokeSendAnnouncement({ subject, message, mode: "all" });
}

export async function listAnnouncementHistory(limit = 20) {
  const { data, error } = await supabase
    .from("announcements")
    .select("id, subject, message, scope, recipient_count, created_at, sent_by")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}
