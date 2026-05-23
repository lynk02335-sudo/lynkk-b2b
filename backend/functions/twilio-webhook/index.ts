import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseKey)

interface TwilioStatusCallback {
  MessageSid: string
  MessageStatus: string
  ErrorCode?: string
  ErrorMessage?: string
  To?: string
  From?: string
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const formData = await req.formData()
    
    const messageSid = formData.get('MessageSid') as string
    const messageStatus = formData.get('MessageStatus') as string
    const errorCode = formData.get('ErrorCode') as string
    const errorMessage = formData.get('ErrorMessage') as string

    if (!messageSid) {
      return new Response('Missing MessageSid', { status: 400 })
    }

    console.log(`Twilio webhook: SID=${messageSid}, Status=${messageStatus}`)

    let status: string
    switch (messageStatus) {
      case 'queued':
      case 'sent':
        status = 'sent'
        break
      case 'delivered':
        status = 'delivered'
        break
      case 'read':
        status = 'read'
        break
      case 'failed':
      case 'undelivered':
        status = 'failed'
        break
      default:
        status = 'pending'
    }

    const updateData: Record<string, unknown> = {
      status,
    }

    if (status === 'delivered') {
      updateData.delivered_at = new Date().toISOString()
    }

    if (status === 'failed' && (errorCode || errorMessage)) {
      updateData.error_message = errorMessage || `Error code: ${errorCode}`
    }

    const { error: updateError } = await supabase
      .from('user_messages')
      .update(updateData)
      .eq('twilio_sid', messageSid)

    if (updateError) {
      console.error('Failed to update message status:', updateError)
      return new Response('Failed to update status', { status: 500 })
    }

    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('Twilio webhook error:', error)
    return new Response('Internal error', { status: 500 })
  }
})