import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout() {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <div style={{ padding: '24px', maxWidth: 1280, margin: '0 auto' }} className="fade-up">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
