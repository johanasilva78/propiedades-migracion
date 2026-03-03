# Propiedades Migración (React + Vite + Tailwind + Tremor)

Proyecto base para migrar el formulario de inspección a React 18 con Vite y Tailwind v3.4, componentes Tremor y preparación opcional para AWS Amplify Gen2.

## Requisitos previos
- Node.js 18+ (recomendado 18/20)
- npm 9+

## Instalación
```bash
npm install
```

## Correr en local
```bash
npm run dev
```
Abre el enlace que muestra Vite (por defecto http://localhost:5173).

## Build de producción
```bash
npm run build
```

## Endpoint /ping (estado actual)
- El frontend llama a `/ping` usando `VITE_API_URL` (por defecto `/api`).
- Si no hay backend, el hook `usePing` usa mock (`pong (mock)`) sin fallar.
- Más adelante: se conectará a Amplify Gen2; la Lambda `helloWorld` expuesta en la API `myApi` responderá `{ message: 'pong', timestamp, requestId }`.

## Qué incluye la Home ahora
- Ping de salud con fallback mock.
- Formulario completo migrado (datos cliente, sumas aseguradas, descripción, colindancias, localización, historial, siniestralidad, procesos, peligros, prevención, estimación, fotos con upload + .zip y payload mock).

## Estructura de carpetas
- `src/components` – componentes reutilizables.
- `src/pages` – páginas (Home incluido).
- `src/hooks` – hooks personalizados (ej. `usePing`).
- `src/services` – clientes/API helpers (ej. `apiClient.js`).
- `amplify` – configuración preparada para Amplify Gen2 (dummy, sin credenciales ni despliegue requerido).

## Amplify Gen2 (preparado, opcional)
- `amplify/backend.ts` define el backend con `myApi` y la Lambda `helloWorld`.
- `amplify/backend/api/myApi` – definición del API REST y ruta `/ping`.
- `amplify/backend/functions/helloWorld` – Lambda de ejemplo que responde `pong`.
- `amplify/outputs/amplify_outputs.json` – dummy `{}`; el frontend carga este archivo con fallback vacío para funcionar sin AWS.
- No se ejecutó `amplify push/pull` ni se requieren credenciales para correr localmente.

## CI / Amplify
Archivo `amplify.yml` en la raíz con pasos básicos:
```yaml
version: 1
applications:
  - appRoot: .
    frontend:
      phases:
        preBuild:
          commands:
            - npm ci
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: dist
        files:
          - '**/*'
    test:
      phases:
        preTest:
          commands: []
        test:
          commands: []
```
Diseñado para no fallar aunque no haya backend de AWS configurado aún.

## Próximos pasos
- Integrar el formulario completo y lógica existente.
- Conectar `/ping` real a Amplify cuando se tengan credenciales.
- Añadir pruebas y flujos CI/CD según el entorno destino.
