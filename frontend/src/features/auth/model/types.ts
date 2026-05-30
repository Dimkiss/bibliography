export type AuthUser = {
  id: number;
  login: string;
  full_name: string;
  role_id: number;
  role_name: string | null;
  department_id: number;
  department_name: string | null;
  author_id: number | null;
  author_name: string | null;
  position: string | null;
  degree: string | null;
  rank: string | null;
  email: string | null;
  type: string | null;
  birthdate: string | null;
  birth_year: number | null;
  nickname: string | null;
  status: number | null;
  search_pattern: string | null;
  external_id: number | null;
  snils_last4: string | null;
  orcid: string | null;
  scopus_id: string | null;
  wos_id: string | null;
};

export type LoginPayload = {
  username: string;
  password: string;
};

export type LoginResponse = {
  access_token: string;
  token_type: 'bearer';
  user: AuthUser;
};
