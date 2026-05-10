import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';

import styles from './YearRangeSelect.module.css';

const DEFAULT_MIN_START_YEAR = 2016;
const DEFAULT_MIN_RANGE_YEARS = 1;

const RECENT_YEAR_ACTIONS = [
  { years: 1, label: 'Последний год' },
  { years: 3, label: 'Последние 3 года' },
  { years: 5, label: 'Последние 5 лет' },
] as const;

type DragState = {
  mode: 'from' | 'to' | 'range';
  startClientX: number;
  startRange: YearRange;
};

export type YearRange = {
  from: number;
  to: number;
};

export type YearRangePickerProps = {
  from: number;
  to: number;
  minYear: number;
  maxYear: number;
  minRangeYears?: number;
  className?: string;
  fromLabel?: string;
  toLabel?: string;
  onChange: (range: YearRange) => void;
};

export type YearRangeSelectProps = {
  from: number;
  to: number;
  minStartYear?: number;
  minYear?: number;
  maxYear: number;
  minRangeYears?: number;
  width?: number | string;
  showQuickActions?: boolean;
  onChange: (range: YearRange) => void;
  ariaLabel: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function toSafeInteger(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.round(value) : fallback;
}

function getYearBounds(minYear: number, maxYear: number): YearRange {
  const safeMinYear = toSafeInteger(Math.min(minYear, maxYear), DEFAULT_MIN_START_YEAR);
  const safeMaxYear = toSafeInteger(Math.max(minYear, maxYear), safeMinYear);

  return {
    from: safeMinYear,
    to: safeMaxYear,
  };
}

function getMinRangeYears(minRangeYears: number, bounds: YearRange): number {
  const totalYears = bounds.to - bounds.from + 1;

  return clamp(
    toSafeInteger(minRangeYears, DEFAULT_MIN_RANGE_YEARS),
    DEFAULT_MIN_RANGE_YEARS,
    totalYears,
  );
}

function normalizeRange(
  from: number,
  to: number,
  bounds: YearRange,
  minRangeYears: number,
): YearRange {
  let nextFrom = clamp(toSafeInteger(from, bounds.from), bounds.from, bounds.to);
  let nextTo = clamp(toSafeInteger(to, bounds.to), bounds.from, bounds.to);

  if (nextFrom > nextTo) {
    [nextFrom, nextTo] = [nextTo, nextFrom];
  }

  if (nextTo - nextFrom + 1 < minRangeYears) {
    nextTo = Math.min(bounds.to, nextFrom + minRangeYears - 1);
    nextFrom = Math.max(bounds.from, nextTo - minRangeYears + 1);
  }

  return {
    from: nextFrom,
    to: nextTo,
  };
}

function parseDraftYear(value: string): number | null {
  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? Math.round(parsedValue) : null;
}

export function YearRangePicker({
  from,
  to,
  minYear,
  maxYear,
  minRangeYears = DEFAULT_MIN_RANGE_YEARS,
  className = '',
  fromLabel = 'Начальный год диапазона',
  toLabel = 'Конечный год диапазона',
  onChange,
}: YearRangePickerProps) {
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const bounds = useMemo(() => getYearBounds(minYear, maxYear), [maxYear, minYear]);
  const safeMinRangeYears = getMinRangeYears(minRangeYears, bounds);
  const selectedRange = useMemo(
    () => normalizeRange(from, to, bounds, safeMinRangeYears),
    [bounds, from, safeMinRangeYears, to],
  );
  const totalYears = bounds.to - bounds.from + 1;
  const leftPercent = ((selectedRange.from - bounds.from) / totalYears) * 100;
  const rightPercent = ((selectedRange.to - bounds.from + 1) / totalYears) * 100;
  const [draftFrom, setDraftFrom] = useState(String(selectedRange.from));
  const [draftTo, setDraftTo] = useState(String(selectedRange.to));
  const [dragMode, setDragMode] = useState<DragState['mode'] | null>(null);

  useEffect(() => {
    setDraftFrom(String(selectedRange.from));
    setDraftTo(String(selectedRange.to));
  }, [selectedRange.from, selectedRange.to]);

  useEffect(() => {
    if (from !== selectedRange.from || to !== selectedRange.to) {
      onChange(selectedRange);
    }
  }, [from, onChange, selectedRange, to]);

  const sliderStyle = {
    '--range-left': `${leftPercent}%`,
    '--range-right': `${rightPercent}%`,
  } as CSSProperties;

  function changeFrom(nextFrom: number) {
    onChange({
      from: clamp(
        toSafeInteger(nextFrom, selectedRange.from),
        bounds.from,
        selectedRange.to - safeMinRangeYears + 1,
      ),
      to: selectedRange.to,
    });
  }

  function changeTo(nextTo: number) {
    onChange({
      from: selectedRange.from,
      to: clamp(
        toSafeInteger(nextTo, selectedRange.to),
        selectedRange.from + safeMinRangeYears - 1,
        bounds.to,
      ),
    });
  }

  function shiftRange(deltaYears: number) {
    const rangeLength = selectedRange.to - selectedRange.from + 1;
    const nextFrom = clamp(
      selectedRange.from + deltaYears,
      bounds.from,
      bounds.to - rangeLength + 1,
    );

    onChange({
      from: nextFrom,
      to: nextFrom + rangeLength - 1,
    });
  }

  function getBoundaryIndex(clientX: number): number {
    const slider = sliderRef.current;

    if (!slider) {
      return 0;
    }

    const rect = slider.getBoundingClientRect();
    const percent = clamp((clientX - rect.left) / rect.width, 0, 1);

    return clamp(Math.round(percent * totalYears), 0, totalYears);
  }

  function getStepDelta(startClientX: number, clientX: number): number {
    const slider = sliderRef.current;

    if (!slider) {
      return 0;
    }

    const rect = slider.getBoundingClientRect();
    const stepWidth = rect.width / totalYears;

    return Math.round((clientX - startClientX) / stepWidth);
  }

  function resolveDragRange(dragState: DragState, clientX: number): YearRange {
    if (dragState.mode === 'range') {
      const rangeLength = dragState.startRange.to - dragState.startRange.from + 1;
      const deltaYears = getStepDelta(dragState.startClientX, clientX);
      const nextFrom = clamp(
        dragState.startRange.from + deltaYears,
        bounds.from,
        bounds.to - rangeLength + 1,
      );

      return {
        from: nextFrom,
        to: nextFrom + rangeLength - 1,
      };
    }

    const boundaryIndex = getBoundaryIndex(clientX);

    if (dragState.mode === 'from') {
      return {
        from: clamp(
          bounds.from + boundaryIndex,
          bounds.from,
          dragState.startRange.to - safeMinRangeYears + 1,
        ),
        to: dragState.startRange.to,
      };
    }

    return {
      from: dragState.startRange.from,
      to: clamp(
        bounds.from + boundaryIndex - 1,
        dragState.startRange.from + safeMinRangeYears - 1,
        bounds.to,
      ),
    };
  }

  function startDrag(
    mode: DragState['mode'],
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    event.preventDefault();
    const nextDragState: DragState = {
      mode,
      startClientX: event.clientX,
      startRange: selectedRange,
    };
    dragStateRef.current = nextDragState;
    setDragMode(mode);

    if (mode !== 'range') {
      onChange(resolveDragRange(nextDragState, event.clientX));
    }

    function handlePointerMove(moveEvent: PointerEvent) {
      const currentDragState = dragStateRef.current;

      if (!currentDragState) {
        return;
      }

      onChange(resolveDragRange(currentDragState, moveEvent.clientX));
    }

    function handlePointerUp(upEvent: PointerEvent) {
      const currentDragState = dragStateRef.current;

      if (currentDragState) {
        onChange(resolveDragRange(currentDragState, upEvent.clientX));
      }

      dragStateRef.current = null;
      setDragMode(null);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }

  function commitFromDraft() {
    const nextFrom = parseDraftYear(draftFrom);

    if (nextFrom === null) {
      setDraftFrom(String(selectedRange.from));
      return;
    }

    changeFrom(nextFrom);
  }

  function commitToDraft() {
    const nextTo = parseDraftYear(draftTo);

    if (nextTo === null) {
      setDraftTo(String(selectedRange.to));
      return;
    }

    changeTo(nextTo);
  }

  function handleDraftKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    commitDraft: () => void,
  ) {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitDraft();
      event.currentTarget.blur();
    }
  }

  function handleFromKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      changeFrom(selectedRange.from - 1);
    }

    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      changeFrom(selectedRange.from + 1);
    }

    if (event.key === 'Home') {
      event.preventDefault();
      changeFrom(bounds.from);
    }
  }

  function handleToKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      changeTo(selectedRange.to - 1);
    }

    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      changeTo(selectedRange.to + 1);
    }

    if (event.key === 'End') {
      event.preventDefault();
      changeTo(bounds.to);
    }
  }

  function handleRangeKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      shiftRange(-1);
    }

    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      shiftRange(1);
    }
  }

  return (
    <div className={[styles.picker, className].filter(Boolean).join(' ')}>
      <div className={styles.inputRow}>
        <input
          className={styles.input}
          type="number"
          inputMode="numeric"
          value={draftFrom}
          aria-label={fromLabel}
          onChange={(event) => setDraftFrom(event.target.value)}
          onBlur={commitFromDraft}
          onKeyDown={(event) => handleDraftKeyDown(event, commitFromDraft)}
        />
        <span className={styles.rangeDash}>–</span>
        <input
          className={styles.input}
          type="number"
          inputMode="numeric"
          value={draftTo}
          aria-label={toLabel}
          onChange={(event) => setDraftTo(event.target.value)}
          onBlur={commitToDraft}
          onKeyDown={(event) => handleDraftKeyDown(event, commitToDraft)}
        />
      </div>

      <div
        className={[
          styles.slider,
          dragMode ? styles.dragging : '',
          dragMode === 'range' ? styles.draggingRange : '',
        ]
          .filter(Boolean)
          .join(' ')}
        ref={sliderRef}
        style={sliderStyle}
      >
        <div className={styles.track} aria-hidden="true" />
        <button
          type="button"
          className={styles.selection}
          aria-label="Сдвинуть диапазон лет"
          onPointerDown={(event) => startDrag('range', event)}
          onKeyDown={handleRangeKeyDown}
        />
        <button
          type="button"
          className={`${styles.handle} ${styles.handleFrom}`}
          aria-label="Изменить начальный год"
          aria-valuemin={bounds.from}
          aria-valuemax={selectedRange.to}
          aria-valuenow={selectedRange.from}
          onPointerDown={(event) => startDrag('from', event)}
          onKeyDown={handleFromKeyDown}
        />
        <button
          type="button"
          className={`${styles.handle} ${styles.handleTo}`}
          aria-label="Изменить конечный год"
          aria-valuemin={selectedRange.from}
          aria-valuemax={bounds.to}
          aria-valuenow={selectedRange.to}
          onPointerDown={(event) => startDrag('to', event)}
          onKeyDown={handleToKeyDown}
        />
      </div>
    </div>
  );
}

