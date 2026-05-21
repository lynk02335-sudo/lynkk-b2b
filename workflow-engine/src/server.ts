import 'dotenv/config';
import fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { registerUserImportRoutes } from './routes/users/import';
import { registerUserExportRoutes } from './routes/users/export';
import { registerCatalogImportRoutes } from './routes/catalog/import';
import { registerRepeatedJobs } from './jobs/QueueSetup';
import { chiSquaredTest } from './core/stats';

const server = fastify({ logger: true });

const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function getUser(request: fastify.FastifyRequest) {
  const authHeader = request.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
}

// Routes
server.get('/api/sms-templates', async (request, reply) => {
  try {
    const user = await getUser(request);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { data, error } = await supabase
      .from('sms_templates')
      .select('*')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return reply.send(data || []);
  } catch (err: any) {
    reply.status(500).send({ error: err.message });
  }
});

server.post('/api/sms-templates', async (request, reply) => {
  try {
    const body = z.object({
      name: z.string().min(1),
      body: z.string().min(1),
      variables: z.array(z.string()).optional(),
    }).parse(request.body);
    
    const user = await getUser(request);
    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { data, error } = await supabase
      .from('sms_templates')
      .insert({
        customer_id: user.id,
        name: body.name,
        body: body.body,
        variables: body.variables || [],
      })
      .select()
      .single();
    
    if (error) throw error;
    return reply.status(201).send(data);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({ error: 'Invalid input', details: err.errors });
    }
    reply.status(500).send({ error: err.message });
  }
});

server.put('/api/sms-templates/:id', async (request, reply) => {
  try {
    const { id } = request.params as { id: string };
    const body = z.object({
      name: z.string().optional(),
      body: z.string().optional(),
      variables: z.array(z.string()).optional(),
    }).parse(request.body);

    const { data, error } = await supabase
      .from('sms_templates')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return reply.send(data);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({ error: 'Invalid input', details: err.errors });
    }
    reply.status(500).send({ error: err.message });
  }
});

server.delete('/api/sms-templates/:id', async (request, reply) => {
  try {
    const { id } = request.params as { id: string };
    
    const { error } = await supabase
      .from('sms_templates')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return reply.send({ message: 'Template deleted' });
  } catch (err: any) {
    reply.status(500).send({ error: err.message });
  }
});

// =====================================================
// PUSH TEMPLATES API
// =====================================================
server.get('/api/push-templates', async (request, reply) => {
  try {
    const user = await getUser(request);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { data, error } = await supabase
      .from('push_templates')
      .select('*')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return reply.send(data || []);
  } catch (err: any) {
    reply.status(500).send({ error: err.message });
  }
});

server.post('/api/push-templates', async (request, reply) => {
  try {
    const body = z.object({
      name: z.string().min(1),
      title: z.string().min(1),
      body: z.string().min(1),
      icon_url: z.string().optional(),
      cta_url: z.string().optional(),
      variables: z.array(z.string()).optional(),
    }).parse(request.body);
    
    const user = await getUser(request);
    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { data, error } = await supabase
      .from('push_templates')
      .insert({
        customer_id: user.id,
        name: body.name,
        title: body.title,
        body: body.body,
        icon_url: body.icon_url || null,
        cta_url: body.cta_url || null,
        variables: body.variables || [],
      })
      .select()
      .single();
    
    if (error) throw error;
    return reply.status(201).send(data);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({ error: 'Invalid input', details: err.errors });
    }
    reply.status(500).send({ error: err.message });
  }
});

server.put('/api/push-templates/:id', async (request, reply) => {
  try {
    const { id } = request.params as { id: string };
    const body = z.object({
      name: z.string().optional(),
      title: z.string().optional(),
      body: z.string().optional(),
      icon_url: z.string().optional(),
      cta_url: z.string().optional(),
      variables: z.array(z.string()).optional(),
    }).parse(request.body);

    const { data, error } = await supabase
      .from('push_templates')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return reply.send(data);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({ error: 'Invalid input', details: err.errors });
    }
    reply.status(500).send({ error: err.message });
  }
});

server.delete('/api/push-templates/:id', async (request, reply) => {
  try {
    const { id } = request.params as { id: string };
    
    const { error } = await supabase
      .from('push_templates')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return reply.send({ message: 'Template deleted' });
  } catch (err: any) {
    reply.status(500).send({ error: err.message });
  }
});

// =====================================================
// SEND SMS
// =====================================================
server.post('/api/messages/sms', async (request, reply) => {
  try {
    const body = z.object({
      tracked_user_email: z.string(),
      phone_field: z.string().default('phone'),
      template_id: z.string().optional(),
      message: z.string().optional(),
      variables: z.record(z.string()).optional(),
      workflow_id: z.string().uuid().optional(),
    }).parse(request.body);

    const user = await getUser(request);
    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    // Get customer SMS config
    const { data: customer } = await supabase
      .from('customers')
      .select('sms_config')
      .eq('id', user.id)
      .single();

    const smsConfig = (customer?.sms_config as Record<string, string>) || {};
    const { account_sid, auth_token, phone_number, messaging_service_sid } = smsConfig;

    if (!account_sid || !auth_token) {
      return reply.status(400).send({ error: 'Twilio not configured' });
    }

    // Get tracked user phone number
    const { data: trackedUser } = await supabase
      .from('tracked_users')
      .select('id, phone, phone_number, mobile, metadata')
      .eq('customer_id', user.id)
      .eq('email', body.tracked_user_email)
      .single();

    let phoneNumber = '';
    if (body.phone_field === 'phone') phoneNumber = trackedUser?.phone || '';
    else if (body.phone_field === 'phone_number') phoneNumber = trackedUser?.phone_number || '';
    else if (body.phone_field === 'mobile') phoneNumber = trackedUser?.mobile || '';

    // If no phone, use from metadata
    if (!phoneNumber && trackedUser?.metadata) {
      const meta = trackedUser.metadata as Record<string, string>;
      phoneNumber = meta.phone || meta.phone_number || meta.mobile || '';
    }

    // Validate E.164 format
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    if (!phoneNumber || !e164Regex.test(phoneNumber)) {
      return reply.status(400).send({ error: 'Invalid or missing phone number. Must be E.164 format (e.g., +1234567890)' });
    }

    // Get template content
    let messageContent = body.message || '';
    if (body.template_id && body.template_id !== 'custom') {
      const { data: template } = await supabase
        .from('sms_templates')
        .select('body')
        .eq('id', body.template_id)
        .single();
      
      if (template) {
        messageContent = template.body;
      }
    }

    // Replace variables
    if (body.variables) {
      for (const [key, value] of Object.entries(body.variables)) {
        messageContent = messageContent.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      }
    }

    if (!messageContent.trim()) {
      return reply.status(400).send({ error: 'Message content is empty after variable resolution' });
    }

    // Send via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${account_sid}/Messages.json`;
    const auth = Buffer.from(`${account_sid}:${auth_token}`).toString('base64');

    const formData = new URLSearchParams();
    formData.append('To', phoneNumber);
    if (messaging_service_sid) {
      formData.append('MessagingServiceSid', messaging_service_sid);
    } else if (phone_number) {
      formData.append('From', phone_number);
    } else {
      return reply.status(400).send({ error: 'No sender phone number configured' });
    }
    formData.append('Body', messageContent);

    const twilioRes = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const twilioData = await twilioRes.json();

    if (!twilioRes.ok) {
      // Log failed message
      await supabase.from('user_messages').insert({
        customer_id: user.id,
        tracked_user_email: body.tracked_user_email,
        tracked_user_id: trackedUser?.id || null,
        channel: 'sms',
        message_type: 'outbound',
        content: messageContent,
        recipient_phone: phoneNumber,
        workflow_id: body.workflow_id || null,
        status: 'failed',
        error_message: (twilioData as any).message || 'Twilio error',
      });
      return reply.status(400).send({ error: (twilioData as any).message || 'Failed to send SMS' });
    }

    const twilioSid = (twilioData as any).sid;

    // Log successful message
    await supabase.from('user_messages').insert({
      customer_id: user.id,
      tracked_user_email: body.tracked_user_email,
      tracked_user_id: trackedUser?.id || null,
      channel: 'sms',
      message_type: 'outbound',
      template_id: body.template_id,
      content: messageContent,
      recipient_phone: phoneNumber,
      workflow_id: body.workflow_id || null,
      status: 'sent',
      twilio_sid: twilioSid,
      sent_at: new Date().toISOString(),
    });

    return reply.send({ success: true, sid: twilioSid });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({ error: 'Invalid input', details: err.errors });
    }
    reply.status(500).send({ error: err.message });
  }
});

