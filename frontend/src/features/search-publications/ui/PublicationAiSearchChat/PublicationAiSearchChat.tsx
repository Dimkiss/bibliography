import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';

import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { OutlineButton } from '@/shared/ui/OutlineButton';
import type {
  AiPublicationRagSearchDto,
  AiPublicationSearchPlanDto,
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
  onSubmit: (message: string) => Promise<AiPublicationRagSearchDto | null>;
  onReset: () => void;
};

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 1,
    role: 'assistant',
    text: 'Напишите запрос по публикациям. Я заполню параметры поиска и обновлю выдачу.',
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

function formatPlanItems(plan: AiPublicationSearchPlanDto): string[] {
  const items: string[] = [];
  const { filters } = plan;

  if (filters.text_query?.trim()) {
    items.push(`Метаданные: ${filters.text_query.trim()}`);
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
    items.push(`RAG: ${filters.article_ids.length} публикаций по PDF-фрагментам`);
  }

  return items;
}

function formatRetrievalItems(
  retrieval?: AiPublicationRagSearchDto['retrieval'],
): string[] {
  if (!retrieval || retrieval.status !== 'ok') {
    return [];
  }

  return retrieval.matches.slice(0, 3).map((match) => {
    const page =
      match.page_number > 0 ? `стр. ${match.page_number}` : 'страница не указана';
    return `#${match.article_id}, ${page}: ${match.text}`;
  });
}

export function PublicationAiSearchChat({
  isPlanning,
  resetRevision,
  onSubmit,
  onReset,
}: PublicationAiSearchChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const nextMessageId = useRef(2);

  useEffect(() => {
    setDraft('');
    setMessages(INITIAL_MESSAGES);
    nextMessageId.current = 2;
  }, [resetRevision]);

  const addMessage = (message: Omit<ChatMessage, 'id'>) => {
    setMessages((prev) => [
      ...prev,
      {
        ...message,
        id: nextMessageId.current,
      },
    ]);
    nextMessageId.current += 1;
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
        text: ragSearch?.plan.explanation ?? 'Параметры применены к выдаче.',
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
                {formatRetrievalItems(message.retrieval).length ? (
                  <ul className={styles.matchList}>
                    {formatRetrievalItems(message.retrieval).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
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
