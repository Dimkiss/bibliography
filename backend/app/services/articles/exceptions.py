class ArticleServiceError(Exception):
    pass


class ArticleNotFoundError(ArticleServiceError):
    pass


class ArticleValidationError(ArticleServiceError):
    pass


class ArticleConflictError(ArticleServiceError):
    pass
