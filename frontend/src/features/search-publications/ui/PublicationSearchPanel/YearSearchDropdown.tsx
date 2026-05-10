import { forwardRef, useMemo } from 'react';

import type { PublicationSearchFormState } from '@/entities/publication';
import { DropdownButton } from '@/shared/ui/DropdownButton';
import { Icon } from '@/shared/ui/Icon';
import { YearRangePicker } from '@/shared/ui/YearRangeSelect';
import styles from './PublicationSearchPanel.module.css';

const RECENT_YEAR_ACTIONS = [
  { years: 1, label: 'Последний год' },
  { years: 3, label: 'Последние 3 года' },
  { years: 5, label: 'Последние 5 лет' },
] as const;

type YearSearchDropdownProps = {
  value: PublicationSearchFormState;
  yearMin?: number | null;
  yearMax?: number | null;
  isOpen: boolean;
  className?: string;
  onOpenChange: (nextValue: boolean) => void;
  onYearRangeChange: (nextValue: { from: string; to: string }) => void;
};

function parseYear(value: string): number | null {
  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? Math.round(parsedValue) : null;
}

export const YearSearchDropdown = forwardRef<
  HTMLDivElement,
  YearSearchDropdownProps
>(function YearSearchDropdown(
  {
    value,
    yearMin,
    yearMax,
    isOpen,
    className = '',
    onOpenChange,
    onYearRangeChange,
  },
  ref,
) {
  const maxAvailableYear = yearMax ?? new Date().getFullYear();
  const minAvailableYear = yearMin ?? Math.max(1900, maxAvailableYear - 30);
  const minYear = Math.min(minAvailableYear, maxAvailableYear);
  const maxYear = Math.max(minAvailableYear, maxAvailableYear);
  const selectedFrom = parseYear(value.yearFrom) ?? minYear;
  const selectedTo = parseYear(value.yearTo) ?? maxYear;

  const periodLabel = useMemo(() => {
    const hasSelectedPeriod = value.yearFrom.trim() || value.yearTo.trim();

    if (!hasSelectedPeriod) {
      return 'Год';
    }

    const from = value.yearFrom || (yearMin ? String(yearMin) : 'Год от');
    const to = value.yearTo || (yearMax ? String(yearMax) : 'Год до');
    return `${from}–${to}`;
  }, [value.yearFrom, value.yearTo, yearMin, yearMax]);

  const selectRecentYears = (yearsCount: number) => {
    const year = maxYear;
    onYearRangeChange({
      from: String(Math.max(minYear, year - yearsCount + 1)),
      to: String(year),
    });
    onOpenChange(false);
  };

  return (
    <div
      ref={ref}
      className={['app-search-dropdown-wrap', styles.yearDropdownWrap, className]
        .filter(Boolean)
        .join(' ')}
    >
      <DropdownButton
        label={periodLabel}
        icon={<Icon name="calendar_renge" size={18} />}
        size="normal"
        variant="tonal"
        width={240}
        className={styles.yearTrigger}
        isOpen={isOpen}
        onClick={() => onOpenChange(!isOpen)}
      />

      {isOpen ? (
        <div className={styles.yearMenu}>
          <div className={styles.yearPanel}>
            <YearRangePicker
              from={selectedFrom}
              to={selectedTo}
              minYear={minYear}
              maxYear={maxYear}
              onChange={(range) =>
                onYearRangeChange({
                  from: String(range.from),
                  to: String(range.to),
                })
              }
            />

            <div className={styles.quickActions}>
              {RECENT_YEAR_ACTIONS.map((action) => (
                <button
                  key={action.years}
                  type="button"
                  className={styles.quickAction}
                  onClick={() => selectRecentYears(action.years)}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
});
