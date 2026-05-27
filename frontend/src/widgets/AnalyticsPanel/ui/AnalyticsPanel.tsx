import { useEffect, useMemo, useState } from 'react';

import {
  getAnalyticsDashboard,
  type DashboardResponse,
} from '../api/analytics';
import { AnalyticsLwlCard } from './AnalyticsLwlCard';
import { AnalyticsTypesCard } from './AnalyticsTypesCard';
import { AnalyticsYearsCard } from './AnalyticsYearsCard';
import styles from './AnalyticsPanel.module.css';

type AnalyticsPanelProps = {
  defaultYearsFrom?: number;
  defaultYearsTo?: number;
  defaultTypesYear?: number;
  defaultLwlYear?: number;
};

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

  const analyticsYearOptions = useMemo(
    () => availableYears.filter((year) => year >= 2016),
    [availableYears],
  );

  return (
    <section className={styles.section} aria-labelledby="analytics-panel-title">
      <div className={`app-surface ${styles.panel}`}>
        <h2 id="analytics-panel-title" className={styles.panelTitle}>
          Аналитическая панель
        </h2>

        {isLoading && !data && (
          <div className={styles.state}>Загрузка аналитики...</div>
        )}
        {error && !data && <div className={styles.state}>{error}</div>}

        {data && (
          <div className={styles.grid}>
            <AnalyticsYearsCard
              data={data.years.series}
              yearsFrom={yearsFrom}
              yearsTo={yearsTo}
              maxYear={Math.max(...availableYears)}
              onYearsFromChange={setYearsFrom}
              onYearsToChange={setYearsTo}
            />

            <AnalyticsTypesCard
              year={data.types.year}
              total={data.types.total}
              data={data.types.series}
              availableYears={analyticsYearOptions}
              onYearChange={setTypesYear}
            />

            <AnalyticsLwlCard
              year={data.lwl.year}
              data={data.lwl.series}
              availableYears={analyticsYearOptions}
              onYearChange={setLwlYear}
            />
          </div>
        )}
      </div>
    </section>
  );
}
