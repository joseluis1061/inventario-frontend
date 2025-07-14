// ===== INTERFACES PARA USUARIOS =====

/**
 * Información básica de rol dentro del usuario
 */
export interface UsuarioRolInfo {
  id: number;
  nombre: string;
  descripcion: string;
}

/**
 * Respuesta completa de usuario del backend
 */
export interface UsuarioResponse {
  id: number;
  username: string;
  nombreCompleto: string;
  email: string;
  activo: boolean;
  fechaCreacion: string;
  rol: UsuarioRolInfo;
  eliminable: boolean;
  esAdminPrincipal: boolean;
  estadoTexto: string;
  iniciales: string;
  nombreRol: string;
}

/**
 * Request para crear un nuevo usuario
 */
export interface UsuarioCreateRequest {
  username: string;
  nombreCompleto: string;
  email: string;
  activo: boolean;
  rolId: number;
}

/**
 * Request para actualizar un usuario existente
 */
export interface UsuarioUpdateRequest {
  username: string;
  nombreCompleto: string;
  email: string;
  activo: boolean;
  rolId: number;
}

/**
 * Request para cambiar contraseña
 */
export interface UsuarioCambiarPasswordRequest {
  passwordActual: string;
  passwordNuevo: string;
}

/**
 * Request para cambiar estado del usuario
 */
export interface UsuarioCambiarEstadoRequest {
  activo: boolean;
}

/**
 * Información básica de usuario (para selects y listas simples)
 */
export interface UsuarioBasico {
  id: number;
  username: string;
  nombreCompleto: string;
  email: string;
  activo: boolean;
  nombreRol: string;
  iniciales: string;
}

/**
 * Filtros para búsqueda de usuarios
 */
export interface UsuarioFiltros {
  username?: string;
  nombreCompleto?: string;
  email?: string;
  rolId?: number;
  activo?: boolean;
  esAdminPrincipal?: boolean;
}

/**
 * Parámetros para paginación de usuarios
 */
export interface UsuarioPaginacionParams {
  page?: number;
  size?: number;
  sort?: string;
  direction?: 'asc' | 'desc';
  filtros?: UsuarioFiltros;
}

/**
 * Respuesta paginada de usuarios
 */
export interface UsuarioPaginatedResponse {
  content: UsuarioResponse[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  numberOfElements: number;
}

/**
 * Estadísticas de usuarios
 */
export interface UsuarioEstadisticas {
  totalUsuarios: number;
  usuariosActivos: number;
  usuariosInactivos: number;
  porcentajeActivos: number;
  usuariosPorRol: { [rolNombre: string]: number };
}

/**
 * Estados de loading para diferentes operaciones
 */
export interface UsuarioLoadingStates {
  listing: boolean;
  creating: boolean;
  updating: boolean;
  deleting: boolean;
  searching: boolean;
  loadingById: boolean;
  loadingActivos: boolean;
  loadingByRol: boolean;
  changingPassword: boolean;
  changingEstado: boolean;
}

/**
 * Opciones de configuración del servicio
 */
export interface UsuarioServiceConfig {
  cacheEnabled?: boolean;
  retryAttempts?: number;
  timeout?: number;
}

/**
 * Información para creación de usuario con contraseña
 */
export interface UsuarioCreateWithPasswordRequest extends UsuarioCreateRequest {
  password: string;
}

/**
 * Validación de usuario
 */
export interface UsuarioValidation {
  usernameMinLength: number;
  usernameMaxLength: number;
  passwordMinLength: number;
  passwordMaxLength: number;
  emailRequired: boolean;
  nombreCompletoRequired: boolean;
}

/**
 * Configuración de permisos de usuario
 */
export interface UsuarioPermisos {
  puedeCrearUsuarios: boolean;
  puedeEditarUsuarios: boolean;
  puedeEliminarUsuarios: boolean;
  puedeVerTodosUsuarios: boolean;
  puedeCambiarPasswords: boolean;
  puedeActivarDesactivar: boolean;
}

/**
 * Historial de cambios de usuario
 */
export interface UsuarioHistorialCambio {
  id: number;
  usuarioId: number;
  accion: 'CREACION' | 'ACTUALIZACION' | 'CAMBIO_PASSWORD' | 'CAMBIO_ESTADO' | 'ELIMINACION';
  camposModificados?: string[];
  fechaCambio: string;
  usuarioQueModifica: string;
  detalles?: string;
}
