# InventarioFrontend

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 19.2.14.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Estructura
src/app
├── core
         ├── guards
                  ├── admin
                  ├── auth
                  ├── manager
                  ├── no-auth
                  ├── role
                  └── index
         ├── interceptors
                  ├── auth
                  ├── error
                  ├── loading
                  └── index
         ├── models
                           └── auth
                                    ├── login
                                    ├── index
                  ├── categorias
                  ├── notification
                  ├── producto
                  ├── usuario
                  └── index
         └── services
                  ├── auth
                  ├── categorias
                  ├── loading
                  ├── notification
                  └── index
├── features
         ├── autenticacion
                  └── components
                           ├── auth-form
                           └── auth-header
                  ├── pages
                           ├── forgot-password
                           └── login
                  └── autenticacion.routes.ts
         ├── categorias
                  ├── components
                  ├── pages
                           ├── actualizar-categorias
                           ├── crear-categorias
                           └── categorias
                  └── categorias.routes.ts
         ├── dashboard
                  ├── components
                  ├── pages
                  └── dashboard.routes.ts
         ├── productos
                  ├── components
                  ├── pages
                  └── productos.routes.ts
         └── usuarios
                  ├── components
                  ├── pages
                  └── usuarios.routes.ts
├── layouts
         ├── auth-layout
         └── main-layout
├── shared
         └── components
                  └── feedback/toast/toast.component
├── styles.scss
├── main.ts
├── index.html
├── app.component.html
├── app.component.scss
├── app.component.spect.ts
├── app.component.ts

