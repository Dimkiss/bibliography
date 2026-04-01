import { useEffect, useState } from 'react';

import { MainPage } from '@/pages/MainPage';
import { LoginPage } from '@/pages/LoginPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { PublicationsPage } from '@/pages/PublicationsPage';
import { UserManagementPage } from '@/pages/UserManagementPage';
import { AuthProvider } from '@/features/auth';

function AppRoutes() {
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => {
      setPathname(window.location.pathname);
    };

    window.addEventListener('popstate', handleLocationChange);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  if (pathname === '/login') {
    return <LoginPage />;
  }

  if (pathname === '/profile') {
    return <ProfilePage />;
  }

  if (pathname === '/user-management') {
    return <UserManagementPage />;
  }

  if (pathname === '/articles') {
    return <PublicationsPage />;
  }

  return <MainPage />;
}

export function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}