// =====================================================
// TEST SMS
// =====================================================
server.post('/api/settings/sms/test', async (request, reply) => {
  try {
    const body = z.object({
      account_sid: z.string().min(1),
      auth_token: z.string().min(1),
      phone_number: z.string().min(1),
      to: z.string().min(1),
    }).parse(request.body);

    const twilioRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${body.account_sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: 'Basic ' + Buffer.from(`${body.account_sid}:${body.auth_token}`).toString('base64'),
        },
        body: new URLSearchParams({
          From: body.phone_number,
          To: body.to,
          Body: 'This is a test message from Lynkk. Your SMS configuration is working!',
        }).toString(),
      }
    );

    const data = await twilioRes.json();

    if (!twilioRes.ok) {
      return reply.status(400).send({ error: data.message || 'Failed to send test SMS' });
    }

    return reply.send({ success: true, sid: data.sid });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({ error: 'Invalid input', details: err.errors });
    }
    reply.status(500).send({ error: err.message });
  }
});

// =====================================================
// TWILIO WEBHOOK
// =====================================================
server.post('/api/webhooks/twilio', async (request, reply) => {
  try {
    const formData = await request.formData();
    
    const messageSid = formData.get('MessageSid') as string;
    const messageStatus = formData.get('MessageStatus') as string;
    const errorCode = formData.get('ErrorCode') as string;
    const errorMessage = formData.get('ErrorMessage') as string;

    if (!messageSid) {
      return reply.status(400).send({ error: 'Missing MessageSid' });
    }

    let status = 'sent';
    if (messageStatus === 'delivered') status = 'delivered';
    else if (messageStatus === 'failed' || messageStatus === 'undelivered') status = 'failed';

    const updateData: Record<string, unknown> = { status };
    if (status === 'delivered') updateData.delivered_at = new Date().toISOString();
    if (status === 'failed' && errorMessage) updateData.error_message = errorMessage;

    const { error } = await supabase
      .from('user_messages')
      .update(updateData)
      .eq('twilio_sid', messageSid);

    if (error) {
      console.error('Failed to update message status:', error);
    }

    return reply.send({ ok: true });
  } catch (err: any) {
    console.error('Twilio webhook error:', err);
    reply.status(500).send({ error: err.message });
  }
});

