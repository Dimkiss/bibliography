import { API_BASE_URL } from '@/shared/config/api';

export type PublicationDto = {
  Record_ID: number;
  title: string;
  authors: string;
  journal: string;
  year: number;
  DOI: string;
};

export async function getLatestPublications(): Promise<PublicationDto[]> {
  const response = await fetch(`${API_BASE_URL}/articles/latest`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch latest publications: ${response.status}`);
  }

  return response.json();
}