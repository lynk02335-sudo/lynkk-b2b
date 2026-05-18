import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useCustomer } from '@/hooks/useCustomer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, Copy, Check, Loader2 } from 'lucide-react'

const steps = [
  { id: 1, title: 'Product Name' },
  { id: 2, title: 'API Key' },
  { id: 3, title: 'Install Tracker' },
  { id: 4, title: 'Complete' },
]

export function OnboardingPage() {
  const navigate = useNavigate()
  // const { toast } = useToast()
  const { customer, loading: customerLoading } = useCustomer()
  
  const [currentStep, setCurrentStep] = useState(() => {
    const saved = localStorage.getItem('onboarding_step')
    return saved ? parseInt(saved) : 1
  })
  
  const [productName, setProductName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [apiKeyCopied, setApiKeyCopied] = useState(false)
  const [localApiKey, setLocalApiKey] = useState<string | null>(null)

  useEffect(() => {
    localStorage.setItem('onboarding_step', currentStep.toString())
  }, [currentStep])

  useEffect(() => {
    if (customer) {
      setProductName(customer.product_name || '')
      setLocalApiKey(customer.api_key)
    }
  }, [customer])

  // Polling for API Key in Step 2
  useEffect(() => {
    let interval: NodeJS.Timeout
    let retries = 0
    const maxRetries = 5

    if (currentStep === 2 && !localApiKey) {
      interval = setInterval(async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data } = await supabase
          .from('customers')
          .select('api_key')
          .eq('id', user.id)
          .single()

        if (data?.api_key) {
          setLocalApiKey(data.api_key)
          clearInterval(interval)
        } else {
          retries++
          if (retries >= maxRetries) {
            setError("API key not found after multiple attempts. Please refresh.")
            clearInterval(interval)
          }
        }
      }, 3000)
    }

    return () => clearInterval(interval)
  }, [currentStep, localApiKey])

  const handleSaveProductName = async () => {
    if (!productName.trim()) {
      setError("Product name is required")
      return
    }
    setSaving(true)
    setError('')
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')
      
      const { error } = await supabase
        .from('customers')
        .update({ product_name: productName.trim() })
        .eq('id', user.id)

      if (error) {
        setError(error.message)
      } else {
        setCurrentStep(2)
      }
    } catch (err) {
      setError('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const copyToClipboard = async (text: string, setCopiedState: (v: boolean) => void) => {
    await navigator.clipboard.writeText(text)
    setCopiedState(true)
    setTimeout(() => setCopiedState(false), 2000)
  }

  const handleComplete = () => {
    localStorage.removeItem('onboarding_step')
    navigate('/dashboard')
  }

  if (customerLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }


  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-center space-x-4 mb-6">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentStep > step.id
                      ? 'bg-green-500 text-white'
                      : currentStep === step.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {currentStep > step.id ? <CheckCircle2 className="w-5 h-5" /> : step.id}
                </div>
                <span className={`ml-2 text-sm hidden sm:inline ${currentStep >= step.id ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {step.title}
                </span>
                {index < steps.length - 1 && (
                  <div className={`w-4 sm:w-8 h-0.5 mx-2 ${currentStep > step.id ? 'bg-green-500' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
          <CardTitle className="text-center text-2xl font-bold">
            {currentStep === 1 && "What's your product called?"}
            {currentStep === 2 && 'Your API Key'}
            {currentStep === 3 && 'Install the tracker'}
            {currentStep === 4 && "You're all set!"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentStep === 1 && (
            <div className="space-y-4">
              <p className="text-muted-foreground text-center">
                This will appear in your dashboard and tracking code.
              </p>
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-200">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="productName">Product Name</Label>
                <Input
                  id="productName"
                  placeholder="My Awesome Product"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                />
              </div>
              <Button 
                className="w-full" 
                onClick={handleSaveProductName}
                disabled={saving || !productName.trim()}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Continue
              </Button>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <p className="text-muted-foreground text-center">
                Keep this safe. You'll need it to install the tracker.
              </p>
              {error && <div className="text-red-500 text-sm text-center">{error}</div>}
              <div className="relative">
                <code className="block p-4 bg-gray-100 rounded-lg font-mono text-sm break-all min-h-[50px]">
                  {localApiKey || 'Generating...'}
                </code>
                {localApiKey && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(localApiKey, setApiKeyCopied)}
                  >
                    {apiKeyCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                )}
              </div>
              <Button className="w-full" onClick={() => setCurrentStep(3)} disabled={!localApiKey}>
                Continue
              </Button>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">1</span>
                    Install Tracker
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Paste this before the &lt;/body&gt; tag on every page.
                  </p>
                  <div className="relative">
                    <pre className="p-4 bg-gray-900 rounded-lg text-xs text-gray-100 overflow-x-auto">
                      <code>{`<!-- 1. Install tracker -->
<script src="${window.location.origin}/track.js" 
        data-key="${localApiKey || '[YOUR_API_KEY]'}">
</script>`}</code>
                    </pre>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 text-gray-100 hover:text-white"
                      onClick={() => copyToClipboard(`<!-- 1. Install tracker -->
<script src="${window.location.origin}/track.js" 
        data-key="${localApiKey || '[YOUR_API_KEY]'}">
</script>`, setCopied)}
                    >
                      {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">2</span>
                    Identify User
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Call this after login to connect events to an email.
                  </p>
                  <div className="relative">
                    <pre className="p-4 bg-gray-900 rounded-lg text-xs text-gray-100 overflow-x-auto">
                      <code>{`<!-- 2. Identify user after login -->
<script>
  Lynkk.identify("user@email.com", "Raj Kumar")
</script>`}</code>
                    </pre>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">3</span>
                    Track Events (Optional)
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Track key actions like signups or purchases.
                  </p>
                  <div className="relative">
                    <pre className="p-4 bg-gray-900 rounded-lg text-xs text-gray-100 overflow-x-auto">
                      <code>{`<!-- 3. Track custom events -->
<script>
  Lynkk.track("project_created", { plan: "trial" })
</script>`}</code>
                    </pre>
                  </div>
                </div>
              </div>

              <Button className="w-full" onClick={() => setCurrentStep(4)}>
                Finish Setup
              </Button>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-6 text-center py-4">
              <div className="flex justify-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-medium">Onboarding Complete!</h3>
                <p className="text-muted-foreground">
                  We'll start showing your users as events come in.
                </p>
              </div>
              <Button className="w-full" onClick={handleComplete}>
                Go to Dashboard
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}