// =====================================================
// SEND PUSH
// =====================================================
server.post('/api/messages/push', async (request, reply) => {
  try {
    const body = z.object({
      tracked_user_email: z.string(),
      template_id: z.string().optional(),
      title: z.string().optional(),
      body: z.string().optional(),
      icon_url: z.string().optional(),
      cta_url: z.string().optional(),
      variables: z.record(z.string()).optional(),
      target: z.enum(['all', 'web', 'mobile']).default('all'),
    }).parse(request.body);

    const user = await getUser(request);
    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    // Get customer push config
    const { data: customer } = await supabase
      .from('customers')
      .select('push_config')
      .eq('id', user.id)
      .single();

    const pushConfig = (customer?.push_config as Record<string, string>) || {};
    const { fcm_server_key } = pushConfig;

    if (!fcm_server_key) {
      return reply.status(400).send({ error: 'Push notifications not configured' });
    }

    // Get tracked user
    const { data: trackedUser } = await supabase
      .from('tracked_users')
      .select('id')
      .eq('customer_id', user.id)
      .eq('email', body.tracked_user_email)
      .single();

    if (!trackedUser) {
      return reply.status(404).send({ error: 'Tracked user not found' });
    }

    // Get active push tokens
    let tokensQuery = supabase
      .from('push_tokens')
      .select('token, platform')
      .eq('customer_id', user.id)
      .eq('tracked_user_id', trackedUser.id)
      .eq('active', true);

    if (body.target === 'web') {
      tokensQuery = tokensQuery.eq('platform', 'WEB');
    } else if (body.target === 'mobile') {
      tokensQuery = tokensQuery.in('platform', ['IOS', 'ANDROID']);
    }

    const { data: tokens } = await tokensQuery;

    if (!tokens || tokens.length === 0) {
      return reply.status(400).send({ error: 'No active push tokens found for this user' });
    }

    // Get template content or use provided values
    let notificationTitle = body.title || '';
    let notificationBody = body.body || '';
    let iconUrl = body.icon_url || '';
    let clickUrl = body.cta_url || '';

    if (body.template_id && body.template_id !== 'custom') {
      const { data: template } = await supabase
        .from('push_templates')
        .select('title, body, icon_url, cta_url')
        .eq('id', body.template_id)
        .single();
      
      if (template) {
        notificationTitle = template.title;
        notificationBody = template.body;
        iconUrl = template.icon_url || '';
        clickUrl = template.cta_url || '';
      }
    }

    // Replace variables
    if (body.variables) {
      for (const [key, value] of Object.entries(body.variables)) {
        notificationTitle = notificationTitle.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
        notificationBody = notificationBody.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
        clickUrl = clickUrl.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      }
    }

    if (!notificationTitle.trim() || !notificationBody.trim()) {
      return reply.status(400).send({ error: 'Notification title or body is empty after variable resolution' });
    }

    // Send to FCM
    const fcmUrl = 'https://fcm.googleapis.com/fcm/send';
    const fcmHeaders = {
      'Authorization': `key=${fcm_server_key}`,
      'Content-Type': 'application/json',
    };

    const results = [];
    for (const token of tokens) {
      const payload = {
        to: token.token,
        notification: {
          title: notificationTitle,
          body: notificationBody,
          icon: iconUrl || undefined,
        },
        data: clickUrl ? { click_action: clickUrl } : undefined,
      };

      try {
        const fcmRes = await fetch(fcmUrl, {
          method: 'POST',
          headers: fcmHeaders,
          body: JSON.stringify(payload),
        });

        const fcmData = await fcmRes.json();
        
        if (fcmData.failure === 0) {
          results.push({ token: token.token, success: true });
          
          // Log successful message
          await supabase.from('user_messages').insert({
            customer_id: user.id,
            tracked_user_email: body.tracked_user_email,
            channel: 'push',
            message_type: 'outbound',
            template_id: body.template_id,
            content: notificationBody,
            status: 'sent',
            sent_at: new Date().toISOString(),
          });
        } else {
          // Mark token as inactive if failed
          await supabase
            .from('push_tokens')
            .update({ active: false })
            .eq('token', token.token);

          results.push({ token: token.token, success: false, error: fcmData.results?.[0]?.error });
        }
      } catch (err) {
        results.push({ token: token.token, success: false, error: 'FCM request failed' });
      }
    }

    const successful = results.filter(r => r.success).length;
    return reply.send({ 
      success: true, 
      sent: successful, 
      total: tokens.length,
      results 
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({ error: 'Invalid input', details: err.errors });
    }
    reply.status(500).send({ error: err.message });
  }
});

// =====================================================
// FCM WEBHOOK (for delivery callbacks)
// =====================================================
server.post('/api/webhooks/fcm', async (request, reply) => {
  try {
    const body = await request.json() as any;
    
    // Handle FCM topic messages or direct messages acknowledgment
    // FCM doesn't have built-in delivery callbacks for web push
    // This endpoint can be used for custom acknowledgment logic
    
    return reply.send({ ok: true });
  } catch (err: any) {
    console.error('FCM webhook error:', err);
    reply.status(500).send({ error: err.message });
  }
});

// =====================================================
// PUSH TOKEN REGISTRATION
// =====================================================
server.post('/api/track/push-token', async (request, reply) => {
  try {
    const body = z.object({
      tracked_user_email: z.string(),
      token: z.string(),
      platform: z.enum(['WEB', 'IOS', 'ANDROID']),
    }).parse(request.body);

    const user = await getUser(request);
    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    // Get tracked user
    const { data: trackedUser } = await supabase
      .from('tracked_users')
      .select('id')
      .eq('customer_id', user.id)
      .eq('email', body.tracked_user_email)
      .single();

    if (!trackedUser) {
      return reply.status(404).send({ error: 'Tracked user not found' });
    }

    // Upsert push token
    const { data, error } = await supabase
      .from('push_tokens')
      .upsert({
        customer_id: user.id,
        tracked_user_id: trackedUser.id,
        token: body.token,
        platform: body.platform,
        active: true,
        last_seen_at: new Date().toISOString(),
      }, {
        onConflict: 'token',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) throw error;
    return reply.status(201).send({ success: true, token: data });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({ error: 'Invalid input', details: err.errors });
    }
    reply.status(500).send({ error: err.message });
  }
});

// =====================================================
// PERSONALIZATION CAMPAIGNS API
// =====================================================
server.get('/api/personalization-campaigns', async (request, reply) => {
  try {
    const user = await getUser(request);
    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { data, error } = await supabase
      .from('personalization_campaigns')
      .select('*')
      .eq('customer_id', user.id)
      .order('updated_at', { ascending: false });
    
    if (error) throw error;
    return reply.send(data || []);
  } catch (err: any) {
    reply.status(500).send({ error: err.message });
  }
});

server.post('/api/personalization-campaigns', async (request, reply) => {
  try {
    const body = z.object({
      name: z.string().min(1),
      type: z.enum(['BANNER', 'MODAL', 'TOOLTIP', 'INLINE', 'RECOMMENDATIONS']),
      targeting_rules: z.object({
        operator: z.string(),
        conditions: z.array(z.object({
          property: z.string(),
          operator: z.string(),
          value: z.any(),
        })),
      }).optional(),
      content: z.object({
        headline: z.string().optional(),
        body: z.string().optional(),
        cta_text: z.string().optional(),
        cta_url: z.string().optional(),
        image_url: z.string().optional(),
        theme: z.string().optional(),
        position: z.string().optional(),
      }).optional(),
      display_rules: z.object({
        trigger: z.string().optional(),
        url_match: z.string().optional(),
        url_pattern: z.string().optional(),
        frequency: z.string().optional(),
        delay_seconds: z.number().optional(),
      }).optional(),
      priority: z.number().optional(),
      variants: z.array(z.any()).optional(),
    }).parse(request.body);

    const user = await getUser(request);
    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { data, error } = await supabase
      .from('personalization_campaigns')
      .insert({
        customer_id: user.id,
        name: body.name,
        type: body.type,
        status: 'DRAFT',
        targeting_rules: body.targeting_rules || { operator: 'AND', conditions: [] },
        content: body.content || {},
        display_rules: body.display_rules || {},
        priority: body.priority || 0,
        variants: body.variants || null,
      })
      .select()
      .single();
    
    if (error) throw error;
    return reply.status(201).send(data);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({ error: 'Invalid input', details: err.errors });
    }
    reply.status(500).send({ error: err.message });
  }
});

server.put('/api/personalization-campaigns/:id', async (request, reply) => {
  try {
    const { id } = request.params as { id: string };
    const body = z.object({
      name: z.string().optional(),
      type: z.enum(['BANNER', 'MODAL', 'TOOLTIP', 'INLINE', 'RECOMMENDATIONS']).optional(),
      status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']).optional(),
      targeting_rules: z.any().optional(),
      content: z.any().optional(),
      display_rules: z.any().optional(),
      priority: z.number().optional(),
      variants: z.array(z.any()).optional(),
    }).parse(request.body);

    const updateData: Record<string, unknown> = {
      ...body,
      updated_at: new Date().toISOString(),
    };

    if (body.status === 'ACTIVE') {
      updateData.activated_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('personalization_campaigns')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return reply.send(data);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({ error: 'Invalid input', details: err.errors });
    }
    reply.status(500).send({ error: err.message });
  }
});

server.delete('/api/personalization-campaigns/:id', async (request, reply) => {
  try {
    const { id } = request.params as { id: string };
    
    const { error } = await supabase
      .from('personalization_campaigns')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return reply.send({ message: 'Campaign deleted' });
  } catch (err: any) {
    reply.status(500).send({ error: err.message });
  }
});

// =====================================================
// GET ACTIVE CAMPAIGNS (for JS SDK)
// =====================================================
server.get('/api/personalization/active', async (request, reply) => {
  try {
    const { user_id, url } = request.query as { user_id?: string; url?: string };

    if (!user_id) {
      return reply.status(400).send({ error: 'user_id is required' });
    }

    // Get tracked user
    const { data: trackedUser } = await supabase
      .from('tracked_users')
      .select('id, customer_id, status, metadata')
      .eq('id', user_id)
      .single();

    if (!trackedUser) {
      return reply.send([]);
    }

    // Get all active campaigns for this customer
    const { data: campaigns } = await supabase
      .from('personalization_campaigns')
      .select('*')
      .eq('customer_id', trackedUser.customer_id)
      .eq('status', 'ACTIVE')
      .order('priority', { ascending: false });

    if (!campaigns || campaigns.length === 0) {
      return reply.send([]);
    }

    // Filter campaigns based on targeting rules and URL
    const matchingCampaigns = [];
    
    for (const campaign of campaigns) {
      const targetingRules = campaign.targeting_rules as any;
      const displayRules = campaign.display_rules as any;

      // Check URL match
      if (displayRules?.url_pattern && url) {
        let urlMatches = false;
        const pattern = displayRules.url_pattern;
        
        if (displayRules.url_match === 'exact') {
          urlMatches = url === pattern;
        } else if (displayRules.url_match === 'contains') {
          urlMatches = url.includes(pattern);
        } else if (displayRules.url_match === 'regex') {
          try {
            urlMatches = new RegExp(pattern).test(url);
          } catch {
            urlMatches = false;
          }
        }
        
        if (!urlMatches) continue;
      }

      // Check targeting conditions
      if (targetingRules?.conditions?.length > 0) {
        const userProps = {
          status: trackedUser.status,
          ...(trackedUser.metadata || {}),
        };

        let matchesConditions = targetingRules.operator === 'AND';
        
        for (const condition of targetingRules.conditions) {
          const userValue = userProps[condition.property];
          let conditionMatch = false;

          switch (condition.operator) {
            case 'eq':
              conditionMatch = userValue === condition.value;
              break;
            case 'neq':
              conditionMatch = userValue !== condition.value;
              break;
            case 'contains':
              conditionMatch = String(userValue).includes(condition.value);
              break;
            case 'gte':
              conditionMatch = Number(userValue) >= Number(condition.value);
              break;
            case 'lte':
              conditionMatch = Number(userValue) <= Number(condition.value);
              break;
            case 'gt':
              conditionMatch = Number(userValue) > Number(condition.value);
              break;
            case 'lt':
              conditionMatch = Number(userValue) < Number(condition.value);
              break;
          }

          if (targetingRules.operator === 'AND') {
            if (!conditionMatch) {
              matchesConditions = false;
              break;
            }
          } else {
            if (conditionMatch) {
              matchesConditions = true;
              break;
            }
          }
        }

        if (!matchesConditions) continue;
      }

      matchingCampaigns.push(campaign);
    }

    return reply.send(matchingCampaigns);
  } catch (err: any) {
    console.error('Error getting active campaigns:', err);
    reply.status(500).send({ error: err.message });
  }
});

