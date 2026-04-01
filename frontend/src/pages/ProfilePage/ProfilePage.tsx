import { useEffect } from 'react';

import styles from './ProfilePage.module.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useAuth } from '@/features/auth';
import { navigateTo } from '@/shared/lib/navigation';

export function ProfilePage() {
  const { user, isAuthenticated, isInitializing } = useAuth();

  useEffect(() => {
    if (!isInitializing && !isAuthenticated) {
      navigateTo('/login');
    }
  }, [isAuthenticated, isInitializing]);

  if (isInitializing) {
    return null;
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div className={styles.page}>
      <Header title="Профиль" authActionVariant="logout" />

      <main className={styles.main}>
        <div className="container">
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h1 className={styles.title}>Профиль пользователя</h1>
              <p className={styles.subtitle}>
                Информация текущей учётной записи
              </p>
            </div>

            <div className={styles.infoGrid}>
              <div className={styles.item}>
                <div className={styles.itemLabel}>Логин</div>
                <div className={styles.itemValue}>{user.login}</div>
              </div>

              <div className={styles.item}>
                <div className={styles.itemLabel}>ФИО</div>
                <div className={styles.itemValue}>{user.full_name}</div>
              </div>

              <div className={styles.item}>
                <div className={styles.itemLabel}>Роль</div>
                <div className={styles.itemValue}>
                  {user.role_name ?? '—'}
                </div>
              </div>

              <div className={styles.item}>
                <div className={styles.itemLabel}>Подразделение</div>
                <div className={styles.itemValue}>
                  {user.department_name ?? '—'}
                </div>
              </div>

              <div className={styles.item}>
                <div className={styles.itemLabel}>Автор</div>
                <div className={styles.itemValue}>
                  {user.author_name ?? '—'}
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}