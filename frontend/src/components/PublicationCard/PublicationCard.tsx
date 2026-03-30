import styles from './PublicationCard.module.css';

export type PublicationCardProps = {
  title: string;
  authors: string;
  journal: string;
  year: number;
  doi: string;
};

export function PublicationCard({
  title,
  authors,
  journal,
  year,
  doi,
}: PublicationCardProps) {
  return (
    <article className={styles.card}>
      <h3 className={styles.title}>{title}</h3>

      <p className={styles.authors}>{authors}</p>

      <div className={styles.meta}>
        <span className={styles.journal}>{journal}</span>
        <span className={styles.year}>{year}</span>
      </div>

      <a
        className={styles.doi}
        href={`https://doi.org/${doi}`}
        target="_blank"
        rel="noreferrer"
      >
        DOI: {doi}
      </a>
    </article>
  );
}