// =====================================================
// CAMPAIGN STATS & AUDIENCE ESTIMATION
// =====================================================
server.get('/api/personalization-campaigns/:id/stats', async (request, reply) => {
  try {
    const { id } = request.params as { id: string };
    const user = await getUser(request);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const [impressions, clicks] = await Promise.all([
      supabase.from('personalization_events')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', id)
        .eq('event_type', 'IMPRESSION'),
      supabase.from('personalization_events')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', id)
        .eq('event_type', 'CLICK'),
    ]);

    const impCount = impressions.count || 0;
    const clickCount = clicks.count || 0;

    return reply.send({
      impressions: impCount,
      clicks: clickCount,
      ctr: impCount > 0 ? Math.round((clickCount / impCount) * 10000) / 100 : 0,
    });
  } catch (err: any) {
    reply.status(500).send({ error: err.message });
  }
});

server.post('/api/personalization-campaigns/audience-size', async (request, reply) => {
  try {
    const body = z.object({
      targeting_rules: z.object({
        operator: z.string(),
        conditions: z.array(z.object({
          property: z.string(),
          operator: z.string(),
          value: z.any(),
        })),
      }),
    }).parse(request.body);

    const user = await getUser(request);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    let count = 0;

    if (!body.targeting_rules.conditions || body.targeting_rules.conditions.length === 0) {
      const { count: total } = await supabase
        .from('tracked_users')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', user.id);
      count = total || 0;
    } else {
      const { data: users } = await supabase
        .from('tracked_users')
        .select('status, metadata')
        .eq('customer_id', user.id);

      const matched = (users || []).filter(u => {
        const results = body.targeting_rules.conditions.map(c => {
          const userVal = c.property === 'status' ? u.status
            : c.property === 'plan' ? (u.metadata as any)?.plan
            : c.property === 'events_count' ? (u.metadata as any)?.events_count
            : c.property === 'last_active_days' ? (u.metadata as any)?.last_active_days
            : undefined;

          if (userVal === undefined) return true;
          const str = String(userVal);
          const val = String(c.value);
          if (c.operator === 'eq') return str === val;
          if (c.operator === 'neq') return str !== val;
          if (c.operator === 'contains') return str.includes(val);
          const num = Number(userVal);
          const numVal = Number(c.value);
          if (!isNaN(num) && !isNaN(numVal)) {
            if (c.operator === 'gte') return num >= numVal;
            if (c.operator === 'lte') return num <= numVal;
            if (c.operator === 'gt') return num > numVal;
            if (c.operator === 'lt') return num < numVal;
          }
          return true;
        });
        return body.targeting_rules.operator === 'AND'
          ? results.every(Boolean)
          : results.some(Boolean);
      });

      count = matched.length;
    }

    return reply.send({ audience_size: count });
  } catch (err: any) {
    reply.status(500).send({ error: err.message });
  }
});

// =====================================================
// PERSONALIZATION EVENTS
// =====================================================
server.post('/api/personalization/impression', async (request, reply) => {
  try {
    const body = z.object({
      campaign_id: z.string(),
      tracked_user_id: z.string(),
      url: z.string().optional(),
      variant_id: z.string().optional(),
    }).parse(request.body);

    const user = await getUser(request);
    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { data, error } = await supabase
      .from('personalization_events')
      .insert({
        customer_id: user.id,
        campaign_id: body.campaign_id,
        tracked_user_id: body.tracked_user_id,
        event_type: 'IMPRESSION',
        url: body.url,
        variant_id: body.variant_id,
      })
      .select()
      .single();

    if (error) throw error;
    return reply.status(201).send(data);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({ error: 'Invalid input', details: err.errors });
    }
    reply.status(500).send({ error: err.message });
  }
});

server.post('/api/personalization/click', async (request, reply) => {
  try {
    const body = z.object({
      campaign_id: z.string(),
      tracked_user_id: z.string(),
      url: z.string().optional(),
      variant_id: z.string().optional(),
    }).parse(request.body);

    const user = await getUser(request);
    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { data, error } = await supabase
      .from('personalization_events')
      .insert({
        customer_id: user.id,
        campaign_id: body.campaign_id,
        tracked_user_id: body.tracked_user_id,
        event_type: 'CLICK',
        url: body.url,
        variant_id: body.variant_id,
      })
      .select()
      .single();

    if (error) throw error;
    return reply.status(201).send(data);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({ error: 'Invalid input', details: err.errors });
    }
    reply.status(500).send({ error: err.message });
  }
});

// =====================================================
// FUNNELS API
// =====================================================
server.get('/api/funnels', async (request, reply) => {
  try {
    const user = await getUser(request);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { data, error } = await supabase
      .from('funnels')
      .select('*')
      .eq('customer_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return reply.send(data || []);
  } catch (err: any) {
    reply.status(500).send({ error: err.message });
  }
});

// Event names for funnel step autocomplete
server.get('/api/events/names', async (request, reply) => {
  try {
    const user = await getUser(request);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { data, error } = await supabase
      .from('events')
      .select('event_name')
      .eq('customer_id', user.id)
      .order('event_name', { ascending: true });

    if (error) throw error;

    const names = [...new Set((data || []).map((e: any) => e.event_name))];
    return reply.send(names);
  } catch (err: any) {
    reply.status(500).send({ error: err.message });
  }
});

server.post('/api/funnels', async (request, reply) => {
  try {
    const body = z.object({
      name: z.string().min(1),
      steps: z.array(z.string().min(1)).min(1),
      conversion_window_hours: z.number().int().positive().optional(),
    }).parse(request.body);

    const user = await getUser(request);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { data, error } = await supabase
      .from('funnels')
      .insert({
        customer_id: user.id,
        name: body.name,
        steps: body.steps,
        conversion_window_hours: body.conversion_window_hours || 168,
      })
      .select()
      .single();

    if (error) throw error;
    return reply.status(201).send(data);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({ error: 'Invalid input', details: err.errors });
    }
    reply.status(500).send({ error: err.message });
  }
});

