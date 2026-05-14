import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useCustomer } from '@/hooks/useCustomer'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Check, Copy, Loader2, AlertTriangle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'

export function SettingsPage() {
  const { customer, loading: customerLoading, error: customerError } = useCustomer()
  const { toast } = useToast()
  
  // Form states
  const [productName, setProductName] = useState('')
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [slackWebhook, setSlackWebhook] = useState('')
  const [dialog360Key, setDialog360Key] = useState('')
  const [resendKey, setResendKey] = useState('')
  
  // UI states
  const [savingProduct, setSavingProduct] = useState(false)
  const [savingChannels, setSavingChannels] = useState(false)
  const [productError, setProductError] = useState<string | null>(null)
  const [channelsError, setChannelsError] = useState<string | null>(null)
  const [copiedApiKey, setCopiedApiKey] = useState(false)
  const [regenerateOpen, setRegenerateOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState('')

  // Pre-fill fields and handle missing API key
  useEffect(() => {
    if (customer) {
      setProductName(customer.product_name || '')
      setWhatsappNumber(customer.whatsapp_number || '')
      setSlackWebhook(customer.slack_webhook_url || '')
      setDialog360Key(customer.dialog360_api_key || '')
      setResendKey(customer.resend_api_key || '')

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
        variant: "default", // use default for green success in many shadcn setups, or custom
      })
    }
    setSavingProduct(false)
  }

  const handleSaveChannels = async () => {
    if (!customer) return
    setSavingChannels(true)
    setChannelsError(null)

    const { error } = await supabase
      .from('customers')
      .update({
        whatsapp_number: whatsappNumber,
        slack_webhook_url: slackWebhook,
        dialog360_api_key: dialog360Key,
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
        description: "Channel configuration saved"
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
        // Refresh to sync hook state
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
          <h2 className="text-xl font-semibold mb-2">{customerError}</h2>
          <p className="text-muted-foreground max-w-md">
            We encountered an issue accessing your account. Please try refreshing or contact support.
          </p>
        </div>
      </DashboardLayout>
    )
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
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>WhatsApp Number (360dialog)</Label>
              {customerLoading ? <Skeleton className="h-10 w-full" /> : (
                <Input
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="+1234567890"
                />
              )}
            </div>
            <div className="space-y-2">
              <Label>360Dialog API Key</Label>
              {customerLoading ? <Skeleton className="h-10 w-full" /> : (
                <Input
                  type="password"
                  value={dialog360Key}
                  onChange={(e) => setDialog360Key(e.target.value)}
                  placeholder="Enter your API key"
                />
              )}
            </div>
            <div className="space-y-2">
              <Label>Resend API Key</Label>
              {customerLoading ? <Skeleton className="h-10 w-full" /> : (
                <Input
                  type="password"
                  value={resendKey}
                  onChange={(e) => setResendKey(e.target.value)}
                  placeholder="Enter your API key"
                />
              )}
            </div>
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
            {channelsError && (
              <p className="text-sm text-red-600">{channelsError}</p>
            )}
            <Button 
              onClick={handleSaveChannels} 
              disabled={savingChannels || customerLoading}
            >
              {savingChannels ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save All
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