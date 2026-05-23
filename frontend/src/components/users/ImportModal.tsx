import { useState, useRef, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { useCustomer } from '@/hooks/useCustomer'
import { API_BASE_URL } from '@/lib/api'
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  Loader2,
  X,
} from 'lucide-react'

const LYNKK_FIELDS = [
  { value: '__skip__', label: '-- Skip this column --' },
  { value: 'email', label: 'Email (required)', required: true },
  { value: 'name', label: 'Full name' },
  { value: 'first_name', label: 'First name' },
  { value: 'last_name', label: 'Last name' },
  { value: 'phone', label: 'Phone number' },
  { value: 'plan', label: 'Plan' },
  { value: 'company', label: 'Company' },
  { value: '__custom__', label: 'Custom property...' },
]

const AUTO_MAP: Record<string, string> = {
  email: 'email',
  'e-mail': 'email',
  name: 'name',
  'full name': 'name',
  'first name': 'first_name',
  fname: 'first_name',
  'last name': 'last_name',
  lname: 'last_name',
  phone: 'phone',
  mobile: 'phone',
  plan: 'plan',
  company: 'company',
  org: 'company',
}

const SAMPLE_CSV = `email,name,first_name,last_name,phone,plan,company
john@example.com,John Doe,John,Doe,+1234567890,Pro,Acme Inc
jane@example.com,Jane Smith,Jane,Smith,,Basic,`

interface ImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Step = 'upload' | 'map' | 'preview' | 'importing' | 'done' | 'error'

interface ValidationResponse {
  total: number
  valid: number
  will_update: number
  errors: ValidationError[]
  warnings: ValidationWarning[]
  preview: any[]
  import_key: string
  filename: string
}

interface ValidationError {
  row: number
  field: string
  value: string
  reason: string
}

interface ValidationWarning {
  row: number
  field: string
  value: string
  reason: string
}

