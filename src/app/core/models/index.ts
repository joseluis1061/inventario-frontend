
// ===== EXPORTACIONES DE MODELOS =====

// Modelos de autenticación (existentes)
export * from './auth';
export * from './categoria.interface';
export * from './producto.interface';
export * from './notification.interface';

// Modelos de categorías (nuevos)
export * from './categoria.interface';

// Re-exportar interfaces de categorías para compatibilidad
export type {
  CategoriaResponse,
  CategoriaCreateRequest,
  CategoriaUpdateRequest,
  CategoriaBasica,
  CategoriaFiltros,
  CategoriaPaginacionParams,
  CategoriaPaginatedResponse,
  CategoriaEstadisticas,
  CategoriaLoadingStates
} from './categoria.interface';