server.put('/api/funnels/:id', async (request, reply) => {
  try {
    const { id } = request.params as { id: string };
    const body = z.object({
      name: z.string().min(1).optional(),
      steps: z.array(z.string().min(1)).min(1).optional(),
      conversion_window_hours: z.number().int().positive().optional(),
    }).parse(request.body);

    const { data, error } = await supabase
      .from('funnels')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return reply.send(data);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({ error: 'Invalid input', details: err.errors });
    }
    reply.status(500).send({ error: err.message });
  }
});

server.delete('/api/funnels/:id', async (request, reply) => {
  try {
    const { id } = request.params as { id: string };
    const { error } = await supabase.from('funnels').delete().eq('id', id);
    if (error) throw error;
    return reply.send({ message: 'Funnel deleted' });
  } catch (err: any) {
    reply.status(500).send({ error: err.message });
  }
});

server.get('/api/funnels/:id/results', async (request, reply) => {
  try {
    const { id } = request.params as { id: string };
    const { segment } = request.query as { segment?: string };

    const user = await getUser(request);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { data: funnel, error: funnelError } = await supabase
      .from('funnels')
      .select('*')
      .eq('id', id)
      .eq('customer_id', user.id)
      .single();

    if (funnelError) throw funnelError;

    const steps: string[] = funnel.steps;
    const windowHours = funnel.conversion_window_hours;
    const windowMs = windowHours * 60 * 60 * 1000;

    // Resolve segment filter to tracked_user emails
    let segmentEmails: string[] | null = null;
    if (segment) {
      const { data: segUsers } = await supabase
        .from('tracked_users')
        .select('email')
        .eq('customer_id', user.id)
        .eq('status', segment);
      segmentEmails = (segUsers || []).map(u => u.email);
    }

    const results = [];

    for (let i = 0; i < steps.length; i++) {
      const stepName = steps[i];

      let query = supabase
        .from('events')
        .select('tracked_user_email')
        .eq('event_name', stepName)
        .eq('customer_id', user.id);

      if (segmentEmails) {
        query = query.in('tracked_user_email', segmentEmails);
      }

      const { data: stepUsers, error: stepError } = await query;
      if (stepError) throw stepError;

      const userEmails = [...new Set((stepUsers || []).map((u: any) => u.tracked_user_email))];

      if (i === 0) {
        results.push({
          name: stepName,
          user_count: userEmails.length,
          conversion_rate: 100,
          median_time_to_next_step: null,
        });
        continue;
      }

      const prevStepName = steps[i - 1];
      const prevResult = results[i - 1];
      const conversionRate = prevResult.user_count > 0
        ? Math.round((userEmails.length / prevResult.user_count) * 10000) / 100
        : 0;

      let medianTime: number | null = null;
      if (userEmails.length > 1) {
        const batch = userEmails.slice(0, 500);

        let prevQuery = supabase
          .from('events')
          .select('tracked_user_email, created_at')
          .eq('event_name', prevStepName)
          .eq('customer_id', user.id)
          .in('tracked_user_email', batch);

        let curQuery = supabase
          .from('events')
          .select('tracked_user_email, created_at')
          .eq('event_name', stepName)
          .eq('customer_id', user.id)
          .in('tracked_user_email', batch);

        if (segmentEmails) {
          prevQuery = prevQuery.in('tracked_user_email', segmentEmails) as any;
          curQuery = curQuery.in('tracked_user_email', segmentEmails) as any;
        }

        const { data: prevEvents } = await prevQuery;
        const { data: curEvents } = await curQuery;

        if (prevEvents && curEvents) {
          const times: number[] = [];
          for (const email of batch) {
            const prev = prevEvents
              .filter((e: any) => e.tracked_user_email === email)
              .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            const cur = curEvents
              .filter((e: any) => e.tracked_user_email === email)
              .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            if (prev.length > 0 && cur.length > 0) {
              const diff = new Date(cur[0].created_at).getTime() - new Date(prev[prev.length - 1].created_at).getTime();
              if (diff > 0 && diff <= windowMs) {
                times.push(diff);
              }
            }
          }
          if (times.length > 0) {
            times.sort((a, b) => a - b);
            const mid = Math.floor(times.length / 2);
            medianTime = times.length % 2 === 0
              ? Math.round((times[mid - 1] + times[mid]) / 2 / 3600000 * 100) / 100
              : Math.round(times[mid] / 3600000 * 100) / 100;
          }
        }
      }

      results.push({
        name: stepName,
        user_count: userEmails.length,
        conversion_rate: conversionRate,
        median_time_to_next_step: medianTime,
      });
    }

    return reply.send({
      funnel_id: funnel.id,
      funnel_name: funnel.name,
      steps: results,
      segment: segment || 'all',
    });
  } catch (err: any) {
    reply.status(500).send({ error: err.message });
  }
});

// =====================================================
// CATALOG - PRODUCT/FEATURE INGESTION
// =====================================================

// List catalog items
server.get('/api/catalog', async (request, reply) => {
  try {
    const user = await getUser(request);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { data, error } = await supabase
      .from('catalog_items')
      .select('*')
      .eq('customer_id', user.id)
      .order('name', { ascending: true });

    if (error) throw error;
    return reply.send(data || []);
  } catch (err: any) {
    reply.status(500).send({ error: err.message });
  }
});

// Upsert catalog items (batch sync)
server.post('/api/catalog/sync', async (request, reply) => {
  try {
    const user = await getUser(request);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const body = z.object({
      items: z.array(z.object({
        external_id: z.string(),
        name: z.string(),
        description: z.string().optional().nullable(),
        category: z.string().optional().nullable(),
        price: z.number().optional().nullable(),
        image_url: z.string().optional().nullable(),
        url: z.string().optional().nullable(),
        metadata: z.record(z.unknown()).optional().nullable(),
        active: z.boolean().optional(),
      })),
    }).parse(request.body);

    const results: { external_id: string; action: 'created' | 'updated' }[] = [];

    for (const item of body.items) {
      const existing = await supabase
        .from('catalog_items')
        .select('id')
        .eq('customer_id', user.id)
        .eq('external_id', item.external_id)
        .single();

      if (existing.data) {
        await supabase
          .from('catalog_items')
          .update({
            name: item.name,
            description: item.description || null,
            category: item.category || null,
            price: item.price ?? null,
            image_url: item.image_url || null,
            url: item.url || null,
            metadata: item.metadata || {},
            active: item.active ?? true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.data.id);
        results.push({ external_id: item.external_id, action: 'updated' });
      } else {
        await supabase
          .from('catalog_items')
          .insert({
            customer_id: user.id,
            external_id: item.external_id,
            name: item.name,
            description: item.description || null,
            category: item.category || null,
            price: item.price ?? null,
            image_url: item.image_url || null,
            url: item.url || null,
            metadata: item.metadata || {},
            active: item.active ?? true,
          });
        results.push({ external_id: item.external_id, action: 'created' });
      }
    }

    return reply.send({ synced: results.length, results });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({ error: 'Invalid request body', details: err.errors });
    }
    reply.status(500).send({ error: err.message });
  }
});

// =====================================================
// RECOMMENDATIONS
// =====================================================

