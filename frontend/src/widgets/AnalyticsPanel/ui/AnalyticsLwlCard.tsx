import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { DashboardLwlPoint } from '../api/analytics';
import { YearSelect } from '@/shared/ui/YearSelect';
import { AnalyticsTooltip } from './AnalyticsTooltip';
import { BAR_COLOR, CHART_TICK_STYLE, GRID_COLOR } from './chartConfig';
import styles from './AnalyticsPanel.module.css';

type AnalyticsLwlCardProps = {
  year: number;
  data: DashboardLwlPoint[];
  availableYears: number[];
  onYearChange: (year: number) => void;
};

export function AnalyticsLwlCard({
  year,
  data,
  availableYears,
  onYearChange,
}: AnalyticsLwlCardProps) {
  return (
    <article className={`${styles.card} ${styles.lwlCard}`}>
      <div className={styles.cardHeader}>
        <h3 className={`${styles.cardTitle} ${styles.lwlCardTitle}`}>
          Распределение по уровням БС
        </h3>

        <YearSelect
          value={year}
          onChange={onYearChange}
          options={availableYears}
          ariaLabel="Год для распределения по уровням БС"
        />
      </div>

      <div className={`${styles.chartArea} ${styles.lwlChartArea}`}>
        <div className={styles.axisLabelVertical}>Количество статей</div>

        <ResponsiveContainer width="100%" height={216}>
          <BarChart data={data} margin={{ top: 0, right: 0, left: 20, bottom: 0 }}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis
              dataKey="label"
              height={16}
              tick={{
                ...CHART_TICK_STYLE,
                dy: -2,
              }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={CHART_TICK_STYLE}
              tickLine={false}
              axisLine={false}
              width={28}
            />
            <Tooltip content={<AnalyticsTooltip />} />
            <Bar dataKey="count" fill={BAR_COLOR} maxBarSize={28}>
              {data.map((entry) => (
                <Cell key={`${entry.label}-${entry.level}`} fill={BAR_COLOR} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}
