import { useEffect, useState } from 'react';

import styles from './ProfilePage.module.css';
import { Header } from '@/widgets/Header';
import { Footer } from '@/widgets/Footer';
import { useAuth } from '@/features/auth';
import { ProfilePublicationsSection } from '@/features/profile-publications';
import { navigateTo } from '@/shared/lib/navigation';

const CURRENT_YEAR = new Date().getFullYear();

function formatValue(value: string | number | null | undefined): string {
  if (value === null || typeof value === 'undefined' || value === '') {
    return '—';
  }

  return String(value);
}

function formatAuthorType(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }

  return value === 'О' ? 'Штатный сотрудник' : value === 'В' ? 'Внештатный' : value;
}

function formatAuthorStatus(value: number | null | undefined): string {
  if (value === null || typeof value === 'undefined') {
    return '—';
  }

  return (
    {
      0: 'Уволен',
      1: 'Работает',
      2: 'Временно не работает',
    }[value] ?? String(value)
  );
}

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
  const displayName = user.author_name ?? user.full_name;

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
            </div>

            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Должность</span>
                <span className={styles.infoValue}>{formatValue(user.position)}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Учёная степень</span>
                <span className={styles.infoValue}>{formatValue(user.degree)}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Звание</span>
                <span className={styles.infoValue}>{formatValue(user.rank)}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Email</span>
                <span className={styles.infoValue}>{formatValue(user.email)}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>ORCID</span>
                {user.orcid ? (
                  <a
                    className={styles.infoValue}
                    href={`https://orcid.org/${user.orcid}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {user.orcid}
                  </a>
                ) : (
                  <span className={styles.infoValue}>—</span>
                )}
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Scopus ID</span>
                {user.scopus_id ? (
                  <a
                    className={styles.infoValue}
                    href={`https://www.scopus.com/authid/detail.uri?authorId=${user.scopus_id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {user.scopus_id}
                  </a>
                ) : (
                  <span className={styles.infoValue}>—</span>
                )}
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>WOS ID</span>
                {user.wos_id ? (
                  <a
                    className={styles.infoValue}
                    href={`https://www.webofscience.com/wos/author/record/${user.wos_id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {user.wos_id}
                  </a>
                ) : (
                  <span className={styles.infoValue}>—</span>
                )}
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Подразделение</span>
                <span className={styles.infoValue}>
                  {formatValue(user.department_name)}
                </span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Тип</span>
                <span className={styles.infoValue}>{formatAuthorType(user.type)}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Статус</span>
                <span className={styles.infoValue}>
                  {formatAuthorStatus(user.status)}
                </span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Дата рождения</span>
                <span className={styles.infoValue}>{formatValue(user.birthdate)}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Год рождения</span>
                <span className={styles.infoValue}>{formatValue(user.birth_year)}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Псевдоним</span>
                <span className={styles.infoValue}>{formatValue(user.nickname)}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Шаблон поиска</span>
                <span className={styles.infoValue}>
                  {formatValue(user.search_pattern)}
                </span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Внешний ID</span>
                <span className={styles.infoValue}>{formatValue(user.external_id)}</span>
              </div>
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
