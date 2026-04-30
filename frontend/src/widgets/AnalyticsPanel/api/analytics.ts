import { API_BASE_URL } from '@/shared/config/api';

export type DashboardYearsPoint = {
  year: number;
  count: number;
};

export type DashboardTypePoint = {
  category: string;
  count: number;
};

export type DashboardLwlPoint = {
  label: string;
  level: number;
  count: number;
};

export type DashboardResponse = {
  years: {
    from: number;
    to: number;
    series: DashboardYearsPoint[];
  };
  types: {
    year: number;
    total: number;
    series: DashboardTypePoint[];
  };
  lwl: {
    year: number;
    series: DashboardLwlPoint[];
  };
};

export type DashboardParams = {
  yearsFrom: number;
  yearsTo: number;
  typesYear: number;
  lwlYear: number;
};

export async function getAnalyticsDashboard(
  params: DashboardParams,
): Promise<DashboardResponse> {
  const searchParams = new URLSearchParams({
    years_from: String(params.yearsFrom),
    years_to: String(params.yearsTo),
    types_year: String(params.typesYear),
    lwl_year: String(params.lwlYear),
  });

  const response = await fetch(
    `${API_BASE_URL}/analytics/dashboard?${searchParams.toString()}`,
    {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch analytics dashboard: ${response.status}`);
  }

  return response.json();
}