from __future__ import annotations

from pydantic import BaseModel, Field, field_validator, model_validator


class AuthorsReportRequest(BaseModel):
    author_ids: list[int] = Field(..., min_length=1, max_length=500)
    year_from: int | None = Field(default=None, ge=1900, le=2100)
    year_to: int | None = Field(default=None, ge=1900, le=2100)
    article_ids: list[int] | None = Field(default=None, max_length=1000)

    @field_validator("author_ids")
    @classmethod
    def validate_author_ids(cls, value: list[int]) -> list[int]:
        unique_ids = list(dict.fromkeys(value))
        if any(item <= 0 for item in unique_ids):
            raise ValueError("author_ids must contain positive integers")
        return unique_ids

    @field_validator("article_ids")
    @classmethod
    def validate_article_ids(cls, value: list[int] | None) -> list[int] | None:
        if value is None:
            return None

        unique_ids = list(dict.fromkeys(value))
        if any(item <= 0 for item in unique_ids):
            raise ValueError("article_ids must contain positive integers")
        return unique_ids

    @model_validator(mode="after")
    def validate_year_range(self) -> "AuthorsReportRequest":
        if (
            self.year_from is not None
            and self.year_to is not None
            and self.year_from > self.year_to
        ):
            raise ValueError("year_from must be less than or equal to year_to")
        return self
