import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';

import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { OutlineButton } from '@/shared/ui/OutlineButton';
import type {
  AiPublicationRagSearchDto,
  AiPublicationSearchPlanDto,
  PublicationListItemDto,
} from '@/entities/publication';
import styles from './PublicationAiSearchChat.module.css';

type ChatMessage = {
  id: number;
  role: 'user' | 'assistant' | 'error';
  text: string;
  plan?: AiPublicationSearchPlanDto;
  retrieval?: AiPublicationRagSearchDto['retrieval'];
};

type PublicationAiSearchChatProps = {
  isPlanning: boolean;
  resetRevision: number;
  items: PublicationListItemDto[];
  onSubmit: (message: string) => Promise<AiPublicationRagSearchDto | null>;
  onReset: () => void;
};

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 1,
    role: 'assistant',
    text: 'Напишите запрос — я найду публикации по содержимому PDF-файлов. Поиск работает только по статьям с текстовым слоем (около 4000 из 5700).',
  },
];

const DATABASE_LABELS: Record<string, string> = {
  wos: 'Web of Science',
  scopus: 'Scopus',
  white_list: 'Белый список',
  rinc: 'РИНЦ',
  vak: 'ВАК',
};

const ORIGINAL_TRANSLATION_LABELS: Record<string, string> = {
  original_only: 'только оригиналы',
  translation_only: 'только переводы',
};

const CHAT_STORAGE_KEY = 'publications:ai-search-chat';
const MAX_STORED_MESSAGES = 16;
const MAX_STORED_MATCHES = 100;
const MAX_STORED_MATCH_TEXT_LENGTH = 520;
const MAX_STORED_TEXT_LENGTH = 1200;

type FormattedRagMatch = {
  key: string;
  page: string;
  text: string;
};

type FormattedRagPublicationGroup = {
  articleId: number;
  resultNumber: number | null;
  title: string | null;
  matches: FormattedRagMatch[];
};

function formatRuCount(
  count: number,
  forms: [string, string, string],
): string {
  const lastTwoDigits = count % 100;
  const lastDigit = count % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return `${count} ${forms[2]}`;
  }

  if (lastDigit === 1) {
    return `${count} ${forms[0]}`;
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return `${count} ${forms[1]}`;
  }

  return `${count} ${forms[2]}`;
}

