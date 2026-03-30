export function normalizeJournalName(journal: string): string {
  return journal.replace(/^\/\//, '').trim();
}