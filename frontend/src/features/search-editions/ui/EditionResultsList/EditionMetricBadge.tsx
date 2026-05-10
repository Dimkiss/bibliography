import {
  formatEditionPresence,
  formatMetricValue,
  formatWhiteListLevel,
  type EditionListItemDto,
} from '@/entities/edition';
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
      <EditionMetricBadge
        label="Белый список"
        value={formatWhiteListLevel(item.white_list_level)}
      />
      <EditionMetricBadge
        label="Web of Science"
        value={formatMetricValue(item.wos_quartile)}
      />
      <EditionMetricBadge
        label="Scopus"
        value={formatMetricValue(item.scopus_quartile)}
      />
      <EditionMetricBadge label="РИНЦ" value={formatEditionPresence(item.rinc)} />
      <EditionMetricBadge label="ВАК" value={formatEditionPresence(item.vak)} />
    </div>
  );
}
