// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3?target=deno'

console.log("Set Admin Role Function Initialized")

serve(async (req: Request) => {
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  )

  const { userId } = await req.json()

  if (!userId) {
    return new Response(JSON.stringify({ error: 'userId is required' }), { 
      status: 400,
      headers: { "Content-Type": "application/json" }
    })
  }

  const { data, error } = await supabaseClient.auth.admin.updateUserById(
    userId,
    { user_metadata: { role: 'admin' } }
  )

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 400,
      headers: { "Content-Type": "application/json" }
    })
  }

  return new Response(JSON.stringify({ data, message: 'Admin role set successfully' }), { 
    status: 200,
    headers: { "Content-Type": "application/json" }
  })
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/set-admin-role' \
    --header 'Authorization: Bearer ' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
