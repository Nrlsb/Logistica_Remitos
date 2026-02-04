# Documentación Técnica del Proyecto

## 🏗 Arquitectura del Sistema

La aplicación sigue una arquitectura clásica **Cliente-Servidor**:

- **Cliente (Frontend)**: Construido con React y Vite, se encarga de la presentación y la interacción con el usuario. Se comunica con el servidor a través de peticiones HTTP (REST API).
- **Servidor (Backend)**: Desarrollado con Express y Node.js, maneja la lógica de negocio, procesa archivos y gestiona la comunicación con la base de datos Supabase.

## 🔧 Configuración y Requisitos

### Requisitos Previos
- **Node.js**: Versión 16 o superior recomendada.
- **NPM**: Gestor de paquetes incluido con Node.js.

### Variables de Entorno
Es crucial configurar las variables de entorno para que el sistema funcione correctamente.

**Server (.env)**
El archivo `.env` en la carpeta `server/` debe contener las credenciales de conexión a Supabase, puertos y claves secretas necesarias.

```env
PORT=3000
SUPABASE_URL=tu_supabase_url
SUPABASE_KEY=tu_supabase_key
# ... otras variables necesarias
```

**Client (.env)**
El archivo `.env` en `client/` puede contener la URL base de la API si no está hardcodeada.

```env
VITE_API_URL=http://localhost:3000/api
```

## 📂 Estructura del Proyecto

### `client/`
Contiene todo el código fuente del frontend.
- `src/components`: Componentes reutilizables de React (ej. `RemitoForm.jsx`, `Layout`).
- `src/pages`: Componentes que representan páginas completas.
- `src/context`: Contextos de React para manejo de estado global (ej. Autenticación).
- `src/assets`: Imágenes, fuentes y archivos estáticos.

### `server/`
Contiene la lógica del backend.
- `index.js`: Punto de entrada principal de la aplicación Express.
- `controllers/`: Lógica de cada endpoint de la API. (Estructura asumida común).
- `routes/`: Definición de las rutas de la API.
- `models/`: Modelos de datos o interacciones directas con la base de datos.

## ✨ Funcionalidades Clave

1.  **Autenticación**: Sistema de login y gestión de usuarios mediante Supabase.
2.  **Gestión de Remitos**: Creación, visualización y administración de remitos de entrada y salida.
3.  **Procesamiento de PDF**: Capacidad para leer y generar documentos PDF (remitos, etiquetas).
4.  **Escaneo de Códigos**: Integración con `html5-qrcode` para escanear códigos de barras o QR desde el navegador, facilitando la carga de productos.
5.  **Migración de Imágenes**: Scripts utilitarios para gestión masiva de imágenes de productos.

## 🤝 Contribución

Si deseas contribuir al proyecto:
1.  Haz un Fork del repositorio.
2.  Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`).
3.  Haz commit de tus cambios.
4.  Push a la rama y abre un Pull Request.