server.get('/api/recommendations/:trackedUserId', async (request, reply) => {
  try {
    const user = await getUser(request);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { trackedUserId } = request.params as { trackedUserId: string };
    const { strategy, limit: limitParam } = request.query as { strategy?: string; limit?: string };
    const limit = limitParam ? parseInt(limitParam) : undefined;

    let query = supabase
      .from('recommendations')
      .select('strategy, item_ids, generated_at')
      .eq('customer_id', user.id)
      .eq('tracked_user_id', trackedUserId)
      .gte('expires_at', new Date().toISOString());

    if (strategy) {
      query = query.eq('strategy', strategy);
    }

    const { data, error } = await query.order('generated_at', { ascending: false });

    if (error) throw error;

    const allItemIds = [...new Set((data || []).flatMap((r: any) => r.item_ids || []))];
    let items: any[] = [];
    if (allItemIds.length > 0) {
      const { data: catalogItems } = await supabase
        .from('catalog_items')
        .select('*')
        .in('id', allItemIds);
      items = catalogItems || [];
    }

    const itemMap = new Map(items.map((i: any) => [i.id, i]));

    let result = (data || []).flatMap((r: any) =>
      (r.item_ids || []).map((id: string) => itemMap.get(id)).filter(Boolean)
    );

    if (limit) {
      result = result.slice(0, limit);
    }

    return reply.send(result);
  } catch (err: any) {
    reply.status(500).send({ error: err.message });
  }
});

// Recommendation event tracking
server.post('/api/recommendations/event', async (request, reply) => {
  try {
    const user = await getUser(request);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const body = z.object({
      tracked_user_id: z.string(),
      strategy: z.string().optional(),
      item_id: z.string().optional(),
      event_type: z.enum(['SHOWN', 'CLICKED', 'PURCHASED']),
      page_url: z.string().optional(),
    }).parse(request.body);

    const { error } = await supabase.from('recommendation_events').insert({
      customer_id: user.id,
      tracked_user_id: body.tracked_user_id,
      strategy: body.strategy || null,
      item_id: body.item_id || null,
      event_type: body.event_type,
      page_url: body.page_url || null,
    });

    if (error) throw error;
    return reply.send({ success: true });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({ error: 'Invalid request', details: err.errors });
    }
    reply.status(500).send({ error: err.message });
  }
});

// Recommendation analytics
server.get('/api/analytics/recommendations', async (request, reply) => {
  try {
    const user = await getUser(request);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Total shown, clicks, purchases
    const { data: allEvents } = await supabase
      .from('recommendation_events')
      .select('event_type, strategy, item_id')
      .eq('customer_id', user.id)
      .gte('created_at', thirtyDaysAgo);

    const events = allEvents || [];
    const totalShown = events.filter(e => e.event_type === 'SHOWN').length;
    const totalClicks = events.filter(e => e.event_type === 'CLICKED').length;
    const totalPurchases = events.filter(e => e.event_type === 'PURCHASED').length;
    const overallCtr = totalShown > 0 ? Math.round((totalClicks / totalShown) * 10000) / 100 : 0;

    // CTR per strategy
    const strategyMap = new Map<string, { shown: number; clicks: number }>();
    for (const ev of events) {
      if (!ev.strategy) continue;
      if (!strategyMap.has(ev.strategy)) {
        strategyMap.set(ev.strategy, { shown: 0, clicks: 0 });
      }
      const entry = strategyMap.get(ev.strategy)!;
      if (ev.event_type === 'SHOWN') entry.shown++;
      if (ev.event_type === 'CLICKED') entry.clicks++;
    }

    const ctrByStrategy = [...strategyMap.entries()].map(([strategy, counts]) => ({
      strategy,
      shown: counts.shown,
      clicks: counts.clicks,
      ctr: counts.shown > 0 ? Math.round((counts.clicks / counts.shown) * 10000) / 100 : 0,
    }));

    // Top performing items (most clicked)
    const clickCounts = new Map<string, number>();
    for (const ev of events) {
      if (ev.event_type === 'CLICKED' && ev.item_id) {
        clickCounts.set(ev.item_id, (clickCounts.get(ev.item_id) || 0) + 1);
      }
    }

    const topItemIds = [...clickCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id]) => id);

    let topItems: any[] = [];
    if (topItemIds.length > 0) {
      const { data: catalogItems } = await supabase
        .from('catalog_items')
        .select('id, external_id, name, category, price, image_url')
        .in('id', topItemIds);
      topItems = (catalogItems || []).map(item => ({
        ...item,
        clicks: clickCounts.get(item.id) || 0,
      })).sort((a, b) => b.clicks - a.clicks);
    }

    // Revenue attributed from purchase events
    const purchaseItemIds = [...new Set(events.filter(e => e.event_type === 'PURCHASED' && e.item_id).map(e => e.item_id!))];

    let attributedRevenue = 0;
    if (purchaseItemIds.length > 0) {
      const { data: purchaseEvents } = await supabase
        .from('events')
        .select('revenue_value')
        .eq('customer_id', user.id)
        .eq('is_revenue_event', true)
        .in('item_id', purchaseItemIds)
        .gte('created_at', thirtyDaysAgo);

      attributedRevenue = (purchaseEvents || []).reduce(
        (sum: number, e: any) => sum + (Number(e.revenue_value) || 0), 0
      );
    }

    return reply.send({
      total_shown: totalShown,
      total_clicks: totalClicks,
      total_purchases: totalPurchases,
      overall_ctr: overallCtr,
      ctr_by_strategy: ctrByStrategy,
      top_items: topItems,
      attributed_revenue: attributedRevenue,
    });
  } catch (err: any) {
    reply.status(500).send({ error: err.message });
  }
});

