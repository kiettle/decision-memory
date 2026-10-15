import { HashRouter, Route, Routes } from "react-router-dom"
import { lazy, Suspense } from "react"

import { ComparePage } from "@/pages/compare-page"
import { ScopesPage } from "@/pages/scopes-page"

import { AppShell } from "@/components/app-shell"
import { DecisionDetailPage } from "@/pages/decision-detail-page"
import { DecisionFormPage } from "@/pages/decision-form-page"
import { LibraryPage } from "@/pages/library-page"
import { SettingsPage } from "@/pages/settings-page"
const ProposalReviewPage = lazy(() => import("@/pages/proposal-review-page").then(module => ({ default: module.ProposalReviewPage })))

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<LibraryPage key="library" />} />
          <Route path="scopes" element={<ScopesPage />} />
          <Route path="compare" element={<ComparePage />} />
          <Route path="check-proposal" element={<Suspense fallback={<p className="page-frame" role="status">Loading proposal review…</p>}><ProposalReviewPage /></Suspense>} />
          <Route path="recent" element={<LibraryPage key="recent" />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="decisions/new" element={<DecisionFormPage />} />
          <Route path="decisions/:id" element={<DecisionDetailPage />} />
          <Route path="decisions/:id/edit" element={<DecisionFormPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App
