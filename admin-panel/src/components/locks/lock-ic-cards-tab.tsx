import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ICCard } from '@/lib/supabase'
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

interface LockICCardsTabProps {
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

export function LockICCardsTab({ lockId }: LockICCardsTabProps) {
  const [cards, setCards] = useState<ICCard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchCards() {
      try {
        const { data, error } = await supabase
          .from('ic_cards')
          .select('*, users:user_id(first_name, last_name)')
          .eq('lock_id', lockId)
          .order('created_at', { ascending: false })

        if (error) throw error
        setCards(data || [])
      } catch (error) {
        console.error('Error fetching IC cards:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCards()
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
        <CardTitle className="text-lg">IC Cards ({cards.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {cards.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No IC cards registered for this lock
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Card Name</TableHead>
                <TableHead>Card Number</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sync</TableHead>
                <TableHead>Valid Period</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cards.map((card) => (
                <TableRow key={card.id}>
                  <TableCell className="font-medium">
                    {card.card_name || '-'}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {card.card_number}
                  </TableCell>
                  <TableCell>
                    {card.users
                      ? `${card.users.first_name} ${card.users.last_name}`
                      : '-'
                    }
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariants[card.status] || 'outline'}>
                      {statusLabels[card.status] || `Unknown (${card.status})`}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {card.sync_status ? (
                      <Badge variant={syncVariants[card.sync_status] || 'secondary'} className="text-xs">
                        {syncLabels[card.sync_status] || card.sync_status}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {card.start_date
                      ? new Date(card.start_date).toLocaleDateString()
                      : '-'
                    }
                    {card.end_date && (
                      <> — {new Date(card.end_date).toLocaleDateString()}</>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {new Date(card.created_at).toLocaleDateString()}
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
