import styles from './AnalyticsPanel.module.css';

export function AnalyticsTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name?: string }>;
  label?: string | number;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className={styles.tooltip}>
      {label !== undefined && <div className={styles.tooltipLabel}>{label}</div>}
      {payload.map((item, index) => (
        <div key={`${item.name ?? 'value'}-${index}`} className={styles.tooltipValue}>
          {item.name ? `${item.name}: ${item.value}` : item.value}
        </div>
      ))}
    </div>
  );
}
