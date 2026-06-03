import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import api from '../lib/api'

interface User {
  username: string
  role: 'admin' | 'supervisor' | 'gerente' | 'cajero'
  nombre: string
  tienda: string | null
}

interface AuthCtx {
  user: User | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  isAdmin: boolean       // admin o supervisor
  isSuperAdmin: boolean  // solo admin puro
}

const AuthContext = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  })

  const login = async (username: string, password: string) => {
    const form = new FormData()
    form.append('username', username)
    form.append('password', password)
    const { data } = await api.post('/auth/login', form)
    localStorage.setItem('token', data.access_token)
    const userData: User = {
      username: data.username,
      role: data.role,
      nombre: data.nombre,
      tienda: data.tienda,
    }
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{
      user, login, logout,
      isAdmin: user?.role === 'admin' || user?.role === 'supervisor',
      isSuperAdmin: user?.role === 'admin',
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth fuera de AuthProvider')
  return ctx
}
