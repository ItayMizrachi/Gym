// Sends the rest-over alerts that are due (Web Push). Called by pg_cron every few seconds, only when a row in
// public.rest_pushes is due. Secrets: VAPID_PUBLIC, VAPID_PRIVATE, CRON_SECRET (SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are provided by Supabase).
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
webpush.setVapidDetails('mailto:itaymiz98@gmail.com', Deno.env.get('VAPID_PUBLIC')!, Deno.env.get('VAPID_PRIVATE')!)

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return new Response('no', { status: 401 })

  // take the due ones (deleting them first, so a slow run never sends one twice)
  const { data: due, error } = await db.from('rest_pushes').delete().lte('send_at', new Date().toISOString()).select()
  if (error) return new Response(error.message, { status: 500 })
  if (!due?.length) return new Response('0')

  const { data: subs } = await db.from('push_subs').select().in('user_id', due.map((d) => d.user_id))
  let sent = 0
  await Promise.all(
    (subs ?? []).map(async (s) => {
      const d = due.find((x) => x.user_id === s.user_id)!
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: d.title, body: d.body, tag: 'gymlog-rest' }),
          { TTL: 60, urgency: 'high' }
        )
        sent++
      } catch (e) {
        // the phone dropped this subscription (app removed, permission off): forget it
        const code = (e as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) await db.from('push_subs').delete().eq('endpoint', s.endpoint)
      }
    })
  )
  return new Response(String(sent))
})
