import {
  formatEditionPresence,
  type EditionListItemDto,
} from '@/entities/edition';
import {
  EditionScopusQuartileBadge,
  EditionWhiteListLevelBadge,
  EditionWosQuartileBadge,
} from './EditionQuartileBadge';
import styles from './EditionResultsList.module.css';

type EditionMetricBadgeProps = {
  label?: string;
  value: string;
};

export function EditionMetricBadge({ label, value }: EditionMetricBadgeProps) {
  return (
    <span className={styles.metric}>
      {label ? <span className={styles.metricLabel}>{label}</span> : null}
      <span className={styles.metricValue}>{value}</span>
    </span>
  );
}

export function EditionMetrics({ item }: { item: EditionListItemDto }) {
  return (
    <div className={styles.metrics}>
      <span className={styles.metric}>
        <span className={styles.metricLabel}>Белый список</span>
        <EditionWhiteListLevelBadge item={item} />
      </span>
      <span className={styles.metric}>
        <span className={styles.metricLabel}>Web of Science</span>
        <EditionWosQuartileBadge item={item} />
      </span>
      <span className={styles.metric}>
        <span className={styles.metricLabel}>Scopus</span>
        <EditionScopusQuartileBadge item={item} />
      </span>
      <EditionMetricBadge label="РИНЦ" value={formatEditionPresence(item.rinc)} />
      <EditionMetricBadge label="ВАК" value={formatEditionPresence(item.vak)} />
    </div>
  );
}