// =====================================================
// ANALYTICS - REVENUE
// =====================================================
server.get('/api/analytics/revenue', async (request, reply) => {
  try {
    const user = await getUser(request);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Total revenue last 30 days
    const { data: revenueEvents } = await supabase
      .from('events')
      .select('revenue_value, currency, created_at')
      .eq('customer_id', user.id)
      .eq('is_revenue_event', true)
      .gte('created_at', thirtyDaysAgo);

    const totalRevenue = (revenueEvents || []).reduce((sum: number, e: any) => sum + (Number(e.revenue_value) || 0), 0);
    const revenueEventCount = (revenueEvents || []).length;
    const avgOrderValue = revenueEventCount > 0 ? totalRevenue / revenueEventCount : 0;

    // MRR from subscription.upgraded
    const { data: upgradeEvents } = await supabase
      .from('events')
      .select('revenue_value, created_at')
      .eq('customer_id', user.id)
      .eq('name', 'subscription.upgraded')
      .gte('created_at', thirtyDaysAgo);

    const mrr = (upgradeEvents || []).reduce((sum: number, e: any) => sum + (Number(e.revenue_value) || 0), 0);

    // Revenue per workflow (7-day attribution)
    const { data: workflows } = await supabase
      .from('workflows')
      .select('id, name')
      .eq('customer_id', user.id);

    const workflowRevenue = [];
    const workflowMessages: any[] = [];

    if (workflows) {
      for (const wf of workflows) {
        const { data: msgs } = await supabase
          .from('user_messages')
          .select('id, tracked_user_email, created_at')
          .eq('workflow_id', wf.id);

        if (msgs) {
          for (const msg of msgs) {
            workflowMessages.push({ ...msg, workflow_id: wf.id, workflow_name: wf.name });

            const msgTime = new Date(msg.created_at).getTime();
            const windowEnd = new Date(msgTime + 7 * 24 * 60 * 60 * 1000).toISOString();
            const msgTimeStr = msg.created_at;

            const { data: attributed } = await supabase
              .from('events')
              .select('revenue_value')
              .eq('customer_id', user.id)
              .eq('tracked_user_email', msg.tracked_user_email)
              .eq('is_revenue_event', true)
              .gte('created_at', msgTimeStr)
              .lte('created_at', windowEnd);

            const attributedRevenue = (attributed || []).reduce((s: number, e: any) => s + (Number(e.revenue_value) || 0), 0);

            if (attributedRevenue > 0) {
              await supabase
                .from('user_messages')
                .update({ attributed_revenue: attributedRevenue })
                .eq('id', msg.id);
            }
          }
        }
      }
    }

    // Aggregate per workflow
    const wfMap = new Map<string, { name: string; messages: number; revenue: number }>();
    for (const wm of workflowMessages) {
      if (!wfMap.has(wm.workflow_id)) {
        wfMap.set(wm.workflow_id, { name: wm.workflow_name, messages: 0, revenue: 0 });
      }
      const entry = wfMap.get(wm.workflow_id)!;
      entry.messages++;
      entry.revenue += Number(wm.attributed_revenue || 0);
    }

    for (const [wfId, entry] of wfMap) {
      workflowRevenue.push({
        workflow_id: wfId,
        workflow_name: entry.name,
        messages_sent: entry.messages,
        revenue_events: 0,
        revenue_attributed: entry.revenue,
        revenue_per_message: entry.messages > 0 ? entry.revenue / entry.messages : 0,
      });
    }

    // AOV trend (12 weeks)
    const aovTrend = [];
    for (let w = 0; w < 12; w++) {
      const weekStart = new Date(Date.now() - (w + 1) * 7 * 24 * 60 * 60 * 1000).toISOString();
      const weekEnd = new Date(Date.now() - w * 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: weekEvents } = await supabase
        .from('events')
        .select('revenue_value')
        .eq('customer_id', user.id)
        .eq('is_revenue_event', true)
        .gte('created_at', weekStart)
        .lt('created_at', weekEnd);

      const weekCount = (weekEvents || []).length;
      const weekRevenue = (weekEvents || []).reduce((s: number, e: any) => s + (Number(e.revenue_value) || 0), 0);

      aovTrend.unshift({
        week: `W${12 - w}`,
        aov: weekCount > 0 ? Math.round((weekRevenue / weekCount) * 100) / 100 : 0,
        revenue: Math.round(weekRevenue * 100) / 100,
      });
    }

    return reply.send({
      total_revenue: totalRevenue,
      avg_order_value: avgOrderValue,
      mrr,
      revenue_per_workflow: workflowRevenue,
      aov_trend: aovTrend,
    });
  } catch (err: any) {
    reply.status(500).send({ error: err.message });
  }
});

// =====================================================
// EXPERIMENTS API
// =====================================================
server.get('/api/experiments', async (request, reply) => {
  try {
    const user = await getUser(request);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { data: experiments, error } = await supabase
      .from('experiments')
      .select('*')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Enrich with summary stats
    const enriched = await Promise.all((experiments || []).map(async (exp) => {
      const { data: assigns } = await supabase
        .from('experiment_assignments')
        .select('variant_id, converted')
        .eq('experiment_id', exp.id);

      const totalUsers = assigns?.length || 0;
      const totalConversions = assigns?.filter(a => a.converted).length || 0;

      // Per-variant breakdown
      const variantStats: Record<string, { users: number; conversions: number }> = {};
      for (const a of assigns || []) {
        if (!variantStats[a.variant_id]) variantStats[a.variant_id] = { users: 0, conversions: 0 };
        variantStats[a.variant_id].users++;
        if (a.converted) variantStats[a.variant_id].conversions++;
      }

      let winner: string | null = null;
      if (exp.status === 'COMPLETED' && exp.winner_variant_id) {
        winner = exp.winner_variant_id;
      } else if (totalUsers > 0) {
        const statsResults = Object.entries(variantStats).map(([id, s]) => ({
          label: id, users: s.users, conversions: s.conversions,
        }));
        if (statsResults.length >= 2) {
          const sig = chiSquaredTest(statsResults);
          if (sig.is_significant) {
            const best = statsResults.reduce((a, b) =>
              (a.conversions / a.users) > (b.conversions / b.users) ? a : b
            );
            winner = best.label;
          }
        }
      }

      return {
        ...exp,
        summary: { total_users: totalUsers, total_conversions: totalConversions, winner },
      };
    }));

    return reply.send(enriched);
  } catch (err: any) {
    reply.status(500).send({ error: err.message });
  }
});

server.get('/api/experiments/:id', async (request, reply) => {
  try {
    const { id } = request.params as { id: string };
    const user = await getUser(request);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { data: exp, error } = await supabase
      .from('experiments')
      .select('*')
      .eq('id', id)
      .eq('customer_id', user.id)
      .single();

    if (error) return reply.status(404).send({ error: 'Experiment not found' });

    const { data: assigns } = await supabase
      .from('experiment_assignments')
      .select('variant_id, converted, converted_at, assigned_at, tracked_user_id')
      .eq('experiment_id', id);

    // Per-variant stats
    const totalCount = assigns?.length || 0;
    const variantMap: Record<string, {
      users: number; conversions: number; conversion_rate: number;
    }> = {};

    for (const a of assigns || []) {
      if (!variantMap[a.variant_id]) {
        variantMap[a.variant_id] = { users: 0, conversions: 0, conversion_rate: 0 };
      }
      variantMap[a.variant_id].users++;
      if (a.converted) variantMap[a.variant_id].conversions++;
    }

    const variantsArray = Object.entries(variantMap).map(([id, s]) => ({
      variant_id: id,
      users: s.users,
      conversions: s.conversions,
      conversion_rate: s.users > 0 ? Math.round((s.conversions / s.users) * 10000) / 100 : 0,
    }));

    // Uplift vs control
    const control = variantsArray.find(v => v.variant_id === 'A');
    const enrichedVariants = variantsArray.map(v => ({
      ...v,
      uplift_vs_control: control && control.users > 0 && v.variant_id !== 'A'
        ? Math.round(((v.conversion_rate - control.conversion_rate) / control.conversion_rate) * 10000) / 100
        : 0,
    }));

    // Significance
    const significance = totalCount > 0 && variantsArray.length >= 2
      ? chiSquaredTest(variantsArray.map(v => ({ label: v.variant_id, users: v.users, conversions: v.conversions })))
      : { chi_square: 0, p_value: 1, confidence_level: 0, is_significant: false };

    // Timeline data (conversion rate over time per variant)
    const timelineData: { date: string; data: Record<string, { users: number; conversions: number; rate: number }> }[] = [];

    if (assigns && assigns.length > 0) {
      const sorted = [...assigns].sort((a, b) =>
        new Date(a.assigned_at).getTime() - new Date(b.assigned_at).getTime()
      );
      const startDate = new Date(sorted[0].assigned_at);
      const endDate = new Date(assigns.length > 0 ? sorted[sorted.length - 1].assigned_at : startDate);

      // Daily buckets
      const dayBuckets: Record<string, Record<string, { users: Set<string>; conversions: number }>> = {};
      for (const a of assigns) {
        const d = new Date(a.assigned_at).toISOString().slice(0, 10);
        if (!dayBuckets[d]) dayBuckets[d] = {};
        if (!dayBuckets[d][a.variant_id]) dayBuckets[d][a.variant_id] = { users: new Set(), conversions: 0 };
        dayBuckets[d][a.variant_id].users.add(a.tracked_user_id);
        if (a.converted) dayBuckets[d][a.variant_id].conversions++;
      }

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateKey = d.toISOString().slice(0, 10);
        const dayData: Record<string, { users: number; conversions: number; rate: number }> = {};
        for (const vId of Object.keys(variantMap)) {
          const bucket = dayBuckets[dateKey]?.[vId];
          const users = bucket?.users.size || 0;
          const conversions = bucket?.conversions || 0;
          dayData[vId] = { users, conversions, rate: users > 0 ? conversions / users : 0 };
        }
        timelineData.push({ date: dateKey, data: dayData });
      }
    }

    return reply.send({
      ...exp,
      variants: enrichedVariants,
      assignments: assigns || [],
      significance,
      timeline: timelineData,
    });
  } catch (err: any) {
    reply.status(500).send({ error: err.message });
  }
});

