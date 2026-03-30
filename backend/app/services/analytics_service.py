from sqlalchemy import text
from sqlalchemy.orm import Session


def get_dashboard_analytics(
    db: Session,
    years_from: int,
    years_to: int,
    types_year: int,
    lwl_year: int,
) -> dict:
    years_query = text("""
        SELECT
            a.Date_of_Publication_F20 AS year,
            COUNT(*) AS count
        FROM articles a
        WHERE a.Date_of_Publication_F20 BETWEEN :years_from AND :years_to
        GROUP BY a.Date_of_Publication_F20
        ORDER BY a.Date_of_Publication_F20
    """)

    years_distribution = db.execute(
        years_query,
        {"years_from": years_from, "years_to": years_to},
    ).mappings().all()

    types_query = text("""
        SELECT
            COALESCE(t.TOP_Name, 'Без типа') AS type_name,
            COUNT(*) AS count
        FROM articlehastop aht
        JOIN articles a
            ON a.Record_ID = aht.Record_ID_f
        LEFT JOIN typesofpublications t
            ON t.TOP_Flag = aht.TypeOfPublication_f
        WHERE a.Date_of_Publication_F20 = :types_year
        GROUP BY COALESCE(t.TOP_Name, 'Без типа')
        ORDER BY count DESC, type_name ASC
    """)

    types_distribution_raw = db.execute(
        types_query,
        {"types_year": types_year},
    ).mappings().all()

    top_3_types = list(types_distribution_raw[:3])
    other_count = sum(row["count"] for row in types_distribution_raw[3:])

    types_distribution = [
        {"category": row["type_name"], "count": row["count"]}
        for row in top_3_types
    ]

    if other_count > 0:
        types_distribution.append({
            "category": "Другое",
            "count": other_count,
        })

    lwl_query = text("""
        SELECT
            COALESCE(j.LWL, 0) AS level,
            COUNT(*) AS count
        FROM articles a
        LEFT JOIN journals j
            ON j.J_ID = a.Journal_ID_f
        WHERE a.Date_of_Publication_F20 = :lwl_year
        GROUP BY COALESCE(j.LWL, 0)
        ORDER BY level
    """)

    lwl_distribution_raw = db.execute(
        lwl_query,
        {"lwl_year": lwl_year},
    ).mappings().all()

    lwl_distribution = [
        {
            "label": f"УБС{row['level']}" if row["level"] else "Без уровня",
            "level": row["level"],
            "count": row["count"],
        }
        for row in lwl_distribution_raw
    ]

    total_publications_query = text("""
        SELECT COUNT(*) AS count
        FROM articles
        WHERE Date_of_Publication_F20 = :types_year
    """)

    total_publications = db.execute(
        total_publications_query,
        {"types_year": types_year},
    ).mappings().first()

    return {
        "years": {
            "from": years_from,
            "to": years_to,
            "series": list(years_distribution),
        },
        "types": {
            "year": types_year,
            "total": total_publications["count"] if total_publications else 0,
            "series": types_distribution,
        },
        "lwl": {
            "year": lwl_year,
            "series": lwl_distribution,
        },
    }