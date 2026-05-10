import { buildDoiUrl } from '@/entities/publication';
import { stopInteractiveEvent } from './publicationResultsList.lib';
import styles from './PublicationResultsList.module.css';

type DoiValueProps = {
  doi: string | null;
};

export function DoiValue({ doi }: DoiValueProps) {
  const doiUrl = buildDoiUrl(doi);

  if (!doi) {
    return <span className={styles.placeholder}>—</span>;
  }

  if (!doiUrl) {
    return <span className={styles.doiText}>{doi}</span>;
  }

  return (
    <a
      className={styles.doiLink}
      href={doiUrl}
      target="_blank"
      rel="noreferrer"
      onClick={stopInteractiveEvent}
    >
      {doi}
    </a>
  );
}
