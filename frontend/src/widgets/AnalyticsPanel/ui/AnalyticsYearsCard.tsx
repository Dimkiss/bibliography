import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { DashboardYearsPoint } from '../api/analytics';
import { YearRangeSelect } from '@/shared/ui/YearRangeSelect';
import { AnalyticsTooltip } from './AnalyticsTooltip';
import { AXIS_COLOR, GRID_COLOR, LINE_COLOR } from './chartConfig';
import styles from './AnalyticsPanel.module.css';

type AnalyticsYearsCardProps = {
  data: DashboardYearsPoint[];
  yearsFrom: number;
  yearsTo: number;
  maxYear: number;
  onYearsFromChange: (year: number) => void;
  onYearsToChange: (year: number) => void;
};

export function AnalyticsYearsCard({
  data,
  yearsFrom,
  yearsTo,
  maxYear,
  onYearsFromChange,
  onYearsToChange,
}: AnalyticsYearsCardProps) {
  const chartData = [...data].sort((a, b) => a.year - b.year);

  return (
    <article className={`${styles.card} ${styles.yearsCard}`}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>Распределение по годам</h3>

        <YearRangeSelect
          from={yearsFrom}
          to={yearsTo}
          maxYear={maxYear}
          ariaLabel="Диапазон лет для распределения по годам"
          onChange={(range) => {
            onYearsFromChange(range.from);
            onYearsToChange(range.to);
          }}
        />
      </div>

      <div className={`${styles.chartArea} ${styles.yearsChartArea}`}>
        <div className={styles.axisLabelVertical}>Количество публикаций</div>

        <ResponsiveContainer width="100%" height={216}>
          <LineChart data={chartData} margin={{ top: 0, right: 8, left: 20, bottom: 0 }}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis
              dataKey="year"
              height={16}
              tick={{
                dy: -2,
                fill: AXIS_COLOR,
                fontFamily: 'Roboto, sans-serif',
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: 0.5,
              }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{
                fill: AXIS_COLOR,
                fontFamily: 'Roboto, sans-serif',
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: 0.5,
              }}
              tickLine={false}
              axisLine={false}
              width={28}
            />
            <Tooltip content={<AnalyticsTooltip />} />
            <Line
              type="linear"
              dataKey="count"
              stroke={LINE_COLOR}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}
