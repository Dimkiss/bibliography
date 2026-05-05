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
import { AXIS_COLOR, BAR_COLOR, GRID_COLOR } from './chartConfig';
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
    <article className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>Распределение по уровням БС</h3>

        <YearSelect
          value={year}
          onChange={onYearChange}
          options={availableYears}
          ariaLabel="Год для распределения по уровням БС"
        />
      </div>

      <div className={styles.chartArea}>
        <div className={styles.axisLabelVertical}>Количество статей</div>

        <ResponsiveContainer width="100%" height={216}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 22, bottom: 0 }}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: AXIS_COLOR }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: AXIS_COLOR }}
              tickLine={false}
              axisLine={false}
              width={38}
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
