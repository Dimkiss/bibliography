import { useEffect, useState } from 'react';

import styles from './ProfilePage.module.css';
import { Header } from '@/widgets/Header';
import { Footer } from '@/widgets/Footer';
import { useAuth } from '@/features/auth';
import { ProfilePublicationsSection } from '@/features/profile-publications';
import { navigateTo } from '@/shared/lib/navigation';

const CURRENT_YEAR = new Date().getFullYear();

export function ProfilePage() {
  const { user, isAuthenticated, isInitializing } = useAuth();
  const [maxYear, setMaxYear] = useState(CURRENT_YEAR);

  useEffect(() => {
    if (!isInitializing && !isAuthenticated) {
      navigateTo('/login');
    }
  }, [isAuthenticated, isInitializing]);

  useEffect(() => {
    setMaxYear(CURRENT_YEAR);
  }, []);

  if (isInitializing) {
    return null;
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const hasAuthor = Boolean(user.author_id);
  const displayName = user.full_name;

  return (
    <div className="app-page">
      <Header title="Профиль" authActionVariant="logout" />

      <main className="app-main">
        <div className="container app-block-group">

          {/* Блок сотрудника */}
          <div className={`app-surface ${styles.profileBlock}`}>
            <p className={styles.name}>{displayName}</p>
            <div className={styles.metaRow}>
              <div className={styles.metaChip}>
                <span className={styles.metaChipLabel}>Логин</span>
                <span className={styles.metaChipSep}>·</span>
                <span className={styles.metaChipValue}>{user.login}</span>
              </div>
              <div className={styles.metaChip}>
                <span className={styles.metaChipLabel}>Роль</span>
                <span className={styles.metaChipSep}>·</span>
                <span className={styles.metaChipValue}>{user.role_name ?? '—'}</span>
              </div>
              <div className={styles.metaChip}>
                <span className={styles.metaChipLabel}>Подразделение</span>
                <span className={styles.metaChipSep}>·</span>
                <span className={styles.metaChipValue}>{user.department_name ?? '—'}</span>
              </div>
              {user.position && (
                <div className={styles.metaChip}>
                  <span className={styles.metaChipLabel}>Должность</span>
                  <span className={styles.metaChipSep}>·</span>
                  <span className={styles.metaChipValue}>{user.position}</span>
                </div>
              )}
              {user.degree && (
                <div className={styles.metaChip}>
                  <span className={styles.metaChipLabel}>Учёная степень</span>
                  <span className={styles.metaChipSep}>·</span>
                  <span className={styles.metaChipValue}>{user.degree}</span>
                </div>
              )}
              {user.rank && (
                <div className={styles.metaChip}>
                  <span className={styles.metaChipLabel}>Звание</span>
                  <span className={styles.metaChipSep}>·</span>
                  <span className={styles.metaChipValue}>{user.rank}</span>
                </div>
              )}
              {user.email && (
                <div className={styles.metaChip}>
                  <span className={styles.metaChipLabel}>Email</span>
                  <span className={styles.metaChipSep}>·</span>
                  <span className={styles.metaChipValue}>{user.email}</span>
                </div>
              )}
              {user.orcid && (
                <div className={styles.metaChip}>
                  <span className={styles.metaChipLabel}>ORCID</span>
                  <span className={styles.metaChipSep}>·</span>
                  <a
                    className={styles.metaChipValue}
                    href={`https://orcid.org/${user.orcid}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {user.orcid}
                  </a>
                </div>
              )}
              {user.scopus_id && (
                <div className={styles.metaChip}>
                  <span className={styles.metaChipLabel}>Scopus ID</span>
                  <span className={styles.metaChipSep}>·</span>
                  <a
                    className={styles.metaChipValue}
                    href={`https://www.scopus.com/authid/detail.uri?authorId=${user.scopus_id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {user.scopus_id}
                  </a>
                </div>
              )}
              {user.wos_id && (
                <div className={styles.metaChip}>
                  <span className={styles.metaChipLabel}>WOS ID</span>
                  <span className={styles.metaChipSep}>·</span>
                  <a
                    className={styles.metaChipValue}
                    href={`https://www.webofscience.com/wos/author/record/${user.wos_id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {user.wos_id}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Блок публикаций */}
          {hasAuthor ? (
            <div className={`app-surface ${styles.publicationsBlock}`}>
              <ProfilePublicationsSection maxYear={maxYear} />
            </div>
          ) : (
            <div className="app-surface">
              <p className={styles.noAuthorText}>
                Публикации недоступны — учётная запись не привязана к сотруднику.
                Обратитесь к администратору.
              </p>
            </div>
          )}

        </div>
      </main>

      <Footer />
    </div>
  );
}
