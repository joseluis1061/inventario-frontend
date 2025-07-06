export interface LoginRequest {
  username: string;
  password: string;
  rememberMe?: boolean;
  deviceInfo?: string;
}

export interface UserInfo {
  id: number;
  username: string;
  nombreCompleto: string;
  email: string;
  role: string;
  activo: boolean;
  fechaCreacion: string;
}

export interface ClientConfig {
  refreshThreshold: number;
  autoRefresh: boolean;
  allowedOperations: string[];
  maxConcurrentSessions: number;
  additionalConfig?: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt: string;
  refreshExpiresAt: string;
  user: UserInfo;
  authorities: string[];
  sessionId: string;
  isExtendedSession: boolean;
  clientConfig: ClientConfig;
  timestamp: string;
  tiempoRestanteMinutos: number;
}
