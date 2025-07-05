module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        // Colores Primarios
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',  // Color principal
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49'
        },

        // Colores Secundarios (Verde - para estados positivos)
        secondary: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',  // Verde principal
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16'
        },

        // Grises (Neutros)
        neutral: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',  // Gris principal
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
          950: '#0a0a0a'
        },

        // Estados de Stock
        stock: {
          // Stock Normal
          normal: {
            50: '#f0fdf4',
            100: '#dcfce7',
            500: '#22c55e',
            600: '#16a34a',
            700: '#15803d'
          },
          // Stock Bajo
          warning: {
            50: '#fffbeb',
            100: '#fef3c7',
            500: '#f59e0b',
            600: '#d97706',
            700: '#b45309'
          },
          // Stock Crítico
          critical: {
            50: '#fef2f2',
            100: '#fee2e2',
            500: '#ef4444',
            600: '#dc2626',
            700: '#b91c1c'
          }
        },

        // Estados de la Aplicación
        status: {
          // Éxito
          success: {
            50: '#f0fdf4',
            100: '#dcfce7',
            500: '#10b981',
            600: '#059669',
            700: '#047857'
          },
          // Error
          error: {
            50: '#fef2f2',
            100: '#fee2e2',
            500: '#ef4444',
            600: '#dc2626',
            700: '#b91c1c'
          },
          // Advertencia
          warning: {
            50: '#fffbeb',
            100: '#fef3c7',
            500: '#f59e0b',
            600: '#d97706',
            700: '#b45309'
          },
          // Información
          info: {
            50: '#eff6ff',
            100: '#dbeafe',
            500: '#3b82f6',
            600: '#2563eb',
            700: '#1d4ed8'
          }
        },

        // Colores de Movimientos
        movement: {
          // Entradas (Verde)
          entrada: {
            50: '#f0fdf4',
            100: '#dcfce7',
            500: '#22c55e',
            600: '#16a34a',
            700: '#15803d'
          },
          // Salidas (Rojo)
          salida: {
            50: '#fef2f2',
            100: '#fee2e2',
            500: '#ef4444',
            600: '#dc2626',
            700: '#b91c1c'
          }
        },

        // Colores de Roles
        role: {
          admin: {
            50: '#fdf4ff',
            100: '#fae8ff',
            500: '#a855f7',
            600: '#9333ea',
            700: '#7c3aed'
          },
          gerente: {
            50: '#fff7ed',
            100: '#ffedd5',
            500: '#f97316',
            600: '#ea580c',
            700: '#c2410c'
          },
          empleado: {
            50: '#f8fafc',
            100: '#f1f5f9',
            500: '#64748b',
            600: '#475569',
            700: '#334155'
          }
        },

        // Backgrounds y Superficies
        surface: {
          50: '#ffffff',
          100: '#f8fafc',
          200: '#f1f5f9',
          300: '#e2e8f0',
          400: '#cbd5e1',
          500: '#94a3b8'
        }
      },

      // Configuración de Fuentes
      fontFamily: {
        sans: ['Roboto', 'ui-sans-serif', 'system-ui'],
        roboto: ['Roboto', 'sans-serif'],
        serif: ['Georgia', 'serif'],
      },

      // Pesos de fuente Roboto
      fontWeight: {
        'light': '300',
        'normal': '400',
        'medium': '500',
        'semibold': '600',
        'bold': '700'
      }
    }
  }
}
