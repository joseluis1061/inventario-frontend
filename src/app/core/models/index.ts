
// ===== EXPORTACIONES DE MODELOS =====

// Modelos de autenticación (existentes)
export * from './auth';

// Modelos de categorías (nuevos)
export * from './categoria';

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
} from './categoria';
