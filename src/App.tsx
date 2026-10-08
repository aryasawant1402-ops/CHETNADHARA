import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { A11yProvider } from './a11y/A11y.tsx'
import { ScreenTimeProvider } from './timer/ScreenTime.tsx'
import { ChildFormPage, ChildrenPage, ConsentPage, CreatePage, LandingPage, LoginPage, SettingsPage } from './screens/account.tsx'
import { CheckPage, DashboardPage, MissingPage, PlanPage, PlayPage, ReportPage, TeacherPage } from './screens/flow.tsx'
import { listChildren, currentParent } from './db/store.ts'

function DashboardHome() {
  const [path, setPath] = useState<string | null>(null)
  useEffect(() => {
    void currentParent().then(async (parent) => {
      if (!parent) {
        setPath('/login')
        return
      }
      const children = await listChildren(parent.id)
      setPath(children[0] ? `/dashboard/${children[0].id}` : '/children')
    })
  }, [])
  if (!path) return <p className="measure">Loading…</p>
  return <Navigate to={path} />
}

export default function App() {
  return (
    <BrowserRouter>
      <A11yProvider>
        <ScreenTimeProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/create" element={<CreatePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/consent" element={<ConsentPage />} />
            <Route path="/children" element={<ChildrenPage />} />
            <Route path="/children/new" element={<ChildFormPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/dashboard" element={<DashboardHome />} />
            <Route path="/dashboard/:childId" element={<DashboardPage />} />
            <Route path="/child/:childId/check" element={<CheckPage />} />
            <Route path="/child/:childId/plan" element={<PlanPage />} />
            <Route path="/child/:childId/play/:activityId" element={<PlayPage />} />
            <Route path="/report/:reportId" element={<ReportPage />} />
            <Route path="/teacher" element={<TeacherPage />} />
            <Route path="*" element={<MissingPage />} />
          </Routes>
        </ScreenTimeProvider>
      </A11yProvider>
    </BrowserRouter>
  )
}
