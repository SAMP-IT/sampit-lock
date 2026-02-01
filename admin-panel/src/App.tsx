import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/contexts/auth-context'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { AppLayout } from '@/components/layout/app-layout'
import { LoginPage } from '@/pages/login'
import { DashboardPage } from '@/pages/dashboard'
import { UsersPage } from '@/pages/users'
import { LocksPage } from '@/pages/locks'
import { ActivityPage } from '@/pages/activity'
import { AccessCodesPage } from '@/pages/access-codes'
import { LockDetailPage } from '@/pages/lock-detail'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/locks" element={<LocksPage />} />
                <Route path="/locks/:lockId" element={<LockDetailPage />} />
                <Route path="/activity" element={<ActivityPage />} />
                <Route path="/access-codes" element={<AccessCodesPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
