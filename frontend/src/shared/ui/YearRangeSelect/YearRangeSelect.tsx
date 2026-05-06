import { useEffect, useId, useMemo, useRef, useState } from 'react';

import styles from './YearRangeSelect.module.css';

const RANGE_SIZE = 5;

export type YearRangeSelectProps = {
  from: number;
  to: number;
  minStartYear?: number;
  maxYear: number;
  onChange: (range: { from: number; to: number }) => void;
  ariaLabel: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function YearRangeSelect({
  from,
  to,
  minStartYear = 2016,
  maxYear,
  onChange,
  ariaLabel,
}: YearRangeSelectProps) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const minEndYear = minStartYear + RANGE_SIZE - 1;
  const safeMaxYear = Math.max(maxYear, minEndYear);
  const selectedEndYear = clamp(to, minEndYear, safeMaxYear);
  const selectedStartYear = selectedEndYear - RANGE_SIZE + 1;
  const [draftEndYear, setDraftEndYear] = useState(selectedEndYear);
  const draftStartYear = draftEndYear - RANGE_SIZE + 1;
  const minSliderYear = minStartYear;
  const maxSliderYear = safeMaxYear;
  const sliderStepsCount = maxSliderYear - minSliderYear || 1;
  const selectionWidthPercent = ((RANGE_SIZE - 1) / sliderStepsCount) * 100;
  const rightPercent = ((draftEndYear - minSliderYear) / sliderStepsCount) * 100;
  const leftPercent = rightPercent - selectionWidthPercent;

  const endYearOptions = useMemo(() => {
    return Array.from(
      { length: safeMaxYear - minEndYear + 1 },
      (_, index) => minEndYear + index,
    );
  }, [minEndYear, safeMaxYear]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen, selectedEndYear]);

  useEffect(() => {
    if (from !== selectedStartYear || to !== selectedEndYear) {
      onChange({ from: selectedStartYear, to: selectedEndYear });
    }
  }, [from, onChange, selectedEndYear, selectedStartYear, to]);

  function commitEndYear(nextEndYear: number) {
    const clampedEndYear = clamp(nextEndYear, minEndYear, safeMaxYear);
    setDraftEndYear(clampedEndYear);
    onChange({
      from: clampedEndYear - RANGE_SIZE + 1,
      to: clampedEndYear,
    });
  }

  function getEndYearFromPointer(clientX: number): number {
    const slider = sliderRef.current;

    if (!slider) {
      return draftEndYear;
    }

    const rect = slider.getBoundingClientRect();
    const percent = clamp((clientX - rect.left) / rect.width, 0, 1);
    return clamp(
      Math.round(minSliderYear + percent * sliderStepsCount),
      minEndYear,
      safeMaxYear,
    );
  }

  function handleSliderPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const nextEndYear = getEndYearFromPointer(event.clientX);
    setDraftEndYear(nextEndYear);

    function handlePointerMove(moveEvent: PointerEvent) {
      setDraftEndYear(getEndYearFromPointer(moveEvent.clientX));
    }

    function handlePointerUp(upEvent: PointerEvent) {
      commitEndYear(getEndYearFromPointer(upEvent.clientX));
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onClick={() => {
          setIsOpen((currentValue) => {
            if (!currentValue) {
              setDraftEndYear(selectedEndYear);
            }

            return !currentValue;
          });
        }}
      >
        <span>
          {selectedStartYear}-{selectedEndYear}
        </span>
        <span className={styles.chevron} aria-hidden="true" />
      </button>

      {isOpen ? (
        <div className={styles.menu} id={menuId}>
          <div className={styles.inputRow}>
            <input
              className={styles.input}
              value={draftStartYear}
              aria-label="Начальный год диапазона"
              disabled
            />
            <span className={styles.rangeDash}>-</span>
            <input
              className={styles.input}
              value={draftEndYear}
              aria-label="Конечный год диапазона"
              inputMode="numeric"
              onChange={(event) => setDraftEndYear(Number(event.target.value))}
              onBlur={(event) => commitEndYear(Number(event.target.value))}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  commitEndYear(Number(event.currentTarget.value));
                }
              }}
              list={`${menuId}-years`}
            />
            <datalist id={`${menuId}-years`}>
              {endYearOptions.map((year) => (
                <option key={year} value={year} />
              ))}
            </datalist>
          </div>

          <div
            className={styles.sliderWrap}
            ref={sliderRef}
            onPointerDown={handleSliderPointerDown}
          >
            <div className={styles.track} />
            <div
              className={styles.selection}
              style={{
                left: `calc(${leftPercent}% + 8px)`,
                width: `calc(${selectionWidthPercent}% - 16px)`,
              }}
            />
            <div className={styles.handle} style={{ left: `${leftPercent}%` }} />
            <div
              className={styles.handle}
              style={{ left: `calc(${leftPercent}% + ${selectionWidthPercent}%)` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
