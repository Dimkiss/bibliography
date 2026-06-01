from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.schemas.edition import (
    PeriodicalEditionEditResponse,
    PeriodicalEditionMetricItem,
    PeriodicalEditionMetricPayload,
    PeriodicalEditionPayload,
)


class AdminEditionNotFoundError(Exception):
    pass


class AdminEditionValidationError(Exception):
    pass


class AdminEditionConflictError(Exception):
    pass


QUARTILE_VALUES = {"Q1", "Q2", "Q3", "Q4", "Q", "S", "R", "V"}


def _normalize_optional_string(value: str | None) -> str | None:
    if value is None:
        return None

    stripped = value.strip()
    return stripped or None


def _normalize_decimal(value: str | None) -> Decimal | None:
    normalized = _normalize_optional_string(value)
    if normalized is None:
        return None

    normalized = normalized.replace(",", ".")

    try:
        return Decimal(normalized)
    except InvalidOperation as exc:
        raise AdminEditionValidationError(
            f"Некорректное числовое значение: {value}"
        ) from exc


def _normalize_quartile(value: str | None) -> str | None:
    normalized = _normalize_optional_string(value)
    if normalized is None:
        return None

    normalized = normalized.upper()
    if normalized in {"1", "2", "3", "4"}:
        normalized = f"Q{normalized}"

    if normalized not in QUARTILE_VALUES:
        raise AdminEditionValidationError(
            f"Некорректный квартиль: {value}"
        )

    return normalized


def _bool_to_db(value: bool) -> int | None:
    return 1 if value else None


def _format_decimal_value(value: Any) -> str | None:
    if value is None:
        return None

    normalized = str(value).strip()
    return normalized or None


def _format_bool_value(value: Any) -> bool:
    return bool(value)


def _validate_metric_years(metrics: list[PeriodicalEditionMetricPayload]) -> None:
    seen_years: set[int] = set()

    for metric in metrics:
        if metric.year in seen_years:
            raise AdminEditionConflictError(
                f"Год {metric.year} указан несколько раз."
            )

        seen_years.add(metric.year)


def _build_metric_params(
    source_id: int,
    title: str,
    metric: PeriodicalEditionMetricPayload,
) -> dict[str, Any]:
    white_list_level = metric.white_list_level
    if white_list_level == 0:
        white_list_level = None

    return {
        "source_id": source_id,
        "jname": title,
        "year": metric.year,
        "impact_factor": _normalize_decimal(metric.impact_factor),
        "five_year_if": _normalize_decimal(metric.five_year_if),
        "wos": _bool_to_db(metric.wos),
        "scopus": _bool_to_db(metric.scopus),
        "white_list_level": white_list_level,
        "rinc": _bool_to_db(metric.rinc),
        "rinc_core": _bool_to_db(metric.rinc_core),
        "rsci": _bool_to_db(metric.rsci),
        "foreign": _bool_to_db(metric.foreign),
        "vak": _bool_to_db(metric.vak),
        "wos_quartile": _normalize_quartile(metric.wos_quartile),
        "scopus_quartile": _normalize_quartile(metric.scopus_quartile),
    }


def _get_periodical_source_row(db: Session, source_id: int):
    return db.execute(
        text(
            """
            SELECT
                JN_ID,
                JournalName,
                ISSN,
                IS_IF,
                WOS_Name,
                ElibraryPerevodName,
                IS_PerVer,
                Comment
            FROM journalnames
            WHERE JN_ID = :source_id
            """
        ),
        {"source_id": source_id},
    ).mappings().first()


def _find_periodical_source_by_title(db: Session, title: str) -> int | None:
    row = db.execute(
        text(
            """
            SELECT JN_ID
            FROM journalnames
            WHERE JournalName = :title
            LIMIT 1
            """
        ),
        {"title": title},
    ).mappings().first()

    return int(row["JN_ID"]) if row else None


def _insert_periodical_source(
    db: Session,
    payload: PeriodicalEditionPayload,
) -> int:
    title = payload.title.strip()
    result = db.execute(
        text(
            """
            INSERT INTO journalnames (
                JournalName,
                ISSN,
                IS_IF,
                WOS_Name,
                ElibraryPerevodName,
                IS_PerVer,
                Comment
            )
            VALUES (
                :title,
                :issn,
                :is_if,
                :wos_name,
                :elibrary_name,
                :is_translation,
                :comment
            )
            """
        ),
        {
            "title": title,
            "issn": _normalize_optional_string(payload.issn),
            "is_if": _bool_to_db(payload.is_if),
            "wos_name": _normalize_optional_string(payload.wos_name),
            "elibrary_name": _normalize_optional_string(payload.elibrary_name),
            "is_translation": _bool_to_db(payload.is_translation),
            "comment": _normalize_optional_string(payload.comment),
        },
    )

    return int(result.lastrowid)


