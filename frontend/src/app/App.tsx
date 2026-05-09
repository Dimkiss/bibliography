import { useEffect, useMemo, useState } from 'react';

import { MainPage } from '@/pages/MainPage';
import { AboutProjectPage } from '@/pages/AboutProjectPage';
import { LoginPage } from '@/pages/LoginPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { PublicationsPage } from '@/pages/PublicationsPage';
import { PublicationDetailsPage } from '@/pages/PublicationDetailsPage';
import { PublicationsCreatePage } from '@/pages/PublicationsCreatePage';
import { UserManagementPage } from '@/pages/UserManagementPage';
import { AuthProvider } from '@/features/auth';
import { subscribeToNavigation } from '@/shared/lib/navigation';

function AppRoutes() {
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    return subscribeToNavigation(() => {
      setPathname(window.location.pathname);
    });
  }, []);

  const isPublicationDetailsPage = useMemo(() => {
    return /^\/articles\/\d+$/.test(pathname);
  }, [pathname]);

  if (pathname === '/login') {
    return <LoginPage />;
  }

  if (pathname === '/profile') {
    return <ProfilePage />;
  }

  if (pathname === '/about') {
    return <AboutProjectPage />;
  }

  if (pathname === '/user-management') {
    return <UserManagementPage />;
  }

  if (pathname === '/articles/create') {
    return <PublicationsCreatePage />;
  }

  if (pathname === '/articles') {
    return <PublicationsPage />;
  }

  if (isPublicationDetailsPage) {
    return <PublicationDetailsPage />;
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