server.post('/api/experiments', async (request, reply) => {
  try {
    const body = z.object({
      name: z.string().min(1),
      type: z.enum(['WORKFLOW', 'PERSONALIZATION']),
      source_id: z.string(),
      variants: z.array(z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
      })),
      traffic_split: z.record(z.number()),
      goal_event: z.string(),
    }).parse(request.body);

    const user = await getUser(request);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    // Validate traffic split sums to 100
    const totalSplit = Object.values(body.traffic_split).reduce((s: number, v: any) => s + Number(v), 0);
    if (Math.round(totalSplit) !== 100) {
      return reply.status(400).send({ error: 'Traffic split must sum to 100' });
    }

    const { data, error } = await supabase
      .from('experiments')
      .insert({
        customer_id: user.id,
        name: body.name,
        type: body.type,
        source_id: body.source_id,
        status: 'DRAFT',
        variants: body.variants,
        traffic_split: body.traffic_split,
        goal_event: body.goal_event,
      })
      .select()
      .single();

    if (error) throw error;
    return reply.status(201).send(data);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({ error: 'Invalid input', details: err.errors });
    }
    reply.status(500).send({ error: err.message });
  }
});

server.put('/api/experiments/:id', async (request, reply) => {
  try {
    const { id } = request.params as { id: string };
    const body = z.object({
      name: z.string().optional(),
      status: z.enum(['DRAFT', 'RUNNING', 'PAUSED', 'COMPLETED']).optional(),
      variants: z.array(z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
      })).optional(),
      traffic_split: z.record(z.number()).optional(),
      goal_event: z.string().optional(),
    }).parse(request.body);

    const user = await getUser(request);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const updateData: Record<string, unknown> = { ...body, updated_at: new Date().toISOString() };
    if (body.status === 'RUNNING') updateData.started_at = new Date().toISOString();
    if (body.status === 'COMPLETED') updateData.ended_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('experiments')
      .update(updateData)
      .eq('id', id)
      .eq('customer_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return reply.send(data);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({ error: 'Invalid input', details: err.errors });
    }
    reply.status(500).send({ error: err.message });
  }
});

server.post('/api/experiments/:id/declare-winner', async (request, reply) => {
  try {
    const { id } = request.params as { id: string };
    const body = z.object({
      variant_id: z.string(),
      auto_route: z.boolean().optional(),
    }).parse(request.body);

    const user = await getUser(request);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { error } = await supabase
      .from('experiments')
      .update({
        winner_variant_id: body.variant_id,
        status: 'COMPLETED',
        ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('customer_id', user.id);

    if (error) throw error;

    if (body.auto_route) {
      // Set traffic split to 100% on winner
      const split: Record<string, number> = {};
      const { data: exp } = await supabase.from('experiments').select('variants').eq('id', id).single();
      if (exp) {
        for (const v of (exp.variants as any[]) || []) {
          split[v.id] = v.id === body.variant_id ? 100 : 0;
        }
        await supabase.from('experiments').update({ traffic_split: split, updated_at: new Date().toISOString() }).eq('id', id);
      }
    }

    return reply.send({ message: 'Winner declared' });
  } catch (err: any) {
    reply.status(500).send({ error: err.message });
  }
});

server.post('/api/experiments/:id/assign', async (request, reply) => {
  try {
    const { id } = request.params as { id: string };
    const body = z.object({
      tracked_user_id: z.string(),
    }).parse(request.body);

    const user = await getUser(request);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    // Check existing assignment
    const { data: existing } = await supabase
      .from('experiment_assignments')
      .select('variant_id')
      .eq('experiment_id', id)
      .eq('tracked_user_id', body.tracked_user_id)
      .maybeSingle();

    if (existing) {
      return reply.send({ variant_id: existing.variant_id, existing: true });
    }

    // Get experiment for traffic split
    const { data: exp } = await supabase
      .from('experiments')
      .select('traffic_split')
      .eq('id', id)
      .single();

    if (!exp) return reply.status(404).send({ error: 'Experiment not found' });

    // Deterministic hash assignment
    const hash = hashUserToVariant(body.tracked_user_id, id, exp.traffic_split as Record<string, number>);

    const { data, error } = await supabase
      .from('experiment_assignments')
      .insert({
        experiment_id: id,
        tracked_user_id: body.tracked_user_id,
        variant_id: hash,
      })
      .select()
      .single();

    if (error) throw error;
    return reply.status(201).send({ variant_id: data.variant_id, existing: false });
  } catch (err: any) {
    reply.status(500).send({ error: err.message });
  }
});

server.post('/api/experiments/:id/convert', async (request, reply) => {
  try {
    const { id } = request.params as { id: string };
    const body = z.object({
      tracked_user_id: z.string(),
    }).parse(request.body);

    const user = await getUser(request);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { data, error } = await supabase
      .from('experiment_assignments')
      .update({ converted: true, converted_at: new Date().toISOString() })
      .eq('experiment_id', id)
      .eq('tracked_user_id', body.tracked_user_id)
      .eq('converted', false)
      .select();

    if (error) throw error;
    return reply.send({ updated: (data || []).length });
  } catch (err: any) {
    reply.status(500).send({ error: err.message });
  }
});

// Deterministic hash: maps user_id + experiment_id to a variant based on traffic split
function hashUserToVariant(userId: string, experimentId: string, trafficSplit: Record<string, number>): string {
  // Simple but deterministic hash
  const combined = userId + experimentId;
  let hashVal = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hashVal = ((hashVal << 5) - hashVal) + char;
    hashVal = hashVal & hashVal; // Convert to 32bit integer
  }
  const absHash = Math.abs(hashVal);
  const bucket = absHash % 100;

  // Map bucket to variant based on cumulative traffic split
  let cumulative = 0;
  const sortedVariants = Object.entries(trafficSplit).sort();
  for (const [variantId, percentage] of sortedVariants) {
    cumulative += percentage;
    if (bucket < cumulative) return variantId;
  }

  // Fallback to first variant
  return sortedVariants[0]?.[0] || 'A';
}

// Start server
const start = async () => {
  await server.register(cors, { origin: true });
  await server.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });

  registerUserImportRoutes(server);
  registerUserExportRoutes(server);
  registerCatalogImportRoutes(server);

  try {
    // Register background scheduled jobs
    await registerRepeatedJobs();

    await server.listen({ port: 3001 });
    console.log(`Server listening on http://localhost:3001`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();