function trimStoredText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength).trim()}...`;
}

function compactRetrieval(
  retrieval?: AiPublicationRagSearchDto['retrieval'],
): AiPublicationRagSearchDto['retrieval'] | undefined {
  if (!retrieval) {
    return undefined;
  }

  return {
    ...retrieval,
    article_ids: retrieval.article_ids.slice(0, 100),
    matches: retrieval.matches.slice(0, MAX_STORED_MATCHES).map((match) => ({
      ...match,
      text: trimStoredText(match.text, MAX_STORED_MATCH_TEXT_LENGTH),
    })),
    error: retrieval.error
      ? trimStoredText(retrieval.error, MAX_STORED_TEXT_LENGTH)
      : retrieval.error,
  };
}

function compactPlan(
  plan?: AiPublicationSearchPlanDto,
): AiPublicationSearchPlanDto | undefined {
  if (!plan) {
    return undefined;
  }

  return {
    ...plan,
    explanation: trimStoredText(plan.explanation, MAX_STORED_TEXT_LENGTH),
    filters: {
      ...plan.filters,
      text_query: plan.filters.text_query
        ? trimStoredText(plan.filters.text_query, MAX_STORED_TEXT_LENGTH)
        : plan.filters.text_query,
      refine_text_query: plan.filters.refine_text_query
        ? trimStoredText(plan.filters.refine_text_query, MAX_STORED_TEXT_LENGTH)
        : plan.filters.refine_text_query,
      pdf_text_query: plan.filters.pdf_text_query
        ? trimStoredText(plan.filters.pdf_text_query, MAX_STORED_TEXT_LENGTH)
        : plan.filters.pdf_text_query,
      title: plan.filters.title
        ? trimStoredText(plan.filters.title, MAX_STORED_TEXT_LENGTH)
        : plan.filters.title,
      author: plan.filters.author
        ? trimStoredText(plan.filters.author, MAX_STORED_TEXT_LENGTH)
        : plan.filters.author,
      journal: plan.filters.journal
        ? trimStoredText(plan.filters.journal, MAX_STORED_TEXT_LENGTH)
        : plan.filters.journal,
      keyword: plan.filters.keyword.slice(0, 20),
      publication_types: plan.filters.publication_types.slice(0, 20),
      databases: plan.filters.databases.slice(0, 20),
      article_ids: plan.filters.article_ids.slice(0, 100),
    },
    semantic: {
      ...plan.semantic,
      query: plan.semantic.query
        ? trimStoredText(plan.semantic.query, MAX_STORED_TEXT_LENGTH)
        : plan.semantic.query,
    },
  };
}

function compactMessage(message: ChatMessage): ChatMessage {
  return {
    ...message,
    text: trimStoredText(message.text, MAX_STORED_TEXT_LENGTH),
    plan: compactPlan(message.plan),
    retrieval: compactRetrieval(message.retrieval),
  };
}

function compactMessages(messages: ChatMessage[]): ChatMessage[] {
  const [initialMessage] = INITIAL_MESSAGES;
  const regularMessages = messages
    .filter((message) => message.id !== initialMessage.id)
    .slice(-MAX_STORED_MESSAGES)
    .map(compactMessage);

  return [initialMessage, ...regularMessages];
}

function limitMessages(messages: ChatMessage[]): ChatMessage[] {
  const [initialMessage] = INITIAL_MESSAGES;
  const regularMessages = messages
    .filter((message) => message.id !== initialMessage.id)
    .slice(-MAX_STORED_MESSAGES);

  return [initialMessage, ...regularMessages];
}

function isChatRole(value: unknown): value is ChatMessage['role'] {
  return value === 'user' || value === 'assistant' || value === 'error';
}

function normalizeStoredMessage(value: unknown, index: number): ChatMessage | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const rawMessage = value as Partial<ChatMessage>;
  if (!isChatRole(rawMessage.role) || typeof rawMessage.text !== 'string') {
    return null;
  }

  return compactMessage({
    id: Number.isInteger(rawMessage.id) ? Number(rawMessage.id) : index + 1,
    role: rawMessage.role,
    text: rawMessage.text,
    plan: rawMessage.plan,
    retrieval: rawMessage.retrieval,
  });
}

function loadStoredMessages(): ChatMessage[] {
  try {
    const storedValue = window.sessionStorage.getItem(CHAT_STORAGE_KEY);
    if (!storedValue) {
      return INITIAL_MESSAGES;
    }

    const parsed = JSON.parse(storedValue);
    if (!Array.isArray(parsed)) {
      return INITIAL_MESSAGES;
    }

    const messages = parsed
      .map(normalizeStoredMessage)
      .filter((message): message is ChatMessage => Boolean(message));

    return messages.length ? compactMessages(messages) : INITIAL_MESSAGES;
  } catch {
    window.sessionStorage.removeItem(CHAT_STORAGE_KEY);
    return INITIAL_MESSAGES;
  }
}

function saveStoredMessages(messages: ChatMessage[]) {
  try {
    window.sessionStorage.setItem(
      CHAT_STORAGE_KEY,
      JSON.stringify(compactMessages(messages)),
    );
  } catch {
    // Ignore storage quota errors: chat history is useful, but not critical.
  }
}

function clearStoredMessages() {
  window.sessionStorage.removeItem(CHAT_STORAGE_KEY);
}

function getNextMessageId(messages: ChatMessage[]): number {
  return Math.max(1, ...messages.map((message) => message.id)) + 1;
}

function formatPlanItems(plan: AiPublicationSearchPlanDto): string[] {
  const items: string[] = [];
  const { filters } = plan;
  const hasRagResults = filters.article_ids.length > 0;

  if (filters.text_query?.trim()) {
    items.push(
      hasRagResults
        ? `Запрос: ${filters.text_query.trim()}`
        : `Метаданные: ${filters.text_query.trim()}`,
    );
  }

  if (filters.refine_text_query?.trim()) {
    items.push(`Уточнение: ${filters.refine_text_query.trim()}`);
  }

  if (filters.pdf_text_query?.trim()) {
    items.push(`PDF: ${filters.pdf_text_query.trim()}`);
  }

  if (filters.title?.trim()) {
    items.push(`Название: ${filters.title.trim()}`);
  }

  if (filters.author?.trim()) {
    items.push(`Автор: ${filters.author.trim()}`);
  }

  if (filters.journal?.trim()) {
    items.push(`Издание: ${filters.journal.trim()}`);
  }

  if (filters.keyword.length) {
    items.push(`Ключевые слова: ${filters.keyword.join(', ')}`);
  }

  if (filters.year_from !== null && filters.year_to !== null) {
    items.push(
      filters.year_from === filters.year_to
        ? `Год: ${filters.year_from}`
        : `Период: ${filters.year_from}-${filters.year_to}`,
    );
  } else if (filters.year_from !== null) {
    items.push(`С ${filters.year_from} года`);
  } else if (filters.year_to !== null) {
    items.push(`До ${filters.year_to} года`);
  }

  if (filters.databases.length) {
    items.push(
      `Базы: ${filters.databases
        .map((database) => DATABASE_LABELS[database] ?? database)
        .join(', ')}`,
    );
  }

  const originalTranslationLabel =
    ORIGINAL_TRANSLATION_LABELS[filters.original_translation_mode];
  if (originalTranslationLabel) {
    items.push(`Версии: ${originalTranslationLabel}`);
  }

  if (filters.article_ids.length) {
    items.push(`PDF-фрагменты: ${filters.article_ids.length} найденных публикаций`);
  }

  return items;
}

function formatRetrievalGroups(
  retrieval?: AiPublicationRagSearchDto['retrieval'],
  itemPositionMap?: Map<number, number>,
  itemTitleMap?: Map<number, string | null>,
): FormattedRagPublicationGroup[] {
  if (!retrieval || retrieval.status !== 'ok') {
    return [];
  }

  const groupsByArticleId = new Map<number, FormattedRagPublicationGroup>();
  const ragOrderByArticleId = new Map<number, number>(
    retrieval.article_ids.map((articleId, index): [number, number] => [
      articleId,
      index + 1,
    ]),
  );

  retrieval.matches.forEach((match) => {
    const text = match.text.trim();
    if (!text) {
      return;
    }

    const articleId = match.article_id;
    const resultNumber =
      itemPositionMap?.get(articleId) ??
      ragOrderByArticleId.get(articleId) ??
      null;
    const title = itemTitleMap?.get(articleId) ?? null;
    const group =
      groupsByArticleId.get(articleId) ??
      {
        articleId,
        resultNumber,
        title,
        matches: [],
      };
    const page =
      match.page_number > 0 ? `стр. ${match.page_number}` : 'страница не указана';

    group.matches.push({
      key: `${match.article_id}-${match.page_number}-${match.chunk_index}`,
      page,
      text,
    });
    groupsByArticleId.set(articleId, group);
  });

  const articleOrder = retrieval.article_ids.length
    ? retrieval.article_ids
    : Array.from(groupsByArticleId.keys());

  return articleOrder
    .map((articleId) => groupsByArticleId.get(articleId))
    .filter((group): group is FormattedRagPublicationGroup => Boolean(group));
}

function buildAssistantText(ragSearch: AiPublicationRagSearchDto | null): string {
  if (!ragSearch) {
    return 'Параметры применены к выдаче.';
  }

  const { plan, retrieval } = ragSearch;

  if (plan.intent === 'clarify') {
    return plan.explanation;
  }

  if (retrieval.status === 'ok') {
    const count = retrieval.article_ids.length;

    if (count > 0) {
      return `Выдача обновлена. По тексту PDF найдено ${formatRuCount(count, ['публикация', 'публикации', 'публикаций'])}.`;
    }

    return 'По тексту PDF совпадений не найдено. Параметры поиска применены к выдаче.';
  }

  if (retrieval.status === 'disabled') {
    return 'Параметры применены к выдаче. RAG-поиск по PDF отключён.';
  }

  if (retrieval.status === 'error') {
    return retrieval.error
      ? `Параметры применены, но поиск по PDF не выполнен: ${retrieval.error}`
      : 'Параметры применены, но поиск по PDF не выполнен.';
  }

  return 'Параметры применены к выдаче.';
}

function RagMatchSnippet({ match }: { match: FormattedRagMatch }) {
  return (
    <li>
      <span className={styles.matchMeta}>{match.page}</span>
      <span className={styles.matchText}>{match.text}</span>
    </li>
  );
}

function RagPublicationMatchGroup({
  group,
  foundInMetadata,
}: {
  group: FormattedRagPublicationGroup;
  foundInMetadata: boolean;
}) {
  const [firstMatch, ...additionalMatches] = group.matches;
  const positionLabel = group.resultNumber
    ? `№${group.resultNumber} в выдаче`
    : `Публикация #${group.articleId}`;

  const sourceLabel = foundInMetadata ? 'метаданные + текст PDF' : 'текст PDF';

  if (!firstMatch) {
    return null;
  }

  return (
    <li className={styles.matchGroup}>
      <div className={styles.matchGroupTitle}>
        {positionLabel}
        <span className={styles.matchSource}>{sourceLabel}</span>
      </div>
      {group.title ? (
        <div className={styles.matchGroupArticleTitle}>{group.title}</div>
      ) : null}
      <ul className={styles.matchSnippets}>
        <RagMatchSnippet match={firstMatch} />
      </ul>

      {additionalMatches.length ? (
        <details className={styles.moreArticleMatches}>
          <summary>
            Ещё {formatRuCount(additionalMatches.length, [
              'фрагмент',
              'фрагмента',
              'фрагментов',
            ])}{' '}
            по этой публикации
          </summary>
          <ul className={styles.matchSnippets}>
            {additionalMatches.map((match) => (
              <RagMatchSnippet key={match.key} match={match} />
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  );
}

function RagMatchList({
  retrieval,
  metadataArticleIds,
  itemPositionMap,
  itemTitleMap,
}: {
  retrieval?: AiPublicationRagSearchDto['retrieval'];
  metadataArticleIds: Set<number>;
  itemPositionMap: Map<number, number>;
  itemTitleMap: Map<number, string | null>;
}) {
  const groups = formatRetrievalGroups(retrieval, itemPositionMap, itemTitleMap);

  if (!groups.length) {
    return null;
  }

  const visibleGroups = groups.slice(0, 3);
  const hiddenGroups = groups.slice(3);

  return (
    <div className={styles.matchesBlock}>
      <div className={styles.matchListTitle}>Найдено в тексте PDF</div>
      <ul className={styles.matchList}>
        {visibleGroups.map((group) => (
          <RagPublicationMatchGroup
            key={group.articleId}
            group={group}
            foundInMetadata={metadataArticleIds.has(group.articleId)}
          />
        ))}
      </ul>

      {hiddenGroups.length ? (
        <details className={styles.moreMatches}>
          <summary>
            Показать ещё{' '}
            {formatRuCount(hiddenGroups.length, [
              'публикацию',
              'публикации',
              'публикаций',
            ])}
          </summary>
          <ul className={styles.matchList}>
            {hiddenGroups.map((group) => (
              <RagPublicationMatchGroup
                key={group.articleId}
                group={group}
                foundInMetadata={metadataArticleIds.has(group.articleId)}
              />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

export function PublicationAiSearchChat({
  isPlanning,
  resetRevision,
  items,
  onSubmit,
  onReset,
}: PublicationAiSearchChatProps) {
  const itemPositionMap = new Map<number, number>(
    items.map((item, index) => [item.id, index + 1]),
  );
  const itemTitleMap = new Map<number, string | null>(
    items.map((item) => [item.id, item.title ?? null]),
  );
  const metadataArticleIds = new Set(
    items.filter((item) => item.found_in_metadata).map((item) => item.id),
  );
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(loadStoredMessages);
  const nextMessageId = useRef<number | null>(null);
  const lastResetRevision = useRef(resetRevision);

  if (nextMessageId.current === null) {
    nextMessageId.current = getNextMessageId(messages);
  }

  useEffect(() => {
    saveStoredMessages(messages);
  }, [messages]);

  useEffect(() => {
    if (lastResetRevision.current === resetRevision) {
      return;
    }

    lastResetRevision.current = resetRevision;
    setDraft('');
    setMessages(INITIAL_MESSAGES);
    nextMessageId.current = 2;
    clearStoredMessages();
  }, [resetRevision]);

  const addMessage = (message: Omit<ChatMessage, 'id'>) => {
    const messageId = nextMessageId.current ?? 2;
    nextMessageId.current = messageId + 1;

    setMessages((prev) =>
      limitMessages([
        ...prev,
        {
          ...message,
          id: messageId,
        },
      ]),
    );
  };

  const handleSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();

    const message = draft.trim();
    if (!message || isPlanning) {
      return;
    }

    setDraft('');
    addMessage({ role: 'user', text: message });

    try {
      const ragSearch = await onSubmit(message);
      addMessage({
        role: 'assistant',
        text: buildAssistantText(ragSearch),
        plan: ragSearch?.plan,
        retrieval: ragSearch?.retrieval,
      });
    } catch (caughtError) {
      addMessage({
        role: 'error',
        text:
          caughtError instanceof Error
            ? caughtError.message
            : 'Не удалось выполнить ИИ-поиск.',
      });
    }
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    event.preventDefault();
    void handleSubmit();
  };

  const handleReset = () => {
    setDraft('');
    setMessages(INITIAL_MESSAGES);
    nextMessageId.current = 2;
    clearStoredMessages();
    onReset();
  };

  return (
    <div className={styles.root}>
      {isOpen ? (
        <section className={styles.panel} aria-label="ИИ-поиск публикаций">
          <div className={styles.header}>
            <div className={styles.titleWrap}>
              <span className={styles.titleIcon} aria-hidden="true">
                <Icon name="search" size={20} />
              </span>
              <h2 className={styles.title}>ИИ-поиск</h2>
            </div>

            <button
              type="button"
              className={styles.iconButton}
              aria-label="Закрыть чат"
              onClick={() => setIsOpen(false)}
            >
              <Icon name="close" size={20} />
            </button>
          </div>

          <div className={styles.messages}>
            {messages.map((message) => (
              <div
                key={message.id}
                className={[
                  styles.message,
                  message.role === 'user' ? styles.userMessage : '',
                  message.role === 'assistant' ? styles.assistantMessage : '',
                  message.role === 'error' ? styles.errorMessage : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div>{message.text}</div>
                {message.plan ? (
                  <ul className={styles.planList}>
                    {formatPlanItems(message.plan).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
                <RagMatchList
                  retrieval={message.retrieval}
                  metadataArticleIds={metadataArticleIds}
                  itemPositionMap={itemPositionMap}
                  itemTitleMap={itemTitleMap}
                />
              </div>
            ))}

            {isPlanning ? (
              <div className={`${styles.message} ${styles.assistantMessage}`}>
                Формирую параметры поиска...
              </div>
            ) : null}
          </div>

          <form className={styles.composer} onSubmit={handleSubmit}>
            <textarea
              className={styles.input}
              value={draft}
              rows={3}
              placeholder="Статьи о Байкале в Scopus за последние 10 лет"
              disabled={isPlanning}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleInputKeyDown}
            />

            <div className={styles.actions}>
              <OutlineButton
                label="Сброс"
                size="small"
                width={104}
                onClick={handleReset}
              />
              <Button
                type="submit"
                label={isPlanning ? 'Ищу...' : 'Найти'}
                iconName="search"
                size="small"
                width={104}
                disabled={isPlanning || !draft.trim()}
              />
            </div>
          </form>
        </section>
      ) : null}

      <button
        type="button"
        className={styles.trigger}
        aria-label="Открыть ИИ-поиск"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <Icon name={isOpen ? 'close' : 'search'} size={24} />
      </button>
    </div>
  );
}
