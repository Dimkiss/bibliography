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