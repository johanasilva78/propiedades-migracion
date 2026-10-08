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
- El frontend llama a `/ping` usando `VITE_API_URL` (por defecto `http://localhost:3000`).
- El estado de conexión se verifica automáticamente al abrir la aplicación, cada minuto y al recuperar la conexión de red.
- El proxy local necesita `INSPECTIONS_API_URL`; un backend inaccesible muestra error.
- La API de borradores de Lambda comprueba PostgreSQL; `helloWorld` de Amplify es un ejemplo separado.

## Qué incluye la Home ahora
- Estado de conexión automático, con mensajes sencillos y sin fallback de éxito simulado.
- Secciones del formulario plegables, cerradas inicialmente.
- Gestión de borradores con acciones para retomar, listar o iniciar una inspección.
- Formulario completo con guardado por sección, recuperación por UUID y fotos mediante Fileupload de DANA.

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

## Borradores por sección en PostgreSQL

La migración inicial está en `database/001_partial_inspections.sql`. El mapa de
campos del formulario a columnas SQL está en `database/section-fields.json`.
El formulario React ya usa el cliente de borradores: permite guardar una sección,
guardar todo el avance y retomar por UUID. La API Python está en
`lambda/inspections/lambda_function.py`; debe desplegarse y conectarse mediante
una URL HTTP para probar desde el navegador. El ZIP desplegable está en
`lambda/inspections-lambda.zip`.

El script se puede volver a ejecutar en PostgreSQL 14 o posterior: conserva tablas,
índices y configuración del catálogo existentes, reemplaza funciones/vista y
elimina/recrea los triggers dentro de la transacción. `IF NOT EXISTS` no adapta
columnas ni restricciones de tablas ya creadas; esos cambios requieren una
migración específica. El usuario debe tener permisos sobre `public` y ser
propietario de los objetos que se reemplazan o tener el rol correspondiente.

Desde `Propiedades-migracion`, con `DATABASE_URL` configurada y usando `psql`:

```bash
psql "$DATABASE_URL" -1 -v ON_ERROR_STOP=1 -f database/001_partial_inspections.sql
psql "$DATABASE_URL" -1 -v ON_ERROR_STOP=1 -f database/002_all_fields_required.sql
```