export default function ImportModal({ open, onOpenChange }: ImportModalProps) {
  const queryClient = useQueryClient()
  const { customer } = useCustomer()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [customProps, setCustomProps] = useState<Record<string, string>>({})
  const [validation, setValidation] = useState<ValidationResponse | null>(null)
  const [skipErrors, setSkipErrors] = useState(true)
  const [importResult, setImportResult] = useState<{
    imported: number
    updated: number
    skipped: number
    total: number
  } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [errorsExpanded, setErrorsExpanded] = useState(true)
  const [warningsExpanded, setWarningsExpanded] = useState(false)

  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        resetState()
      }, 300)
    }
  }, [open])

  function resetState() {
    setStep('upload')
    setFile(null)
    setFileError(null)
    setCsvHeaders([])
    setMapping({})
    setCustomProps({})
    setValidation(null)
    setSkipErrors(true)
    setImportResult(null)
    setImportError(null)
    setIsDragging(false)
    setErrorsExpanded(true)
    setWarningsExpanded(false)
  }

  function handleFileSelect(selectedFile: File | null) {
    setFileError(null)
    if (!selectedFile) {
      setFile(null)
      return
    }
    if (!selectedFile.name.endsWith('.csv')) {
      setFileError('Only .csv files are accepted')
      setFile(null)
      return
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      setFileError('File exceeds 10MB limit')
      setFile(null)
      return
    }
    setFile(selectedFile)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files[0]
    handleFileSelect(droppedFile)
  }

  function parseCsvHeaders(file: File): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        const firstLine = text.split('\n')[0]
        if (!firstLine) {
          reject(new Error('Empty CSV'))
          return
        }
        const headers = firstLine.split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
        resolve(headers)
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsText(file.slice(0, 1024 * 10))
    })
  }

  async function handleGoToMap() {
    if (!file) return
    try {
      const headers = await parseCsvHeaders(file)
      setCsvHeaders(headers)

      const initialMapping: Record<string, string> = {}
      const initialCustom: Record<string, string> = {}
      for (const header of headers) {
        const lower = header.toLowerCase().trim()
        const mapped = AUTO_MAP[lower]
        if (mapped) {
          initialMapping[header] = mapped
        } else {
          initialMapping[header] = '__custom__'
          initialCustom[header] = header
        }
      }
      setMapping(initialMapping)
      setCustomProps(initialCustom)
      setStep('map')
    } catch {
      setFileError('Failed to parse CSV headers')
    }
  }

  function handleMappingChange(csvCol: string, lynkkField: string) {
    setMapping((prev) => ({ ...prev, [csvCol]: lynkkField }))
    if (lynkkField !== '__custom__') {
      setCustomProps((prev) => {
        const next = { ...prev }
        delete next[csvCol]
        return next
      })
    }
  }

  function handleCustomPropNameChange(csvCol: string, propName: string) {
    setCustomProps((prev) => ({ ...prev, [csvCol]: propName }))
  }

  function resolveField(csvCol: string): string {
    const mapped = mapping[csvCol]
    if (mapped === '__custom__') {
      return customProps[csvCol] || csvCol
    }
    return mapped
  }

  const emailMapped = Object.values(mapping).some((v) => v === 'email')

  function getMappingPayload(): Record<string, string> {
    const payload: Record<string, string> = {}
    for (const header of csvHeaders) {
      const field = resolveField(header)
      if (field && field !== '__skip__') {
        payload[header] = field
      }
    }
    return payload
  }

  async function handleValidate() {
    if (!file) return
    setStep('preview')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('No session')

      const formData = new FormData()
      formData.append('file', file)
      formData.append('mapping', JSON.stringify(getMappingPayload()))

      const res = await fetch(`${API_BASE_URL}/api/users/import/validate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Validation failed' }))
        throw new Error(err.message || 'Validation failed')
      }

      const result = await res.json()
      setValidation(result)

      if (result.errors.length > 0) {
        setSkipErrors(true)
      }
    } catch (err: any) {
      setImportError(err.message)
      setStep('error')
    }
  }

  async function handleConfirmImport() {
    if (!validation) return
    setStep('importing')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('No session')

      const res = await fetch(`${API_BASE_URL}/api/users/import/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          import_key: validation.import_key,
          skip_errors: skipErrors,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Import failed' }))
        throw new Error(err.message || 'Import failed')
      }

      const result = await res.json()
      setImportResult(result)
      setStep('done')
    } catch (err: any) {
      setImportError(err.message)
      setStep('error')
    }
  }

  function handleDone() {
    queryClient.invalidateQueries({ queryKey: ['users', customer?.id] })
    onOpenChange(false)
  }

  function downloadSampleCsv() {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'lynkk-sample-import.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function downloadErrorReport() {
    if (!validation) return
    const headers = 'Row #,Field,Value,Reason\n'
    const rows = validation.errors
      .map((e) => `"${e.row}","${e.field}","${e.value}","${e.reason}"`)
      .join('\n')
    const csv = headers + rows
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'import-errors.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const canClose = step !== 'importing'

  return (
    <Dialog open={open} onOpenChange={(o) => canClose && onOpenChange(o)}>
      <DialogContent
        className="sm:max-w-2xl"
        onPointerDownOutside={(e) => !canClose && e.preventDefault()}
        onEscapeKeyDown={(e) => !canClose && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {step === 'upload' && 'Import Users'}
            {step === 'map' && 'Map your columns'}
            {step === 'preview' && 'Preview & Validate'}
            {step === 'importing' && 'Importing users...'}
            {step === 'done' && 'Import complete'}
            {step === 'error' && 'Import failed'}
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Upload a CSV file to add or update users'}
            {step === 'map' && 'Tell us which CSV column matches which Lynkk field'}
            {step === 'preview' && 'Review your data before importing'}
            {step === 'importing' && 'This may take a moment for large files'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
          {['upload', 'map', 'preview'].map((s, i) => (
            <span key={s} className="flex items-center gap-1">
              <span
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
                  step === s
                    ? 'bg-primary text-primary-foreground'
                    : ['done', 'importing', 'error'].includes(step) && i < 3
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {['done', 'importing', 'error'].includes(step) && i < 3 ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  i + 1
                )}
              </span>
              <span className="hidden sm:inline">
                {s === 'upload' ? 'Upload' : s === 'map' ? 'Map' : 'Preview'}
              </span>
              {i < 2 && <ChevronRight className="h-4 w-4 mx-1" />}
            </span>
          ))}
        </div>

        {step === 'upload' && (
          <div className="space-y-4">
            <div
              ref={dropRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors',
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50',
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
              />
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
              <p className="text-base font-medium mb-1">Drag and drop your CSV here</p>
              <p className="text-sm text-muted-foreground">or click to browse</p>
            </div>

            {fileError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                {fileError}
              </div>
            )}

            {file && !fileError && (
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFile(null)}
                >
                  <X className="h-4 w-4 mr-1" />
                  Remove
                </Button>
              </div>
            )}

            <div className="text-center">
              <button
                onClick={downloadSampleCsv}
                className="text-sm text-primary hover:underline"
              >
                Download sample CSV template
              </button>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                onClick={handleGoToMap}
                disabled={!file || !!fileError}
              >
                Next: Map Columns
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {step === 'map' && (
          <div className="space-y-4">
            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              <div className="grid grid-cols-2 gap-4 text-sm font-medium text-muted-foreground px-1">
                <span>Your CSV column</span>
                <span>Lynkk field</span>
              </div>
              {csvHeaders.map((header) => (
                <div key={header} className="grid grid-cols-2 gap-4 items-center">
                  <span className="text-sm text-muted-foreground truncate px-1">
                    {header}
                  </span>
                  <Select
                    value={mapping[header] || '__skip__'}
                    onValueChange={(v) => handleMappingChange(header, v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LYNKK_FIELDS.map((field) => (
                        <SelectItem key={field.value} value={field.value}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {mapping[header] === '__custom__' && (
                    <div className="col-span-2 mt-1">
                      <Input
                        placeholder="Enter custom property name..."
                        value={customProps[header] || ''}
                        onChange={(e) => handleCustomPropNameChange(header, e.target.value)}
                        className="text-sm"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {!emailMapped && (
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Email is required to import users
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep('upload')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleValidate} disabled={!emailMapped}>
                Next: Preview & Validate
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && validation && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{validation.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-emerald-700">{validation.valid}</p>
                <p className="text-xs text-emerald-600">Valid</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-amber-700">{validation.will_update}</p>
                <p className="text-xs text-amber-600">Updates</p>
              </div>
              <div className={cn(
                'rounded-lg p-3 text-center',
                validation.errors.length > 0 ? 'bg-red-50' : 'bg-muted',
              )}>
                <p className={cn(
                  'text-2xl font-bold',
                  validation.errors.length > 0 ? 'text-red-700' : '',
                )}>
                  {validation.errors.length}
                </p>
                <p className={cn(
                  'text-xs',
                  validation.errors.length > 0 ? 'text-red-600' : 'text-muted-foreground',
                )}>
                  Errors
                </p>
              </div>
            </div>

            {validation.preview.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Preview (first {validation.preview.length} rows)</p>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left p-2 font-medium">Email</th>
                        <th className="text-left p-2 font-medium">Name</th>
                        <th className="text-left p-2 font-medium">Phone</th>
                        <th className="text-left p-2 font-medium">Plan</th>
                        <th className="text-left p-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validation.preview.map((row: any, i: number) => (
                        <tr key={i} className="border-t">
                          <td className="p-2">{row.email}</td>
                          <td className="p-2">{row.name || '-'}</td>
                          <td className="p-2">{row.phone || '-'}</td>
                          <td className="p-2">{row.plan || '-'}</td>
                          <td className="p-2">
                            {row.status === 'will_update' ? (
                              <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                                Update
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">
                                New
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {validation.errors.length > 0 && (
              <div className="border rounded-lg">
                <button
                  onClick={() => setErrorsExpanded(!errorsExpanded)}
                  className="flex items-center justify-between w-full p-3 hover:bg-muted/50"
                >
                  <span className="text-sm font-medium text-red-600">
                    {validation.errors.length} row{validation.errors.length > 1 ? 's' : ''} have errors
                  </span>
                  {errorsExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                {errorsExpanded && (
                  <div className="p-3 pt-0">
                    <div className="overflow-x-auto border rounded-lg text-sm">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-muted/50">
                            <th className="text-left p-2 font-medium">Row #</th>
                            <th className="text-left p-2 font-medium">Field</th>
                            <th className="text-left p-2 font-medium">Value</th>
                            <th className="text-left p-2 font-medium">Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {validation.errors.slice(0, 20).map((e, i) => (
                            <tr key={i} className="border-t">
                              <td className="p-2">{e.row}</td>
                              <td className="p-2">{e.field}</td>
                              <td className="p-2 text-muted-foreground">{e.value}</td>
                              <td className="p-2 text-red-600">{e.reason}</td>
                            </tr>
                          ))}
                          {validation.errors.length > 20 && (
                            <tr className="border-t">
                              <td colSpan={4} className="p-2 text-center text-muted-foreground text-xs">
                                ...and {validation.errors.length - 20} more errors
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={downloadErrorReport}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download error report
                    </Button>
                  </div>
                )}
              </div>
            )}

            {validation.errors.length > 0 && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="errorHandling"
                    checked={skipErrors}
                    onChange={() => setSkipErrors(true)}
                    className="accent-primary"
                  />
                  Import valid rows and skip errors
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="errorHandling"
                    checked={!skipErrors}
                    onChange={() => setSkipErrors(false)}
                    className="accent-primary"
                  />
                  Cancel and fix errors first
                </label>
              </div>
            )}

            {validation.warnings.length > 0 && (
              <div className="border rounded-lg">
                <button
                  onClick={() => setWarningsExpanded(!warningsExpanded)}
                  className="flex items-center justify-between w-full p-3 hover:bg-muted/50"
                >
                  <span className="text-sm font-medium text-amber-600">
                    {validation.warnings.length} warning{validation.warnings.length > 1 ? 's' : ''} (rows will still import)
                  </span>
                  {warningsExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                {warningsExpanded && (
                  <div className="p-3 pt-0">
                    <div className="overflow-x-auto border rounded-lg text-sm">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-muted/50">
                            <th className="text-left p-2 font-medium">Row #</th>
                            <th className="text-left p-2 font-medium">Field</th>
                            <th className="text-left p-2 font-medium">Original</th>
                            <th className="text-left p-2 font-medium">Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {validation.warnings.map((w, i) => (
                            <tr key={i} className="border-t">
                              <td className="p-2">{w.row}</td>
                              <td className="p-2">{w.field}</td>
                              <td className="p-2 text-muted-foreground">{w.value}</td>
                              <td className="p-2">{w.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep('map')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleConfirmImport}
                disabled={!skipErrors && validation.errors.length > 0}
              >
                Confirm Import
              </Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-base font-medium">Importing your users...</p>
            <p className="text-sm text-muted-foreground">This may take a moment for large files</p>
          </div>
        )}

        {step === 'done' && importResult && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <CheckCircle2 className="h-16 w-16 text-emerald-500" />
            <p className="text-xl font-semibold">Import complete</p>
            <div className="text-sm text-muted-foreground text-center space-y-1">
              <p>{importResult.imported} users added</p>
              <p>{importResult.updated} users updated</p>
              <p>{importResult.skipped} rows skipped</p>
            </div>
            <div className="flex gap-3 pt-4">
              <Button onClick={handleDone}>View Users</Button>
              <Button variant="outline" onClick={() => resetState()}>
                Import another file
              </Button>
            </div>
          </div>
        )}

        {step === 'error' && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <XCircle className="h-16 w-16 text-red-500" />
            <p className="text-xl font-semibold">Import failed</p>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              {importError || 'An unexpected error occurred during import.'}
            </p>
            <Button variant="outline" onClick={() => resetState()} className="mt-4">
              Try again
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
