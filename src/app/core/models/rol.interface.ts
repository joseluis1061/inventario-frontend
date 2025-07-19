// ===== INTERFACES PARA ROLES =====

/**
 * Respuesta completa de rol del backend
 */
export interface RolResponse {
  id: number;
  nombre: string;
  descripcion: string;
  fechaCreacion: string;
  esRolSistema: boolean;
  estadoTexto: string;
}

/**
 * Request para crear un nuevo rol
 */
export interface RolCreateRequest {
  nombre: string;
  descripcion: string;
}

/**
 * Request para actualizar un rol existente
 */
export interface RolUpdateRequest {
  nombre: string;
  descripcion: string;
}

/**
 * Información básica de rol (para selects y listas simples)
 */
export interface RolBasico {
  id: number;
  nombre: string;
  descripcion?: string;
  esRolSistema: boolean;
}

/**
 * Filtros para búsqueda de roles
 */
export interface RolFiltros {
  nombre?: string;
  esRolSistema?: boolean;
  estadoTexto?: string;
}

/**
 * Parámetros para paginación de roles
 */
export interface RolPaginacionParams {
  page?: number;
  size?: number;
  sort?: string;
  direction?: 'asc' | 'desc';
  filtros?: RolFiltros;
}

/**
 * Respuesta paginada de roles
 */
export interface RolPaginatedResponse {
  content: RolResponse[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  numberOfElements: number;
}

/**
 * Estadísticas de roles
 */
export interface RolEstadisticas {
  totalRoles: number;
  rolesSistema: number;
  rolesPersonalizados: number;
  porcentajeRolesSistema: number;
  usuariosPorRol: { [rolNombre: string]: number };
}

/**
 * Estados de loading para diferentes operaciones
 */
export interface RolLoadingStates {
  listing: boolean;
  creating: boolean;
  updating: boolean;
  deleting: boolean;
  searching: boolean;
  loadingById: boolean;
  loadingUsuariosPorRol: boolean;
}

/**
 * Opciones de configuración del servicio
 */
export interface RolServiceConfig {
  cacheEnabled?: boolean;
  retryAttempts?: number;
  timeout?: number;
}

/**
 * Información de usuario asignado a un rol
 */
export interface RolUsuarioInfo {
  id: number;
  username: string;
  nombreCompleto: string;
  email: string;
  activo: boolean;
}

/**
 * Respuesta de roles con información de usuarios
 */
export interface RolConUsuarios extends RolResponse {
  usuarios: RolUsuarioInfo[];
  cantidadUsuarios: number;
}
