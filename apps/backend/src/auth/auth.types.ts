export type AuthAccessTier = "super-admin" | "admin";

export type AuthManagedUserRole =
  | "super-admin"
  | "admin"
  | "finance-manager"
  | "customer-support";

export type AuthSessionUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  accessTier: AuthAccessTier;
};

export type AuthTokenPayload = AuthSessionUser & {
  exp: number;
  rememberSession: boolean;
};

export type AuthLoginResponse = {
  accessToken: string;
  tokenType: "Bearer";
  expiresAt: string;
  rememberSession: boolean;
  user: AuthSessionUser;
};

export type AuthBrowserSession = Omit<AuthLoginResponse, "accessToken" | "tokenType">;

export type AuthManagedUser = {
  id: string;
  name: string;
  email: string;
  roleId: AuthManagedUserRole;
  updatedAt: string;
};