export function YearRangeSelect({
  from,
  to,
  minStartYear = DEFAULT_MIN_START_YEAR,
  minYear,
  maxYear,
  minRangeYears = DEFAULT_MIN_RANGE_YEARS,
  width,
  showQuickActions = true,
  onChange,
  ariaLabel,
}: YearRangeSelectProps) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const bounds = useMemo(
    () => getYearBounds(minYear ?? minStartYear, maxYear),
    [maxYear, minStartYear, minYear],
  );
  const safeMinRangeYears = getMinRangeYears(minRangeYears, bounds);
  const selectedRange = useMemo(
    () => normalizeRange(from, to, bounds, safeMinRangeYears),
    [bounds, from, safeMinRangeYears, to],
  );
  const triggerStyle =
    width === undefined
      ? undefined
      : ({
          width: typeof width === 'number' ? `${width}px` : width,
        } as CSSProperties);

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
  }, [isOpen]);

  useEffect(() => {
    if (from !== selectedRange.from || to !== selectedRange.to) {
      onChange(selectedRange);
    }
  }, [from, onChange, selectedRange, to]);

  function selectRecentYears(yearsCount: number) {
    const nextTo = bounds.to;
    const nextFrom = Math.max(bounds.from, nextTo - yearsCount + 1);

    onChange({ from: nextFrom, to: nextTo });
    setIsOpen(false);
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        style={triggerStyle}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
      >
        <span className={styles.triggerLabel}>
          {selectedRange.from}–{selectedRange.to}
        </span>
        <span className={styles.chevron} aria-hidden="true" />
      </button>

      {isOpen ? (
        <div className={styles.menu} id={menuId}>
          <div className={styles.rangePanel}>
            <YearRangePicker
              from={selectedRange.from}
              to={selectedRange.to}
              minYear={bounds.from}
              maxYear={bounds.to}
              minRangeYears={safeMinRangeYears}
              onChange={onChange}
            />
          </div>

          {showQuickActions ? (
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
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
