import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

import type { DashboardTypePoint } from '../api/analytics';
import { YearSelect } from '@/shared/ui/YearSelect';
import { AnalyticsTooltip } from './AnalyticsTooltip';
import { PIE_COLORS } from './chartConfig';
import { formatPublicationsCountLabel } from './formatPublicationsCountLabel';
import styles from './AnalyticsPanel.module.css';

type AnalyticsTypesCardProps = {
  year: number;
  total: number;
  data: DashboardTypePoint[];
  availableYears: number[];
  onYearChange: (year: number) => void;
};

export function AnalyticsTypesCard({
  year,
  total,
  data,
  availableYears,
  onYearChange,
}: AnalyticsTypesCardProps) {
  return (
    <article className={`${styles.card} ${styles.typesCard}`}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>Распределение по типам</h3>

        <YearSelect
          value={year}
          onChange={onYearChange}
          options={availableYears}
          ariaLabel="Год для распределения по типам"
        />
      </div>

      <div className={`${styles.chartArea} ${styles.typesChartArea}`}>
        <div className={styles.donutWrap}>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Tooltip
                content={<AnalyticsTooltip />}
                wrapperStyle={{ zIndex: 20 }}
              />
              <Pie
                data={data}
                dataKey="count"
                nameKey="category"
                cx="50%"
                cy="50%"
                innerRadius={46}
                outerRadius={78}
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`${entry.category}-${index}`}
                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          <div className={styles.donutCenter} aria-hidden="true">
            <span className={styles.donutCenterValue}>{total}</span>
            <span className={styles.donutCenterCaption}>
              {formatPublicationsCountLabel(total)}
            </span>
          </div>
        </div>

        <div className={styles.legendRow}>
          {data.map((item, index) => (
            <div key={item.category} className={styles.legendItem}>
              <span
                className={styles.legendDot}
                style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
              />
              <span className={styles.legendText}>{item.category}</span>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}