Las pruebas modifican temporalmente el catálogo y revierten sus cambios;
ejecutarlas en una base de desarrollo o pruebas:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/partial_inspections.test.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/all_fields_required.test.sql
```

La Lambda Python usa `pg8000.dbapi.connect` con `DB_HOST`, `DB_PORT`, `DB_USER`,
`DB_PASSWORD` y `DB_NAME`. Debe ejecutar el SQL en una misma conexión, con
autocommit desactivado, confirmar con `connection.commit()`, hacer
`connection.rollback()` ante cualquier excepción y cerrar cursor/conexión
en `finally`. El archivo SQL no incluye `BEGIN`/`COMMIT`: la Lambda es quien
controla la transacción. Para `psql`, `-1` proporciona esa transacción.
No se crea ningún esquema nuevo.

La estructura usa el esquema existente `public` de la base indicada por `DB_NAME`:

| Tabla | Uso |
| --- | --- |
| `inspecciones` | UUID del borrador, operador, versión y fechas |
| `catalogo_secciones` | Las 15 secciones, campos obligatorios y permisos para «No aplica» |
| `progreso_secciones` | Estado y evidencia de validación de cada sección |
| `datos_cliente` | Sección 1: cliente, construcción básica e inspector |
| `sumas_aseguradas` | Sección 2: importes RD/USD y detalles de bienes |
| `descripcion_edificio` | Sección 3: construcción, superficies y descripción por nivel |
| `colindancias` | Sección 4: vecinos, distancias y agravación |
| `localizacion_riesgo` | Sección 5: dirección y coordenadas |
| `historial_perdidas` | Sección 6: historial |
| `siniestralidad_zona` | Sección 7: siniestralidad y notas |
| `procesos_empresa` | Sección 8: procesos e inventario |
| `descripcion_peligros` | Sección 9: peligros y servicios energéticos |
| `prevencion_proteccion` | Sección 10: protección contra incendio |
| `seguridad` | Sección 11: cámaras, vigilancia y simulacros |
| `estimacion_perdidas` | Sección 12: MPL y EML |
| `servicios_auxiliares` | Sección 13: características de equipos auxiliares |
| `fotografias` / `archivos_inspeccion` | Sección 14: observaciones, referencias de archivos y categorías |
| `conclusiones_inspector` | Sección 15: conclusiones |
| `envios_dana` | Cola de envío, snapshot, intentos, respuesta y error |
| `resumen_inspecciones` | Vista con progreso y condición `lista_para_enviar` |

Cada tabla de sección tiene una relación 1:1 con la inspección. Las fotografías
tienen relación 1:N. Todos los campos de contenido admiten `NULL`, para guardar
parciales; fechas, importes y cantidades conservan tipos PostgreSQL. Convertir
strings vacíos a `NULL` antes de guardar. Un valor mal formado debe devolver un
error de campo; no se debe perder el resto del borrador ni simular éxito.

### Reglas de completitud

La política actual exige **todos los campos del formulario** para completar cada
sección: 133 campos de datos y las cinco categorías de fotografías. Por ahora
«No aplica» está deshabilitado por campo y por sección. Se permiten borradores
con campos vacíos; la obligatoriedad se valida al completar, sin agregar
restricciones `NOT NULL` a los datos de las secciones.

En instalaciones nuevas, `001_partial_inspections.sql` carga estos requisitos.
Para la base ya creada mediante la Lambda, ejecutar
`database/002_all_fields_required.sql`: actualiza el catálogo y el validador en
una misma transacción. La Lambda controla `commit`/`rollback` igual que en 001.
La migración incrementa `version_reglas` únicamente si los requisitos cambian;
repetirla no incrementa versiones si la política ya coincide. Las secciones
validadas con requisitos anteriores necesitan revalidarse. Los trabajos de
DANA ya encolados conservan su snapshot; esta migración no los cancela.

La sección 14 requiere al menos una foto en cada categoría: `techos`, `pisos`,
`paredes`, `externas` y `otros`. El validador convierte las referencias de
archivos en esos cinco campos virtuales. `observaciones`, `zip_storage_key`,
IDs, fechas de auditoría y fileIDs de DANA son metadata interna, no campos del
formulario obligatorios. Los campos derivados de construcción y descripción
por nivel sí se incluyen y deberán persistirse con el resto del formulario.

`NULL` en la configuración de requisitos sigue significando «sin configurar»
y bloquea la finalización. Un arreglo vacío representa una decisión administrativa
de no exigir campos escalares; no se usa en la política actual.

No marcar las 15 secciones completas por tener algún dato. Al completar una
sección, el backend valida tipos, campos obligatorios y condiciones del riesgo;
después actualiza `progreso_secciones` con `estado = 'completa'`, la versión de
reglas, el operador autenticado y la fecha. El trigger verifica existencia de
datos, obligatoriedad y justificaciones de campos no aplicables. `false` y `0`
son respuestas válidas; `NULL`, texto vacío, arreglos vacíos y descripciones por
nivel con elementos vacíos no lo son.

«No aplica» puede ser por campo (`campos_no_aplican`, con justificación) o por
sección (`estado = 'no_aplica'`, con motivo). Ambos requieren autorización en
el catálogo, pero la política actual deshabilita ambas alternativas. El frontend
no decide esos permisos. Al cambiar las reglas, se debe
incrementar `version_reglas`; las validaciones anteriores dejan de habilitar
el envío hasta que se revaliden.

La política actual también exige los campos mostrados condicionalmente, como
observaciones de colindancias o datos de simulacros. El formulario permite
responderlos siempre. El backend deberá comprobar además la
coherencia entre valores y la cantidad de descripciones por nivel. Las reglas
SQL incluidas validan presencia de respuestas, no toda esa coherencia de negocio.
Los controles booleanos ahora empiezan en «Sin responder» (`NULL`) y permiten
responder explícitamente Sí o No.

### Ejemplo de guardado parcial

Enviar a `PATCH /api/inspections/:id/sections/1` con `X-Operator-Id`:

```json
{
  "expectedVersion": 3,
  "fields": { "nombreRiesgo": "Almacén Central", "propietario": "Empresa X" }
}
```

Un campo omitido conserva su valor, `null` elimina una respuesta y una cadena
vacía se normaliza a `null`. El servidor permite únicamente campos del mapa de
esa sección. Los campos desconocidos y los valores mal formados devuelven 422.
Una sección incompleta sí se guarda, con su estado y campos pendientes; no hace
falta llenar todos los campos para persistir un parcial. La respuesta incluye
UUID, versión actualizada, datos, fotos, progreso y `saved: true`.

Cuando se implemente el envío final, la transacción que detecta completitud
creará el snapshot en `envios_dana` y devolverá su identificador. Esa parte está
pendiente y no forma parte de las pruebas actuales de guardado.

### Estado implementado para pruebas de parciales

- `POST /api/inspections` crea el UUID y las 15 filas de progreso.
- `GET /api/inspections` lista las inspecciones del operador, con paginación de 50.
- `GET /api/inspections/:id` recupera datos, estados y referencias de fotos.
- `PATCH /api/inspections/:id` guarda todos los campos enviados; los omitidos se conservan.
- `PATCH /api/inspections/:id/sections/:sectionId` guarda únicamente esa sección.
- `GET /ping` comprueba acceso a PostgreSQL; no devuelve un éxito simulado.

Cada guardado bloquea la inspección, compara `expectedVersion`, aplica los cambios
con parámetros SQL y revalida las secciones dentro de una transacción. Una
sección incompleta se guarda como parcial. Un UUID de otro operador devuelve
404; una versión vieja o un envío activo devuelve 409. Un error hace rollback
y no muestra «Guardado». Los controles de Sí/No distinguen «Sin responder» de
`false`. Guardar una sección conserva las ediciones locales de las demás.

**Fotografías:** por indicación del proyecto, los parciales usan el Fileupload
existente de DANA. Lambda hace la carga y persiste `dana_file_id`, una referencia
`dana:<fileID>` en `storage_key`, nombre, tipo, tamaño y hash en PostgreSQL. Las
fotos ya guardadas se identifican por su UUID de `archivos_inspeccion` y no se
vuelven a subir. En HTTP, `photos` incluye las cinco listas: omitir `photos`
conserva los archivos; una lista enviada vacía elimina sus referencias de ese
borrador. Una foto nueva se envía con `name` y `dataUrl`; una existente con `id`.

Al recuperar, DANA solo proporciona fileIDs por el endpoint actual: el formulario
muestra el nombre y «Fotografía guardada en DANA». Las fotos nuevas sí tienen
vista previa local. Recuperar una vista previa remota requiere el endpoint de
descarga de DANA. Eliminar una foto del borrador elimina la referencia en
PostgreSQL; no borra el archivo remoto. Si Fileupload confirma y luego falla la
transacción, puede quedar un archivo remoto sin referencia: no hay una API de
borrado remoto configurada para compensarlo. Guardar fotos requiere salida de
red de Lambda hacia DANA además de acceso privado a PostgreSQL.

Esta etapa **no inicia conversaciones ni crea trabajos en `envios_dana`**, incluso
cuando el resultado indica `ready: true`. Esto permite probar guardado y recuperación
sin disparar envíos finales. El worker de conversación, el ZIP de fotos y los
reintentos/reconciliación se implementarán en la etapa de envío. El antiguo proxy
local `/api/dana/*` responde 410 para evitar enviar por el flujo anterior.

### Desplegar y probar desde la consola de Lambda

Para comparar con la Lambda operativa que usa el layer `python314` versión 1,
hay una alternativa: `lambda/inspections-lambda-layer.zip` contiene únicamente
handler y mapas. Adjuntar ese mismo layer/version a la Lambda de borradores y
usar este ZIP permite utilizar el driver del layer. La conexión predeterminada
ahora usa los mismos parámetros que la Lambda operativa, incluido `timeout=15`.
El ZIP habitual sigue incluyendo su propio driver. Esta comparación no confirma
la causa del timeout; si continúa, verificar que los valores DB y el acceso de
red coincidan. Para regenerar el paquete del layer:
`python3 lambda/package_inspections.py --layer`.

1. Crear una Lambda de API de borradores separada de la que ejecuta migraciones,
   o cambiar el handler de una Lambda dedicada a estas pruebas. Usar Python 3.12+
   y el ZIP `lambda/inspections-lambda.zip` (incluye pg8000 y sus dependencias).
2. Configurar handler **`lambda_function.lambda_handler`**. Conservar el acceso
   de VPC a la base y las variables `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`,
   `DB_NAME`. Opcional: `DB_SSLMODE=prefer|require|verify-full|disable` y
   `DB_SSL_CA_FILE` para certificado en `verify-full`.
3. Añadir **`ALLOW_TEST_OPERATOR=true`**. El identificador de prueba se recibe en
   `X-Operator-Id`; esto identifica las pruebas, no autentica a una persona.
   En producción debe desactivarse y usarse un authorizer JWT/Cognito; el backend
   ya admite el `sub` verificado del authorizer. El frontend de esta etapa usa
   únicamente el operador de pruebas y todavía no integra inicio de sesión JWT.
4. Para probar fotos, añadir `DANA_USER`, `DANA_PASSWORD`, `DANA_EMPRESA` y,
   opcionalmente, `DANA_UPLOAD_URL` (por defecto el Fileupload ya usado). No poner
   credenciales en variables `VITE_*`. No se requiere un bucket S3.
5. En los eventos de prueba de la consola, copiar los JSON de
   `lambda/inspections/events/`. Ejecutar `01-create.json` y copiar el UUID devuelto
   en `body`. Sustituir el UUID de ceros en `02-save-section.json` por ese UUID y
   usar su versión actual en `expectedVersion`. Debe devolver `saved: true` y
   progreso parcial. Ejecutar `03-get.json` con el mismo UUID: debe devolver
   `nombreRiesgo` y `propietario` persistidos. `04-list.json` lista los borradores
   de `operador-prueba`. Estos eventos no cargan fotos ni llaman a DANA.

Las migraciones 001 y 002 ya aplicadas son suficientes; no hay un SQL adicional
para este guardado. El ZIP no incluye credenciales ni ejecuta migraciones.
No se ha desplegado la Lambda ni se ha probado contra la instancia privada.

### Probar desde el navegador cuando exista la URL HTTP

Configurar una integración proxy de API Gateway para las rutas anteriores, o una
Function URL. En Lambda configurar `ALLOWED_ORIGINS` con el origen del formulario;
por defecto es `http://localhost:5173`. Si API Gateway administra CORS, configurar
allí GET/POST/PATCH/OPTIONS y los headers Content-Type/Authorization/X-Operator-Id.
Para una etapa que aparece en `event.path`, usar `API_PATH_PREFIX=/nombre-etapa`.

Se puede apuntar el frontend directamente a la URL pública de la API:

```env
VITE_API_URL=https://URL-DE-TU-API/etapa
```

O mantener el proxy Node local con estas variables en `Propiedades-migracion/.env`:

```env
VITE_API_URL=http://localhost:3000
INSPECTIONS_API_URL=https://URL-DE-TU-API/etapa
```

Ejecutar `npm run dev:server` y `npm run dev` en terminales distintas. Si no hay
URL de Lambda, el proxy devuelve 503 con la configuración pendiente; no simula
persistencia. El campo «Operador de pruebas» debe coincidir con el de los eventos.
La pantalla ofrece «Guardar sección», «Guardar avance», «Listar mis borradores»
y «Retomar por ID». El navegador conserva únicamente el último UUID/operador;
los datos persistidos vienen de PostgreSQL, no de localStorage. Cambiar
`VITE_API_URL` requiere reiniciar Vite o generar de nuevo el build.

Las cargas nuevas de fotos están limitadas a 3 MB por guardado (base64 aumenta el
tamaño de la solicitud). Para comenzar, probar datos por sección y luego fotos
en grupos pequeños. Si una petición no llega a confirmar su respuesta, recuperar
el UUID y su versión antes de repetir el guardado. La operación de foto y los
campos de ese guardado forman una misma transacción en PostgreSQL.

### Verificación local

```bash
npm test
npm run test:lambda
npm run build
```

Las pruebas de la API Python validan formatos, autorización, conflictos, rollback
y respuestas de Fileupload usando dobles de PostgreSQL y HTTP. Las pruebas de
Node verifican el cliente y el proxy HTTP local. No sustituyen una prueba real
contra la Lambda y PostgreSQL; los eventos de consola permiten hacer esa prueba.

Referencias técnicas: [bloqueos de filas de PostgreSQL](https://www.postgresql.org/docs/current/explicit-locking.html)
y [funciones JSON de PostgreSQL](https://www.postgresql.org/docs/current/functions-json.html).

Referencias de despliegue: [integración HTTP de Lambda](https://docs.aws.amazon.com/lambda/latest/dg/services-apigateway.html)
y [paquetes ZIP de Python para Lambda](https://docs.aws.amazon.com/lambda/latest/dg/python-package.html).
