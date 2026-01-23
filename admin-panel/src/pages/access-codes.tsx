import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { AccessCode } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Search, KeyRound } from 'lucide-react'

interface AccessCodeWithJoins extends AccessCode {
  locks?: { name: string }
  created_by?: { first_name: string; last_name: string }
}

export function AccessCodesPage() {
  const [codes, setCodes] = useState<AccessCodeWithJoins[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    async function fetchCodes() {
      try {
        const { data, error } = await supabase
          .from('access_codes')
          .select('*, locks(name), created_by:users!access_codes_created_by_user_id_fkey(first_name, last_name)')
          .order('created_at', { ascending: false })

        if (error) throw error
        setCodes(data || [])
      } catch (error) {
        console.error('Error fetching access codes:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCodes()
  }, [])

  const filteredCodes = codes.filter(code => {
    const searchLower = searchQuery.toLowerCase()
    return (
      code.code.toLowerCase().includes(searchLower) ||
      (code.name?.toLowerCase().includes(searchLower) || false) ||
      (code.locks?.name?.toLowerCase().includes(searchLower) || false)
    )
  })

  const getCodeTypeBadge = (type: string) => {
    switch (type) {
      case 'permanent':
        return 'default'
      case 'temporary':
        return 'secondary'
      case 'one_time':
        return 'outline'
      default:
        return 'outline'
    }
  }

  const isCodeValid = (code: AccessCodeWithJoins) => {
    if (!code.is_active) return false
    const now = new Date()
    if (code.valid_from && new Date(code.valid_from) > now) return false
    if (code.valid_until && new Date(code.valid_until) < now) return false
    if (code.code_type === 'one_time' && code.usage_count >= 1) return false
    if (code.max_usage_count && code.usage_count >= code.max_usage_count) return false
    return true
  }

  if (loading) {
    return <AccessCodesSkeleton />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Access Codes</h1>
          <p className="text-muted-foreground">Manage PIN codes for locks</p>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <KeyRound className="h-5 w-5" />
          <span>{codes.length} total codes</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Access Codes</CardTitle>
              <CardDescription>View and manage PIN access codes</CardDescription>
            </div>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search codes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredCodes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? 'No codes found matching your search' : 'No access codes found'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Lock</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Valid Period</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCodes.map((code) => (
                  <TableRow key={code.id}>
                    <TableCell className="font-mono font-semibold">{code.code}</TableCell>
                    <TableCell>{code.name || '-'}</TableCell>
                    <TableCell>{code.locks?.name || 'Unknown Lock'}</TableCell>
                    <TableCell>
                      <Badge variant={getCodeTypeBadge(code.code_type)} className="capitalize">
                        {code.code_type.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={isCodeValid(code) ? 'default' : 'destructive'}>
                        {isCodeValid(code) ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {code.max_usage_count
                        ? `${code.usage_count} / ${code.max_usage_count}`
                        : code.usage_count
                      }
                    </TableCell>
                    <TableCell className="text-sm">
                      {code.valid_from && (
                        <div>From: {new Date(code.valid_from).toLocaleDateString()}</div>
                      )}
                      {code.valid_until && (
                        <div>Until: {new Date(code.valid_until).toLocaleDateString()}</div>
                      )}
                      {!code.valid_from && !code.valid_until && '-'}
                    </TableCell>
                    <TableCell>
                      {new Date(code.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function AccessCodesSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-5 w-48 mt-2" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
