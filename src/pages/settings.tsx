import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useCustomer } from '@/hooks/useCustomer'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Check, Copy, Loader2, AlertTriangle, Eye, EyeOff, ExternalLink } from 'lucide-react'
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

type WhatsAppProvider = '360dialog' | 'twilio' | 'wati' | 'aisensy' | 'interakt' | 'other'

export function SettingsPage() {
  const { customer, loading: customerLoading, error: customerError } = useCustomer()
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
  
  // UI states
  const [savingProduct, setSavingProduct] = useState(false)
  const [savingChannels, setSavingChannels] = useState(false)
  const [productError, setProductError] = useState<string | null>(null)
  const [channelsError, setChannelsError] = useState<string | null>(null)
  const [copiedApiKey, setCopiedApiKey] = useState(false)
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

      const config = customer.whatsapp_config || {}
      setWaProvider(config.provider || '360dialog')
      setWaPhoneNumber(config.phone_number || '')
      setWaApiKey(config.api_key || '')
      setWaAccountSid(config.account_sid || '')
      setWaAuthToken(config.auth_token || '')
      setWaEndpointUrl(config.endpoint_url || '')
      setWaApiToken(config.api_token || '')

      // If API key is missing, generate one
      if (!customer.api_key) {
        const ensureKey = async () => {
          console.log("Settings: API key missing, generating...")
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

  const validateWhatsApp = () => {
    if (!waPhoneNumber.startsWith('+') || !/^\+\d+$/.test(waPhoneNumber)) {
      setChannelsError("WhatsApp Number must start with + and contain only digits")
      return false
    }

    const requiredFields: Record<WhatsAppProvider, string[]> = {
      '360dialog': ['api_key'],
      'twilio': ['account_sid', 'auth_token'],
      'wati': ['endpoint_url', 'api_token'],
      'aisensy': ['api_key'],
      'interakt': ['api_key'],
      'other': ['endpoint_url', 'api_key']
    }

    const fields = requiredFields[waProvider]
    for (const f of fields) {
      const val = f === 'api_key' ? waApiKey : 
                  f === 'account_sid' ? waAccountSid : 
                  f === 'auth_token' ? waAuthToken : 
                  f === 'endpoint_url' ? waEndpointUrl : 
                  f === 'api_token' ? waApiToken : ''
      if (!val) {
        setChannelsError(`${f.replace('_', ' ').toUpperCase()} is required`)
        return false
      }
    }

    return true
  }

  const handleSaveProductName = async () => {
    if (!customer) return
    setSavingProduct(true)
    setProductError(null)
    
    const { error } = await supabase
      .from('customers')
      .update({ product_name: productName })
      .eq('id', customer.id)
    
    if (error) {
      setProductError(error.message)
    } else {
      toast({
        title: "Success",
        description: "Product name saved",
      })
    }
    setSavingProduct(false)
  }

  const handleSaveChannels = async () => {
    if (!customer) return
    setSavingChannels(true)
    setChannelsError(null)

    if (!validateWhatsApp()) {
      setSavingChannels(false)
      return
    }

    const whatsapp_config = {
      provider: waProvider,
      phone_number: waPhoneNumber,
      api_key: waApiKey,
      account_sid: waAccountSid,
      auth_token: waAuthToken,
      endpoint_url: waEndpointUrl,
      api_token: waApiToken
    }

    const { error } = await supabase
      .from('customers')
      .update({
        whatsapp_config,
        slack_webhook_url: slackWebhook,
        resend_api_key: resendKey
      })
      .eq('id', customer.id)

    if (error) {
      setChannelsError(error.message)
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message
      })
    } else {
      toast({
        title: "Success",
        description: "Channel settings saved"
      })
    }
    setSavingChannels(false)
  }

  const handleRegenerateKey = async () => {
    if (confirmDelete !== 'DELETE' || !customer) return
    
    setSavingProduct(true)
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
        window.location.reload()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSavingProduct(false)
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
    'interakt': 'https://developer.interakt.ai'
  }

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account and integration settings</p>
        </div>

        {/* Product Information Card */}
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
                  {productError && (
                    <p className="text-sm text-red-600 mt-1">{productError}</p>
                  )}
                </>
              )}
            </div>
            <Button 
              onClick={handleSaveProductName} 
              disabled={savingProduct || customerLoading}
            >
              {savingProduct ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
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

            {channelsError && (
              <p className="text-sm text-red-600 mt-4">{channelsError}</p>
            )}
            
            <Button 
              onClick={handleSaveChannels} 
              disabled={savingChannels || customerLoading}
              className="w-full mt-6"
            >
              {savingChannels ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save All Channel Settings
            </Button>
          </CardContent>
        </Card>

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
                disabled={confirmDelete !== 'DELETE' || savingProduct}
              >
                {savingProduct ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
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