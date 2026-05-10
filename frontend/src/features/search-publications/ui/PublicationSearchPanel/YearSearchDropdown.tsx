import { forwardRef, useMemo } from 'react';

import type { PublicationSearchFormState } from '@/entities/publication';
import { DropdownButton } from '@/shared/ui/DropdownButton';
import { Icon } from '@/shared/ui/Icon';
import styles from './PublicationSearchPanel.module.css';

type YearSearchDropdownProps = {
  value: PublicationSearchFormState;
  yearMin?: number | null;
  yearMax?: number | null;
  isOpen: boolean;
  onOpenChange: (nextValue: boolean) => void;
  onYearRangeChange: (nextValue: { from: string; to: string }) => void;
};

export const YearSearchDropdown = forwardRef<
  HTMLDivElement,
  YearSearchDropdownProps
>(function YearSearchDropdown(
  {
    value,
    yearMin,
    yearMax,
    isOpen,
    onOpenChange,
    onYearRangeChange,
  },
  ref,
) {
  const periodLabel = useMemo(() => {
    const hasSelectedPeriod = value.yearFrom.trim() || value.yearTo.trim();

    if (!hasSelectedPeriod) {
      return 'Год';
    }

    const from = value.yearFrom || (yearMin ? String(yearMin) : 'Год от');
    const to = value.yearTo || (yearMax ? String(yearMax) : 'Год до');
    return `${from}-${to}`;
  }, [value.yearFrom, value.yearTo, yearMin, yearMax]);

  const selectRecentYears = (yearsCount: number) => {
    const year = yearMax ?? new Date().getFullYear();
    onYearRangeChange({
      from: String(year - yearsCount + 1),
      to: String(year),
    });
    onOpenChange(false);
  };

  return (
    <div ref={ref} className="app-search-dropdown-wrap">
      <DropdownButton
        label={periodLabel}
        icon={<Icon name="calendar_renge" size={18} />}
        size="normal"
        variant="tonal"
        width={248}
        isOpen={isOpen}
        onClick={() => onOpenChange(!isOpen)}
      />

      {isOpen ? (
        <div className="app-search-menu">
          <div className={styles.yearPanel}>
            <div className="app-year-inputs">
              <input
                className="app-year-input"
                type="number"
                inputMode="numeric"
                placeholder={yearMin ? String(yearMin) : 'От'}
                value={value.yearFrom}
                onChange={(event) =>
                  onYearRangeChange({
                    from: event.target.value,
                    to: value.yearTo,
                  })
                }
              />

              <span className="app-year-separator">-</span>

              <input
                className="app-year-input"
                type="number"
                inputMode="numeric"
                placeholder={yearMax ? String(yearMax) : 'До'}
                value={value.yearTo}
                onChange={(event) =>
                  onYearRangeChange({
                    from: value.yearFrom,
                    to: event.target.value,
                  })
                }
              />
            </div>

            <div className={styles.quickActions}>
              <button
                type="button"
                className={styles.quickAction}
                onClick={() => selectRecentYears(1)}
              >
                Последний год
              </button>

              <button
                type="button"
                className={styles.quickAction}
                onClick={() => selectRecentYears(3)}
              >
                Последние 3 года
              </button>

              <button
                type="button"
                className={styles.quickAction}
                onClick={() => selectRecentYears(5)}
              >
                Последние 5 лет
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
});
