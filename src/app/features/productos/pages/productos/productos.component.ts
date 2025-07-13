import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil, catchError, of } from 'rxjs';

import { ProductosService } from '../../../../core/services/productos.service';
import { ProductoResponse } from '../../../../core/models/producto.interface';

@Component({
  selector: 'app-productos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './productos.component.html',
  styleUrl: './productos.component.scss'
})
export class ProductosComponent implements OnInit, OnDestroy {
  private readonly productosService = inject(ProductosService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  // Signals para estado del componente
  productos = signal<ProductoResponse[]>([]);
  searchTerm = signal<string>('');
  showDeleteConfirm = signal<number | null>(null);
  selectedCategory = signal<number | null>(null);
  sortField = signal<string>('nombre');
  sortDirection = signal<'asc' | 'desc'>('asc');

  // Estados reactivos del servicio
  loadingStates = this.productosService.loadingStates;

  ngOnInit(): void {
    this.cargarProductos();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Cargar todos los productos
   */
  cargarProductos(): void {
    this.productosService.obtenerTodos()
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error al cargar productos:', error);
          return of([]);
        })
      )
      .subscribe(productos => {
        this.productos.set(productos);
      });
  }

  /**
   * Filtrar y ordenar productos
   */
  get productosFiltrados(): ProductoResponse[] {
    let productos = this.productos();

    // Filtrar por término de búsqueda
    const search = this.searchTerm().toLowerCase();
    if (search) {
      productos = productos.filter(producto =>
        producto.nombre.toLowerCase().includes(search) ||
        producto.descripcion.toLowerCase().includes(search) ||
        producto.nombreCategoria.toLowerCase().includes(search) ||
        producto.categoriaPrecio.toLowerCase().includes(search)
      );
    }

    // Filtrar por categoría
    if (this.selectedCategory()) {
      productos = productos.filter(producto =>
        producto.categoria.id === this.selectedCategory()
      );
    }

    // Ordenar
    const field = this.sortField();
    const direction = this.sortDirection();

    productos.sort((a, b) => {
      let valueA: any;
      let valueB: any;

      switch (field) {
        case 'nombre':
          valueA = a.nombre.toLowerCase();
          valueB = b.nombre.toLowerCase();
          break;
        case 'precio':
          valueA = a.precio;
          valueB = b.precio;
          break;
        case 'stockActual':
          valueA = a.stockActual;
          valueB = b.stockActual;
          break;
        case 'categoria':
          valueA = a.nombreCategoria.toLowerCase();
          valueB = b.nombreCategoria.toLowerCase();
          break;
        case 'fechaCreacion':
          valueA = new Date(a.fechaCreacion);
          valueB = new Date(b.fechaCreacion);
          break;
        default:
          return 0;
      }

      if (valueA < valueB) return direction === 'asc' ? -1 : 1;
      if (valueA > valueB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return productos;
  }

  /**
   * Obtener categorías únicas para el filtro
   */
  get categoriasUnicas(): Array<{id: number, nombre: string}> {
    const productos = this.productos();
    const categoriasMap = new Map();

    productos.forEach(producto => {
      if (!categoriasMap.has(producto.categoria.id)) {
        categoriasMap.set(producto.categoria.id, {
          id: producto.categoria.id,
          nombre: producto.categoria.nombre
        });
      }
    });

    return Array.from(categoriasMap.values()).sort((a, b) =>
      a.nombre.localeCompare(b.nombre)
    );
  }

  /**
   * Manejar búsqueda
   */
  onSearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchTerm.set(target.value);
  }

  /**
   * Cambiar filtro de categoría
   */
  onCategoryFilter(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const value = target.value;
    this.selectedCategory.set(value ? Number(value) : null);
  }

  /**
   * Cambiar ordenamiento
   */
  onSort(field: string): void {
    if (this.sortField() === field) {
      // Cambiar dirección si es el mismo campo
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      // Nuevo campo, ordenar ascendente
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }
  }

  /**
   * Limpiar filtros
   */
  limpiarFiltros(): void {
    this.searchTerm.set('');
    this.selectedCategory.set(null);
  }

  /**
  * Limpiar búsqueda
  */
  limpiarBusqueda(): void {
    this.searchTerm.set('');
  }

  /**
   * Refrescar lista de productos
   */
  refrescar(): void {
    this.productosService.refrescar()
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error al refrescar productos:', error);
          return of([]);
        })
      )
      .subscribe(productos => {
        this.productos.set(productos);
      });
  }

  /**
   * Navegar a crear nuevo producto
   */
  crearProducto(): void {
    this.router.navigate(['/productos/crear']);
  }

  /**
   * Editar producto
   */
  editarProducto(producto: ProductoResponse): void {
    this.router.navigate(['/productos/actualizar', producto.id]);
  }

  /**
   * Mostrar confirmación de eliminación
   */
  confirmarEliminar(productoId: number): void {
    this.showDeleteConfirm.set(productoId);
  }

  /**
   * Cancelar eliminación
   */
  cancelarEliminar(): void {
    this.showDeleteConfirm.set(null);
  }

  /**
   * Eliminar producto
   */
  eliminarProducto(productoId: number): void {
    this.productosService.eliminar(productoId)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error al eliminar producto:', error);
          return of(null);
        })
      )
      .subscribe(() => {
        // Actualizar lista local removiendo el producto eliminado
        const productosActuales = this.productos();
        this.productos.set(productosActuales.filter(prod => prod.id !== productoId));
        this.showDeleteConfirm.set(null);
      });
  }

  /**
   * Obtener producto a eliminar por ID
   */
  getProductoToDelete(): ProductoResponse | undefined {
    const id = this.showDeleteConfirm();
    return id ? this.productos().find(p => p.id === id) : undefined;
  }

  /**
   * TrackBy function para optimizar renderizado
   */
  trackByProducto(index: number, producto: ProductoResponse): number {
    return producto.id;
  }

  /**
   * Obtener clase CSS para el estado de stock
   */
  getEstadoStockClass(estado: string): string {
    switch (estado) {
      case 'CRÍTICO': return 'bg-red-100 text-red-800';
      case 'BAJO': return 'bg-yellow-100 text-yellow-800';
      case 'NORMAL': return 'bg-green-100 text-green-800';
      case 'ALTO': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  /**
   * Obtener clase CSS para categoría de precio
   */
  getCategoriaPrecioClass(categoria: string): string {
    switch (categoria) {
      case 'Básico': return 'bg-gray-100 text-gray-800';
      case 'Estándar': return 'bg-blue-100 text-blue-800';
      case 'Premium': return 'bg-purple-100 text-purple-800';
      case 'Lujo': return 'bg-amber-100 text-amber-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  // Getters para estadísticas
  get totalProductos(): number {
    return this.productos().length;
  }

  get productosConStock(): number {
    return this.productos().filter(p => p.estadoStock === 'NORMAL' || p.estadoStock === 'ALTO').length;
  }

  get productosStockBajo(): number {
    return this.productos().filter(p => p.estadoStock === 'BAJO').length;
  }

  get productosStockCritico(): number {
    return this.productos().filter(p => p.estadoStock === 'CRÍTICO').length;
  }

  /**
   * Formatear precio en pesos colombianos
   */
  formatearPrecio(precio: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(precio);
  }

  /**
   * Formatear fecha de creación
   */
  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Manejar error de carga de imagen
   */
  onImageError(event: Event, producto: ProductoResponse): void {
    const img = event.target as HTMLImageElement;
    if (img.src !== producto.imagenPlaceholder) {
      img.src = producto.imagenPlaceholder;
    }
  }

  /**
   * Obtener icono de ordenamiento
   */
  getSortIcon(field: string): string {
    if (this.sortField() !== field) return '↕️';
    return this.sortDirection() === 'asc' ? '↑' : '↓';
  }
}
