import { useEffect, useMemo, useRef, useState } from 'react';

import { Footer } from '@/widgets/Footer';
import { Header } from '@/widgets/Header';
import { useAuth } from '@/features/auth';
import { KeywordSearchInput } from '@/features/search-publications';
import {
  createAdminArticle,
  getAdminPublicationTypes,
  getAdminArticleForEdit,
  getAdminAuthors,
  getAdminWorkFormFields,
  getAdminWorkFormTypes,
  searchAdminEditionSources,
  searchAdminArticles,
  searchAdminJournals,
  searchAdminMediumDesignators,
  searchAdminPlaces,
  searchAdminPublishers,
  updateAdminArticle,
  uploadAdminArticlePdf,
  type AdminOptionDto,
  type AdminEditionSourceDto,
  type AdminArticleEditDto,
  type ArticleSearchItemDto,
  type AuthorOptionDto,
  type CreateAdminArticlePayload,
  type PublicationTypeDto,
  type WorkFormFieldDto,
  type WorkFormTypeDto,
} from '@/features/create-publication';
import { navigateTo } from '@/shared/lib/navigation';
import { ADMIN_ROLE_ID } from '@/entities/role';
import { getPublicationDetail } from '@/entities/publication';
import { Button } from '@/shared/ui/Button';
import { Checkbox } from '@/shared/ui/Checkbox';
import { Icon } from '@/shared/ui/Icon';
import { OutlineButton } from '@/shared/ui/OutlineButton';
import { RadioButton } from '@/shared/ui/RadioButton';
import { RichTextField } from '@/shared/ui/RichTextField';
import { Select } from '@/shared/ui/Select';
import { TextButton } from '@/shared/ui/TextButton';
import { TextField } from '@/shared/ui/TextField';
import styles from './PublicationsCreatePage.module.css';

type FormVariant =
  | 'article'
  | 'book-chapter'
  | 'book-monograph'
  | 'conference'
  | 'dissertation'
  | 'patent'
  | 'newspaper'
  | 'report';
type FormScenario =
  | 'article'
  | 'book-chapter'
  | 'book-monograph'
  | 'conference-materials'
  | 'other';
type ArticleLanguage = 'R' | 'F' | '';
type RelatedArticleKind = 'original' | 'translation' | '';
type SelectorMode =
  | 'journal'
  | 'publisher'
  | 'source'
  | 'related'
  | 'author'
  | 'place-publication'
  | 'place-meeting'
  | 'medium'
  | null;

type SelectedAuthor = {
  author: AuthorOptionDto;
  affiliation: string;
  correspondingAuthor: boolean;
};

type ClearFieldButtonProps = {
  label: string;
  onClick: () => void;
};

type PublicationsCreatePageProps = {
  articleId?: number;
};

type FormState = {
  workFormType: string;
  publicationTypeFlag: string;
  publicationTypeFlags: string[];
  title: string;
  authorsText: string;
  sourceText: string;
  edition: string;
  journal: AdminOptionDto | null;
  publisher: AdminOptionDto | null;
  placeOfPublication: AdminOptionDto | null;
  placeOfMeeting: AdminOptionDto | null;
  mediumDesignator: AdminOptionDto | null;
  authorRole: string;
  authorOfMaterial: string;
  volume: string;
  issue: string;
  speaker: string;
  doi: string;
  url: string;
  pages: string;
  publicationDate: string;
  dateOfMeeting: string;
  year: string;
  abstract: string;
  keywordsInput: string;
  relatedArticle: ArticleSearchItemDto | null;
  relatedArticleKind: RelatedArticleKind;
  articleLanguage: ArticleLanguage;
  isbn: string;
  tirage: string;
  extentOfWork: string;
  notes: string;
  pdfFileName: string;
  pdfFile: File | null;
};

const INITIAL_FORM: FormState = {
  workFormType: '',
  publicationTypeFlag: '',
  publicationTypeFlags: [],
  title: '',
  authorsText: '',
  sourceText: '',
  edition: '',
  journal: null,
  publisher: null,
  placeOfPublication: null,
  placeOfMeeting: null,
  mediumDesignator: null,
  authorRole: '',
  authorOfMaterial: '',
  volume: '',
  issue: '',
  speaker: '',
  doi: '',
  url: '',
  pages: '',
  publicationDate: '',
  dateOfMeeting: '',
  year: '',
  abstract: '',
  keywordsInput: '',
  relatedArticle: null,
  relatedArticleKind: '',
  articleLanguage: '',
  isbn: '',
  tirage: '',
  extentOfWork: '',
  notes: '',
  pdfFileName: '',
  pdfFile: null,
};

function ClearFieldButton({ label, onClick }: ClearFieldButtonProps) {
  return (
    <button
      type="button"
      className={styles.clearFieldButton}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      aria-label={label}
    >
      <Icon name="close" size={20} />
    </button>
  );
}

const FORM_SCENARIO_OPTIONS: Array<{ value: FormScenario; label: string }> = [
  { value: 'article', label: 'Статья' },
  { value: 'book-chapter', label: 'Книжное издание: глава' },
  { value: 'book-monograph', label: 'Книжное издание: монография' },
  { value: 'conference-materials', label: 'Материалы конференций: материалы конференций' },
  { value: 'other', label: 'Другое' },
];

function isFormScenario(value: string | null): value is FormScenario {
  return FORM_SCENARIO_OPTIONS.some((option) => option.value === value);
}

function getInitialFormScenarioFromUrl(): FormScenario {
  const scenario = new URLSearchParams(window.location.search).get('scenario');
  return isFormScenario(scenario) ? scenario : 'article';
}

const AGREED_SCENARIO_CONFIG: Record<
  Exclude<FormScenario, 'other'>,
  { workFormType: string; publicationTypeFlag: string; variant: FormVariant }
> = {
  article: {
    workFormType: 'J',
    publicationTypeFlag: 'ST',
    variant: 'article',
  },
  'book-chapter': {
    workFormType: 'B',
    publicationTypeFlag: 'GL',
    variant: 'book-chapter',
  },
  'book-monograph': {
    workFormType: 'B',
    publicationTypeFlag: 'MO',
    variant: 'book-monograph',
  },
  'conference-materials': {
    workFormType: 'C',
    publicationTypeFlag: 'MA',
    variant: 'conference',
  },
};

const AGREED_FLAGS_BY_WORK_FORM: Record<string, string[]> = {
  J: ['ST'],
  B: ['GL', 'MO'],
  C: ['MA'],
};

function getScenarioConfig(scenario: FormScenario) {
  return scenario === 'other' ? null : AGREED_SCENARIO_CONFIG[scenario];
}

function getScenarioPublicationTypeFlags(
  scenario: FormScenario,
  items: PublicationTypeDto[],
  _workFormType: string,
): string[] {
  const config = getScenarioConfig(scenario);

  if (config) {
    const preferredFlag = items.find((item) => item.value === config.publicationTypeFlag)?.value;
    return preferredFlag ? [preferredFlag] : [];
  }

  return [];
}

function resolveScenarioFromArticle(
  workFormType: string,
  publicationTypeFlags: string[],
): FormScenario {
  const flags = new Set(publicationTypeFlags);

  if (publicationTypeFlags.length === 1) {
    if (workFormType === 'J' && flags.has('ST')) {
      return 'article';
    }

    if (workFormType === 'B' && flags.has('GL')) {
      return 'book-chapter';
    }

    if (workFormType === 'B' && flags.has('MO')) {
      return 'book-monograph';
    }

    if (workFormType === 'C' && flags.has('MA')) {
      return 'conference-materials';
    }
  }

  return 'other';
}

function getWorkFormLabel(item: WorkFormTypeDto): string {
  if (item.value === 'J') {
    return 'Статья';
  }

  if (item.value === 'B') {
    return 'Книжное издание';
  }

  if (item.value === 'C') {
    return 'Материалы конференции';
  }

  if (item.value === 'D') {
    return 'Диссертация';
  }

  if (item.value === 'M') {
    return 'Патент / свидетельство';
  }

  if (item.value === 'N') {
    return 'Газетное издание';
  }

  if (item.value === 'R') {
    return 'Отчёт';
  }

  return item.label_ru?.trim() || item.label?.trim() || item.value;
}

function getPublicationTypeLabel(item: PublicationTypeDto): string {
  const knownLabels: Record<string, string> = {
    AR: 'Автореферат',
    AS: 'Авторское свидетельство',
    AT: 'Атлас',
    BU: 'Библиографический указатель',
    DI: 'Диссертация',
    DO: 'Устный доклад',
    EJ: 'Электронный журнал',
    GA: 'Газета',
    GL: 'Глава',
    JU: 'Журнал',
    KA: 'Карта',
    KN: 'Книга',
    LI: 'Лицензия',
    MA: 'Материалы конференции',
    MO: 'Монография',
    MP: 'Методическое пособие',
    OT: 'Отчёт',
    PA: 'Патент',
    PD: 'Пленарный доклад',
    RE: 'Реферат',
    SB: 'Сборник',
    SD: 'Стендовый доклад / постер',
    SP: 'Справочник',
    ST: 'Статья',
    TE: 'Тезисы',
    TR: 'Труды',
    UC: 'Учебник',
  };

  if (knownLabels[item.value]) {
    return knownLabels[item.value];
  }

  if (item.value === 'GL') {
    return 'Глава';
  }

  if (item.value === 'MO') {
    return 'Монография';
  }

  if (item.value === 'MA') {
    return 'Материалы конференции';
  }

  if (item.value === 'ST') {
    return 'Статья';
  }

  return item.label;
}

function filterEnabledWorkForms(items: WorkFormTypeDto[]): WorkFormTypeDto[] {
  return items.filter((item) => item.value !== 'X');
}

function filterEnabledPublicationTypes(
  items: PublicationTypeDto[],
  _workFormType: string,
): PublicationTypeDto[] {
  return items;
}