def _update_periodical_source(
    db: Session,
    source_id: int,
    payload: PeriodicalEditionPayload,
) -> None:
    title = payload.title.strip()
    existing_source_id = _find_periodical_source_by_title(db, title)
    if existing_source_id is not None and existing_source_id != source_id:
        raise AdminEditionConflictError(
            f"Журнал с названием «{title}» уже существует."
        )

    db.execute(
        text(
            """
            UPDATE journalnames
            SET
                JournalName = :title,
                ISSN = :issn,
                IS_IF = :is_if,
                WOS_Name = :wos_name,
                ElibraryPerevodName = :elibrary_name,
                IS_PerVer = :is_translation,
                Comment = :comment
            WHERE JN_ID = :source_id
            """
        ),
        {
            "source_id": source_id,
            "title": title,
            "issn": _normalize_optional_string(payload.issn),
            "is_if": _bool_to_db(payload.is_if),
            "wos_name": _normalize_optional_string(payload.wos_name),
            "elibrary_name": _normalize_optional_string(payload.elibrary_name),
            "is_translation": _bool_to_db(payload.is_translation),
            "comment": _normalize_optional_string(payload.comment),
        },
    )

    db.execute(
        text(
            """
            UPDATE journals
            SET jname = :title
            WHERE JN_ID_f = :source_id
            """
        ),
        {"source_id": source_id, "title": title},
    )


def _save_periodical_metric(
    db: Session,
    *,
    source_id: int,
    title: str,
    metric: PeriodicalEditionMetricPayload,
) -> None:
    params = _build_metric_params(source_id, title, metric)

    if metric.j_id is not None:
        existing_row = db.execute(
            text(
                """
                SELECT J_ID, JN_ID_f
                FROM journals
                WHERE J_ID = :j_id
                """
            ),
            {"j_id": metric.j_id},
        ).mappings().first()

        if existing_row is None:
            raise AdminEditionNotFoundError(
                f"Строка показателей J_ID={metric.j_id} не найдена."
            )

        existing_source_id = existing_row.get("JN_ID_f")
        if existing_source_id is None or int(existing_source_id) != source_id:
            raise AdminEditionConflictError(
                f"Строка показателей J_ID={metric.j_id} относится к другому журналу."
            )

        duplicate_row = db.execute(
            text(
                """
                SELECT J_ID
                FROM journals
                WHERE JN_ID_f = :source_id
                  AND Year = :year
                  AND J_ID <> :j_id
                LIMIT 1
                """
            ),
            {"source_id": source_id, "year": metric.year, "j_id": metric.j_id},
        ).mappings().first()

        if duplicate_row is not None:
            raise AdminEditionConflictError(
                f"Для этого журнала уже есть показатели за {metric.year} год."
            )

        db.execute(
            text(
                """
                UPDATE journals
                SET
                    JN_ID_f = :source_id,
                    jname = :jname,
                    Year = :year,
                    Impact_Factor = :impact_factor,
                    FiveYearIF = :five_year_if,
                    WOS = :wos,
                    Scopus = :scopus,
                    LWL = :white_list_level,
                    Rints = :rinc,
                    RintsCore = :rinc_core,
                    RSCI = :rsci,
                    Foreign_ = :foreign,
                    BAK = :vak,
                    Quartile = :wos_quartile,
                    QuartileScopus = :scopus_quartile
                WHERE J_ID = :j_id
                """
            ),
            {**params, "j_id": metric.j_id},
        )
        return

    existing_metric = db.execute(
        text(
            """
            SELECT J_ID
            FROM journals
            WHERE JN_ID_f = :source_id
              AND Year = :year
            LIMIT 1
            """
        ),
        {"source_id": source_id, "year": metric.year},
    ).mappings().first()

    if existing_metric is not None:
        _save_periodical_metric(
            db,
            source_id=source_id,
            title=title,
            metric=metric.copy(update={"j_id": int(existing_metric["J_ID"])}),
        )
        return

    db.execute(
        text(
            """
            INSERT INTO journals (
                JN_ID_f,
                jname,
                Year,
                Impact_Factor,
                FiveYearIF,
                WOS,
                Scopus,
                LWL,
                Rints,
                RintsCore,
                RSCI,
                Foreign_,
                BAK,
                Quartile,
                QuartileScopus
            )
            VALUES (
                :source_id,
                :jname,
                :year,
                :impact_factor,
                :five_year_if,
                :wos,
                :scopus,
                :white_list_level,
                :rinc,
                :rinc_core,
                :rsci,
                :foreign,
                :vak,
                :wos_quartile,
                :scopus_quartile
            )
            """
        ),
        params,
    )


