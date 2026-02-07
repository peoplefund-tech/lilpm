import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { user_ids } = await req.json()

        if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
            throw new Error('user_ids array is required')
        }

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            { auth: { autoRefreshToken: false, persistSession: false } }
        )

        const results: { userId: string; success: boolean; error?: string; details?: string[] }[] = []

        for (const userId of user_ids) {
            const details: string[] = []

            try {
                console.log(`Starting deletion for user: ${userId}`)

                // Get user email and find a replacement user for NOT NULL fields
                let userEmail = ''
                let replacementUserId: string | null = null

                try {
                    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId)
                    userEmail = userData?.user?.email || ''
                    details.push(`User: ${userEmail || userId}`)
                } catch (e: any) {
                    details.push(`Could not get user: ${e.message}`)
                }

                // Find a replacement user for NOT NULL creator_id fields
                try {
                    const { data: otherUser } = await supabaseAdmin
                        .from('profiles')
                        .select('id')
                        .neq('id', userId)
                        .limit(1)
                        .single()
                    replacementUserId = otherUser?.id || null
                    details.push(`Replacement user: ${replacementUserId || 'none'}`)
                } catch (e) {
                    details.push(`No replacement user found`)
                }

                // 1. DELETE user_ai_settings
                const { error: e1 } = await supabaseAdmin.from('user_ai_settings').delete().eq('user_id', userId)
                details.push(`user_ai_settings: ${e1 ? e1.message : 'ok'}`)

                // 2. DELETE prd_documents created by user
                const { error: e2 } = await supabaseAdmin.from('prd_documents').delete().eq('created_by', userId)
                details.push(`prd_documents: ${e2 ? e2.message : 'ok'}`)

                // 3. DELETE prd_projects created by user
                const { error: e3 } = await supabaseAdmin.from('prd_projects').delete().eq('created_by', userId)
                details.push(`prd_projects: ${e3 ? e3.message : 'ok'}`)

                // 4. DELETE team_members
                const { error: e4 } = await supabaseAdmin.from('team_members').delete().eq('user_id', userId)
                details.push(`team_members: ${e4 ? e4.message : 'ok'}`)

                // 5. UPDATE team_invites (invited_by) - nullable
                const { error: e5 } = await supabaseAdmin.from('team_invites').update({ invited_by: null }).eq('invited_by', userId)
                details.push(`team_invites: ${e5 ? e5.message : 'ok'}`)

                // 6. DELETE team_invites by email
                if (userEmail) {
                    const { error: e6 } = await supabaseAdmin.from('team_invites').delete().eq('email', userEmail)
                    details.push(`team_invites (email): ${e6 ? e6.message : 'ok'}`)
                }

                // 7. UPDATE issues (assignee_id) - nullable
                const { error: e7 } = await supabaseAdmin.from('issues').update({ assignee_id: null }).eq('assignee_id', userId)
                details.push(`issues (assignee): ${e7 ? e7.message : 'ok'}`)

                // 8. UPDATE issues (creator_id) - NOW NULLABLE, can set to null
                const { error: e8 } = await supabaseAdmin.from('issues').update({ creator_id: null }).eq('creator_id', userId)
                details.push(`issues (creator): ${e8 ? e8.message : 'ok'}`)

                // 9. DELETE activity_logs
                const { error: e9 } = await supabaseAdmin.from('activity_logs').delete().eq('user_id', userId)
                details.push(`activity_logs: ${e9 ? e9.message : 'ok'}`)

                // 10. DELETE notifications
                const { error: e10 } = await supabaseAdmin.from('notifications').delete().eq('user_id', userId)
                details.push(`notifications: ${e10 ? e10.message : 'ok'}`)

                // 11. DELETE conversation_access_requests (requested_by)
                const { error: e11a } = await supabaseAdmin.from('conversation_access_requests').delete().eq('requested_by', userId)
                details.push(`conversation_access_requests (requested_by): ${e11a ? e11a.message : 'ok'}`)

                // 12. UPDATE conversation_access_requests (reviewed_by) - nullable
                const { error: e11b } = await supabaseAdmin.from('conversation_access_requests').update({ reviewed_by: null }).eq('reviewed_by', userId)
                details.push(`conversation_access_requests (reviewed_by): ${e11b ? e11b.message : 'ok'}`)

                // 13. DELETE conversation_shares (shared_by)
                const { error: e12 } = await supabaseAdmin.from('conversation_shares').delete().eq('shared_by', userId)
                details.push(`conversation_shares: ${e12 ? e12.message : 'ok'}`)

                // 14. DELETE conversations (user_id) - this will cascade to messages
                const { error: e13 } = await supabaseAdmin.from('conversations').delete().eq('user_id', userId)
                details.push(`conversations: ${e13 ? e13.message : 'ok'}`)

                // 15. DELETE profiles
                const { error: e14 } = await supabaseAdmin.from('profiles').delete().eq('id', userId)
                details.push(`profiles: ${e14 ? e14.message : 'ok'}`)

                // 12. Finally delete auth user
                console.log('Deleting auth user...')
                const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)

                if (authError) {
                    details.push(`auth.users: ${authError.message}`)
                    throw new Error(`Auth: ${authError.message}`)
                }

                details.push('auth.users: ok')
                results.push({ userId, success: true, details })
                console.log(`Deleted user: ${userId}`)

            } catch (userError: any) {
                console.error(`Error deleting ${userId}:`, userError)
                results.push({ userId, success: false, error: userError.message, details })
            }
        }

        const successCount = results.filter(r => r.success).length

        return new Response(
            JSON.stringify({
                success: successCount === user_ids.length,
                message: `Deleted ${successCount}/${user_ids.length} users`,
                results
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
