import { useParams, useNavigate } from 'react-router-dom'
import { useExperiment, updateExperiment, declareWinner } from '../hooks/use-experiments'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Loader2, ArrowLeft, Trophy, Play, Pause } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  RUNNING: 'bg-green-100 text-green-700',
  PAUSED: 'bg-yellow-100 text-yellow-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
}

export default function ExperimentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { experiment, loading, refetch } = useExperiment(id)

  const handleStatusChange = async (status: string) => {
    if (!id) return
    await updateExperiment(id, { status })
    refetch()
  }

  const handleDeclareWinner = async (variantId: string) => {
    if (!id) return
    await declareWinner(id, variantId)
    refetch()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  if (!experiment) {
    return (
      <div className="text-center py-12 text-gray-500">
        Experiment not found
      </div>
    )
  }

  const significance = experiment.significance || {}
  const timeline = experiment.timeline || []
  const variantsList = (experiment.variants as any[]) || []

  // Timeline data for recharts
  const chartData = timeline.map((d: any) => {
    const point: any = { date: d.date }
    for (const vId of Object.keys(d.data || {})) {
      point[vId] = Math.round((d.data[vId].rate || 0) * 10000) / 100
    }
    return point
  })

  const variantNames = (experiment.variants as any[] || []).reduce((acc: any, v: any) => {
    const found = ((experiment.variants as any[]) || []).find((ev: any) => ev.id === v.variant_id)
    acc[v.variant_id] = found?.name || v.variant_id
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/experiments')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{experiment.name}</h1>
            <Badge className={statusColors[experiment.status]}>{experiment.status}</Badge>
          </div>
          <p className="text-sm text-gray-500">
            Goal: <code className="bg-gray-100 px-1 rounded">{experiment.goal_event}</code>
            {' | '}Type: {experiment.type}
            {experiment.started_at && (
              <> | Started: {new Date(experiment.started_at).toLocaleDateString()}</>
            )}
            {experiment.ended_at && (
              <> | Ended: {new Date(experiment.ended_at).toLocaleDateString()}</>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {experiment.status === 'DRAFT' && (
            <Button onClick={() => handleStatusChange('RUNNING')}>
              <Play className="w-4 h-4 mr-1" /> Start
            </Button>
          )}
          {experiment.status === 'RUNNING' && (
            <Button variant="outline" onClick={() => handleStatusChange('PAUSED')}>
              <Pause className="w-4 h-4 mr-1" /> Pause
            </Button>
          )}
          {experiment.status === 'PAUSED' && (
            <Button onClick={() => handleStatusChange('RUNNING')}>
              <Play className="w-4 h-4 mr-1" /> Resume
            </Button>
          )}
        </div>
      </div>

      {/* Significance indicator */}
      {experiment.assignments?.length > 0 && (
        <Card className={significance.is_significant ? 'border-green-400' : ''}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium">Statistical Significance</span>
                <span className="ml-3 text-2xl font-bold">
                  {significance.confidence_level?.toFixed(1)}%
                </span>
                <span className="ml-2 text-gray-500">confidence</span>
              </div>
              {significance.is_significant ? (
                <Badge className="bg-green-100 text-green-700 text-sm px-3 py-1">
                  Significant at 95% confidence
                </Badge>
              ) : (
                <Badge variant="outline" className="text-sm">
                  Not yet significant
                </Badge>
              )}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              χ² = {significance.chi_square?.toFixed(3)}, p = {significance.p_value?.toFixed(4)}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Variant comparison table */}
      <Card>
        <CardHeader>
          <CardTitle>Variant Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-3 pr-4">Variant</th>
                <th className="pb-3 pr-4">Users</th>
                <th className="pb-3 pr-4">Conversions</th>
                <th className="pb-3 pr-4">Conversion Rate</th>
                <th className="pb-3 pr-4">Uplift vs Control</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {variantsList.map((v: any) => (
                <tr key={v.variant_id} className="border-b hover:bg-gray-50">
                  <td className="py-3 pr-4 font-medium">
                    {variantNames[v.variant_id] || v.variant_id}
                    {v.variant_id === experiment.winner_variant_id && (
                      <Trophy className="w-4 h-4 text-yellow-500 inline ml-1" />
                    )}
                    {v.variant_id === 'A' && (
                      <Badge variant="outline" className="ml-2 text-xs">Control</Badge>
                    )}
                  </td>
                  <td className="py-3 pr-4">{v.users}</td>
                  <td className="py-3 pr-4">{v.conversions}</td>
                  <td className="py-3 pr-4 font-medium">{v.conversion_rate}%</td>
                  <td className="py-3 pr-4">
                    {v.variant_id === 'A' ? (
                      <span className="text-gray-400">-</span>
                    ) : (
                      <span className={v.uplift_vs_control > 0 ? 'text-green-600' : 'text-red-600'}>
                        {v.uplift_vs_control > 0 ? '+' : ''}{v.uplift_vs_control}%
                      </span>
                    )}
                  </td>
                  <td className="py-3">
                    {experiment.status !== 'COMPLETED' && !experiment.winner_variant_id && v.variant_id !== 'A' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeclareWinner(v.variant_id)}
                      >
                        <Trophy className="w-3 h-3 mr-1" />
                        Declare Winner
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Timeline chart */}
      {chartData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Conversion Rate Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(d) => {
                    const date = new Date(d)
                    return `${date.getMonth() + 1}/${date.getDate()}`
                  }}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  domain={[0, 'auto']}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${value.toFixed(2)}%`,
                    variantNames[name] || name,
                  ]}
                  labelFormatter={(label) => new Date(label).toLocaleDateString()}
                />
                <Legend
                  formatter={(value: string) => variantNames[value] || value}
                />
                {variantsList.map((v: any, i: number) => (
                  <Line
                    key={v.variant_id}
                    type="monotone"
                    dataKey={v.variant_id}
                    stroke={['#3b82f6', '#f59e0b', '#10b981', '#ef4444'][i]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
