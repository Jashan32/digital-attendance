import { createRoot } from 'react-dom/client'
import './index.css'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { DashboardLayout } from './components/Layout/DashboardLayout'
import { Home } from './pages/Home'
import { Students } from './pages/Students'
import { Branches } from './pages/Branches'
import { Subjects } from './pages/Subjects'
import { Timetable } from './pages/Timetable'
import { Attendance } from './pages/Attendance'

createRoot(document.getElementById('root')!).render(
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<Navigate to="home" replace />} />
          <Route path="home" element={<Home />} />
          <Route path="timetable" element={<Timetable />} />
          <Route path="students" element={<Students />} />
          <Route path="attendence" element={<Attendance />} />
          <Route path="branches" element={<Branches />} />
          <Route path="subjects" element={<Subjects />} />
        </Route>
      </Routes>
    </BrowserRouter>
)
