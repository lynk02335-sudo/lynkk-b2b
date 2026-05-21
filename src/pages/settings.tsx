import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useCustomer } from '@/hooks/useCustomer'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Check, Copy, Loader2, AlertTriangle, Eye, EyeOff, ExternalLink, Save } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

type WhatsAppProvider = '360dialog' | 'twilio' | 'wati' | 'aisensy' | 'interakt' | 'meta_cloud' | 'other'

export function SettingsPage() {
  const { customer, loading: customerLoading, error: customerError, refetch } = useCustomer()
  const { toast } = useToast()
  
  // Form states
  const [productName, setProductName] = useState('')
  const [slackWebhook, setSlackWebhook] = useState('')
  const [resendKey, setResendKey] = useState('')
  
  // WhatsApp States
  const [waProvider, setWaProvider] = useState<WhatsAppProvider>('360dialog')
  const [waPhoneNumber, setWaPhoneNumber] = useState('')
  const [waApiKey, setWaApiKey] = useState('')
  const [waAccountSid, setWaAccountSid] = useState('')
  const [waAuthToken, setWaAuthToken] = useState('')
  const [waEndpointUrl, setWaEndpointUrl] = useState('')
  const [waApiToken, setWaApiToken] = useState('')
  const [waAccessToken, setWaAccessToken] = useState('')
  const [waPhoneNumberId, setWaPhoneNumberId] = useState('')

  // SMS (Twilio) States
  const [twilioAccountSid, setTwilioAccountSid] = useState('')
  const [twilioAuthToken, setTwilioAuthToken] = useState('')
  const [twilioPhoneNumber, setTwilioPhoneNumber] = useState('')
  const [twilioMessagingServiceSid, setTwilioMessagingServiceSid] = useState('')

  // Push (FCM) States
  const [fcmServerKey, setFcmServerKey] = useState('')
  const [vapidPublicKey, setVapidPublicKey] = useState('')
  const [vapidPrivateKey, setVapidPrivateKey] = useState('')
  
  // UI states
  const [fromEmail, setFromEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [copiedApiKey, setCopiedApiKey] = useState(false)
  const [sendingTestSms, setSendingTestSms] = useState(false)

  const isSmsConnected = !!(twilioAccountSid && twilioAuthToken && twilioPhoneNumber)

  const handleSendTestSms = async () => {
    if (!customer?.email) {
      toast({ variant: "destructive", title: "Error", description: "No email on file to send test SMS" })
      return
    }
    setSendingTestSms(true)
    try {
      const res = await fetch('http://localhost:3001/api/settings/sms/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_sid: twilioAccountSid,
          auth_token: twilioAuthToken,
          phone_number: twilioPhoneNumber,
          to: customer.phone || customer.email,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send test SMS')
      toast({ title: "Success", description: "Test SMS sent successfully!" })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message })
    } finally {
      setSendingTestSms(false)
    }
  }
  const [regenerateOpen, setRegenerateOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState('')
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})

  const togglePassword = (field: string) => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }))
  }

  // Pre-fill fields and handle missing API key
  useEffect(() => {
    if (customer) {
      setProductName(customer.product_name || '')
      setSlackWebhook(customer.slack_webhook_url || '')
      setResendKey(customer.resend_api_key || '')
      setFromEmail(customer.from_email || '')

      const config = customer.whatsapp_config || {}
      setWaProvider(config.provider || '360dialog')
      setWaPhoneNumber(config.phone_number || '')
      setWaApiKey(config.api_key || '')
      setWaAccountSid(config.account_sid || '')
      setWaAuthToken(config.auth_token || '')
      setWaEndpointUrl(config.endpoint_url || '')
      setWaApiToken(config.api_token || '')
      setWaAccessToken(config.access_token || '')
      setWaPhoneNumberId(config.phone_number_id || '')

      const smsConfig = customer.sms_config || {}
      setTwilioAccountSid(smsConfig.account_sid || '')
      setTwilioAuthToken(smsConfig.auth_token || '')
      setTwilioPhoneNumber(smsConfig.phone_number || '')
      setTwilioMessagingServiceSid(smsConfig.messaging_service_sid || '')

      const pushConfig = customer.push_config || {}
      setFcmServerKey(pushConfig.fcm_server_key || '')
      setVapidPublicKey(pushConfig.vapid_public || '')
      setVapidPrivateKey(pushConfig.vapid_private || '')

      // If API key is missing, generate one
      if (!customer.api_key) {
        const ensureKey = async () => {
          const newKey = crypto.randomUUID()
          await supabase
            .from('customers')
            .update({ api_key: newKey })
            .eq('id', customer.id)
        }
        ensureKey()
      }
    }
  }, [customer])

  const hasChanges = (() => {
    if (!customer) return false
    
    const config = customer.whatsapp_config || {}
    const isWaChanged = 
      waProvider !== (config.provider || '360dialog') ||
      waPhoneNumber !== (config.phone_number || '') ||
      waApiKey !== (config.api_key || '') ||
      waAccountSid !== (config.account_sid || '') ||
      waAuthToken !== (config.auth_token || '') ||
      waEndpointUrl !== (config.endpoint_url || '') ||
      waApiToken !== (config.api_token || '') ||
      waAccessToken !== (config.access_token || '') ||
      waPhoneNumberId !== (config.phone_number_id || '')

    const smsConfig = customer.sms_config || {}
    const isSmsChanged = 
      twilioAccountSid !== (smsConfig.account_sid || '') ||
      twilioAuthToken !== (smsConfig.auth_token || '') ||
      twilioPhoneNumber !== (smsConfig.phone_number || '') ||
      twilioMessagingServiceSid !== (smsConfig.messaging_service_sid || '')

    const pushConfig = customer.push_config || {}
    const isPushChanged = 
      fcmServerKey !== (pushConfig.fcm_server_key || '') ||
      vapidPublicKey !== (pushConfig.vapid_public || '') ||
      vapidPrivateKey !== (pushConfig.vapid_private || '')

    return (
      productName !== (customer.product_name || '') ||
      slackWebhook !== (customer.slack_webhook_url || '') ||
      resendKey !== (customer.resend_api_key || '') ||
      fromEmail !== (customer.from_email || '') ||
      isWaChanged ||
      isSmsChanged ||
      isPushChanged
    )
  })()

  const validateWhatsApp = () => {
    if (!waPhoneNumber.startsWith('+') || !/^\+\d+$/.test(waPhoneNumber)) {
      toast({ variant: "destructive", title: "Error", description: "WhatsApp Number must start with + and contain only digits" })
        return false
    }

    const requiredFields: Record<WhatsAppProvider, string[]> = {
      '360dialog': ['api_key'],
      'twilio': ['account_sid', 'auth_token'],
      'wati': ['endpoint_url', 'api_token'],
      'aisensy': ['api_key'],
      'interakt': ['api_key'],
      'meta_cloud': ['access_token', 'phone_number_id'],
      'other': ['endpoint_url', 'api_key']
    }

    const fields = requiredFields[waProvider]
    for (const f of fields) {
      const val = f === 'api_key' ? waApiKey :
                  f === 'account_sid' ? waAccountSid :
                  f === 'auth_token' ? waAuthToken :
                  f === 'endpoint_url' ? waEndpointUrl :
                  f === 'api_token' ? waApiToken :
                  f === 'access_token' ? waAccessToken :
                  f === 'phone_number_id' ? waPhoneNumberId : ''
      if (!val) {
        toast({ variant: "destructive", title: "Error", description: `${f.replace('_', ' ').toUpperCase()} is required` })
        return false
      }
    }

    return true
  }

  const handleSaveAll = async () => {
    if (!customer) return
    setSaving(true)

    // Validation
    if (!productName.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Product Name is required" })
      setSaving(false)
      return
    }

    if (slackWebhook && !slackWebhook.startsWith('https://')) {
      toast({ variant: "destructive", title: "Error", description: "Slack Webhook URL must start with https://" })
      setSaving(false)
      return
    }

    if (!validateWhatsApp()) {
      toast({ variant: "destructive", title: "Error", description: "Please check your WhatsApp configuration" })
      setSaving(false)
      return
    }

    const whatsapp_config = {
      provider: waProvider,
      phone_number: waPhoneNumber,
      api_key: waApiKey,
      account_sid: waAccountSid,
      auth_token: waAuthToken,
      endpoint_url: waEndpointUrl,
      api_token: waApiToken,
      access_token: waAccessToken,
      phone_number_id: waPhoneNumberId
    }

    const sms_config = {
      account_sid: twilioAccountSid,
      auth_token: twilioAuthToken,
      phone_number: twilioPhoneNumber,
      messaging_service_sid: twilioMessagingServiceSid
    }

    const push_config = {
      fcm_server_key: fcmServerKey,
      vapid_public: vapidPublicKey,
      vapid_private: vapidPrivateKey
    }

    const payload = {
      product_name: productName,
      whatsapp_config,
      sms_config,
      push_config,
      slack_webhook_url: slackWebhook,
      resend_api_key: resendKey,
      from_email: fromEmail || null
    }

    const { error } = await supabase
      .from('customers')
      .update(payload)
      .eq('id', customer.id)

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message
      })
    } else {
      toast({
        title: "Success",
        description: "Settings saved successfully"
      })
    }
    setSaving(false)
  }

  const handleRegenerateKey = async () => {
    if (confirmDelete !== 'DELETE' || !customer) return
    
    setSaving(true)
    const newKey = crypto.randomUUID()
    
    try {
      const { error } = await supabase
        .from('customers')
        .update({ api_key: newKey })
        .eq('id', customer.id)

      if (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message
        })
      } else {
        toast({
          title: "Success",
          description: "API key regenerated successfully"
        })
        setRegenerateOpen(false)
        setConfirmDelete('')
        refetch()
      }
    } catch {
      // error already toasted above
    } finally {
      setSaving(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    if (!text) return
    await navigator.clipboard.writeText(text)
    setCopiedApiKey(true)
    toast({
      title: "Copied!",
      description: "API key copied to clipboard"
    })
    setTimeout(() => setCopiedApiKey(false), 2000)
  }

  if (customerError) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-96 text-center p-8">
          <AlertTriangle className="w-16 h-16 text-yellow-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Something went wrong. Please refresh the page.</h2>
          <Button onClick={() => window.location.reload()} variant="outline">
            Refresh
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  const providerDocs: Record<string, string> = {
    '360dialog': 'https://docs.360dialog.com',
    'twilio': 'https://console.twilio.com',
    'wati': 'https://docs.wati.io',
    'aisensy': 'https://aisensy.com/docs',
    'interakt': 'https://developer.interakt.ai',
    'meta_cloud': 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started'
  }

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account and integration settings</p>
        </div>

        {customerLoading ? (
          <div className="space-y-8">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full" />)}
          </div>
        ) : (
          <div className="space-y-8 pb-24">
            <Card>
              <CardHeader>
            <CardTitle>Product Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Product Name</Label>
              {customerLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <>
                  <Input
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="My Awesome Product"
                  />
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* API Key Card */}
        <Card>
          <CardHeader>
            <CardTitle>API Key</CardTitle>
            <CardDescription>Use this key to install the tracker on your website</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {customerLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : (
              <div className="flex items-center gap-2">
                <code className="flex-1 p-3 bg-gray-100 rounded text-sm font-mono break-all">
                  {customer?.api_key}
                </code>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => copyToClipboard(customer?.api_key || '')}
                >
                  {copiedApiKey ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            )}
            <Button 
              variant="outline" 
              onClick={() => setRegenerateOpen(true)}
              disabled={customerLoading}
            >
              Regenerate Key
            </Button>
          </CardContent>
        </Card>

        {/* Channel Configuration Card */}
        <Card>
          <CardHeader>
            <CardTitle>Channel Configuration</CardTitle>
            <CardDescription>Configure your integration settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* WhatsApp Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">WhatsApp Configuration</h3>
              
              <div className="space-y-2">
                <Label>WhatsApp Provider</Label>
                {customerLoading ? <Skeleton className="h-10 w-full" /> : (
                  <Select value={waProvider} onValueChange={(v: WhatsAppProvider) => setWaProvider(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="360dialog">360dialog</SelectItem>
                      <SelectItem value="twilio">Twilio</SelectItem>
                      <SelectItem value="wati">Wati</SelectItem>
                      <SelectItem value="aisensy">AiSensy</SelectItem>
                      <SelectItem value="interakt">Interakt</SelectItem>
                      <SelectItem value="meta_cloud">Meta Cloud API (Official)</SelectItem>
                      <SelectItem value="other">Other (Custom API)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Dynamic WhatsApp Fields */}
              {!customerLoading && (
                <div className="space-y-4 border-l-2 border-primary/10 pl-4 py-2">
                  <div className="space-y-2">
                    <Label>WhatsApp Number</Label>
                    <Input 
                      value={waPhoneNumber} 
                      onChange={(e) => setWaPhoneNumber(e.target.value)}
                      placeholder="+1234567890" 
                    />
                  </div>

                  {waProvider === '360dialog' && (
                    <PasswordField label="360dialog API Key" value={waApiKey} onChange={setWaApiKey} show={showPasswords.wa_api} onToggle={() => togglePassword('wa_api')} />
                  )}

                  {waProvider === 'twilio' && (
                    <>
                      <PasswordField label="Twilio Account SID" value={waAccountSid} onChange={setWaAccountSid} show={showPasswords.wa_sid} onToggle={() => togglePassword('wa_sid')} />
                      <PasswordField label="Twilio Auth Token" value={waAuthToken} onChange={setWaAuthToken} show={showPasswords.wa_token} onToggle={() => togglePassword('wa_token')} />
                    </>
                  )}

                  {waProvider === 'wati' && (
                    <>
                      <div className="space-y-2">
                        <Label>Wati API Endpoint</Label>
                        <Input value={waEndpointUrl} onChange={(e) => setWaEndpointUrl(e.target.value)} placeholder="https://live-server-xxxx.wati.io" />
                      </div>
                      <PasswordField label="Wati API Token" value={waApiToken} onChange={setWaApiToken} show={showPasswords.wa_token} onToggle={() => togglePassword('wa_token')} />
                    </>
                  )}

                  {(waProvider === 'aisensy' || waProvider === 'interakt') && (
                    <PasswordField label={`${waProvider.charAt(0).toUpperCase() + waProvider.slice(1)} API Key`} value={waApiKey} onChange={setWaApiKey} show={showPasswords.wa_api} onToggle={() => togglePassword('wa_api')} />
                  )}

                  {waProvider === 'meta_cloud' && (
                    <>
                      <PasswordField label="Access Token" value={waAccessToken} onChange={setWaAccessToken} show={showPasswords.wa_meta_token} onToggle={() => togglePassword('wa_meta_token')} />
                      <div className="space-y-2">
                        <Label>Phone Number ID</Label>
                        <Input
                          value={waPhoneNumberId}
                          onChange={(e) => setWaPhoneNumberId(e.target.value)}
                          placeholder="123456789012345"
                        />
                        <p className="text-xs text-muted-foreground">
                          Found in Meta Business Manager → WhatsApp → API Setup. This is the numeric ID, not the phone number itself.
                        </p>
                      </div>
                    </>
                  )}

                  {waProvider === 'other' && (
                    <>
                      <div className="space-y-2">
                        <Label>API Endpoint URL</Label>
                        <Input value={waEndpointUrl} onChange={(e) => setWaEndpointUrl(e.target.value)} placeholder="https://your-api.com/send" />
                      </div>
                      <PasswordField label="API Key / Token" value={waApiKey} onChange={setWaApiKey} show={showPasswords.wa_api} onToggle={() => togglePassword('wa_api')} />
                      <p className="text-xs text-muted-foreground">
                        Your endpoint must accept a POST request with JSON body: <code>{'{ to, message }'}</code> and return <code>{'{ success: true }'}</code>
                      </p>
                    </>
                  )}

                  {providerDocs[waProvider] && (
                    <a href={providerDocs[waProvider]} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline">
                      How to get your {waProvider} API key <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}
            </div>

            <hr className="my-6" />

            {/* Email Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Email Configuration</h3>
              <div className="space-y-2">
                <Label>Resend API Key</Label>
                {customerLoading ? <Skeleton className="h-10 w-full" /> : (
                  <PasswordField label="" noLabel value={resendKey} onChange={setResendKey} show={showPasswords.resend} onToggle={() => togglePassword('resend')} />
                )}
              </div>
              <div className="space-y-2">
                <Label>From Email Address</Label>
                {customerLoading ? <Skeleton className="h-10 w-full" /> : (
                  <Input
                    type="email"
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                    placeholder="hello@yourcompany.com"
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  This is the address your users will see emails from. Before setting this,{' '}
                  <a
                    href="https://resend.com/domains"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground"
                  >
                    verify your domain in Resend
                  </a>
                  {' '}by adding the DNS records they provide. Emails will fail silently if the domain isn't verified.
                </p>
              </div>
            </div>

            <hr className="my-6" />

            {/* Slack Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Slack Configuration</h3>
              <div className="space-y-2">
                <Label>Slack Webhook URL</Label>
                {customerLoading ? <Skeleton className="h-10 w-full" /> : (
                  <Input
                    value={slackWebhook}
                    onChange={(e) => setSlackWebhook(e.target.value)}
                    placeholder="https://hooks.slack.com/services/..."
                  />
                )}
              </div>
            </div>

            <hr className="my-6" />

            {/* SMS (Twilio) Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">SMS Configuration (Twilio)</h3>
              {customerLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <div className="space-y-4 border-l-2 border-primary/10 pl-4 py-2">
                  <div className="space-y-2">
                    <Label>Account SID</Label>
                    <Input 
                      value={twilioAccountSid} 
                      onChange={(e) => setTwilioAccountSid(e.target.value)}
                      placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    />
                  </div>
                  <PasswordField 
                    label="Auth Token" 
                    value={twilioAuthToken} 
                    onChange={setTwilioAuthToken} 
                    show={showPasswords.twilio_token} 
                    onToggle={() => togglePassword('twilio_token')} 
                  />
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input 
                      value={twilioPhoneNumber} 
                      onChange={(e) => setTwilioPhoneNumber(e.target.value)}
                      placeholder="+1234567890"
                    />
                    <p className="text-xs text-muted-foreground">Your Twilio phone number (from Twilio console)</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Messaging Service SID (optional)</Label>
                    <Input 
                      value={twilioMessagingServiceSid} 
                      onChange={(e) => setTwilioMessagingServiceSid(e.target.value)}
                      placeholder="MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    />
                    <p className="text-xs text-muted-foreground">Use this instead of phone number for bulk messaging</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSendTestSms}
                      disabled={!isSmsConnected || sendingTestSms}
                    >
                      {sendingTestSms ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : null}
                      Send Test SMS
                    </Button>
                    <span className={cn(
                      "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium",
                      isSmsConnected
                        ? "bg-green-100 text-green-700"
                        : "bg-slate-100 text-slate-500"
                    )}>
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        isSmsConnected ? "bg-green-500" : "bg-slate-400"
                      )} />
                      {isSmsConnected ? 'Connected' : 'Not configured'}
                    </span>
                  </div>
                  <a 
                    href="https://console.twilio.com" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-xs text-primary flex items-center gap-1 hover:underline"
                  >
                    Get your Twilio credentials <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>

            <hr className="my-6" />

            {/* Push (FCM) Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Push Notification Configuration (FCM)</h3>
              {customerLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <div className="space-y-4 border-l-2 border-primary/10 pl-4 py-2">
                  <div className="space-y-2">
                    <Label>FCM Server Key</Label>
                    <PasswordField 
                      label="" 
                      noLabel 
                      value={fcmServerKey} 
                      onChange={setFcmServerKey} 
                      show={showPasswords.fcm} 
                      onToggle={() => togglePassword('fcm')} 
                    />
                    <p className="text-xs text-muted-foreground">Your Firebase Cloud Messaging server key</p>
                  </div>
                  <div className="space-y-2">
                    <Label>VAPID Public Key</Label>
                    <Input 
                      value={vapidPublicKey} 
                      onChange={(e) => setVapidPublicKey(e.target.value)}
                      placeholder="BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFg..."
                    />
                    <p className="text-xs text-muted-foreground">For web push notifications</p>
                  </div>
                  <div className="space-y-2">
                    <Label>VAPID Private Key</Label>
                    <PasswordField 
                      label="" 
                      noLabel 
                      value={vapidPrivateKey} 
                      onChange={setVapidPrivateKey} 
                      show={showPasswords.vapid} 
                      onToggle={() => togglePassword('vapid')} 
                    />
                  </div>
                  <a 
                    href="https://console.firebase.google.com" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-xs text-primary flex items-center gap-1 hover:underline"
                  >
                    Get your Firebase config <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )}

    {/* Sticky Save All Button */}
    {customer && !customerLoading && (
      <div className="fixed bottom-0 left-0 right-0 border-t bg-white p-4 shadow-lg z-50 flex items-center justify-center">
        <div className="max-w-2xl w-full flex items-center justify-between gap-4">
          <div className="flex-1">
            {hasChanges && (
              <p className="text-sm font-medium text-amber-600 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                You have unsaved changes
              </p>
            )}
          </div>
          <Button 
            onClick={handleSaveAll} 
            disabled={saving || !hasChanges}
            size="lg"
            className="px-8 shadow-md"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save All Settings
          </Button>
        </div>
      </div>
    )}

        {/* Regenerate Key Dialog */}
        <Dialog open={regenerateOpen} onOpenChange={setRegenerateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Regenerate API Key?</DialogTitle>
              <DialogDescription>
                This will break your existing tracker. Type DELETE to confirm.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input
                value={confirmDelete}
                onChange={(e) => setConfirmDelete(e.target.value)}
                placeholder="Type DELETE"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRegenerateOpen(false)}>Cancel</Button>
              <Button 
                variant="destructive" 
                onClick={handleRegenerateKey}
                disabled={confirmDelete !== 'DELETE' || saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Regenerate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}

interface PasswordFieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  show: boolean
  onToggle: () => void
  noLabel?: boolean
}

function PasswordField({ label, value, onChange, show, onToggle, noLabel }: PasswordFieldProps) {
  return (
    <div className="space-y-2">
      {!noLabel && <Label>{label}</Label>}
      <div className="relative">
        <Input 
          type={show ? "text" : "password"} 
          value={value} 
          onChange={(e) => onChange(e.target.value)} 
          placeholder={show ? "Enter value" : "••••••••"} 
        />
        <button 
          type="button" 
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}