import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useStateContext } from '../contexts/ContextProvider'
import axiosClient from '../axios-client'
import Sidebar from './Sidebar'
import Header from '../components/Header'
import { useTheme } from '../contexts/theme-context'

export default function DefaultLayout() {

  const { user, token, setUser, setToken } = useStateContext();
  const { preferences, setPreference } = useTheme();

  const sidebarOpen = !preferences.sidebarCompact;
  const setSidebarOpen = (open) => setPreference("sidebarCompact", !open);
  const [mobileOpen, setMobileOpen] = useState(false);


  useEffect(() => {
    if (token) {
      axiosClient.get('/user')
        .then(({ data }) => setUser(data))
        .catch(() => setToken(null));
    }
  }, [token]);

  if (!token) {
    return <Navigate to="/login"/>;
  }

  const onLogout = (ev) => {
    ev.preventDefault();
    axiosClient.post('/logout').then(() => {
      setUser({});
      setToken(null);
    });
  };


  return (
    <div className="app-shell">

      <a href="#main-content" className="skip-link">Skip to content</a>
      <Sidebar
        onLogout={onLogout}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      <div className="app-main">

        <Header
          user={user}
          onLogout={onLogout}
          setMobileOpen={setMobileOpen}
        />

        <main id="main-content" className="workspace-content">
          <Outlet />
        </main>

      </div>

    </div>
  )
}