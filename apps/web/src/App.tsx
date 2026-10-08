import { HashRouter, Route, Routes } from "react-router-dom"

import { AppShell } from "@/components/app-shell"
import { DecisionDetailPage } from "@/pages/decision-detail-page"
import { DecisionFormPage } from "@/pages/decision-form-page"
import { LibraryPage } from "@/pages/library-page"
import { SettingsPage } from "@/pages/settings-page"

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<LibraryPage />} />
          <Route path="recent" element={<LibraryPage />} />
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
