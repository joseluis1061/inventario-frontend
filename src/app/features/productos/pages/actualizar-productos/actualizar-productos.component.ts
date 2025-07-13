import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil, catchError, of, switchMap } from 'rxjs';

import { ProductosService } from '../../../../core/services/productos.service';
import { CategoriasService } from '../../../../core/services/categorias.service';
import { ProductoUpdateRequest, ProductoResponse } from '../../../../core/models/producto.interface';
import { CategoriaResponse } from '../../../../core/models/categoria.interface';

@Component({
  selector: 'app-actualizar-productos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './actualizar-productos.component.html'
})
export class ActualizarProductosComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly productosService = inject(ProductosService);
  private readonly categoriasService = inject(CategoriasService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy$ = new Subject<void>();

  // Signals para estado del componente
  isLoading = signal(false);
  isLoadingProducto = signal(true);
  formSubmitted = signal(false);
  categorias = signal<CategoriaResponse[]>([]);
  loadingCategorias = signal(true);
  productoOriginal = signal<ProductoResponse | null>(null);
  productoId = signal<number | null>(null);

  // FormGroup
  productoForm!: FormGroup;

  // Estados reactivos del servicio
  loadingStates = this.productosService.loadingStates;

  ngOnInit(): void {
    this.initializeForm();
    this.cargarCategorias();
    this.loadProducto();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Cargar producto desde la ruta
   */
  private loadProducto(): void {
    this.route.paramMap
      .pipe(
        takeUntil(this.destroy$),
        switchMap(params => {
          const id = Number(params.get('id'));
          if (!id || isNaN(id)) {
            this.router.navigate(['/productos']);
            return of(null);
          }

          this.productoId.set(id);
          this.isLoadingProducto.set(true);

          return this.productosService.obtenerPorId(id);
        }),
        catchError(error => {
          console.error('Error al cargar producto:', error);
          this.router.navigate(['/productos']);
          return of(null);
        })
      )
      .subscribe(producto => {
        this.isLoadingProducto.set(false);

        if (producto) {
          this.productoOriginal.set(producto);
          this.populateForm(producto);
        } else {
          this.router.navigate(['/productos']);
        }
      });
  }

  /**
   * Llenar formulario con datos del producto
   */
  private populateForm(producto: ProductoResponse): void {
    this.productoForm.patchValue({
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      precio: producto.precio,
      stockMinimo: producto.stockMinimo,
      categoriaId: producto.categoria.id,
      imagenPlaceholder: producto.imagenPlaceholder || ''
    });
  }

  /**
   * Cargar categorías disponibles
   */
  private cargarCategorias(): void {
    this.loadingCategorias.set(true);

    this.categoriasService.obtenerTodas()
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error al cargar categorías:', error);
          return of([]);
        })
      )
      .subscribe(categorias => {
        this.categorias.set(categorias);
        this.loadingCategorias.set(false);
      });
  }

  /**
   * Inicializar formulario con validaciones
   */
  private initializeForm(): void {
    this.productoForm = this.fb.group({
      nombre: ['', [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(100)
      ]],
      descripcion: ['', [
        Validators.required,
        Validators.minLength(10),
        Validators.maxLength(500)
      ]],
      precio: ['', [
        Validators.required,
        Validators.min(0.01),
        Validators.max(999999999.99)
      ]],
      stockMinimo: ['', [
        Validators.required,
        Validators.min(0),
        Validators.max(999999)
      ]],
      categoriaId: ['', [
        Validators.required
      ]],
      imagenPlaceholder: ['']
    });
  }

  /**
   * Verificar errores de campo específico
   */
  hasFieldError(fieldName: string): boolean {
    const field = this.productoForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched || this.formSubmitted()));
  }

  /**
   * Obtener mensaje de error para un campo
   */
  getFieldError(fieldName: string): string {
    const field = this.productoForm.get(fieldName);

    if (!field || !field.errors) return '';

    const errors = field.errors;

    switch (fieldName) {
      case 'nombre':
        if (errors['required']) return 'El nombre es obligatorio';
        if (errors['minlength']) return 'El nombre debe tener al menos 2 caracteres';
        if (errors['maxlength']) return 'El nombre no puede exceder 100 caracteres';
        break;

      case 'descripcion':
        if (errors['required']) return 'La descripción es obligatoria';
        if (errors['minlength']) return 'La descripción debe tener al menos 10 caracteres';
        if (errors['maxlength']) return 'La descripción no puede exceder 500 caracteres';
        break;

      case 'precio':
        if (errors['required']) return 'El precio es obligatorio';
        if (errors['min']) return 'El precio debe ser mayor a 0';
        if (errors['max']) return 'El precio es demasiado alto';
        break;

      case 'stockMinimo':
        if (errors['required']) return 'El stock mínimo es obligatorio';
        if (errors['min']) return 'El stock mínimo no puede ser negativo';
        if (errors['max']) return 'El stock mínimo es demasiado alto';
        break;

      case 'categoriaId':
        if (errors['required']) return 'Debes seleccionar una categoría';
        break;
    }

    return '';
  }

  /**
   * Verificar si hay cambios en el formulario
   */
  hasFormChanges(): boolean {
    const productoOriginal = this.productoOriginal();
    if (!productoOriginal) return false;

    const formValues = this.productoForm.value;
    return (
      formValues.nombre?.trim() !== productoOriginal.nombre ||
      formValues.descripcion?.trim() !== productoOriginal.descripcion ||
      Number(formValues.precio) !== productoOriginal.precio ||
      Number(formValues.stockMinimo) !== productoOriginal.stockMinimo ||
      Number(formValues.categoriaId) !== productoOriginal.categoria.id ||
      (formValues.imagenPlaceholder?.trim() || '') !== (productoOriginal.imagenPlaceholder || '')
    );
  }

  /**
   * Enviar formulario
   */
  onSubmit(): void {
    this.formSubmitted.set(true);

    if (this.productoForm.invalid) {
      this.markAllFieldsAsTouched();
      return;
    }

    if (!this.hasFormChanges()) {
      // No hay cambios, regresar a la lista
      this.router.navigate(['/productos']);
      return;
    }

    const productoId = this.productoId();
    if (!productoId) return;

    this.isLoading.set(true);

    const productoData: ProductoUpdateRequest = {
      nombre: this.productoForm.get('nombre')?.value?.trim(),
      descripcion: this.productoForm.get('descripcion')?.value?.trim(),
      precio: Number(this.productoForm.get('precio')?.value),
      stockMinimo: Number(this.productoForm.get('stockMinimo')?.value),
      categoriaId: Number(this.productoForm.get('categoriaId')?.value),
      imagenPlaceholder: this.productoForm.get('imagenPlaceholder')?.value?.trim() || undefined
    };

    this.productosService.actualizar(productoId, productoData)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error al actualizar producto:', error);
          this.isLoading.set(false);
          return of(null);
        })
      )
      .subscribe(producto => {
        this.isLoading.set(false);

        if (producto) {
          // Navegar de vuelta a la lista de productos
          this.router.navigate(['/productos']);
        }
      });
  }

  /**
   * Cancelar y volver a lista
   */
  onCancel(): void {
    this.router.navigate(['/productos']);
  }

  /**
   * Resetear formulario a valores originales
   */
  onReset(): void {
    const productoOriginal = this.productoOriginal();
    if (productoOriginal) {
      this.populateForm(productoOriginal);
      this.formSubmitted.set(false);
    }
  }

  /**
   * Marcar todos los campos como touched
   */
  private markAllFieldsAsTouched(): void {
    Object.keys(this.productoForm.controls).forEach(key => {
      this.productoForm.get(key)?.markAsTouched();
    });
  }

  /**
   * Verificar si el formulario está listo para enviar
   */
  get isFormReady(): boolean {
    return this.productoForm.valid &&
           !this.isLoading() &&
           !this.loadingCategorias() &&
           !this.isLoadingProducto() &&
           this.hasFormChanges();
  }

  /**
   * Verificar si mostrar el botón de guardar
   */
  get showSubmitButton(): boolean {
    const nombreControl = this.productoForm.get('nombre');
    return !!(nombreControl?.value && nombreControl.value.trim().length >= 2);
  }

  /**
   * Formatear precio para vista previa
   */
  formatearPrecio(precio: number): string {
    if (!precio || isNaN(precio)) return 'Sin precio';

    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(precio);
  }

  /**
   * Obtener categoría seleccionada
   */
  getCategoriaSeleccionada(): CategoriaResponse | null {
    const categoriaId = this.productoForm.get('categoriaId')?.value;
    if (!categoriaId) return null;

    return this.categorias().find(cat => cat.id === Number(categoriaId)) || null;
  }

  /**
   * Generar imagen placeholder automática
   */
  generarImagenPlaceholder(): void {
    const categoria = this.getCategoriaSeleccionada();
    if (!categoria) return;

    const nombre = this.productoForm.get('nombre')?.value || 'Producto';
    const color = categoria.colorSugerido.replace('#', '');
    const texto = encodeURIComponent(nombre.substring(0, 20));

    const placeholderUrl = `https://via.placeholder.com/300x300/${color}/FFFFFF?text=${texto}`;
    this.productoForm.patchValue({ imagenPlaceholder: placeholderUrl });
  }

  /**
   * Obtener título de la página
   */
  get pageTitle(): string {
    const producto = this.productoOriginal();
    return producto ? `Editar: ${producto.nombre}` : 'Editando Producto';
  }

  /**
   * Verificar si el producto original existe
   */
  get hasProductoOriginal(): boolean {
    return !!this.productoOriginal();
  }
}
