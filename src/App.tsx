import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Tiendas from './pages/Tiendas'
import NuevaVenta from './pages/NuevaVenta'
import Historial from './pages/Historial'
import Productos from './pages/Productos'
import Reportes from './pages/Reportes'
import Configuracion from './pages/Configuracion'
import Mercancia from './pages/Mercancia'
import Explorer from './pages/Explorer'
import Nodo4 from './pages/Nodo4'

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactElement; adminOnly?: boolean }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && user.role !== 'admin' && user.role !== 'supervisor') return <Navigate to="/dashboard" replace />
  return children
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={user.role === 'cajero' ? '/ventas' : '/dashboard'} /> : <Login />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/dashboard" element={user?.role === 'cajero' ? <Navigate to="/ventas" replace /> : <Dashboard />} />
        <Route path="/tiendas" element={<ProtectedRoute adminOnly><Tiendas /></ProtectedRoute>} />
        <Route path="/ventas" element={<NuevaVenta />} />
        <Route path="/historial" element={<Historial />} />
        <Route path="/productos" element={<Productos />} />
        <Route path="/mercancia" element={<Mercancia />} />
        <Route path="/explorer" element={<Explorer />} />
        <Route path="/nodo4" element={<ProtectedRoute adminOnly><Nodo4 /></ProtectedRoute>} />
        <Route path="/reportes" element={<Reportes />} />
        <Route path="/config" element={<Configuracion />} />
      </Route>
      <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
