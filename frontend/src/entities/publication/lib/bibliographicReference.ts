export type PublicationWithBibliographicReference = {
  bibliographic_reference?: string | null;
};

export function getBibliographicReference(
  item: PublicationWithBibliographicReference,
): string {
  return item.bibliographic_reference?.trim() ?? '';
}
