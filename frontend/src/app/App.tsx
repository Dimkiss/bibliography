import { useEffect, useMemo, useState } from 'react';

import { MainPage } from '@/pages/MainPage';
import { AboutProjectPage } from '@/pages/AboutProjectPage';
import { LoginPage } from '@/pages/LoginPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { PublicationsPage } from '@/pages/PublicationsPage';
import { EditionsPage } from '@/pages/EditionsPage';
import { EditionDetailsPage } from '@/pages/EditionDetailsPage';
import { PeriodicalEditionFormPage } from '@/pages/PeriodicalEditionFormPage';
import { PublicationDetailsPage } from '@/pages/PublicationDetailsPage';
import { PublicationsCreatePage } from '@/pages/PublicationsCreatePage';
import { UserManagementPage } from '@/pages/UserManagementPage';
import { AuthorManagementPage } from '@/pages/AuthorManagementPage';
import { AuthorDetailsPage } from '@/pages/AuthorDetailsPage';
import { AuthProvider } from '@/features/auth';
import {
  getCurrentNavigationPath,
  subscribeToNavigation,
} from '@/shared/lib/navigation';

function AppRoutes() {
  const [locationPath, setLocationPath] = useState(getCurrentNavigationPath);

  useEffect(() => {
    return subscribeToNavigation(() => {
      setLocationPath(getCurrentNavigationPath());
    });
  }, []);

  const pathname = useMemo(() => {
    return new URL(locationPath, window.location.origin).pathname;
  }, [locationPath]);

  const isPublicationDetailsPage = useMemo(() => {
    return /^\/articles\/\d+$/.test(pathname);
  }, [pathname]);

  const publicationEditArticleId = useMemo(() => {
    const match = pathname.match(/^\/articles\/(\d+)\/edit$/);
    if (!match) {
      return null;
    }

    const parsed = Number(match[1]);
    return Number.isNaN(parsed) ? null : parsed;
  }, [pathname]);

  const isEditionDetailsPage = useMemo(() => {
    return /^\/journals\/(?:periodical|nonperiodical)\/\d+$/.test(pathname);
  }, [pathname]);

  const periodicalEditionEditSourceId = useMemo(() => {
    const match = pathname.match(/^\/journals\/periodical\/(\d+)\/edit$/);
    if (!match) {
      return null;
    }

    const parsed = Number(match[1]);
    return Number.isNaN(parsed) ? null : parsed;
  }, [pathname]);

  const isAuthorDetailsPage = useMemo(() => {
    return /^\/authors\/\d+$/.test(pathname);
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

  if (pathname === '/author-management') {
    return <AuthorManagementPage />;
  }

  if (isAuthorDetailsPage) {
    return <AuthorDetailsPage key={locationPath} />;
  }

  if (pathname === '/articles/create') {
    return <PublicationsCreatePage />;
  }

  if (publicationEditArticleId !== null) {
    return <PublicationsCreatePage key={locationPath} articleId={publicationEditArticleId} />;
  }

  if (pathname === '/articles') {
    return <PublicationsPage key={locationPath} />;
  }

  if (pathname === '/journals') {
    return <EditionsPage key={locationPath} />;
  }

  if (pathname === '/journals/periodical/create') {
    return <PeriodicalEditionFormPage key={locationPath} />;
  }

  if (periodicalEditionEditSourceId !== null) {
    return (
      <PeriodicalEditionFormPage
        key={locationPath}
        sourceId={periodicalEditionEditSourceId}
      />
    );
  }

  if (isEditionDetailsPage) {
    return <EditionDetailsPage key={locationPath} />;
  }

  if (isPublicationDetailsPage) {
    return <PublicationDetailsPage key={locationPath} />;
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
