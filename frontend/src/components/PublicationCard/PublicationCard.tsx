import { buildDoiUrl } from '@/shared/lib/publications';
import styles from './PublicationCard.module.css';

export type PublicationCardProps = {
  title: string | null;
  authors: string | null;
  journal: string | null;
  year: number | null;
  doi: string | null;
};

export function PublicationCard({
  title,
  authors,
  journal,
  year,
  doi,
}: PublicationCardProps) {
  const doiUrl = buildDoiUrl(doi);

  return (
    <article className={styles.card}>
      <h3 className={styles.title}>{title || 'Без названия'}</h3>

      <p className={styles.authors}>{authors || 'Авторы не указаны'}</p>

      <div className={styles.meta}>
        {journal ? <span className={styles.journal}>{journal}</span> : null}
        {journal && year ? <span className={styles.separator}>·</span> : null}
        {year ? <span className={styles.year}>{year}</span> : null}
      </div>

      {doiUrl && doi ? (
        <a className={styles.doi} href={doiUrl} target="_blank" rel="noreferrer">
          DOI: {doi}
        </a>
      ) : (
        <span className={styles.doiPlaceholder}>DOI не указан</span>
      )}
    </article>
  );
}