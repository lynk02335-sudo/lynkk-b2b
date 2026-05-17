import { useParams, Link } from 'react-router-dom'
import { ChevronLeft, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DashboardLayout } from '@/components/layout'
import { useWorkflow } from '@/hooks/use-workflows'

export default function WorkflowStatsPage() {
  const { id } = useParams<{ id: string }>()
  const { data: workflow, isLoading } = useWorkflow(id ?? '')

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full text-slate-500 text-sm p-8">
          Loading workflow stats...
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="flex-1 space-y-6 p-8 pt-6">
        <div className="flex items-center gap-4">
          <Link to="/workflows">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{(workflow?.config as any)?.name ?? 'Workflow'} — Stats</h2>
            <p className="text-sm text-slate-500">Performance analytics for this workflow</p>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center h-96 text-center">
          <BarChart3 className="w-16 h-16 text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No stats available yet</h3>
          <p className="text-sm text-slate-500 max-w-md">
            Workflow stats will appear here once users are enrolled and workflows start firing.
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}