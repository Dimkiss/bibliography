import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  getAnalyticsDashboard,
  type DashboardLwlPoint,
  type DashboardResponse,
  type DashboardTypePoint,
  type DashboardYearsPoint,
} from '@/shared/api/analytics';
import styles from './AnalyticsPanel.module.css';

type AnalyticsPanelProps = {
  defaultYearsFrom?: number;
  defaultYearsTo?: number;
  defaultTypesYear?: number;
  defaultLwlYear?: number;
};

const PIE_COLORS = ['#DD6A86', '#48A56E', '#3F546F', '#E1B84C', '#8EA3B7'];
const BAR_COLOR = 'var(--Rectangle)';
const LINE_COLOR = '#46AF7A';
const GRID_COLOR = '#D9DEE4';
const AXIS_COLOR = '#4C5B60';

type SelectProps = {
  value: number | string;
  onChange: (value: number) => void;
  options: number[];
  ariaLabel: string;
};

function FilterSelect({ value, onChange, options, ariaLabel }: SelectProps) {
  return (
    <div className={styles.selectWrap}>
      <select
        className={styles.select}
        value={value}
        aria-label={ariaLabel}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function AnalyticsTooltip({
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

export function AnalyticsPanel({
  defaultYearsFrom = 2020,
  defaultYearsTo = 2024,
  defaultTypesYear = 2024,
  defaultLwlYear = 2024,
}: AnalyticsPanelProps) {
  const [yearsFrom, setYearsFrom] = useState<number>(defaultYearsFrom);
  const [yearsTo, setYearsTo] = useState<number>(defaultYearsTo);
  const [typesYear, setTypesYear] = useState<number>(defaultTypesYear);
  const [lwlYear, setLwlYear] = useState<number>(defaultLwlYear);

  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await getAnalyticsDashboard({
          yearsFrom,
          yearsTo,
          typesYear,
          lwlYear,
        });

        if (!isMounted) return;
        setData(response);
      } catch {
        if (!isMounted) return;
        setError('Не удалось загрузить аналитическую панель');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [yearsFrom, yearsTo, typesYear, lwlYear]);

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const startYear = 2000;

    return Array.from(
      { length: currentYear - startYear + 1 },
      (_, index) => currentYear - index,
    );
  }, []);

  return (
    <section className={styles.section} aria-labelledby="analytics-panel-title">
      <div className={styles.panel}>
        <h2 id="analytics-panel-title" className={styles.panelTitle}>
          Аналитическая панель
        </h2>

        {isLoading && <div className={styles.state}>Загрузка аналитики...</div>}
        {!isLoading && error && <div className={styles.state}>{error}</div>}

        {!isLoading && !error && data && (
          <div className={styles.grid}>
            <AnalyticsYearsCard
              data={data.years.series}
              yearsFrom={yearsFrom}
              yearsTo={yearsTo}
              availableYears={availableYears}
              onYearsFromChange={setYearsFrom}
              onYearsToChange={setYearsTo}
            />

            <AnalyticsTypesCard
              year={data.types.year}
              total={data.types.total}
              data={data.types.series}
              availableYears={availableYears}
              onYearChange={setTypesYear}
            />

            <AnalyticsLwlCard
              year={data.lwl.year}
              data={data.lwl.series}
              availableYears={availableYears}
              onYearChange={setLwlYear}
            />
          </div>
        )}
      </div>
    </section>
  );
}

type AnalyticsYearsCardProps = {
  data: DashboardYearsPoint[];
  yearsFrom: number;
  yearsTo: number;
  availableYears: number[];
  onYearsFromChange: (year: number) => void;
  onYearsToChange: (year: number) => void;
};

function AnalyticsYearsCard({
  data,
  yearsFrom,
  yearsTo,
  availableYears,
  onYearsFromChange,
  onYearsToChange,
}: AnalyticsYearsCardProps) {
  const chartData = [...data].sort((a, b) => a.year - b.year);

  return (
    <article className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>Распределение по годам</h3>

        <div className={styles.doubleSelect}>
          <FilterSelect
            value={yearsFrom}
            onChange={onYearsFromChange}
            options={availableYears}
            ariaLabel="Начальный год"
          />
          <span className={styles.rangeDash}>–</span>
          <FilterSelect
            value={yearsTo}
            onChange={onYearsToChange}
            options={availableYears.filter((year) => year >= yearsFrom)}
            ariaLabel="Конечный год"
          />
        </div>
      </div>

      <div className={styles.chartArea}>
        <div className={styles.axisLabelVertical}>Количество публикаций</div>

        <ResponsiveContainer width="100%" height={190}>
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: 22, bottom: 0 }}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 11, fill: AXIS_COLOR }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: AXIS_COLOR }}
              tickLine={false}
              axisLine={false}
              width={36}
            />
            <Tooltip content={<AnalyticsTooltip />} />
            <Line
              type="monotone"
              dataKey="count"
              stroke={LINE_COLOR}
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 2, fill: '#ffffff' }}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

type AnalyticsTypesCardProps = {
  year: number;
  total: number;
  data: DashboardTypePoint[];
  availableYears: number[];
  onYearChange: (year: number) => void;
};

function AnalyticsTypesCard({
  year,
  total,
  data,
  availableYears,
  onYearChange,
}: AnalyticsTypesCardProps) {
  return (
    <article className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>Распределение по типам</h3>

        <FilterSelect
          value={year}
          onChange={onYearChange}
          options={availableYears}
          ariaLabel="Год для распределения по типам"
        />
      </div>

      <div className={styles.donutWrap}>
        <ResponsiveContainer width="100%" height={190}>
          <PieChart>
            <Tooltip content={<AnalyticsTooltip />} />
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

              <Label
                content={({ viewBox }) => {
                  if (!viewBox || !('cx' in viewBox) || !('cy' in viewBox)) return null;

                  return (
                    <g>
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy - 2}
                        textAnchor="middle"
                        className={styles.donutValue}
                      >
                        {total}
                      </text>
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy + 18}
                        textAnchor="middle"
                        className={styles.donutCaption}
                      >
                        публикаций
                      </text>
                    </g>
                  );
                }}
                position="center"
              />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
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
    </article>
  );
}

type AnalyticsLwlCardProps = {
  year: number;
  data: DashboardLwlPoint[];
  availableYears: number[];
  onYearChange: (year: number) => void;
};

function AnalyticsLwlCard({
  year,
  data,
  availableYears,
  onYearChange,
}: AnalyticsLwlCardProps) {
  return (
    <article className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>Распределение по уровням БС</h3>

        <FilterSelect
          value={year}
          onChange={onYearChange}
          options={availableYears}
          ariaLabel="Год для распределения по уровням БС"
        />
      </div>

      <div className={styles.chartArea}>
        <div className={styles.axisLabelVertical}>Количество статей</div>

        <ResponsiveContainer width="100%" height={190}>
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