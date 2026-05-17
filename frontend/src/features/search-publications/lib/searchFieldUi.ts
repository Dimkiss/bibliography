import type { SearchFieldKey } from '@/entities/publication';

export function getSearchFieldIconName(field: SearchFieldKey) {
  switch (field) {
    case 'textQuery':
    case 'pdfTextQuery':
      return 'search';
    case 'author':
      return 'person';
    case 'title':
      return 'article-outline';
    case 'journal':
      return 'journal-outline';
    case 'keyword':
      return 'hashtag';
    default:
      return 'person';
  }
}
