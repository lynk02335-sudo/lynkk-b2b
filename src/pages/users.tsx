import { useState, useMemo } from 'react'
import { DashboardLayout } from '@/components/layout'
import type { UserState } from '@/types'
import { useUsers, useUpdateUserState } from '@/hooks/use-users'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'
import {
  Search,
  X,
  Clock,
  GitBranch,
  Users,
  AlertTriangle,
  Download,
  MoreHorizontal,
} from 'lucide-react'

const STATES: { value: UserState | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'at_risk', label: 'At Risk' },
  { value: 'cold', label: 'Cold' },
  { value: 'churned', label: 'Churned' },
]

const STATE_COLORS: Record<UserState, string> = {
  active: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  at_risk: 'bg-amber-100 text-amber-800 border-amber-200',
  cold: 'bg-orange-100 text-orange-800 border-orange-200',
  churned: 'bg-rose-100 text-rose-800 border-rose-200',
}

function getStateColor(state: UserState): string {
  return STATE_COLORS[state] || ''
}

function toUserState(s: string): UserState {
  const valid: UserState[] = ['active', 'at_risk', 'cold', 'churned']
  return valid.includes(s as UserState) ? (s as UserState) : 'active'
}

function getInitials(name?: string): string {
  if (!name) return 'U'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatRelativeTime(dateString: string): string {
  const now = Date.now()
  const then = new Date(dateString).getTime()
  const diffMs = now - then
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHrs / 24)

  if (diffHrs < 1) return 'Just now'
  if (diffHrs < 24) return `${diffHrs}h ago`
  if (diffDays < 30) return `${diffDays}d ago`
  return formatDate(dateString)
}

export default function UsersPage() {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState<UserState | 'all'>('all')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  const { data: users, isLoading, isError, error } = useUsers()
  const updateState = useUpdateUserState()

  const filteredUsers = useMemo(() => {
    if (!users) return []
    return users.filter((user) => {
      const matchesSearch =
        !search ||
        (user.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (user.email ?? '').toLowerCase().includes(search.toLowerCase())
      const matchesState = stateFilter === 'all' || user.status === stateFilter
      return matchesSearch && matchesState
    })
  }, [users, search, stateFilter])

  const selectedUser = useMemo(() => {
    if (!selectedUserId || !users) return null
    return users.find((u) => u.id === selectedUserId) || null
  }, [selectedUserId, users])

  function handleStateChange(userId: string, newState: UserState) {
    updateState.mutate(
      { id: userId, state: newState },
      {
        onSuccess: () => {
          toast({ title: `User state updated to ${newState.replace(/_/g, ' ')}` })
        },
        onError: () => {
          toast({ variant: 'destructive', title: 'Failed to update user state' })
        },
      },
    )
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-8 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-full max-w-sm" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (isError) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-96 text-center p-8">
          <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Failed to load users</h2>
          <p className="text-muted-foreground mb-4">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  if (!users || users.length === 0) {
    return (
      <DashboardLayout>
        <div className="p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Users</h1>
            <p className="text-muted-foreground">Manage and monitor your users</p>
          </div>
          <div className="flex flex-col items-center justify-center h-96 text-center">
            <Users className="w-16 h-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No users found</h2>
            <p className="text-muted-foreground">
              Users will appear here once they start interacting with your product.
            </p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Users</h1>
            <p className="text-muted-foreground">
              {users.length.toLocaleString('en-IN')} total users
            </p>
          </div>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
          <div className="flex gap-1">
            {STATES.map((s) => (
              <Button
                key={s.value}
                variant={stateFilter === s.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStateFilter(s.value)}
              >
                {s.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex -mx-8">
          <div
            className={cn(
              'px-8 transition-all duration-300',
              selectedUser ? 'w-[calc(100%-400px)]' : 'w-full',
            )}
          >
            {filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Search className="w-12 h-12 text-muted-foreground mb-3" />
                <h3 className="text-lg font-semibold mb-1">No matching users</h3>
                <p className="text-muted-foreground text-sm">
                  Try adjusting your search or filter criteria.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Last Seen</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow
                      key={user.id}
                      className={cn(
                        'cursor-pointer',
                        selectedUserId === user.id && 'bg-muted',
                      )}
                      onClick={() =>
                        setSelectedUserId(
                          selectedUserId === user.id ? null : user.id,
                        )
                      }
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {getInitials(user.name || undefined)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">
                            {user.name || 'Unknown User'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.email || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{formatRelativeTime(user.last_seen)}</span>
                        </div>
                      </TableCell>
<TableCell>
                          <Badge
                            variant="outline"
                            className={cn('text-xs', getStateColor(toUserState(user.status)))}
                          >
                            {user.status}
                          </Badge>
                        </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        -
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedUserId(user.id)
                              }}
                            >
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {(
                              ['active', 'at_risk', 'cold', 'churned'] as UserState[]
                            )
                              .filter((s) => s !== user.status)
                              .map((s) => (
                                <DropdownMenuItem
                                  key={s}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleStateChange(user.id, s)
                                  }}
                                >
                                  Set as {s.replace(/_/g, ' ')}
                                </DropdownMenuItem>
                              ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {selectedUser && (
            <div className="w-[400px] shrink-0 border-l overflow-y-auto max-h-[calc(100vh-12rem)]">
              <div className="p-6 space-y-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="text-sm">
                        {getInitials(selectedUser.name || undefined)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold text-lg">
                        {selectedUser.name || 'Unknown User'}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedUser.email || 'No email'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setSelectedUserId(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className={cn('text-xs', getStateColor(toUserState(selectedUser.status)))}
                  >
                    {selectedUser.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Joined {formatDate(selectedUser.first_seen)}
                  </span>
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-medium mb-3">Actions</h4>
                  <div className="flex flex-wrap gap-2">
                    {(
                      ['active', 'at_risk', 'cold', 'churned'] as UserState[]
                    )
                      .filter((s) => s !== selectedUser.status)
                      .map((s) => (
                        <Button
                          key={s}
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleStateChange(selectedUser.id, s)
                          }
                          disabled={updateState.isPending}
                        >
                          {s === 'active'
                            ? 'Mark Active'
                            : s === 'at_risk'
                              ? 'Mark At Risk'
                              : s === 'cold'
                                ? 'Mark Cold'
                                : 'Mark Churned'}
                        </Button>
                      ))}
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Recent Events
                  </h4>
                  <p className="text-sm text-muted-foreground">No events yet</p>
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-muted-foreground" />
                    Workflow Enrollments
                  </h4>
                  <p className="text-sm text-muted-foreground">No enrollments yet</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
