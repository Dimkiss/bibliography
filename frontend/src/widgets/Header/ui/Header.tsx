import { useEffect, useMemo, useState } from 'react';

import styles from './Header.module.css';
import { Icon } from '@/shared/ui/Icon';
import { NavButton } from '@/shared/ui/NavButton';
import { OutlineButton } from '@/shared/ui/OutlineButton';
import { useAuth } from '@/features/auth';
import { navigateTo } from '@/shared/lib/navigation';
import {
  ADMIN_ROLE_ID,
  ADMINISTRATION_ROLE_ID,
  DEPARTMENT_HEAD_ROLE_ID,
} from '@/entities/role';

type NavItem = {
  id: string;
  label: string;
  iconName: string;
  path: string;
};

const baseNavItems = [
  { id: 'home', label: 'Главная', iconName: 'main-page', path: '/' },
  {
    id: 'articles',
    label: 'Публикации',
    iconName: 'article-outline',
    path: '/articles',
  },
  {
    id: 'journals',
    label: 'Издания',
    iconName: 'journal-outline',
    path: '/journals',
  },
] as const;

const tailNavItems = [
  { id: 'help', label: 'Справка', iconName: 'help-outline', path: '/help' },
  { id: 'about', label: 'О проекте', iconName: 'info-outline', path: '/about' },
] as const;

const userManagementNavItem = {
  id: 'user-management',
  label: 'Пользователи',
  iconName: 'gmail_groups',
  path: '/user-management',
} as const;

const authorManagementNavItem = {
  id: 'author-management',
  label: 'Авторы',
  iconName: 'person',
  path: '/author-management',
} as const;

type HeaderActionVariant = 'default' | 'hidden' | 'logout' | 'back';

type HeaderProps = {
  title: string;
  authActionVariant?: HeaderActionVariant;
};

function getActiveNavItem(
  pathname: string,
  navItems: ReadonlyArray<{
    id: string;
    path: string;
  }>,
): string | null {
  if (pathname === '/') {
    return 'home';
  }

  const matchedItem = navItems.find((item) => {
    if (item.path === '/') {
      return false;
    }

    return pathname === item.path || pathname.startsWith(`${item.path}/`);
  });

  return matchedItem?.id ?? null;
}

export function Header({
  title,
  authActionVariant = 'default',
}: HeaderProps) {
  const [pathname, setPathname] = useState(window.location.pathname);
  const { user, isAuthenticated, isInitializing, logout } = useAuth();

  useEffect(() => {
    const handleLocationChange = () => {
      setPathname(window.location.pathname);
    };

    window.addEventListener('popstate', handleLocationChange);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  const isAdmin = isAuthenticated && user?.role_id === ADMIN_ROLE_ID;
  const canAccessAuthors =
    isAuthenticated &&
    (user?.role_id === ADMIN_ROLE_ID ||
      user?.role_id === ADMINISTRATION_ROLE_ID ||
      user?.role_id === DEPARTMENT_HEAD_ROLE_ID);

  const navItems = useMemo(() => {
    const items: NavItem[] = [...baseNavItems];
    if (canAccessAuthors) items.push(authorManagementNavItem);
    if (isAdmin) items.push(userManagementNavItem);
    items.push(...tailNavItems);
    return items;
  }, [isAdmin, canAccessAuthors]);

  const activeItem = useMemo(
    () => getActiveNavItem(pathname, navItems),
    [pathname, navItems],
  );

  const handleLogout = () => {
    logout();
    navigateTo('/');
  };

  const handleBack = () => {
    if (window.history.state !== null && window.history.length > 1) {
      window.history.back();
      return;
    }

    navigateTo('/');
  };

  const renderAuthAction = () => {
    if (isInitializing || authActionVariant === 'hidden') {
      return null;
    }

    if (authActionVariant === 'back') {
      return (
        <OutlineButton
          className={styles.headerAuthButton}
          size="normal"
          iconName="arrow_back"
          label="Назад"
          onClick={handleBack}
        />
      );
    }

    if (authActionVariant === 'logout') {
      return (
        <OutlineButton
          className={styles.headerAuthButton}
          size="normal"
          iconName="log-in"
          label="Выход"
          onClick={handleLogout}
        />
      );
    }

    if (isAuthenticated && user) {
      return (
        <OutlineButton
          className={styles.headerAuthButton}
          size="normal"
          iconName="person"
          label={user.login}
          onClick={() => navigateTo('/profile')}
        />
      );
    }

    return (
      <OutlineButton
        className={styles.headerAuthButton}
        size="normal"
        iconName="log-in"
        label="Вход"
        onClick={() => navigateTo('/login')}
      />
    );
  };

  return (
    <header className={styles.header}>
      <div className={styles.logoWrap}>
        <Icon name="lin-color" size={96} colored className={styles.logo} />
      </div>

      <div className={styles.supheader}>
        <div className={styles.inner}>
          <div className={styles.leftSpacer} />

          <nav className={styles.nav} aria-label="Основная навигация">
            {navItems.map((item) => (
              <NavButton
                key={item.id}
                iconName={item.iconName}
                label={item.label}
                selected={activeItem === item.id}
                onClick={() => navigateTo(item.path)}
              />
            ))}
          </nav>

          <div className={styles.actions}>{renderAuthAction()}</div>
        </div>
      </div>

      <div className={styles.subheader}>
        <div className={styles.subheaderTitle}>{title}</div>
      </div>
    </header>
  );
}
