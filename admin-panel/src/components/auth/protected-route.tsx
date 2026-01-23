import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'
import { Loader2, ShieldX } from 'lucide-react'

// Only these emails can access the admin panel
const ALLOWED_EMAILS = [
  'abillkishoreraj@gmail.com',
  'admintest@gmail.com',
  'tester@gmail.com',
]

export function ProtectedRoute() {
  const { user, loading, signOut } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Check if user email is in allowed list
  if (!ALLOWED_EMAILS.includes(user.email)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-full bg-red-100 dark:bg-red-950">
              <ShieldX className="h-10 w-10 text-red-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-6">
            You don't have permission to access the admin panel. Contact the administrator for access.
          </p>
          <button
            onClick={() => signOut()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  return <Outlet />
}
