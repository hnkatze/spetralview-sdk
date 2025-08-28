# 🎬 SpectraView SDK

**Session Recording & Replay SDK** - Captura y reproduce sesiones de usuario visualmente, similar a Hotjar/FullStory.

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/cit-lab/spectraview)
[![Size](https://img.shields.io/badge/size-163KB_minified-green.svg)](https://github.com/cit-lab/spectraview)
[![License](https://img.shields.io/badge/license-MIT-purple.svg)](LICENSE)

## 📋 Tabla de Contenidos

- [Características](#-características)
- [Instalación](#-instalación)
- [Uso Rápido](#-uso-rápido)
- [API](#-api)
- [Desarrollo](#-desarrollo)
- [Compilación](#-compilación)
- [Despliegue](#-despliegue)
- [Demo](#-demo)
- [Estructura del Proyecto](#-estructura-del-proyecto)

## ✨ Características

### Captura Visual Completa
- **Grabación de DOM completo** con rrweb
- **Reproducción exacta** de la sesión del usuario
- **Captura de interacciones**: clicks, inputs, scroll, navegación
- **Detección de errores** JavaScript y promesas rechazadas
- **Tracking de red**: fetch y XHR requests

### Privacidad y Seguridad
- **Máscaras automáticas** para inputs sensibles (passwords, tarjetas)
- **Sanitización** de emails, teléfonos, SSN
- **Clases CSS** para excluir elementos: `spectra-block`, `spectra-ignore`
- **Modo offline** para demos sin backend

### Performance
- **Bundle optimizado**: ~163KB minificado (~55KB gzipped)
- **Batching inteligente**: envío cada 50 eventos o 30 segundos
- **Compresión** con pako
- **Throttling** de eventos frecuentes
- **Almacenamiento local** con IndexedDB

## 📦 Instalación

### Opción 1: CDN (Recomendado para empezar)

```html
<!-- En tu HTML -->
<script src="https://cdn.jsdelivr.net/gh/tu-usuario/spectraview/dist/spectraview.min.js"></script>
<script>
  SpectraView.init({
    apiKey: 'your-api-key',
    apiEndpoint: 'https://api.spectraview.com',
    appId: 'my-app'
  });
</script>
```

### Opción 2: NPM

```bash
npm install @spectraview/sdk
```

```javascript
import SpectraView from '@spectraview/sdk';

SpectraView.init({
  apiKey: 'your-api-key',
  apiEndpoint: 'https://api.spectraview.com',
  appId: 'my-app'
});
```

## 🚀 Uso Rápido

### Configuración Básica

```javascript
// Inicializar el SDK
SpectraView.init({
  // Requerido
  apiKey: 'your-api-key',
  apiEndpoint: 'https://api.example.com',
  appId: 'my-app',
  
  // Opcional
  userId: 'user-123',
  debug: false,
  
  // Control de captura
  captureMode: 'full', // 'full' | 'privacy' | 'minimal'
  batchSize: 50,
  flushInterval: 30000, // 30 segundos
  
  // Privacidad
  maskAllInputs: true,
  blockClass: 'spectra-block',
  ignoreClass: 'spectra-ignore',
  
  // Sampling
  sampling: {
    scroll: 150,
    mousemove: false,
    mouseInteraction: true
  }
});
```

### Capturar Eventos Personalizados

```javascript
// Capturar evento custom
SpectraView.capture('checkout_started', {
  cartValue: 99.99,
  items: 3
});

// Identificar usuario
SpectraView.setUser('user-456', {
  name: 'John Doe',
  email: 'john@example.com'
});

// Agregar contexto a la sesión
SpectraView.addContext({
  ticketId: 'TICKET-123',
  feature: 'checkout'
});
```

### Control de Grabación

```javascript
// Detener grabación
SpectraView.stop();

// Exportar eventos (para debugging)
const sessionData = SpectraView.exportEvents();

// Descargar sesión como JSON
SpectraView.downloadEvents();

// Obtener eventos para replay
const events = SpectraView.getReplayEvents();
```

### Privacidad - Excluir Elementos

```html
<!-- Este elemento no será grabado -->
<div class="spectra-block">
  Contenido sensible
</div>

<!-- Este elemento será ignorado completamente -->
<div class="spectra-ignore">
  No grabar esto
</div>

<!-- Marcar inputs sensibles -->
<input type="text" data-sensitive="true" />
```

## 📖 API

### `SpectraView.init(config)`
Inicializa el SDK con la configuración especificada.

**Parámetros:**
- `config.apiKey` (string): API key para autenticación
- `config.apiEndpoint` (string): URL del servidor
- `config.appId` (string): ID de la aplicación
- `config.userId` (string, opcional): ID del usuario
- `config.debug` (boolean, opcional): Modo debug

### `SpectraView.capture(eventName, data)`
Captura un evento personalizado.

```javascript
SpectraView.capture('button_clicked', { 
  buttonId: 'checkout',
  value: 99.99 
});
```

### `SpectraView.setUser(userId, metadata)`
Identifica al usuario actual.

```javascript
SpectraView.setUser('user-123', {
  plan: 'premium',
  role: 'admin'
});
```

### `SpectraView.stop()`
Detiene la grabación y envía eventos pendientes.

### `SpectraView.exportEvents()`
Exporta los eventos capturados (útil para debugging).

### `SpectraView.downloadEvents()`
Descarga la sesión como archivo JSON.

## 🛠️ Desarrollo

### Requisitos
- Node.js >= 14
- npm >= 6

### Setup del Proyecto

```bash
# Clonar repositorio
git clone https://github.com/tu-usuario/spectraview.git
cd spectraview/sdk

# Instalar dependencias
npm install

# Desarrollo con hot reload
npm run dev

# Servidor de pruebas
npm run serve
```

### Scripts Disponibles

```json
{
  "scripts": {
    "dev": "webpack --mode development --watch",
    "build": "webpack --mode production",
    "test": "jest",
    "serve": "http-server . -p 8080 -c-1"
  }
}
```

## 🔨 Compilación

### Build de Producción

```bash
# Generar bundle minificado
npm run build

# Output: dist/spectraview.min.js (163KB)
```

### Build de Desarrollo

```bash
# Con source maps para debugging
npm run dev

# Output: dist/spectraview.js (607KB con source maps)
```

### Configuración de Webpack

El proyecto usa Webpack 5 con:
- **Babel** para compatibilidad con navegadores antiguos
- **Terser** para minificación
- **UMD** output para compatibilidad universal

## 🚀 Despliegue

### Opción 1: CDN Público (jsDelivr)

1. **Sube a GitHub:**
```bash
git add .
git commit -m "Release v1.0.0"
git tag v1.0.0
git push origin main --tags
```

2. **Usa desde jsDelivr:**
```html
<!-- Última versión -->
<script src="https://cdn.jsdelivr.net/gh/usuario/repo@latest/dist/spectraview.min.js"></script>

<!-- Versión específica -->
<script src="https://cdn.jsdelivr.net/gh/usuario/repo@1.0.0/dist/spectraview.min.js"></script>
```

### Opción 2: NPM Registry

1. **Prepara package.json:**
```json
{
  "name": "@tuorg/spectraview",
  "version": "1.0.0",
  "main": "dist/spectraview.min.js",
  "files": ["dist/"]
}
```

2. **Publica en NPM:**
```bash
npm login
npm publish --access public
```

3. **Instala desde NPM:**
```bash
npm install @tuorg/spectraview
```

### Opción 3: CDN Privado (AWS S3 + CloudFront)

```bash
# Upload a S3
aws s3 cp dist/spectraview.min.js s3://tu-bucket/sdk/v1.0.0/

# Invalida cache de CloudFront
aws cloudfront create-invalidation --distribution-id ABCD --paths "/sdk/*"
```

**Uso:**
```html
<script src="https://cdn.tudominio.com/sdk/v1.0.0/spectraview.min.js"></script>
```

### Opción 4: Self-hosted

```nginx
# nginx.conf
location /sdk/ {
  alias /var/www/spectraview/dist/;
  expires 1y;
  add_header Cache-Control "public, immutable";
  gzip_static on;
}
```

## 🎮 Demo

### Demo Online
Visita: https://tu-dominio.com/spectraview/demo

### Demo Local

1. **Inicia el servidor:**
```bash
cd sdk
npm run serve
```

2. **Abre en el navegador:**
- Test básico: http://localhost:8080/test.html
- Player completo: http://localhost:8080/player.html

### Funcionalidades del Player

- ▶️ **Grabar sesión**: Captura todas las interacciones
- ⏹️ **Detener grabación**: Finaliza la captura
- 🔄 **Reproducir sesión**: Ve la grabación visual
- 💾 **Exportar**: Descarga como JSON
- 📁 **Importar**: Carga sesiones guardadas

## 📁 Estructura del Proyecto

```
sdk/
├── src/
│   └── spectraview.js      # Código fuente principal
├── dist/
│   ├── spectraview.js      # Build desarrollo
│   └── spectraview.min.js  # Build producción
├── test/
│   └── spectraview.test.js # Tests unitarios
├── test.html               # Página de prueba básica
├── player.html             # Demo con player completo
├── webpack.config.js       # Configuración de Webpack
├── package.json            # Dependencias y scripts
└── README.md              # Este archivo
```

## 🔧 Configuración Avanzada

### Modo Offline (Sin Backend)

```javascript
// Para demos o desarrollo sin servidor
SpectraView.init({
  apiKey: 'demo',
  apiEndpoint: null, // Sin backend
  appId: 'demo-app',
  debug: true
});
```

### Integración con React

```jsx
import { useEffect } from 'react';
import SpectraView from '@spectraview/sdk';

function App() {
  useEffect(() => {
    SpectraView.init({
      apiKey: process.env.REACT_APP_SPECTRA_KEY,
      apiEndpoint: process.env.REACT_APP_API_URL,
      appId: 'react-app'
    });
    
    return () => {
      SpectraView.stop();
    };
  }, []);
  
  return <YourApp />;
}
```

### Integración con Next.js

```javascript
// pages/_app.js
import { useEffect } from 'react';
import SpectraView from '@spectraview/sdk';

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      SpectraView.init({
        apiKey: process.env.NEXT_PUBLIC_SPECTRA_KEY,
        apiEndpoint: process.env.NEXT_PUBLIC_API_URL,
        appId: 'nextjs-app'
      });
    }
  }, []);
  
  return <Component {...pageProps} />;
}
```

## 📊 Métricas de Performance

- **Tamaño del bundle**: 163KB minificado (~55KB gzipped)
- **Impacto en CPU**: < 5% durante grabación
- **Uso de memoria**: < 10MB para sesiones normales
- **Latencia inicial**: < 50ms
- **Overhead de red**: < 1KB/s promedio

## 🤝 Soporte

- **Documentación**: https://docs.spectraview.com
- **GitHub Issues**: https://github.com/tu-usuario/spectraview/issues
- **Email**: support@spectraview.com
- **Slack**: #spectraview-support

## 📝 Licencia

MIT License - Ver [LICENSE](LICENSE) para más detalles.

## 🙏 Créditos

Construido con:
- [rrweb](https://github.com/rrweb-io/rrweb) - Motor de grabación/reproducción
- [pako](https://github.com/nodeca/pako) - Compresión
- [localforage](https://github.com/localForage/localForage) - Almacenamiento local

---

**Desarrollado por CIT Lab** 🚀

*Última actualización: Diciembre 2024*