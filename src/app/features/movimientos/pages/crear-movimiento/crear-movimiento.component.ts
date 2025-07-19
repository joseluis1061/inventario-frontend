import { Component, inject, signal, OnInit, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil, catchError, of, debounceTime, distinctUntilChanged } from 'rxjs';

import { MovimientosService } from '../../../../core/services/movimientos.service';
import { ProductosService } from '../../../../core/services/productos.service';
import { UsuariosService } from '../../../../core/services/usuarios.service';
import { AuthService } from '../../../../core/services/auth-service.service';
import { MovimientoCreateRequest, TipoMovimiento } from '../../../../core/models/movimiento.interface';
import { ProductoResponse } from '../../../../core/models/producto.interface';
import { UsuarioResponse } from '../../../../core/models/usuario.interface';

@Component({
  selector: 'app-crear-movimiento',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './crear-movimiento.component.html',
  styleUrl: './crear-movimiento.component.scss'
})
export class CrearMovimientoComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly movimientosService = inject(MovimientosService);
  private readonly productosService = inject(ProductosService);
  private readonly usuariosService = inject(UsuariosService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy$ = new Subject<void>();

  // Signals para estado del componente
  isLoading = signal(false);
  formSubmitted = signal(false);
  productos = signal<ProductoResponse[]>([]);
  usuarios = signal<UsuarioResponse[]>([]);
  loadingProductos = signal(true);
  loadingUsuarios = signal(true);
  selectedProducto = signal<ProductoResponse | null>(null);
  selectedUsuario = signal<UsuarioResponse | null>(null);

  // FormGroup
  movimientoForm!: FormGroup;

  // Estados reactivos del servicio
  loadingStates = this.movimientosService.loadingStates;

  // Computed values
  currentUser = computed(() => this.authService.getCurrentUser());
  isManager = computed(() => this.authService.isManagerOrAbove());
  canSelectUser = computed(() => this.authService.isManagerOrAbove());

  // Valor calculado del movimiento
  valorMovimiento = computed(() => {
    const cantidad = Number(this.movimientoForm?.get('cantidad')?.value) || 0;
    const producto = this.selectedProducto();
    console.log('Valor movimiento calculado:', cantidad, producto?.precio);
    return producto ? cantidad * producto.precio : 0;
  });

  // Stock disponible del producto seleccionado
  stockDisponible = computed(() => {
    const producto = this.selectedProducto();
    return producto ? producto.stockActual : 0;
  });

  // Validación de stock para salidas
  stockSuficiente = computed(() => {
    const tipoMovimiento = this.movimientoForm?.get('tipoMovimiento')?.value;
    const cantidad = this.movimientoForm?.get('cantidad')?.value || 0;
    const stockActual = this.stockDisponible();

    if (tipoMovimiento === 'SALIDA') {
      return cantidad <= stockActual;
    }
    return true;
  });

  // Tipos de movimiento disponibles
  tiposMovimiento: { value: TipoMovimiento; label: string; icon: string; color: string }[] = [
    {
      value: 'ENTRADA',
      label: 'Entrada de Mercancía',
      icon: 'M12 4l-8 8h16l-8-8z M12 4v16',
      color: 'text-green-600'
    },
    {
      value: 'SALIDA',
      label: 'Salida de Mercancía',
      icon: 'M12 20l8-8H4l8 8z M12 20V4',
      color: 'text-red-600'
    }
  ];

  // Motivos predefinidos según el tipo
  motivosEntrada = [
    'Compra de inventario inicial',
    'Reposición de stock',
    'Devolución de cliente',
    'Ajuste de inventario positivo',
    'Transferencia entre almacenes',
    'Donación recibida',
    'Otro motivo'
  ];

  motivosSalida = [
    'Venta a cliente',
    'Devolución a proveedor',
    'Producto dañado/vencido',
    'Ajuste de inventario negativo',
    'Transferencia entre almacenes',
    'Muestra gratuita',
    'Otro motivo'
  ];

  ngOnInit(): void {
    this.initializeForm();
    this.cargarDatos();
    this.setupFormSubscriptions();
    this.processQueryParams();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Inicializar formulario con validaciones
   */
  private initializeForm(): void {
    const currentUser = this.currentUser();

    this.movimientoForm = this.fb.group({
      productoId: ['', [Validators.required]],
      usuarioId: [currentUser?.id || '', [Validators.required]],
      tipoMovimiento: ['', [Validators.required]],
      cantidad: ['', [
        Validators.required,
        Validators.min(1),
        Validators.max(999999),
        Validators.pattern(/^\d+$/)
      ]],
      motivo: ['', [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(255)
      ]]
    });
  }

  /**
   * Configurar suscripciones del formulario
   */
  private setupFormSubscriptions(): void {
    // Suscripción a cambios en el producto seleccionado
    this.movimientoForm.get('productoId')?.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        distinctUntilChanged()
      )
      .subscribe(productoId => {
        const producto = this.productos().find(p => p.id === +productoId);
        this.selectedProducto.set(producto || null);

        // Resetear cantidad cuando cambia el producto
        this.movimientoForm.get('cantidad')?.setValue('');
      });

    // Suscripción a cambios en el usuario seleccionado
    this.movimientoForm.get('usuarioId')?.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        distinctUntilChanged()
      )
      .subscribe(usuarioId => {
        const usuario = this.usuarios().find(u => u.id === +usuarioId);
        this.selectedUsuario.set(usuario || null);
      });

    // Suscripción a cambios en el tipo de movimiento
    this.movimientoForm.get('tipoMovimiento')?.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        distinctUntilChanged()
      )
      .subscribe(() => {
        // Limpiar motivo cuando cambia el tipo
        this.movimientoForm.get('motivo')?.setValue('');

        // Revalidar cantidad para salidas
        this.movimientoForm.get('cantidad')?.updateValueAndValidity();
      });

    // Suscripción a cambios en la cantidad
    this.movimientoForm.get('cantidad')?.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(() => {
        // Trigger computed values update
      });

    this.movimientoForm.get('cantidad')?.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(100)
      )
      .subscribe(() => {
        // Forzar actualización del computed
      });
  }

  /**
   * Procesar parámetros de consulta para pre-llenar el formulario
   */
  private processQueryParams(): void {
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        if (params['producto']) {
          this.movimientoForm.get('productoId')?.setValue(+params['producto']);
        }
        if (params['tipo']) {
          this.movimientoForm.get('tipoMovimiento')?.setValue(params['tipo']);
        }
      });
  }

  /**
   * Cargar datos necesarios
   */
  private cargarDatos(): void {
    this.cargarProductos();
    this.cargarUsuarios();
  }

  /**
   * Cargar productos disponibles
   */
  private cargarProductos(): void {
    this.loadingProductos.set(true);

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
        this.loadingProductos.set(false);
      });
  }

  /**
   * Cargar usuarios disponibles
   */
  private cargarUsuarios(): void {
    this.loadingUsuarios.set(true);

    this.usuariosService.obtenerActivos()
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error al cargar usuarios:', error);
          return of([]);
        })
      )
      .subscribe(usuarios => {
        this.usuarios.set(usuarios);
        this.loadingUsuarios.set(false);
      });
  }

  /**
   * Obtener motivos según el tipo de movimiento
   */
  getMotivosDisponibles(): string[] {
    const tipoMovimiento = this.movimientoForm.get('tipoMovimiento')?.value;
    return tipoMovimiento === 'ENTRADA' ? this.motivosEntrada : this.motivosSalida;
  }

  /**
   * Verificar errores de campo específico
   */
  hasFieldError(fieldName: string): boolean {
    const field = this.movimientoForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched || this.formSubmitted()));
  }

  /**
   * Obtener mensaje de error para un campo
   */
  getFieldError(fieldName: string): string {
    const field = this.movimientoForm.get(fieldName);

    if (!field || !field.errors) return '';

    const errors = field.errors;

    switch (fieldName) {
      case 'productoId':
        if (errors['required']) return 'Debes seleccionar un producto';
        break;

      case 'usuarioId':
        if (errors['required']) return 'Debes seleccionar un usuario';
        break;

      case 'tipoMovimiento':
        if (errors['required']) return 'Debes seleccionar el tipo de movimiento';
        break;

      case 'cantidad':
        if (errors['required']) return 'La cantidad es obligatoria';
        if (errors['min']) return 'La cantidad debe ser mayor a 0';
        if (errors['max']) return 'La cantidad es demasiado alta';
        if (errors['pattern']) return 'La cantidad debe ser un número entero';
        break;

      case 'motivo':
        if (errors['required']) return 'El motivo es obligatorio';
        if (errors['minlength']) return 'El motivo debe tener al menos 3 caracteres';
        if (errors['maxlength']) return 'El motivo no puede exceder 255 caracteres';
        break;
    }

    return '';
  }

  /**
   * Seleccionar motivo predefinido
   */
  seleccionarMotivo(motivo: string): void {
    this.movimientoForm.get('motivo')?.setValue(motivo);
  }

  /**
   * Enviar formulario
   */
  onSubmit(): void {
    this.formSubmitted.set(true);

    if (this.movimientoForm.invalid) {
      this.markAllFieldsAsTouched();
      return;
    }

    // Validar stock para salidas
    if (!this.stockSuficiente()) {
      this.movimientoForm.get('cantidad')?.setErrors({ 'stockInsuficiente': true });
      return;
    }

    this.isLoading.set(true);

    const tipoMovimiento = this.movimientoForm.get('tipoMovimiento')?.value as TipoMovimiento;
    const baseData = {
      productoId: Number(this.movimientoForm.get('productoId')?.value),
      usuarioId: Number(this.movimientoForm.get('usuarioId')?.value),
      cantidad: Number(this.movimientoForm.get('cantidad')?.value),
      motivo: this.movimientoForm.get('motivo')?.value?.trim()
    };

    // Crear el objeto específico según el tipo
    let request$;
    if (tipoMovimiento === 'ENTRADA') {
      const entradaData = {
        ...baseData,
        tipoMovimiento: 'ENTRADA' as const
      };
      request$ = this.movimientosService.crearEntrada(entradaData);
    } else {
      const salidaData = {
        ...baseData,
        tipoMovimiento: 'SALIDA' as const
      };
      request$ = this.movimientosService.crearSalida(salidaData);
    }

    request$
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error al crear movimiento:', error);
          this.isLoading.set(false);
          return of(null);
        })
      )
      .subscribe(movimiento => {
        this.isLoading.set(false);

        if (movimiento) {
          // Navegar de vuelta a la lista de movimientos
          this.router.navigate(['/movimientos']);
        }
      });
  }

  /**
   * Cancelar y volver a lista
   */
  onCancel(): void {
    this.router.navigate(['/movimientos']);
  }

  /**
   * Resetear formulario
   */
  onReset(): void {
    this.movimientoForm.reset();
    this.formSubmitted.set(false);
    this.selectedProducto.set(null);
    this.selectedUsuario.set(null);

    // Restablecer usuario actual si no es manager
    const currentUser = this.currentUser();
    if (currentUser && !this.canSelectUser()) {
      this.movimientoForm.get('usuarioId')?.setValue(currentUser.id);
    }
  }

  /**
   * Marcar todos los campos como touched
   */
  private markAllFieldsAsTouched(): void {
    Object.keys(this.movimientoForm.controls).forEach(key => {
      this.movimientoForm.get(key)?.markAsTouched();
    });
  }

  /**
   * Verificar si el formulario está listo para enviar
   */
  get isFormReady(): boolean {
    return this.movimientoForm.valid &&
           !this.isLoading() &&
           !this.loadingProductos() &&
           !this.loadingUsuarios() &&
           this.stockSuficiente();
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
   * Obtener información del producto por ID
   */
  getProductoPorId(id: number): ProductoResponse | undefined {
    return this.productos().find(p => p.id === id);
  }

  /**
   * Obtener información del usuario por ID
   */
  getUsuarioPorId(id: number): UsuarioResponse | undefined {
    return this.usuarios().find(u => u.id === id);
  }

  /**
   * Obtener clase CSS para el estado de stock
   */
  getStockClass(): string {
    const stock = this.stockDisponible();
    const producto = this.selectedProducto();

    if (!producto) return 'text-neutral-600';

    if (stock <= 0) return 'text-red-600';
    if (stock <= producto.stockMinimo) return 'text-yellow-600';
    return 'text-green-600';
  }

  /**
   * Obtener mensaje de estado de stock
   */
  getStockMessage(): string {
    const stock = this.stockDisponible();
    const producto = this.selectedProducto();

    if (!producto) return '';

    if (stock <= 0) return 'Sin stock disponible';
    if (stock <= producto.stockMinimo) return 'Stock bajo';
    return 'Stock disponible';
  }

  /**
   * Obtener mensaje de validación de cantidad para salidas
   */
  getCantidadValidationMessage(): string {
    if (this.movimientoForm.get('tipoMovimiento')?.value === 'SALIDA' && !this.stockSuficiente()) {
      return `Stock insuficiente. Disponible: ${this.stockDisponible()}`;
    }
    return '';
  }
}
