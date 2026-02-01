import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Fingerprint } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface LockFingerprintsTabProps {
  lockId: string
}

const statusLabels: Record<number, string> = {
  1: 'Normal',
  2: 'Invalid',
  3: 'Pending',
  4: 'Adding',
  5: 'Add Failed',
  6: 'Modifying',
  7: 'Modify Failed',
  8: 'Deleting',
  9: 'Delete Failed',
}

const statusVariants: Record<number, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  1: 'default',
  2: 'destructive',
  3: 'outline',
  4: 'outline',
  5: 'destructive',
  6: 'outline',
  7: 'destructive',
  8: 'outline',
  9: 'destructive',
}

export function LockFingerprintsTab({ lockId }: LockFingerprintsTabProps) {
  const [fingerprints, setFingerprints] = useState<Fingerprint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchFingerprints() {
      try {
        const { data, error } = await supabase
          .from('fingerprints')
          .select('*, users:user_id(first_name, last_name)')
          .eq('lock_id', lockId)
          .order('created_at', { ascending: false })

        if (error) throw error
        setFingerprints(data || [])
      } catch (error) {
        console.error('Error fetching fingerprints:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchFingerprints()
  }, [lockId])

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
        <CardTitle className="text-lg">Fingerprints ({fingerprints.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {fingerprints.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No fingerprints registered for this lock
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Number</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Valid Period</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fingerprints.map((fp) => (
                <TableRow key={fp.id}>
                  <TableCell className="font-medium">
                    {fp.fingerprint_name || '-'}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {fp.fingerprint_number}
                  </TableCell>
                  <TableCell>
                    <Badge variant={fp.fingerprint_type === 1 ? 'default' : 'secondary'}>
                      {fp.fingerprint_type === 1 ? 'Normal' : fp.fingerprint_type === 4 ? 'Cyclic' : `Type ${fp.fingerprint_type}`}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {fp.users
                      ? `${fp.users.first_name} ${fp.users.last_name}`
                      : '-'
                    }
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariants[fp.status] || 'outline'}>
                      {statusLabels[fp.status] || `Unknown (${fp.status})`}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {fp.start_date
                      ? new Date(fp.start_date).toLocaleDateString()
                      : '-'
                    }
                    {fp.end_date && (
                      <> — {new Date(fp.end_date).toLocaleDateString()}</>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {new Date(fp.created_at).toLocaleDateString()}
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
