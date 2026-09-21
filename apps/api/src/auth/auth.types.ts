import type { UserRole, UserStatus } from "@railcards/database";

export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  status: UserStatus;
}

export interface AccessTokenPayload {
  sub: string;
  username: string;
  role: UserRole;
}
