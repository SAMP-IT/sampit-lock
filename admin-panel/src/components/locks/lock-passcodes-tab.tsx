import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Passcode } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Search } from 'lucide-react'

interface LockPasscodesTabProps {
  lockId: string
}

export function LockPasscodesTab({ lockId }: LockPasscodesTabProps) {
  const [passcodes, setPasscodes] = useState<Passcode[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    async function fetchPasscodes() {
      try {
        const { data, error } = await supabase
          .from('passcodes')
          .select('*, users:created_by(first_name, last_name)')
          .eq('lock_id', lockId)
          .order('created_at', { ascending: false })

        if (error) throw error
        setPasscodes(data || [])
      } catch (error) {
        console.error('Error fetching passcodes:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPasscodes()
  }, [lockId])

  const filteredPasscodes = passcodes.filter(p => {
    const searchLower = searchQuery.toLowerCase()
    return (
      p.code.toLowerCase().includes(searchLower) ||
      (p.name?.toLowerCase().includes(searchLower) || false)
    )
  })

  const syncLabels: Record<string, string> = {
    synced: 'Synced',
    pending_add: 'Pending Add',
    pending_delete: 'Pending Delete',
    pending_update: 'Pending Update',
    failed: 'Failed',
    unknown: 'Unknown',
  }

  const syncVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    synced: 'default',
    pending_add: 'outline',
    pending_delete: 'outline',
    pending_update: 'outline',
    failed: 'destructive',
    unknown: 'secondary',
  }

  const getTypeVariant = (type: string) => {
    switch (type) {
      case 'permanent': return 'default'
      case 'timed': return 'secondary'
      case 'one_time': return 'outline'
      default: return 'outline'
    }
  }

  if (loading) {
    return (
      <Card className="mt-4">
        <CardContent className="pt-6">
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Passcodes ({passcodes.length})</CardTitle>
          <div className="relative w-56">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search passcodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredPasscodes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchQuery ? 'No passcodes found matching your search' : 'No passcodes for this lock'}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Valid Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sync</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPasscodes.map((passcode) => (
                <TableRow key={passcode.id}>
                  <TableCell className="font-mono">{passcode.code}</TableCell>
                  <TableCell>{passcode.name || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={getTypeVariant(passcode.code_type)} className="capitalize">
                      {passcode.code_type.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {passcode.valid_from
                      ? new Date(passcode.valid_from).toLocaleDateString()
                      : '-'
                    }
                    {passcode.valid_until && (
                      <> — {new Date(passcode.valid_until).toLocaleDateString()}</>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={passcode.is_active ? 'default' : 'secondary'}>
                      {passcode.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {passcode.sync_status ? (
                      <Badge variant={syncVariants[passcode.sync_status] || 'secondary'} className="text-xs">
                        {syncLabels[passcode.sync_status] || passcode.sync_status}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {passcode.users
                      ? `${passcode.users.first_name} ${passcode.users.last_name}`
                      : '-'
                    }
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {new Date(passcode.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