def get_periodical_edition_for_edit(
    *,
    db: Session,
    source_id: int,
) -> PeriodicalEditionEditResponse:
    row = _get_periodical_source_row(db, source_id)
    if row is None:
        raise AdminEditionNotFoundError("Периодическое издание не найдено.")

    metric_rows = db.execute(
        text(
            """
            SELECT
                J_ID,
                Year,
                Impact_Factor,
                FiveYearIF,
                WOS,
                Scopus,
                LWL,
                Rints,
                RintsCore,
                RSCI,
                Foreign_,
                BAK,
                Quartile,
                QuartileScopus
            FROM journals
            WHERE JN_ID_f = :source_id
            ORDER BY Year DESC, J_ID DESC
            """
        ),
        {"source_id": source_id},
    ).mappings().all()

    return PeriodicalEditionEditResponse(
        source_id=int(row["JN_ID"]),
        title=row["JournalName"],
        issn=row.get("ISSN"),
        is_if=_format_bool_value(row.get("IS_IF")),
        wos_name=row.get("WOS_Name"),
        elibrary_name=row.get("ElibraryPerevodName"),
        is_translation=_format_bool_value(row.get("IS_PerVer")),
        comment=row.get("Comment"),
        metrics=[
            PeriodicalEditionMetricItem(
                j_id=int(metric_row["J_ID"]),
                year=int(metric_row["Year"]),
                impact_factor=_format_decimal_value(metric_row.get("Impact_Factor")),
                five_year_if=_format_decimal_value(metric_row.get("FiveYearIF")),
                wos_quartile=metric_row.get("Quartile"),
                scopus_quartile=metric_row.get("QuartileScopus"),
                white_list_level=metric_row.get("LWL"),
                wos=_format_bool_value(metric_row.get("WOS")),
                scopus=_format_bool_value(metric_row.get("Scopus")),
                rinc=_format_bool_value(metric_row.get("Rints")),
                rinc_core=_format_bool_value(metric_row.get("RintsCore")),
                rsci=_format_bool_value(metric_row.get("RSCI")),
                foreign=_format_bool_value(metric_row.get("Foreign_")),
                vak=_format_bool_value(metric_row.get("BAK")),
            )
            for metric_row in metric_rows
        ],
    )


def create_periodical_edition(
    *,
    db: Session,
    payload: PeriodicalEditionPayload,
) -> PeriodicalEditionEditResponse:
    title = payload.title.strip()
    _validate_metric_years(payload.metrics)

    try:
        source_id = _find_periodical_source_by_title(db, title)
        if source_id is None:
            source_id = _insert_periodical_source(db, payload)
        else:
            _update_periodical_source(db, source_id, payload)

        for metric in payload.metrics:
            _save_periodical_metric(
                db,
                source_id=source_id,
                title=title,
                metric=metric,
            )

        db.commit()
    except Exception:
        db.rollback()
        raise

    return get_periodical_edition_for_edit(db=db, source_id=source_id)


def update_periodical_edition(
    *,
    db: Session,
    source_id: int,
    payload: PeriodicalEditionPayload,
) -> PeriodicalEditionEditResponse:
    if _get_periodical_source_row(db, source_id) is None:
        raise AdminEditionNotFoundError("Периодическое издание не найдено.")

    title = payload.title.strip()
    _validate_metric_years(payload.metrics)

    try:
        _update_periodical_source(db, source_id, payload)

        for metric in payload.metrics:
            _save_periodical_metric(
                db,
                source_id=source_id,
                title=title,
                metric=metric,
            )

        db.commit()
    except Exception:
        db.rollback()
        raise

    return get_periodical_edition_for_edit(db=db, source_id=source_id)
