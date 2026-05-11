import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';

import {
  EDITION_KIND_OPTIONS,
  type EditionFilterOptionDto,
  type EditionKind,
  type EditionSearchFormState,
} from '@/entities/edition';
import { Button } from '@/shared/ui/Button';
import { DropdownButton } from '@/shared/ui/DropdownButton';
import { FilterDropdown } from '@/shared/ui/FilterDropdown';
import { Icon } from '@/shared/ui/Icon';
import { YearRangePicker } from '@/shared/ui/YearRangeSelect';
import styles from './EditionSearchPanel.module.css';

const RECENT_YEAR_ACTIONS = [
  { years: 1, label: 'Последний год' },
  { years: 3, label: 'Последние 3 года' },
  { years: 5, label: 'Последние 5 лет' },
] as const;

type EditionSearchPanelProps = {
  kind: EditionKind;
  value: EditionSearchFormState;
  yearMin?: number | null;
  yearMax?: number | null;
  metricLevels: EditionFilterOptionDto[];
  editionTypes: EditionFilterOptionDto[];
  isLoading?: boolean;
  onKindChange: (nextKind: EditionKind) => void;
  onQueryChange: (nextValue: string) => void;
  onYearRangeChange: (nextValue: { from: string; to: string }) => void;
  onMetricLevelsChange: (nextValue: string[]) => void;
  onEditionTypesChange: (nextValue: string[]) => void;
  onSubmit: () => void;
};

function parseYear(value: string): number | null {
  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? Math.round(parsedValue) : null;
}

export function EditionSearchPanel({
  kind,
  value,
  yearMin,
  yearMax,
  metricLevels,
  editionTypes,
  isLoading = false,
  onKindChange,
  onQueryChange,
  onYearRangeChange,
  onMetricLevelsChange,
  onEditionTypesChange,
  onSubmit,
}: EditionSearchPanelProps) {
  const [isKindOpen, setIsKindOpen] = useState(false);
  const [isYearOpen, setIsYearOpen] = useState(false);
  const kindRef = useRef<HTMLDivElement | null>(null);
  const yearRef = useRef<HTMLDivElement | null>(null);
  const selectedKind = useMemo(
    () => EDITION_KIND_OPTIONS.find((option) => option.value === kind),
    [kind],
  );
  const searchPlaceholder =
    kind === 'periodical' ? 'Название или ISSN' : 'Название или ISBN';
  const maxAvailableYear = yearMax ?? new Date().getFullYear();
  const minAvailableYear = yearMin ?? Math.max(1900, maxAvailableYear - 30);
  const minYear = Math.min(minAvailableYear, maxAvailableYear);
  const maxYear = Math.max(minAvailableYear, maxAvailableYear);
  const selectedFrom = parseYear(value.yearFrom) ?? minYear;
  const selectedTo = parseYear(value.yearTo) ?? maxYear;
  const yearLabel = useMemo(() => {
    if (!value.yearFrom.trim() && !value.yearTo.trim()) {
      return 'Годы публикации';
    }

    const from = value.yearFrom || String(minYear);
    const to = value.yearTo || String(maxYear);
    return `${from}–${to}`;
  }, [maxYear, minYear, value.yearFrom, value.yearTo]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (kindRef.current && !kindRef.current.contains(target)) {
        setIsKindOpen(false);
      }

      if (yearRef.current && !yearRef.current.contains(target)) {
        setIsYearOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  const selectRecentYears = (yearsCount: number) => {
    onYearRangeChange({
      from: String(Math.max(minYear, maxYear - yearsCount + 1)),
      to: String(maxYear),
    });
    setIsYearOpen(false);
  };

  return (
    <section className={styles.section}>
      <form className={`app-surface ${styles.panel}`} onSubmit={handleSubmit}>
        <div className={styles.topRow}>
          <div ref={kindRef} className={styles.kindWrap}>
            <DropdownButton
              label={selectedKind?.label ?? 'Периодические'}
              icon={
                <Icon
                  name={selectedKind?.iconName ?? 'journal-outline'}
                  size={18}
                />
              }
              size="normal"
              variant="tonal"
              width={248}
              isOpen={isKindOpen}
              onClick={() => setIsKindOpen((prev) => !prev)}
            />

            {isKindOpen ? (
              <div className="app-search-menu">
                <div className="app-search-options-list">
                  {EDITION_KIND_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className="app-search-option-button"
                      onClick={() => {
                        onKindChange(option.value);
                        setIsKindOpen(false);
                      }}
                    >
                      <span className="app-search-option-icon">
                        <Icon name={option.iconName} size={18} />
                      </span>
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <input
            className={styles.searchInput}
            type="search"
            value={value.query}
            placeholder={searchPlaceholder}
            onChange={(event) => onQueryChange(event.target.value)}
            aria-label="Поиск изданий"
          />

          <Button
            type="submit"
            label={isLoading ? 'Поиск...' : 'Поиск'}
            size="normal"
            width={152}
            iconName="search"
            disabled={isLoading}
          />
        </div>

        <div className={styles.filtersRow}>
          {kind === 'periodical' ? (
            <FilterDropdown
              label="Квартиль/Уровень"
              mode="multi"
              options={metricLevels}
              value={value.metricLevels}
              onChange={onMetricLevelsChange}
            />
          ) : (
            <FilterDropdown
              label="Тип издания"
              mode="multi"
              options={editionTypes}
              value={value.editionTypes}
              onChange={onEditionTypesChange}
            />
          )}

          <div ref={yearRef} className={styles.yearWrap}>
            <button
              type="button"
              className={[
                styles.yearTrigger,
                value.yearFrom || value.yearTo ? styles.yearTriggerActive : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setIsYearOpen((prev) => !prev)}
              aria-expanded={isYearOpen}
            >
              <span>{yearLabel}</span>
              <Icon
                name={isYearOpen ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
                size={18}
              />
            </button>

            {isYearOpen ? (
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
        </div>
      </form>
    </section>
  );
}