function resolveVariant(
  workForm: WorkFormTypeDto | null,
  publicationType: PublicationTypeDto | null,
): FormVariant {
  const workFormValue = workForm?.value;
  const publicationTypeValue = publicationType?.value;
  const workFormLabel = `${workForm?.label_ru ?? ''} ${workForm?.label ?? ''}`.toLowerCase();
  const publicationTypeLabel = `${publicationType?.label ?? ''}`.toLowerCase();

  if (workFormValue === 'C' || workFormLabel.includes('конферен')) {
    return 'conference';
  }

  if (workFormValue === 'D') {
    return 'dissertation';
  }

  if (workFormValue === 'M') {
    return 'patent';
  }

  if (workFormValue === 'N') {
    return 'newspaper';
  }

  if (workFormValue === 'R') {
    return 'report';
  }

  if (
    workFormValue === 'B' ||
    workFormLabel.includes('книж') ||
    workFormLabel.includes('монограф') ||
    publicationTypeLabel.includes('монограф') ||
    publicationTypeLabel.includes('глава')
  ) {
    if (
      publicationTypeValue === 'GL' ||
      publicationTypeLabel.includes('глава') ||
      publicationTypeLabel.includes('очерк')
    ) {
      return 'book-chapter';
    }

    if (publicationTypeValue === 'MO' || publicationTypeLabel.includes('монограф')) {
      return 'book-monograph';
    }

    return 'book-monograph';
  }

  return 'article';
}

function normalizeKeywords(value: string): string[] {
  return value
    .split(/[;,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter(
      (item, index, array) =>
        array.findIndex((entry) => entry.toLowerCase() === item.toLowerCase()) === index,
    );
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function transliterateRuToLat(value: string): string {
  const map: Record<string, string> = {
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'g',
    д: 'd',
    е: 'e',
    ё: 'e',
    ж: 'zh',
    з: 'z',
    и: 'i',
    й: 'y',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    у: 'u',
    ф: 'f',
    х: 'kh',
    ц: 'ts',
    ч: 'ch',
    ш: 'sh',
    щ: 'shch',
    ъ: '',
    ы: 'y',
    ь: '',
    э: 'e',
    ю: 'yu',
    я: 'ya',
  };

  return value
    .toLowerCase()
    .split('')
    .map((char) => map[char] ?? char)
    .join('');
}

function getAuthorLastNameVariants(author: AuthorOptionDto): string[] {
  const [lastName = ''] = author.label.trim().split(/\s+/);
  const nicknameVariants = (author.nickname ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return [lastName, ...nicknameVariants].filter(Boolean);
}

function buildAuthorMatchVariants(author: AuthorOptionDto): string[] {
  const [, firstName = '', patronymic = ''] = author.label.trim().split(/\s+/);
  const firstInitial = firstName.charAt(0);
  const patronymicInitial = patronymic.charAt(0);
  const variants: string[] = [];

  for (const lastName of getAuthorLastNameVariants(author)) {
    variants.push(lastName);

    if (firstInitial) {
      variants.push(`${lastName} ${firstInitial}`);
      variants.push(`${lastName} ${firstInitial}.`);
    }

    if (firstInitial && patronymicInitial) {
      variants.push(`${lastName} ${firstInitial}${patronymicInitial}`);
      variants.push(`${lastName} ${firstInitial}.${patronymicInitial}.`);
      variants.push(`${lastName} ${firstInitial} ${patronymicInitial}`);
    }
  }

  return Array.from(
    new Set(
      variants.flatMap((variant) => [
        normalizeSearchText(variant),
        normalizeSearchText(transliterateRuToLat(variant)),
      ]),
    ),
  ).filter(Boolean);
}

function findAuthorsInText(authorsText: string, authors: AuthorOptionDto[]): AuthorOptionDto[] {
  const normalizedText = normalizeSearchText(authorsText);
  const transliteratedText = normalizeSearchText(transliterateRuToLat(authorsText));

  if (!normalizedText) {
    return [];
  }

  return authors.filter(
    (author) =>
      author.id !== null &&
      author.source === 'employee' &&
      buildAuthorMatchVariants(author).some(
        (variant) => normalizedText.includes(variant) || transliteratedText.includes(variant),
      ),
  );
}

function deriveYear(year: string, publicationDate: string): number | null {
  const trimmedYear = year.trim();
  if (trimmedYear) {
    const parsedYear = Number(trimmedYear);
    return Number.isFinite(parsedYear) ? parsedYear : null;
  }

  if (publicationDate) {
    const parsedYear = Number(publicationDate.slice(0, 4));
    return Number.isFinite(parsedYear) ? parsedYear : null;
  }

  return null;
}

function formatArticleMeta(item: ArticleSearchItemDto): string {
  return [item.authors, item.journal, item.year, item.doi].filter(Boolean).join(' · ');
}

function getSourceLabel(variant: FormVariant): string {
  if (variant === 'book-chapter') {
    return 'Монография';
  }

  if (variant === 'conference') {
    return 'Мероприятие';
  }

  if (variant === 'newspaper') {
    return 'Газета';
  }

  if (variant === 'report' || variant === 'patent') {
    return 'Общее название';
  }

  return 'Издание';
}

function getTitlePlaceholder(variant: FormVariant): string {
  if (variant === 'book-chapter') {
    return 'Название главы';
  }

  if (variant === 'book-monograph') {
    return 'Название монографии';
  }

  if (variant === 'conference') {
    return 'Название материала';
  }

  if (variant === 'dissertation') {
    return 'Название диссертации';
  }

  if (variant === 'patent') {
    return 'Название патента / свидетельства';
  }

  if (variant === 'newspaper') {
    return 'Название материала';
  }

  if (variant === 'report') {
    return 'Название отчёта';
  }

  return 'Название';
}

function getAuthorsPlaceholder(variant: FormVariant): string {
  if (variant === 'book-chapter') {
    return 'Авторы главы';
  }

  if (variant === 'book-monograph') {
    return 'Авторы монографии';
  }

  if (variant === 'conference') {
    return 'Авторы материала';
  }

  if (variant === 'dissertation') {
    return 'Автор диссертации';
  }

  if (variant === 'patent') {
    return 'Авторы / правообладатели';
  }

  return 'Авторы';
}

function getSourceItemTitle(item: ArticleSearchItemDto): string {
  return item.title || item.journal || `Публикация #${item.id}`;
}

function getRelatedArticleLabel(articleLanguage: ArticleLanguage): string {
  if (articleLanguage === 'R') {
    return 'Переводная версия';
  }

  if (articleLanguage === 'F') {
    return 'Оригинальная версия';
  }

  return 'Связанная статья';
}

function detectArticleLanguage(title: string): ArticleLanguage {
  const value = title.trim();

  if (!value) {
    return '';
  }

  if (/[а-яё]/i.test(value)) {
    return 'R';
  }

  if (/[a-z]/i.test(value)) {
    return 'F';
  }

  return '';
}

function normalizeArticleLanguage(value: string | null | undefined): ArticleLanguage {
  return value === 'R' || value === 'F' ? value : '';
}

function getRelatedArticleKindFromLanguage(
  articleLanguage: ArticleLanguage,
): RelatedArticleKind {
  if (articleLanguage === 'F') {
    return 'original';
  }

  if (articleLanguage === 'R') {
    return 'translation';
  }

  return '';
}

function getRelatedArticleKindFromEditArticle(
  article: AdminArticleEditDto,
): RelatedArticleKind {
  if (article.original_version_id !== null) {
    return 'original';
  }

  if (article.translation_version_id !== null) {
    return 'translation';
  }

  return getRelatedArticleKindFromLanguage(normalizeArticleLanguage(article.article_language));
}

function toFormString(value: string | number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function stripLegacySourcePrefix(value: string | number | null | undefined): string {
  return toFormString(value).trimStart().replace(/^\/+\s*/, '');
}

function buildLookupOption(
  id: number | null | undefined,
  label: string | null | undefined,
  fallbackLabel: string,
): AdminOptionDto | null {
  if (id === null || id === undefined) {
    return null;
  }

  return {
    id,
    label: label?.trim() || `${fallbackLabel} #${id}`,
  };
}

function buildEmptyForm(workFormType: string, publicationTypeFlags: string[] | string): FormState {
  const flags = Array.isArray(publicationTypeFlags)
    ? publicationTypeFlags
    : publicationTypeFlags
      ? [publicationTypeFlags]
      : [];
  const selectedFlags = flags.slice(0, 1);

  return {
    ...INITIAL_FORM,
    workFormType,
    publicationTypeFlag: selectedFlags[0] ?? '',
    publicationTypeFlags: selectedFlags,
  };
}

function buildSelectedAuthorsFromEditArticle(
  article: AdminArticleEditDto,
  authors: AuthorOptionDto[],
): SelectedAuthor[] {
  const authorsById = new Map(authors.map((item) => [item.id, item]));

  return article.authors.map((item) => ({
    author:
      authorsById.get(item.author_id) ??
      {
        id: item.author_id,
        label: item.author_name,
        source: 'employee',
        nickname: null,
        email: null,
        position: null,
        department_id: null,
        department_name: null,
      },
    affiliation: String(item.affiliation || 1),
    correspondingAuthor: item.corresponding_author,
  }));
}

async function loadRelatedArticleForEdit(
  article: AdminArticleEditDto,
): Promise<ArticleSearchItemDto | null> {
  const relatedArticleId = article.original_version_id ?? article.translation_version_id;

  if (relatedArticleId === null) {
    return null;
  }

  try {
    const detail = await getPublicationDetail(relatedArticleId);

    return {
      id: detail.id,
      title: detail.title,
      authors: detail.authors,
      journal: detail.journal,
      year: detail.year,
      doi: detail.doi,
    };
  } catch {
    return {
      id: relatedArticleId,
      title: `Публикация #${relatedArticleId}`,
      authors: null,
      journal: null,
      year: null,
      doi: null,
    };
  }
}

function buildFormFromEditArticle(
  article: AdminArticleEditDto,
  workFormType: string,
  publicationTypeFlags: string[],
  relatedArticle: ArticleSearchItemDto | null,
): FormState {
  const isMonograph =
    workFormType === 'B' && publicationTypeFlags.length === 1 && publicationTypeFlags[0] === 'MO';

  return {
    ...buildEmptyForm(workFormType, publicationTypeFlags),
    title: isMonograph
      ? stripLegacySourcePrefix(article.title || article.title_of_material)
      : toFormString(article.title),
    authorsText: toFormString(
      isMonograph ? article.authors_text || article.author_of_material : article.authors_text,
    ),
    sourceText: isMonograph
      ? stripLegacySourcePrefix(article.title_of_material)
      : toFormString(article.title_of_material),
    edition: toFormString(article.edition),
    journal: buildLookupOption(article.journal_id, article.journal_label, 'Издание'),
    publisher: buildLookupOption(article.publisher_id, article.publisher_label, 'Издательство'),
    placeOfPublication: buildLookupOption(
      article.place_of_publication_id,
      article.place_of_publication_label,
      'Место публикации',
    ),
    placeOfMeeting: buildLookupOption(
      article.place_of_meeting_id,
      article.place_of_meeting_label,
      'Место проведения',
    ),
    mediumDesignator: buildLookupOption(
      article.medium_designator_id,
      article.medium_designator_label,
      'Обозначение материала',
    ),
    authorRole: toFormString(article.author_role),
    authorOfMaterial: toFormString(
      isMonograph ? article.author_of_material || article.authors_text : article.author_of_material,
    ),
    volume: toFormString(article.volume),
    issue: toFormString(article.issue),
    speaker: toFormString(article.speaker),
    doi: toFormString(article.doi),
    url: toFormString(article.url),
    pages: toFormString(article.pages),
    publicationDate: toFormString(article.publication_date),
    dateOfMeeting: toFormString(article.date_of_meeting),
    year: toFormString(article.year),
    abstract: toFormString(article.abstract),
    keywordsInput: article.keywords.join(', '),
    relatedArticle,
    relatedArticleKind: getRelatedArticleKindFromEditArticle(article),
    articleLanguage: normalizeArticleLanguage(article.article_language),
    isbn: toFormString(article.isbn),
    tirage: toFormString(article.tirage),
    extentOfWork: toFormString(article.extent_of_work),
    notes: toFormString(article.notes),
  };
}

export function PublicationsCreatePage({ articleId }: PublicationsCreatePageProps) {
  const { user, isAuthenticated, isInitializing } = useAuth();
  const isEditMode = typeof articleId === 'number';
  const initialFormScenario = useMemo(getInitialFormScenarioFromUrl, []);

  const [formScenario, setFormScenario] = useState<FormScenario>(initialFormScenario);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [workForms, setWorkForms] = useState<WorkFormTypeDto[]>([]);
  const [workFormFields, setWorkFormFields] = useState<WorkFormFieldDto[]>([]);
  const [publicationTypes, setPublicationTypes] = useState<PublicationTypeDto[]>([]);
  const [allAuthors, setAllAuthors] = useState<AuthorOptionDto[]>([]);
  const [selectedAuthors, setSelectedAuthors] = useState<SelectedAuthor[]>([]);
  const [isBootLoading, setIsBootLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [selectorMode, setSelectorMode] = useState<SelectorMode>(null);
  const [selectorQuery, setSelectorQuery] = useState('');
  const [selectorLoading, setSelectorLoading] = useState(false);
  const [journalResults, setJournalResults] = useState<AdminOptionDto[]>([]);
  const [publisherResults, setPublisherResults] = useState<AdminOptionDto[]>([]);
  const [placeResults, setPlaceResults] = useState<AdminOptionDto[]>([]);
  const [mediumResults, setMediumResults] = useState<AdminOptionDto[]>([]);
  const [authorResults, setAuthorResults] = useState<AuthorOptionDto[]>([]);
  const [sourceResults, setSourceResults] = useState<AdminEditionSourceDto[]>([]);
  const [relatedResults, setRelatedResults] = useState<ArticleSearchItemDto[]>([]);

  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const publicationDateInputRef = useRef<HTMLInputElement | null>(null);

  const isRoleAllowed = Boolean(isAuthenticated && user?.role_id === ADMIN_ROLE_ID);

  useEffect(() => {
    if (!isInitializing && (!isAuthenticated || user?.role_id !== ADMIN_ROLE_ID)) {
      navigateTo('/articles');
    }
  }, [isAuthenticated, isInitializing, user?.role_id]);

  useEffect(() => {
    if (!isRoleAllowed) {
      return;
    }

    let isMounted = true;

    async function loadInitialData() {
      setIsBootLoading(true);
      setError('');

      try {
        const [workFormItems, authorsResponse, articleForEdit] = await Promise.all([
          getAdminWorkFormTypes(),
          getAdminAuthors({ all: true }),
          isEditMode && articleId ? getAdminArticleForEdit(articleId) : Promise.resolve(null),
        ]);

        if (!isMounted) {
          return;
        }

        const enabledWorkFormItems = filterEnabledWorkForms(workFormItems);

        setWorkForms(enabledWorkFormItems);
        setAllAuthors(authorsResponse.items);

        const defaultScenario = initialFormScenario;
        const defaultScenarioConfig =
          getScenarioConfig(defaultScenario) ?? AGREED_SCENARIO_CONFIG.article;
        const defaultWorkForm =
          enabledWorkFormItems.find((item) => item.value === defaultScenarioConfig.workFormType) ||
          enabledWorkFormItems[0] ||
          null;

        if (!defaultWorkForm) {
          setPublicationTypes([]);
          setWorkFormFields([]);
          setForm(INITIAL_FORM);
          return;
        }

        if (articleForEdit) {
          const editWorkFormType = articleForEdit.work_form_type || defaultWorkForm.value;
          const editPublicationTypeFlags = articleForEdit.publication_type_flags;
          const editScenario = resolveScenarioFromArticle(
            editWorkFormType,
            editPublicationTypeFlags,
          );
          const [publicationTypeItems, fieldItems, relatedArticle] = await Promise.all([
            getAdminPublicationTypes(editWorkFormType),
            getAdminWorkFormFields(editWorkFormType),
            loadRelatedArticleForEdit(articleForEdit),
          ]);

          if (!isMounted) {
            return;
          }

          setFormScenario(editScenario);
          setPublicationTypes(publicationTypeItems);
          setWorkFormFields(fieldItems);
          setSelectedAuthors(
            buildSelectedAuthorsFromEditArticle(articleForEdit, authorsResponse.items),
          );
          setForm(
            buildFormFromEditArticle(
              articleForEdit,
              editWorkFormType,
              editPublicationTypeFlags,
              relatedArticle,
            ),
          );
          return;
        }

        const [publicationTypeItems, fieldItems] = await Promise.all([
          getAdminPublicationTypes(defaultWorkForm.value),
          getAdminWorkFormFields(defaultWorkForm.value),
        ]);

        if (!isMounted) {
          return;
        }

        setFormScenario(defaultScenario);
        setPublicationTypes(publicationTypeItems);
        setWorkFormFields(fieldItems);
        setForm(
          buildEmptyForm(
            defaultWorkForm.value,
            getScenarioPublicationTypeFlags(
              defaultScenario,
              publicationTypeItems,
              defaultWorkForm.value,
            ),
          ),
        );
      } catch (caughtError) {
        if (!isMounted) {
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : isEditMode
              ? 'Не удалось подготовить форму редактирования публикации.'
              : 'Не удалось подготовить форму добавления публикации.',
        );
      } finally {
        if (isMounted) {
          setIsBootLoading(false);
        }
      }
    }

    void loadInitialData();

    return () => {
      isMounted = false;
    };
  }, [articleId, initialFormScenario, isEditMode, isRoleAllowed]);

  const selectedWorkForm = useMemo(
    () => workForms.find((item) => item.value === form.workFormType) ?? null,
    [form.workFormType, workForms],
  );

  const selectedPublicationTypeFlags = useMemo(
    () => {
      const selectedFlag =
        form.publicationTypeFlag || form.publicationTypeFlags[0] || '';

      return selectedFlag ? [selectedFlag] : [];
    },
    [form.publicationTypeFlag, form.publicationTypeFlags],
  );

  const selectedPublicationType = useMemo(
    () => publicationTypes.find((item) => item.value === selectedPublicationTypeFlags[0]) ?? null,
    [publicationTypes, selectedPublicationTypeFlags],
  );

  const availablePublicationTypes = useMemo(
    () => filterEnabledPublicationTypes(publicationTypes, form.workFormType),
    [form.workFormType, publicationTypes],
  );

  const otherPublicationTypes = useMemo(() => {
    const hiddenFlags = new Set(AGREED_FLAGS_BY_WORK_FORM[form.workFormType] ?? []);
    return availablePublicationTypes.filter((item) => !hiddenFlags.has(item.value));
  }, [availablePublicationTypes, form.workFormType]);

  const variant = useMemo(
    () => {
      const config = getScenarioConfig(formScenario);
      return config?.variant ?? resolveVariant(selectedWorkForm, selectedPublicationType);
    },
    [formScenario, selectedWorkForm, selectedPublicationType],
  );

  const workFormFieldNames = useMemo(
    () =>
      new Set(
        workFormFields
          .map((item) => item.article_field)
          .filter((item): item is string => Boolean(item)),
      ),
    [workFormFields],
  );

  const sourceLabel = useMemo(() => getSourceLabel(variant), [variant]);
  const isOtherScenario = formScenario === 'other';
  const resolvedYear = deriveYear(form.year, form.publicationDate);
  const detectedArticleLanguage = useMemo(
    () => detectArticleLanguage(form.title),
    [form.title],
  );

  const shouldShowField = (articleField: string, scenarios: FormScenario[] = []) =>
    isOtherScenario ? workFormFieldNames.has(articleField) : scenarios.includes(formScenario);
  const useSourceLookup =
    shouldShowField('Title_of_Material_F9', ['book-chapter', 'conference-materials']) &&
    (!isOtherScenario || form.workFormType === 'B' || form.workFormType === 'C');
  const showPlainSourceField =
    shouldShowField('Title_of_Material_F9', ['book-chapter', 'conference-materials']) &&
    !useSourceLookup;

  const isSubmitDisabled =
    isSubmitting ||
    !form.title.trim() ||
    resolvedYear === null ||
    (isOtherScenario && selectedPublicationTypeFlags.length === 0) ||
    (formScenario === 'article' && !form.journal) ||
    (formScenario === 'book-chapter' && !form.sourceText.trim()) ||
    (formScenario === 'book-monograph' && !form.publisher) ||
    (formScenario === 'conference-materials' && (!form.sourceText.trim() || !form.publisher));

  useEffect(() => {
    if (!selectorMode) {
      return;
    }

    let isMounted = true;
    const isArticleSelector = selectorMode === 'source' || selectorMode === 'related';
    const isSearchRequiredSelector =
      isArticleSelector ||
      selectorMode === 'author' ||
      selectorMode === 'journal' ||
      selectorMode === 'publisher' ||
      selectorMode === 'place-publication' ||
      selectorMode === 'place-meeting' ||
      selectorMode === 'medium';
    const trimmedSelectorQuery = selectorQuery.trim();

    if (isSearchRequiredSelector && !trimmedSelectorQuery) {
      setSelectorLoading(false);
      if (selectorMode === 'source') {
        setSourceResults([]);
      } else if (selectorMode === 'related') {
        setRelatedResults([]);
      } else if (selectorMode === 'journal') {
        setJournalResults([]);
      } else if (selectorMode === 'publisher') {
        setPublisherResults([]);
      } else if (selectorMode === 'place-publication' || selectorMode === 'place-meeting') {
        setPlaceResults([]);
      } else if (selectorMode === 'medium') {
        setMediumResults([]);
      } else {
        setAuthorResults([]);
      }
      return;
    }

    async function loadSelectorItems() {
      setSelectorLoading(true);

      try {
        if (selectorMode === 'journal') {
          const items = await searchAdminJournals(selectorQuery);
          if (isMounted) {
            setJournalResults(items);
          }
          return;
        }

        if (selectorMode === 'publisher') {
          const items = await searchAdminPublishers(selectorQuery);
          if (isMounted) {
            setPublisherResults(items);
          }
          return;
        }

        if (selectorMode === 'place-publication' || selectorMode === 'place-meeting') {
          const items = await searchAdminPlaces(selectorQuery);
          if (isMounted) {
            setPlaceResults(items);
          }
          return;
        }

        if (selectorMode === 'medium') {
          const items = await searchAdminMediumDesignators(selectorQuery);
          if (isMounted) {
            setMediumResults(items);
          }
          return;
        }

        if (selectorMode === 'author') {
          const response = await getAdminAuthors({
            query: selectorQuery,
            page: 1,
            pageSize: 100,
          });
          if (isMounted) {
            setAuthorResults(
              response.items.filter(
                (item) => item.source === 'employee' && item.id !== null,
              ),
            );
          }
          return;
        }

        if (selectorMode === 'source') {
          const items = await searchAdminEditionSources(
            selectorQuery,
            variant === 'conference' ? 'conference' : 'monograph',
          );
          if (isMounted) {
            setSourceResults(items);
          }
          return;
        }

        if (selectorMode === 'related') {
          const items = await searchAdminArticles(selectorQuery);
          if (isMounted) {
            setRelatedResults(items);
          }
        }
      } catch (caughtError) {
        if (isMounted) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : 'Не удалось загрузить данные для выбора.',
          );
        }
      } finally {
        if (isMounted) {
          setSelectorLoading(false);
        }
      }
    }

    const loadTimer = isSearchRequiredSelector
      ? window.setTimeout(() => {
          void loadSelectorItems();
        }, 300)
      : null;

    if (!isSearchRequiredSelector) {
      void loadSelectorItems();
    }

    return () => {
      isMounted = false;
      if (loadTimer !== null) {
        window.clearTimeout(loadTimer);
      }
    };
  }, [selectorMode, selectorQuery, variant]);

  const closeSelector = () => {
    setSelectorMode(null);
    setSelectorQuery('');
  };

  const loadWorkFormData = async (workFormType: string, scenario: FormScenario) => {
    const [items, fieldItems] = await Promise.all([
      getAdminPublicationTypes(workFormType),
      getAdminWorkFormFields(workFormType),
    ]);

    setPublicationTypes(items);
    setWorkFormFields(fieldItems);
    setSelectedAuthors([]);
    setForm(() =>
      buildEmptyForm(
        workFormType,
        getScenarioPublicationTypeFlags(scenario, items, workFormType),
      ),
    );
  };

  const handleScenarioChange = async (nextValue: string) => {
    const nextScenario = nextValue as FormScenario;
    setError('');
    setSuccessMessage('');
    setSelectorMode(null);
    setFormScenario(nextScenario);

    try {
      const scenarioConfig = getScenarioConfig(nextScenario);
      const nextWorkFormType =
        scenarioConfig?.workFormType ||
        (form.workFormType && form.workFormType !== 'X' ? form.workFormType : 'J');

      await loadWorkFormData(nextWorkFormType, nextScenario);
    } catch (caughtError) {
      setPublicationTypes([]);
      setWorkFormFields([]);
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Не удалось загрузить поля формы публикации.',
      );
    }
  };

  const handleOtherWorkFormChange = async (nextValue: string) => {
    setError('');
    setSuccessMessage('');
    setSelectorMode(null);

    try {
      await loadWorkFormData(nextValue, 'other');
    } catch (caughtError) {
      setPublicationTypes([]);
      setWorkFormFields([]);
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Не удалось загрузить поля формы публикации.',
      );
    }
  };

  const selectPublicationTypeFlag = (flag: string) => {
    setSelectorMode(null);
    setForm((prev) => ({
      ...prev,
      publicationTypeFlag: flag,
      publicationTypeFlags: [flag],
    }));
  };

  const openPublicationDatePicker = () => {
    const input = publicationDateInputRef.current;

    if (!input) {
      return;
    }

    input.showPicker?.();
    input.focus();
  };

  const openSelector = (mode: SelectorMode) => {
    setError('');
    setSuccessMessage('');

    if (selectorMode === mode) {
      closeSelector();
      return;
    }

    if (mode === 'source') {
      setSelectorQuery(form.sourceText);
    } else if (mode === 'journal') {
      setSelectorQuery(form.journal?.label ?? '');
    } else if (mode === 'publisher') {
      setSelectorQuery(form.publisher?.label ?? '');
    } else if (mode === 'place-publication') {
      setSelectorQuery(form.placeOfPublication?.label ?? '');
    } else if (mode === 'place-meeting') {
      setSelectorQuery(form.placeOfMeeting?.label ?? '');
    } else if (mode === 'medium') {
      setSelectorQuery(form.mediumDesignator?.label ?? '');
    } else if (mode === 'author') {
      setSelectorQuery('');
    } else {
      setSelectorQuery(form.relatedArticle?.title ?? '');
    }

    setSelectorMode(mode);
  };

  const addSelectedAuthor = (author: AuthorOptionDto) => {
    if (author.id === null || author.source !== 'employee') {
      return;
    }

    setSelectedAuthors((prev) => {
      if (prev.some((item) => item.author.id === author.id)) {
        return prev;
      }

      return [
        ...prev,
        {
          author,
          affiliation: '1',
          correspondingAuthor: false,
        },
      ];
    });
  };

  const syncAuthorsFromText = () => {
    setError('');
    setSuccessMessage('');

    const matchedAuthors = findAuthorsInText(form.authorsText, allAuthors);

    setSelectedAuthors((prev) => {
      const prevById = new Map(prev.map((item) => [item.author.id, item]));

      return matchedAuthors.map((author) => ({
        author,
        affiliation: prevById.get(author.id)?.affiliation ?? '1',
        correspondingAuthor: prevById.get(author.id)?.correspondingAuthor ?? false,
      }));
    });
  };

  const updateSelectedAuthor = (
    authorId: number,
    patch: Partial<Pick<SelectedAuthor, 'affiliation' | 'correspondingAuthor'>>,
  ) => {
    setSelectedAuthors((prev) =>
      prev.map((item) => {
        if (item.author.id !== authorId) {
          return patch.correspondingAuthor ? { ...item, correspondingAuthor: false } : item;
        }

        return {
          ...item,
          ...patch,
        };
      }),
    );
  };

  const removeSelectedAuthor = (authorId: number) => {
    setSelectedAuthors((prev) => prev.filter((item) => item.author.id !== authorId));
  };

  const handleSubmit = async () => {
    setError('');
    setSuccessMessage('');

    if (!form.title.trim()) {
      setError('Заполни поле «Название».');
      return;
    }

    if (resolvedYear === null) {
      setError('Укажи год публикации или дату, из которой можно определить год.');
      return;
    }

    if (isOtherScenario && selectedPublicationTypeFlags.length === 0) {
      setError('Выбери тип публикации.');
      return;
    }

    if (formScenario === 'article' && !form.journal) {
      setError('Для статьи выбери издание.');
      return;
    }

    const nextArticleLanguage = detectedArticleLanguage || form.articleLanguage;
    const nextRelatedArticleKind =
      form.relatedArticleKind || getRelatedArticleKindFromLanguage(nextArticleLanguage);
    const titleValue = form.title.trim();
    const authorsTextValue = form.authorsText.trim();
    const authorOfMaterialValue = form.authorOfMaterial.trim();

    const payloadBase: CreateAdminArticlePayload = {
      title: titleValue,
      year: resolvedYear,
      authors_text: authorsTextValue || null,
      authors: selectedAuthors
        .filter((item) => item.author.id !== null)
        .map((item) => ({
          author_id: item.author.id as number,
          affiliation: Number(item.affiliation) || 1,
          corresponding_author: item.correspondingAuthor,
        })),
      abstract: form.abstract.trim() || null,
      doi: form.doi.trim() || null,
      work_form_type: form.workFormType || null,
      author_role: form.authorRole.trim() || null,
      author_of_material: authorOfMaterialValue || null,
      publication_type_flags: selectedPublicationTypeFlags,
      keywords: normalizeKeywords(form.keywordsInput),
      article_language: nextArticleLanguage || null,
      original_version_id:
        form.relatedArticle && nextRelatedArticleKind === 'original'
          ? form.relatedArticle.id
          : null,
      translation_version_id:
        form.relatedArticle && nextRelatedArticleKind === 'translation'
          ? form.relatedArticle.id
          : null,
    };

    const sharedDetails = {
      publisher_id: form.publisher?.id ?? null,
      place_of_publication_id: form.placeOfPublication?.id ?? null,
      place_of_meeting_id: form.placeOfMeeting?.id ?? null,
      medium_designator_id: form.mediumDesignator?.id ?? null,
      title_of_material: form.sourceText.trim() || null,
      edition: form.edition.trim() || null,
      volume: form.volume.trim() || null,
      issue: form.issue.trim() || null,
      pages: form.pages.trim() || null,
      extent_of_work: form.extentOfWork.trim() || null,
      url: form.url.trim() || null,
      isbn: form.isbn.trim() || null,
      notes: form.notes.trim() || null,
      speaker: form.speaker.trim() || null,
      tirage: form.tirage.trim() || null,
    } satisfies Partial<CreateAdminArticlePayload>;

    const payloadByVariant: Record<FormVariant, CreateAdminArticlePayload> = {
      article: {
        ...payloadBase,
        journal_id: form.journal?.id ?? null,
        pages: sharedDetails.pages,
        publication_date: form.publicationDate || null,
        volume: sharedDetails.volume,
        issue: sharedDetails.issue,
      },
      'book-chapter': {
        ...payloadBase,
        ...sharedDetails,
      },
      'book-monograph': {
        ...payloadBase,
        ...sharedDetails,
        title_of_material: titleValue || sharedDetails.title_of_material,
        author_of_material: authorsTextValue || authorOfMaterialValue || null,
      },
      conference: {
        ...payloadBase,
        ...sharedDetails,
        journal_id: form.journal?.id ?? null,
        date_of_meeting: form.dateOfMeeting.trim() || null,
      },
      dissertation: {
        ...payloadBase,
        ...sharedDetails,
      },
      patent: {
        ...payloadBase,
        ...sharedDetails,
      },
      newspaper: {
        ...payloadBase,
        ...sharedDetails,
      },
      report: {
        ...payloadBase,
        ...sharedDetails,
      },
    };

    const payload = payloadByVariant[variant];

    setIsSubmitting(true);

    try {
      const savedArticle =
        isEditMode && articleId
          ? await updateAdminArticle(articleId, payload)
          : await createAdminArticle(payload);
      const savedArticleId = savedArticle.id;

      if (form.pdfFile) {
        await uploadAdminArticlePdf(savedArticleId, form.pdfFile);
      }
      setSuccessMessage(
        isEditMode
          ? `Публикация успешно сохранена. ID: ${savedArticleId}`
          : `Публикация успешно добавлена. ID: ${savedArticleId}`,
      );
      setSelectorMode(null);
      if (!isEditMode) {
        setSelectedAuthors([]);
        setForm((prev) =>
          buildEmptyForm(
            prev.workFormType,
            getScenarioPublicationTypeFlags(formScenario, publicationTypes, prev.workFormType),
          ),
        );
      }
      if (pdfInputRef.current) {
        pdfInputRef.current.value = '';
      }

      window.setTimeout(() => {
        navigateTo(isEditMode ? `/articles/${savedArticleId}` : '/articles');
      }, 900);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : isEditMode
            ? 'Не удалось сохранить публикацию.'
            : 'Не удалось создать публикацию.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderLookupField = (
    label: string,
    value: string,
    mode: Exclude<SelectorMode, null>,
    clearLabel: string,
    onClear: () => void,
  ) => (
    <div className={styles.lookupRow}>
      <TextField
        label={label}
        height={40}
        radius={4}
        rootClassName={styles.fullWidthField}
        fieldClassName={[styles.formTextField, styles.lookupTextField].join(' ')}
        inputClassName={styles.formTextFieldInput}
        value={value}
        readOnly
        endContent={value ? <ClearFieldButton label={clearLabel} onClick={onClear} /> : null}
      />
      <Button
        label="Выбрать"
        className={styles.sideButton}
        onClick={() => openSelector(mode)}
      />
    </div>
  );

  const renderPublicationDateField = (label = 'Дата') => (
    <TextField
      ref={publicationDateInputRef}
      label={label}
      height={40}
      radius={4}
      rootClassName={styles.fullWidthField}
      fieldClassName={styles.formTextField}
      inputClassName={[styles.formTextFieldInput, styles.dateFieldInput].join(' ')}
      trailingIcon="calendar_month"
      onTrailingIconClick={openPublicationDatePicker}
      type="date"
      value={form.publicationDate}
      onChange={(event) =>
        setForm((prev) => ({
          ...prev,
          publicationDate: event.target.value,
        }))
      }
    />
  );

  const renderDateOfMeetingField = () => (
    <TextField
      label="Дата проведения"
      height={40}
      radius={4}
      rootClassName={styles.fullWidthField}
      fieldClassName={styles.formTextField}
      inputClassName={styles.formTextFieldInput}
      value={form.dateOfMeeting}
      onChange={(event) =>
        setForm((prev) => ({
          ...prev,
          dateOfMeeting: event.target.value,
        }))
      }
    />
  );

  const renderYearField = () => (
    <TextField
      label="Год"
      height={40}
      radius={4}
      rootClassName={styles.fullWidthField}
      fieldClassName={styles.formTextField}
      inputClassName={styles.formTextFieldInput}
      type="number"
      value={form.year}
      onChange={(event) =>
        setForm((prev) => ({
          ...prev,
          year: event.target.value,
        }))
      }
    />
  );

  const renderSelectorPanel = () => {
    if (!selectorMode) {
      return null;
    }

    if (selectorMode === 'journal') {
      return (
        <div className={styles.selectorPanel}>
          <div className={styles.selectorHeader}>
            <div className={styles.selectorTitle}>Выбор издания</div>
            <button type="button" className={styles.selectorClose} onClick={closeSelector}>
              ×
            </button>
          </div>
          <TextField
            variant="plain"
            height={40}
            radius={4}
            rootClassName={styles.selectorSearchField}
            fieldClassName={styles.formTextField}
            inputClassName={styles.formTextFieldInput}
            value={selectorQuery}
            onChange={(event) => setSelectorQuery(event.target.value)}
            placeholder="Поиск по названию, ISSN или ID"
          />
          <div className={styles.selectorResults}>
            {selectorLoading ? <div className={styles.selectorHint}>Загрузка…</div> : null}
            {!selectorLoading && !selectorQuery.trim() ? (
              <div className={styles.selectorHint}>Введите название, ISSN или ID издания.</div>
            ) : null}
            {!selectorLoading && selectorQuery.trim() && journalResults.length === 0 ? (
              <div className={styles.selectorHint}>Совпадения не найдены.</div>
            ) : null}
            {journalResults.map((item) => (
              <button
                key={item.id}
                type="button"
                className={styles.selectorItem}
                onClick={() => {
                  setForm((prev) => ({
                    ...prev,
                    journal: item,
                  }));
                  closeSelector();
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (selectorMode === 'publisher') {
      return (
        <div className={styles.selectorPanel}>
          <div className={styles.selectorHeader}>
            <div className={styles.selectorTitle}>Выбор издательства</div>
            <button type="button" className={styles.selectorClose} onClick={closeSelector}>
              ×
            </button>
          </div>
          <TextField
            variant="plain"
            height={40}
            radius={4}
            rootClassName={styles.selectorSearchField}
            fieldClassName={styles.formTextField}
            inputClassName={styles.formTextFieldInput}
            value={selectorQuery}
            onChange={(event) => setSelectorQuery(event.target.value)}
            placeholder="Поиск издательства"
          />
          <div className={styles.selectorResults}>
            {selectorLoading ? <div className={styles.selectorHint}>Загрузка…</div> : null}
            {!selectorLoading && !selectorQuery.trim() ? (
              <div className={styles.selectorHint}>Введите название или ID издательства.</div>
            ) : null}
            {!selectorLoading && selectorQuery.trim() && publisherResults.length === 0 ? (
              <div className={styles.selectorHint}>Совпадения не найдены.</div>
            ) : null}
            {publisherResults.map((item) => (
              <button
                key={item.id}
                type="button"
                className={styles.selectorItem}
                onClick={() => {
                  setForm((prev) => ({
                    ...prev,
                    publisher: item,
                  }));
                  closeSelector();
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (selectorMode === 'place-publication' || selectorMode === 'place-meeting') {
      const isMeetingPlace = selectorMode === 'place-meeting';

      return (
        <div className={styles.selectorPanel}>
          <div className={styles.selectorHeader}>
            <div className={styles.selectorTitle}>
              {isMeetingPlace ? 'Выбор места проведения' : 'Выбор места публикации'}
            </div>
            <button type="button" className={styles.selectorClose} onClick={closeSelector}>
              ×
            </button>
          </div>
          <TextField
            variant="plain"
            height={40}
            radius={4}
            rootClassName={styles.selectorSearchField}
            fieldClassName={styles.formTextField}
            inputClassName={styles.formTextFieldInput}
            value={selectorQuery}
            onChange={(event) => setSelectorQuery(event.target.value)}
            placeholder="Поиск места"
          />
          <div className={styles.selectorResults}>
            {selectorLoading ? <div className={styles.selectorHint}>Загрузка…</div> : null}
            {!selectorLoading && !selectorQuery.trim() ? (
              <div className={styles.selectorHint}>Введите название или ID места.</div>
            ) : null}
            {!selectorLoading && selectorQuery.trim() && placeResults.length === 0 ? (
              <div className={styles.selectorHint}>Совпадения не найдены.</div>
            ) : null}
            {placeResults.map((item) => (
              <button
                key={item.id}
                type="button"
                className={styles.selectorItem}
                onClick={() => {
                  setForm((prev) => ({
                    ...prev,
                    [isMeetingPlace ? 'placeOfMeeting' : 'placeOfPublication']: item,
                  }));
                  closeSelector();
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (selectorMode === 'medium') {
      return (
        <div className={styles.selectorPanel}>
          <div className={styles.selectorHeader}>
            <div className={styles.selectorTitle}>Выбор обозначения материала</div>
            <button type="button" className={styles.selectorClose} onClick={closeSelector}>
              ×
            </button>
          </div>
          <TextField
            variant="plain"
            height={40}
            radius={4}
            rootClassName={styles.selectorSearchField}
            fieldClassName={styles.formTextField}
            inputClassName={styles.formTextFieldInput}
            value={selectorQuery}
            onChange={(event) => setSelectorQuery(event.target.value)}
            placeholder="Поиск обозначения"
          />
          <div className={styles.selectorResults}>
            {selectorLoading ? <div className={styles.selectorHint}>Загрузка…</div> : null}
            {!selectorLoading && !selectorQuery.trim() ? (
              <div className={styles.selectorHint}>Введите название или ID обозначения.</div>
            ) : null}
            {!selectorLoading && selectorQuery.trim() && mediumResults.length === 0 ? (
              <div className={styles.selectorHint}>Совпадения не найдены.</div>
            ) : null}
            {mediumResults.map((item) => (
              <button
                key={item.id}
                type="button"
                className={styles.selectorItem}
                onClick={() => {
                  setForm((prev) => ({
                    ...prev,
                    mediumDesignator: item,
                  }));
                  closeSelector();
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (selectorMode === 'author') {
      const availableAuthorResults = authorResults.filter(
        (item) => !selectedAuthors.some((selected) => selected.author.id === item.id),
      );

      return (
        <div className={styles.selectorPanel}>
          <div className={styles.selectorHeader}>
            <div className={styles.selectorTitle}>Выбор сотрудника</div>
            <button type="button" className={styles.selectorClose} onClick={closeSelector}>
              ×
            </button>
          </div>
          <TextField
            variant="plain"
            height={40}
            radius={4}
            rootClassName={styles.selectorSearchField}
            fieldClassName={styles.formTextField}
            inputClassName={styles.formTextFieldInput}
            value={selectorQuery}
            onChange={(event) => setSelectorQuery(event.target.value)}
            placeholder="Поиск сотрудника по ФИО"
          />
          <div className={styles.selectorResults}>
            {selectorLoading ? <div className={styles.selectorHint}>Загрузка…</div> : null}
            {!selectorLoading && !selectorQuery.trim() ? (
              <div className={styles.selectorHint}>Введите ФИО сотрудника.</div>
            ) : null}
            {!selectorLoading && selectorQuery.trim() && availableAuthorResults.length === 0 ? (
              <div className={styles.selectorHint}>Совпадения не найдены.</div>
            ) : null}
            {availableAuthorResults.map((item) => (
              <button
                key={`${item.source}-${item.id ?? item.label}`}
                type="button"
                className={styles.selectorItem}
                onClick={() => {
                  addSelectedAuthor(item);
                  closeSelector();
                }}
              >
                <div className={styles.selectorItemTitle}>{item.label}</div>
                {item.department_name || item.position ? (
                  <div className={styles.selectorItemMeta}>
                    {['Сотрудник', item.department_name, item.position].filter(Boolean).join(' · ')}
                  </div>
                ) : (
                  <div className={styles.selectorItemMeta}>Сотрудник</div>
                )}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (selectorMode === 'source') {
      return (
        <div className={styles.selectorPanel}>
          <div className={styles.selectorHeader}>
            <div className={styles.selectorTitle}>
              Выбор значения для поля «{sourceLabel}»
            </div>
            <button type="button" className={styles.selectorClose} onClick={closeSelector}>
              ×
            </button>
          </div>
          <TextField
            variant="plain"
            height={40}
            radius={4}
            rootClassName={styles.selectorSearchField}
            fieldClassName={styles.formTextField}
            inputClassName={styles.formTextFieldInput}
            value={selectorQuery}
            onChange={(event) => setSelectorQuery(event.target.value)}
            placeholder="Поиск по названию, DOI или ID"
          />
          <div className={styles.selectorResults}>
            {selectorLoading ? <div className={styles.selectorHint}>Загрузка…</div> : null}
            {!selectorLoading && !selectorQuery.trim() ? (
              <div className={styles.selectorHint}>
                Введите название, ISBN, автора или издательство.
              </div>
            ) : null}
            {!selectorLoading && selectorQuery.trim() && sourceResults.length === 0 ? (
              <div className={styles.selectorHint}>Совпадения не найдены.</div>
            ) : null}
            {sourceResults.map((item) => (
              <button
                key={item.id}
                type="button"
                className={styles.selectorItem}
                onClick={() => {
                  setForm((prev) => ({
                    ...prev,
                    sourceText: item.label,
                  }));
                  closeSelector();
                }}
              >
                <div className={styles.selectorItemTitle}>{item.label}</div>
                {item.meta ? (
                  <div className={styles.selectorItemMeta}>{item.meta}</div>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className={styles.selectorPanel}>
        <div className={styles.selectorHeader}>
          <div className={styles.selectorTitle}>Выбор связанной статьи</div>
          <button type="button" className={styles.selectorClose} onClick={closeSelector}>
            ×
          </button>
        </div>
        <div className={styles.selectorHint}>
          Будет сохранено как: {getRelatedArticleLabel(detectedArticleLanguage).toLowerCase()}.
        </div>
        <TextField
          variant="plain"
          height={40}
          radius={4}
          rootClassName={styles.selectorSearchField}
          fieldClassName={styles.formTextField}
          inputClassName={styles.formTextFieldInput}
          value={selectorQuery}
          onChange={(event) => setSelectorQuery(event.target.value)}
          placeholder="Поиск по названию, DOI или ID"
        />
        <div className={styles.selectorResults}>
          {selectorLoading ? <div className={styles.selectorHint}>Загрузка…</div> : null}
          {!selectorLoading && !selectorQuery.trim() ? (
            <div className={styles.selectorHint}>Введите название, DOI или ID статьи.</div>
          ) : null}
          {!selectorLoading && selectorQuery.trim() && relatedResults.length === 0 ? (
            <div className={styles.selectorHint}>Совпадения не найдены.</div>
          ) : null}
          {relatedResults.map((item) => (
            <button
              key={item.id}
              type="button"
              className={styles.selectorItem}
                onClick={() => {
                  setForm((prev) => ({
                    ...prev,
                    relatedArticle: item,
                    relatedArticleKind: getRelatedArticleKindFromLanguage(
                      detectedArticleLanguage,
                    ),
                    articleLanguage: detectedArticleLanguage || prev.articleLanguage,
                  }));
                  closeSelector();
                }}
            >
              <div className={styles.selectorItemTitle}>{getSourceItemTitle(item)}</div>
              <div className={styles.selectorItemMeta}>{formatArticleMeta(item)}</div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const pageTitle = isEditMode ? 'Редактировать публикацию' : 'Добавить публикацию';
  const accessDeniedText = isEditMode
    ? 'Доступ к странице редактирования публикаций разрешён только администратору.'
    : 'Доступ к странице добавления публикаций разрешён только администратору.';
  const loadingText = isEditMode ? 'Загрузка публикации…' : 'Загрузка формы…';

  if (isInitializing || (isRoleAllowed && isBootLoading)) {
    return (
      <div className={`app-page ${styles.page}`}>
        <Header title={pageTitle} />
        <main className="app-main">
          <div className="container app-block-group">
            <div className={styles.statusBox}>{loadingText}</div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!isRoleAllowed) {
    return (
      <div className={`app-page ${styles.page}`}>
        <Header title={pageTitle} />
        <main className="app-main">
          <div className="container app-block-group">
            <div className={styles.statusBox}>{accessDeniedText}</div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className={`app-page ${styles.page}`}>
      <Header title={pageTitle} />

      <main className="app-main">
        <div className="container app-block-group">
          {error ? <div className={styles.messageError}>{error}</div> : null}
          {successMessage ? <div className={styles.messageSuccess}>{successMessage}</div> : null}

          <section className={styles.card}>
            <div className={styles.typeRow}>
              <div className={styles.typeLabel}>Тип публикации</div>

              <Select
                className={styles.primarySelect}
                width={280}
                menuWidth={360}
                ariaLabel="Тип публикации"
                options={FORM_SCENARIO_OPTIONS.map((item) => ({
                  value: item.value,
                  label: item.label,
                }))}
                value={formScenario}
                onChange={(nextValue) => void handleScenarioChange(nextValue)}
              />

              {isOtherScenario ? (
                <Select
                  className={styles.secondarySelect}
                  variant="outlined"
                  width={220}
                  menuWidth={280}
                  ariaLabel="Форма публикации"
                  options={workForms.map((item) => ({
                    value: item.value,
                    label: getWorkFormLabel(item),
                  }))}
                  value={form.workFormType}
                  onChange={(nextValue) => void handleOtherWorkFormChange(nextValue)}
                />
              ) : null}
            </div>

            {isOtherScenario ? (
              <div className={styles.otherTypesPanel}>
                <div className={styles.otherTypesLabel}>Классификация</div>
                <div className={styles.otherTypesGrid} role="radiogroup">
                  {otherPublicationTypes.length > 0 ? (
                    otherPublicationTypes.map((item) => {
                      const isChecked = selectedPublicationTypeFlags.includes(item.value);

                      return (
                        <button
                          key={item.value}
                          type="button"
                          className={[
                            styles.otherTypeButton,
                            isChecked ? styles.otherTypeButtonSelected : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          onClick={() => selectPublicationTypeFlag(item.value)}
                          role="radio"
                          aria-checked={isChecked}
                        >
                          <RadioButton checked={isChecked} />
                          <span>{getPublicationTypeLabel(item)}</span>
                        </button>
                      );
                    })
                  ) : (
                    <div className={styles.selectorHint}>
                      Для выбранной формы нет дополнительных типов.
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <div className={styles.formBody}>
              <TextField
                label={getTitlePlaceholder(variant)}
                height={40}
                radius={4}
                rootClassName={styles.fullWidthField}
                fieldClassName={styles.formTextField}
                inputClassName={styles.formTextFieldInput}
                value={form.title}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    title: event.target.value,
                  }))
                }
              />

              <TextField
                label={getAuthorsPlaceholder(variant)}
                height={40}
                radius={4}
                rootClassName={styles.fullWidthField}
                fieldClassName={styles.formTextField}
                inputClassName={styles.formTextFieldInput}
                value={form.authorsText}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    authorsText: event.target.value,
                  }))
                }
              />

              <div className={styles.authorsPanel}>
                {selectedAuthors.length > 0 ? (
                  <div className={styles.selectedAuthorsList}>
                    {selectedAuthors.map((item) => (
                      <div key={item.author.id} className={styles.selectedAuthorRow}>
                        <div className={styles.selectedAuthorName}>{item.author.label}</div>
                        <label className={styles.affiliationControl}>
                          <span>Количество аффилиаций</span>
                          <input
                            className={styles.affiliationInput}
                            type="number"
                            min="1"
                            max="9"
                            value={item.affiliation}
                            onChange={(event) =>
                              updateSelectedAuthor(item.author.id as number, {
                                affiliation: event.target.value,
                              })
                            }
                          />
                        </label>
                        <button
                          type="button"
                          className={styles.correspondingButton}
                          onClick={() =>
                            updateSelectedAuthor(item.author.id as number, {
                              correspondingAuthor: !item.correspondingAuthor,
                            })
                          }
                        >
                          <Checkbox checked={item.correspondingAuthor} />
                          <span>Автор для переписки</span>
                        </button>
                        <button
                          type="button"
                          className={styles.authorDeleteButton}
                          onClick={() => removeSelectedAuthor(item.author.id as number)}
                          aria-label={`Удалить сотрудника ${item.author.label}`}
                        >
                          <Icon name="delete" size={20} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className={styles.authorsActions}>
                  <TextButton
                    label="Обновить"
                    iconName="sync"
                    className={styles.authorsTextButton}
                    disabled={!form.authorsText.trim()}
                    onClick={syncAuthorsFromText}
                  />
                  <OutlineButton
                    label="Добавить"
                    iconName="add"
                    className={styles.addAuthorButton}
                    onClick={() => openSelector('author')}
                  />
                </div>
              </div>

              {selectorMode === 'author' ? renderSelectorPanel() : null}

              <div className={styles.rowTwoLeft}>{renderYearField()}</div>

              {shouldShowField('Journal_ID_f', ['article']) ? (
                <div className={styles.lookupRow}>
                  <TextField
                    label="Издание"
                    height={40}
                    radius={4}
                    rootClassName={styles.fullWidthField}
                    fieldClassName={[styles.formTextField, styles.lookupTextField].join(' ')}
                    inputClassName={styles.formTextFieldInput}
                    value={form.journal?.label ?? ''}
                    readOnly
                    endContent={
                      form.journal ? (
                        <ClearFieldButton
                          label="Очистить издание"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              journal: null,
                            }))
                          }
                        />
                      ) : null
                    }
                  />
                  <Button
                    label="Выбрать"
                    className={styles.sideButton}
                    onClick={() => openSelector('journal')}
                  />
                </div>
              ) : null}

              {useSourceLookup ? (
                <div className={styles.lookupRow}>
                  <TextField
                    label={sourceLabel}
                    height={40}
                    radius={4}
                    rootClassName={styles.fullWidthField}
                    fieldClassName={[styles.formTextField, styles.lookupTextField].join(' ')}
                    inputClassName={styles.formTextFieldInput}
                    value={form.sourceText}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        sourceText: event.target.value,
                      }))
                    }
                  />
                  <Button
                    label="Выбрать"
                    className={styles.sideButton}
                    onClick={() => openSelector('source')}
                  />
                </div>
              ) : null}

              {showPlainSourceField ? (
                <TextField
                  label={sourceLabel}
                  height={40}
                  radius={4}
                  rootClassName={styles.fullWidthField}
                  fieldClassName={styles.formTextField}
                  inputClassName={styles.formTextFieldInput}
                  value={form.sourceText}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      sourceText: event.target.value,
                    }))
                  }
                />
              ) : null}

              {shouldShowField('Author_of_Material_F7', ['book-chapter', 'conference-materials']) ? (
                <TextField
                  label={variant === 'conference' ? 'Редактор' : 'Автор монографии'}
                  height={40}
                  radius={4}
                  rootClassName={styles.fullWidthField}
                  fieldClassName={styles.formTextField}
                  inputClassName={styles.formTextFieldInput}
                  value={form.authorOfMaterial}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      authorOfMaterial: event.target.value,
                    }))
                  }
                />
              ) : null}

              {shouldShowField('AuthorRole_F2') ? (
                <TextField
                  label="Роль автора"
                  height={40}
                  radius={4}
                  rootClassName={styles.fullWidthField}
                  fieldClassName={styles.formTextField}
                  inputClassName={styles.formTextFieldInput}
                  value={form.authorRole}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      authorRole: event.target.value,
                    }))
                  }
                />
              ) : null}

              {shouldShowField('Speaker', ['conference-materials']) ? (
                <TextField
                  label="Докладчик"
                  height={40}
                  radius={4}
                  rootClassName={styles.fullWidthField}
                  fieldClassName={styles.formTextField}
                  inputClassName={styles.formTextFieldInput}
                  value={form.speaker}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      speaker: event.target.value,
                    }))
                  }
                />
              ) : null}

              {shouldShowField('Edition_F15', ['book-chapter', 'book-monograph']) ? (
                <TextField
                  label="Редакция"
                  height={40}
                  radius={4}
                  rootClassName={styles.fullWidthField}
                  fieldClassName={styles.formTextField}
                  inputClassName={styles.formTextFieldInput}
                  value={form.edition}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      edition: event.target.value,
                    }))
                  }
                />
              ) : null}

              {shouldShowField('PublisherName_F19_f', [
                'book-chapter',
                'book-monograph',
                'conference-materials',
              ]) ? (
                <div className={styles.lookupRow}>
                  <TextField
                    label={variant === 'dissertation' ? 'Университет' : 'Издательство'}
                    height={40}
                    radius={4}
                    rootClassName={styles.fullWidthField}
                    fieldClassName={[styles.formTextField, styles.lookupTextField].join(' ')}
                    inputClassName={styles.formTextFieldInput}
                    value={form.publisher?.label ?? ''}
                    readOnly
                    endContent={
                      form.publisher ? (
                        <ClearFieldButton
                          label="Очистить издательство"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              publisher: null,
                            }))
                          }
                        />
                      ) : null
                    }
                  />
                  <Button
                    label="Выбрать"
                    className={styles.sideButton}
                    onClick={() => openSelector('publisher')}
                  />
                </div>
              ) : null}

              {shouldShowField('PlaceOfPublication_F18_f', [
                'book-chapter',
                'book-monograph',
                'conference-materials',
              ]) ? (
                renderLookupField(
                  variant === 'dissertation' ? 'Место защиты' : 'Место публикации',
                  form.placeOfPublication?.label ?? '',
                  'place-publication',
                  'Очистить место публикации',
                  () =>
                    setForm((prev) => ({
                      ...prev,
                      placeOfPublication: null,
                    })),
                )
              ) : null}

              {shouldShowField('PlaceOfMeeting_F13_f', ['conference-materials'])
                ? renderLookupField(
                    'Место проведения',
                    form.placeOfMeeting?.label ?? '',
                    'place-meeting',
                    'Очистить место проведения',
                    () =>
                      setForm((prev) => ({
                        ...prev,
                        placeOfMeeting: null,
                      })),
                  )
                : null}

              {shouldShowField('MediumDesignator_F5_f') ? (
                renderLookupField(
                  'Обозначение материала',
                  form.mediumDesignator?.label ?? '',
                  'medium',
                  'Очистить обозначение материала',
                  () =>
                    setForm((prev) => ({
                      ...prev,
                      mediumDesignator: null,
                    })),
                )
              ) : null}

              {selectorMode === 'journal' ||
              selectorMode === 'publisher' ||
              selectorMode === 'source' ||
              selectorMode === 'place-publication' ||
              selectorMode === 'place-meeting' ||
              selectorMode === 'medium'
                ? renderSelectorPanel()
                : null}

              {shouldShowField('DOI', ['article']) ||
              shouldShowField('Pages_F25', ['article']) ||
              shouldShowField('PublicationDate', ['article']) ||
              shouldShowField('VolumeID_F22', ['article']) ||
              shouldShowField('IssueID_F24', ['article']) ? (
                <>
                  <div className={styles.rowThreeArticle}>
                    <TextField
                      label="DOI"
                      height={40}
                      radius={4}
                      rootClassName={styles.fullWidthField}
                      fieldClassName={styles.formTextField}
                      inputClassName={styles.formTextFieldInput}
                      value={form.doi}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          doi: event.target.value,
                        }))
                      }
                    />
                    <TextField
                      label="Страницы"
                      height={40}
                      radius={4}
                      rootClassName={styles.fullWidthField}
                      fieldClassName={styles.formTextField}
                      inputClassName={styles.formTextFieldInput}
                      value={form.pages}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          pages: event.target.value,
                        }))
                      }
                    />
                    {renderPublicationDateField()}
                  </div>
                  <div className={styles.rowTwoLeft}>
                    <TextField
                      label="Том"
                      height={40}
                      radius={4}
                      rootClassName={styles.fullWidthField}
                      fieldClassName={styles.formTextField}
                      inputClassName={styles.formTextFieldInput}
                      value={form.volume}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          volume: event.target.value,
                        }))
                      }
                    />
                    <TextField
                      label="Выпуск"
                      height={40}
                      radius={4}
                      rootClassName={styles.fullWidthField}
                      fieldClassName={styles.formTextField}
                      inputClassName={styles.formTextFieldInput}
                      value={form.issue}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          issue: event.target.value,
                        }))
                      }
                    />
                  </div>
                </>
              ) : null}

              {shouldShowField('DOI', ['book-chapter', 'conference-materials']) ||
              shouldShowField('URL_F38', ['book-chapter', 'conference-materials']) ||
              shouldShowField('Pages_F25', ['book-chapter', 'conference-materials']) ||
              shouldShowField('DateOfMeeting_F12', ['conference-materials']) ? (
                <>
                  <div className={styles.rowTwo}>
                    <TextField
                      label="DOI"
                      height={40}
                      radius={4}
                      rootClassName={styles.fullWidthField}
                      fieldClassName={styles.formTextField}
                      inputClassName={styles.formTextFieldInput}
                      value={form.doi}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          doi: event.target.value,
                        }))
                      }
                    />
                    <TextField
                      label="URL"
                      height={40}
                      radius={4}
                      rootClassName={styles.fullWidthField}
                      fieldClassName={styles.formTextField}
                      inputClassName={styles.formTextFieldInput}
                      value={form.url}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          url: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className={styles.rowTwoLeft}>
                    <TextField
                      label="Страницы"
                      height={40}
                      radius={4}
                      rootClassName={styles.fullWidthField}
                      fieldClassName={styles.formTextField}
                      inputClassName={styles.formTextFieldInput}
                      value={form.pages}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          pages: event.target.value,
                        }))
                      }
                    />
                    {shouldShowField('DateOfMeeting_F12', ['conference-materials'])
                      ? renderDateOfMeetingField()
                      : null}
                  </div>
                </>
              ) : null}

              {shouldShowField('ISBN_F41', ['book-chapter']) ||
              shouldShowField('ExtentOfWork_F26', ['book-chapter']) ||
              shouldShowField('Tirage', ['book-chapter']) ? (
                <div className={styles.rowThree}>
                  <TextField
                    label="ISBN"
                    height={40}
                    radius={4}
                    rootClassName={styles.fullWidthField}
                    fieldClassName={styles.formTextField}
                    inputClassName={styles.formTextFieldInput}
                    value={form.isbn}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        isbn: event.target.value,
                      }))
                    }
                  />
                  <TextField
                    label="Объем работы"
                    height={40}
                    radius={4}
                    rootClassName={styles.fullWidthField}
                    fieldClassName={styles.formTextField}
                    inputClassName={styles.formTextFieldInput}
                    value={form.extentOfWork}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        extentOfWork: event.target.value,
                      }))
                    }
                  />
                  <TextField
                    label="Тираж"
                    height={40}
                    radius={4}
                    rootClassName={styles.fullWidthField}
                    fieldClassName={styles.formTextField}
                    inputClassName={styles.formTextFieldInput}
                    value={form.tirage}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        tirage: event.target.value,
                      }))
                    }
                  />
                </div>
              ) : null}

              {shouldShowField('VolumeID_F22', ['conference-materials']) ||
              shouldShowField('Notes_F42', ['conference-materials']) ? (
                <div className={styles.rowThree}>
                  <TextField
                    label="Том"
                    height={40}
                    radius={4}
                    rootClassName={styles.fullWidthField}
                    fieldClassName={styles.formTextField}
                    inputClassName={styles.formTextFieldInput}
                    value={form.volume}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        volume: event.target.value,
                      }))
                    }
                  />
                  {shouldShowField('IssueID_F24') ? (
                    <TextField
                      label="Выпуск"
                      height={40}
                      radius={4}
                      rootClassName={styles.fullWidthField}
                      fieldClassName={styles.formTextField}
                      inputClassName={styles.formTextFieldInput}
                      value={form.issue}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          issue: event.target.value,
                        }))
                      }
                    />
                  ) : null}
                  <TextField
                    label="Примечания"
                    height={40}
                    radius={4}
                    rootClassName={styles.fullWidthField}
                    fieldClassName={styles.formTextField}
                    inputClassName={styles.formTextFieldInput}
                    value={form.notes}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        notes: event.target.value,
                      }))
                    }
                  />
                </div>
              ) : null}

              {formScenario === 'book-monograph' ? (
                <>
                  <div className={styles.rowTwo}>
                    <TextField
                      label="ISBN"
                      height={40}
                      radius={4}
                      rootClassName={styles.fullWidthField}
                      fieldClassName={styles.formTextField}
                      inputClassName={styles.formTextFieldInput}
                      value={form.isbn}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          isbn: event.target.value,
                        }))
                      }
                    />
                    <TextField
                      label="DOI"
                      height={40}
                      radius={4}
                      rootClassName={styles.fullWidthField}
                      fieldClassName={styles.formTextField}
                      inputClassName={styles.formTextFieldInput}
                      value={form.doi}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          doi: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className={styles.rowThree}>
                    <TextField
                      label="Тираж"
                      height={40}
                      radius={4}
                      rootClassName={styles.fullWidthField}
                      fieldClassName={styles.formTextField}
                      inputClassName={styles.formTextFieldInput}
                      value={form.tirage}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          tirage: event.target.value,
                        }))
                      }
                    />
                    <TextField
                      label="Объем работы"
                      height={40}
                      radius={4}
                      rootClassName={styles.fullWidthField}
                      fieldClassName={styles.formTextField}
                      inputClassName={styles.formTextFieldInput}
                      value={form.extentOfWork}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          extentOfWork: event.target.value,
                        }))
                      }
                    />
                  </div>
                </>
              ) : null}

              {shouldShowField('ExtentOfWork_F26') && form.workFormType !== 'B' ? (
                <div className={styles.rowTwoLeft}>
                  <TextField
                    label="Объем работы"
                    height={40}
                    radius={4}
                    rootClassName={styles.fullWidthField}
                    fieldClassName={styles.formTextField}
                    inputClassName={styles.formTextFieldInput}
                    value={form.extentOfWork}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        extentOfWork: event.target.value,
                      }))
                    }
                  />
                </div>
              ) : null}

              {isOtherScenario &&
              !['J', 'B', 'C', 'D'].includes(form.workFormType) &&
              (shouldShowField('VolumeID_F22') ||
                shouldShowField('IssueID_F24') ||
                shouldShowField('Pages_F25') ||
                shouldShowField('URL_F38')) ? (
                <>
                  <div className={styles.rowThree}>
                    {shouldShowField('IssueID_F24') || shouldShowField('VolumeID_F22') ? (
                      <TextField
                        label={shouldShowField('IssueID_F24') ? 'Выпуск' : 'Том'}
                        height={40}
                        radius={4}
                        rootClassName={styles.fullWidthField}
                        fieldClassName={styles.formTextField}
                        inputClassName={styles.formTextFieldInput}
                        value={shouldShowField('IssueID_F24') ? form.issue : form.volume}
                        onChange={(event) =>
                          setForm((prev) =>
                            shouldShowField('IssueID_F24')
                              ? {
                                  ...prev,
                                  issue: event.target.value,
                                }
                              : {
                                  ...prev,
                                  volume: event.target.value,
                                },
                          )
                        }
                      />
                    ) : null}
                    <TextField
                      label="Страницы"
                      height={40}
                      radius={4}
                      rootClassName={styles.fullWidthField}
                      fieldClassName={styles.formTextField}
                      inputClassName={styles.formTextFieldInput}
                      value={form.pages}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          pages: event.target.value,
                        }))
                      }
                    />
                  </div>

                  {shouldShowField('URL_F38') ? (
                    <TextField
                      label="URL"
                      height={40}
                      radius={4}
                      rootClassName={styles.fullWidthField}
                      fieldClassName={styles.formTextField}
                      inputClassName={styles.formTextFieldInput}
                      value={form.url}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          url: event.target.value,
                        }))
                      }
                    />
                  ) : null}
                </>
              ) : null}

              {shouldShowField('Notes_F42', ['book-chapter', 'book-monograph']) &&
              form.workFormType !== 'C' ? (
                <TextField
                  label="Примечания"
                  height={40}
                  radius={4}
                  rootClassName={styles.fullWidthField}
                  fieldClassName={styles.formTextField}
                  inputClassName={styles.formTextFieldInput}
                  value={form.notes}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      notes: event.target.value,
                    }))
                  }
                />
              ) : null}

              {shouldShowField('Abstract_F43', [
                'article',
                'book-chapter',
                'book-monograph',
                'conference-materials',
              ]) ? (
                <RichTextField
                  label="Аннотация"
                  placeholder="Аннотация"
                  value={form.abstract}
                  onChange={(nextValue) =>
                    setForm((prev) => ({
                      ...prev,
                      abstract: nextValue,
                    }))
                  }
                />
              ) : null}

              <div className={styles.keywordsField}>
                {form.keywordsInput.trim() ? (
                  <span className={styles.keywordsLabel}>Ключевые слова</span>
                ) : null}
                <KeywordSearchInput
                  value={form.keywordsInput}
                  placeholder="Ключевые слова"
                  onChange={(nextValue) =>
                    setForm((prev) => ({
                      ...prev,
                      keywordsInput: nextValue,
                    }))
                  }
                />
              </div>

              <div className={styles.lookupRow}>
                <TextField
                  label="Файл PDF"
                  height={40}
                  radius={4}
                  rootClassName={styles.fullWidthField}
                  fieldClassName={[styles.formTextField, styles.lookupTextField].join(' ')}
                  inputClassName={styles.formTextFieldInput}
                  value={form.pdfFileName}
                  readOnly
                  endContent={
                    form.pdfFileName ? (
                      <ClearFieldButton
                        label="Очистить файл PDF"
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            pdfFileName: '',
                            pdfFile: null,
                          }));
                          if (pdfInputRef.current) {
                            pdfInputRef.current.value = '';
                          }
                        }}
                      />
                    ) : null
                  }
                />
                <Button
                  label="Обзор"
                  className={styles.sideButton}
                  onClick={() => pdfInputRef.current?.click()}
                />
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf"
                  className={styles.hiddenInput}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setForm((prev) => ({
                      ...prev,
                      pdfFileName: file?.name ?? '',
                      pdfFile: file,
                    }));
                  }}
                />
              </div>

              {shouldShowField('OriginalVer_ID_f', ['article']) ||
              shouldShowField('PerVer_ID_f', ['article']) ? (
                <>
                  {!form.relatedArticle ? (
                    <div className={styles.lookupRow}>
                      <TextField
                        label="Связанная статья"
                        height={40}
                        radius={4}
                        rootClassName={styles.fullWidthField}
                        fieldClassName={[styles.formTextField, styles.lookupTextField].join(' ')}
                        inputClassName={styles.formTextFieldInput}
                        value=""
                        readOnly
                      />
                      <Button
                        label="Выбрать"
                        className={styles.sideButton}
                        onClick={() => openSelector('related')}
                      />
                    </div>
                  ) : null}

                  {form.relatedArticle ? (
                    <div className={styles.relatedArticleCard}>
                      <span className={styles.relatedArticleLabel}>
                        {getRelatedArticleLabel(detectedArticleLanguage)}
                      </span>
                      <div className={styles.relatedArticleContent}>
                        <div className={styles.relatedArticleMain}>
                          <div className={styles.relatedArticleTitle}>
                            {getSourceItemTitle(form.relatedArticle)}
                          </div>
                          {form.relatedArticle.authors ? (
                            <div className={styles.relatedArticleAuthors}>
                              {form.relatedArticle.authors}
                            </div>
                          ) : null}
                          {form.relatedArticle.doi ? (
                            <div className={styles.relatedArticleDoi}>
                              <span>DOI:</span> {form.relatedArticle.doi}
                            </div>
                          ) : null}
                        </div>
                        <div className={styles.relatedArticleMeta}>
                          {form.relatedArticle.journal ? (
                            <span>{form.relatedArticle.journal}</span>
                          ) : null}
                          {form.relatedArticle.year ? (
                            <span>{form.relatedArticle.year}</span>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className={styles.relatedArticleUnlink}
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              relatedArticle: null,
                              relatedArticleKind: '',
                            }))
                          }
                          aria-label="Отвязать связанную статью"
                        >
                          <Icon name="link_off" size={24} />
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {selectorMode === 'related' ? renderSelectorPanel() : null}
                </>
              ) : null}

              <div className={styles.actionsRow}>
                <OutlineButton
                  label="Отмена"
                  className={styles.cancelButton}
                  onClick={() => navigateTo(isEditMode && articleId ? `/articles/${articleId}` : '/articles')}
                />
                <Button
                  label={
                    isSubmitting
                      ? isEditMode
                        ? 'Сохранение...'
                        : 'Добавление...'
                      : isEditMode
                        ? 'Сохранить'
                        : 'Добавить'
                  }
                  iconName={isEditMode ? 'save' : 'add_notes'}
                  className={styles.submitButton}
                  disabled={isSubmitDisabled}
                  onClick={() => void handleSubmit()}
                />
              </div>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
