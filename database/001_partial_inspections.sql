-- Estructura idempotente en el esquema public de DB_NAME (PostgreSQL 14+).
-- La Lambda controla la transacción con connection.commit()/rollback().
-- Para psql: usar -1 -v ON_ERROR_STOP=1. No contiene llamadas HTTP ni credenciales.
-- IF NOT EXISTS conserva tablas/índices existentes; no modifica sus columnas.

CREATE TABLE IF NOT EXISTS public.inspecciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operador_id text NOT NULL CHECK (btrim(operador_id) <> ''),
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
  creada_en timestamptz NOT NULL DEFAULT now(),
  actualizada_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inspecciones_operador_idx ON public.inspecciones (operador_id, actualizada_en DESC);

-- Configuración administrativa; NULL en obligatorios bloquea la finalización.
-- Los nombres de campos son columnas SQL, según section-fields.json.
CREATE TABLE IF NOT EXISTS public.catalogo_secciones (
  id smallint PRIMARY KEY CHECK (id BETWEEN 1 AND 15),
  nombre text NOT NULL,
  tabla text NOT NULL UNIQUE,
  campos_obligatorios text[],
  campos_no_aplica_permitidos text[] NOT NULL DEFAULT '{}',
  permite_no_aplica boolean NOT NULL DEFAULT false,
  version_reglas integer NOT NULL DEFAULT 1 CHECK (version_reglas > 0),
  CHECK (array_position(campos_obligatorios, NULL) IS NULL),
  CHECK (array_position(campos_no_aplica_permitidos, NULL) IS NULL)
);
INSERT INTO public.catalogo_secciones (id, nombre, tabla, campos_obligatorios) VALUES
  (1, 'Datos del cliente', 'datos_cliente', ARRAY['nombre_riesgo', 'propietario', 'rnc', 'poliza', 'tipo_riesgo', 'ubicacion_inspeccionada', 'intermediario', 'entrevistado', 'telefono', 'celular', 'email', 'sitio_web', 'edad_riesgo', 'movimiento_comercial', 'org_contable', 'entidad_publica', 'techo_construccion', 'paredes_construccion', 'niveles', 'empleados', 'horario', 'aseguradora_anterior', 'inspeccionado_por', 'fecha_inspeccion', 'zip', 'tipo_construccion', 'tipo_construccion_resultado']::text[]),
  (2, 'Sumas aseguradas', 'sumas_aseguradas', ARRAY['edificacion_rd', 'edificacion_usd', 'mobiliario_rd', 'mobiliario_usd', 'maquinaria_rd', 'maquinaria_usd', 'existencia_rd', 'existencia_usd', 'bienes_especificos_rd', 'bienes_especificos_usd', 'bienes_especificos_detalle', 'otros_bienes_detalle', 'otros_bienes_rd', 'otros_bienes_usd', 'valor_total_rd', 'valor_total_usd']::text[]),
  (3, 'Descripción del edificio', 'descripcion_edificio', ARRAY['descripcion_general', 'descripcion_por_niveles', 'observaciones_edificio', 'anio_construccion', 'fecha_ultima_remodelacion', 'pisos', 'mts_por_piso', 'aptos_por_piso', 'mts_construccion', 'diseno_antisismico', 'construccion_unica', 'construccion_separada', 'predio', 'sindicato', 'descripcion_por_nivel']::text[]),
  (4, 'Colindancias', 'colindancias', ARRAY['colindancia_norte', 'distancia_colindancia_norte', 'colindancia_sur', 'distancia_colindancia_sur', 'colindancia_este', 'distancia_colindancia_este', 'colindancia_oeste', 'distancia_colindancia_oeste', 'colindancias_no_agravan', 'colindancias_agravan', 'colindancias_observaciones']::text[]),
  (5, 'Localización del riesgo', 'localizacion_riesgo', ARRAY['calle', 'sector', 'municipio', 'provincia', 'manzana', 'edificio', 'piso', 'apartamento', 'residencial', 'longitud', 'latitud', 'nivel_mar', 'distancia_agua', 'imagen_riesgo']::text[]),
  (6, 'Historial de pérdidas', 'historial_perdidas', ARRAY['historial_perdidas']::text[]),
  (7, 'Siniestralidad de la zona', 'siniestralidad_zona', ARRAY['siniestralidad', 'siniestralidad_notas']::text[]),
  (8, 'Procesos de la empresa', 'procesos_empresa', ARRAY['descripcion_procesos', 'manejo_inventario']::text[]),
  (9, 'Descripción de peligros', 'descripcion_peligros', ARRAY['combustibles', 'carga_combustible', 'instalaciones_electricas', 'orden_limpieza', 'dentro_riesgo', 'fuera_riesgo', 'pasillos_libres', 'procedencia_energetica', 'generadores', 'transformador', 'subestacion', 'puesta_tierra', 'pararrayos', 'calderas', 'aire_comprimido', 'peligros_otros']::text[]),
  (10, 'Prevención y protección', 'prevencion_proteccion', ARRAY['extintores_cantidad', 'agente_extintor', 'bombas_incendio', 'bombas_agua', 'suministro_agua', 'almacen_agua', 'mangueras_incendio', 'prevencion_otros']::text[]),
  (11, 'Seguridad', 'seguridad', ARRAY['camaras_cantidad', 'camaras_tipo', 'camaras_duracion', 'vigilantes_cantidad', 'vigilantes_subcontratados', 'vigilantes_armas', 'senalizacion_rutas', 'simulacros', 'simulacros_periodicidad', 'simulacros_fecha_ultima']::text[]),
  (12, 'Estimación de pérdidas incendio', 'estimacion_perdidas', ARRAY['mpl', 'eml']::text[]),
  (13, 'Servicios Auxiliares', 'servicios_auxiliares', ARRAY['servicios_aux_cantidad', 'servicios_aux_tipo', 'servicios_aux_marca', 'servicios_aux_modelo', 'servicios_aux_serie', 'servicios_aux_anio', 'servicios_aux_horas', 'servicios_aux_capacidad']::text[]),
  (14, 'Fotografías', 'fotografias', ARRAY['techos', 'pisos', 'paredes', 'externas', 'otros']::text[]),
  (15, 'Conclusiones generales del inspector', 'conclusiones_inspector', ARRAY['conclusiones_inspector']::text[])
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.progreso_secciones (
  inspeccion_id uuid NOT NULL REFERENCES public.inspecciones(id) ON DELETE CASCADE,
  seccion_id smallint NOT NULL REFERENCES public.catalogo_secciones(id),
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','parcial','completa','no_aplica')),
  -- Mapa columna -> justificación: {"sitio_web": "El cliente no tiene sitio web"}.
  campos_no_aplican jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(campos_no_aplican) = 'object'),
  motivo_no_aplica text,
  version_reglas_validada integer,
  validada_por text,
  validada_en timestamptz,
  PRIMARY KEY (inspeccion_id, seccion_id),
  CHECK (estado NOT IN ('completa','no_aplica') OR
    (version_reglas_validada IS NOT NULL AND validada_por IS NOT NULL AND
     btrim(validada_por) <> '' AND validada_en IS NOT NULL)),
  CHECK (estado <> 'no_aplica' OR coalesce(btrim(motivo_no_aplica), '') <> '')
);

-- Una fila por sección e inspección; todos los campos pueden quedar NULL.
-- NULL = sin responder; false/0 = respuesta válida. No usar defaults false.
CREATE TABLE IF NOT EXISTS public.datos_cliente (
  inspeccion_id uuid PRIMARY KEY REFERENCES public.inspecciones(id) ON DELETE CASCADE,
  nombre_riesgo text,
  propietario text,
  rnc text,
  poliza text,
  tipo_riesgo text,
  ubicacion_inspeccionada text,
  intermediario text,
  entrevistado text,
  telefono text,
  celular text,
  email text,
  sitio_web text,
  edad_riesgo text,
  movimiento_comercial text,
  org_contable text,
  entidad_publica text,
  techo_construccion text,
  paredes_construccion text,
  niveles integer,
  empleados integer,
  horario text,
  aseguradora_anterior text,
  inspeccionado_por text,
  fecha_inspeccion date,
  zip text,
  tipo_construccion text,
  tipo_construccion_resultado text
);

CREATE TABLE IF NOT EXISTS public.sumas_aseguradas (
  inspeccion_id uuid PRIMARY KEY REFERENCES public.inspecciones(id) ON DELETE CASCADE,
  edificacion_rd numeric(18,2),
  edificacion_usd numeric(18,2),
  mobiliario_rd numeric(18,2),
  mobiliario_usd numeric(18,2),
  maquinaria_rd numeric(18,2),
  maquinaria_usd numeric(18,2),
  existencia_rd numeric(18,2),
  existencia_usd numeric(18,2),
  bienes_especificos_rd numeric(18,2),
  bienes_especificos_usd numeric(18,2),
  bienes_especificos_detalle text,
  otros_bienes_detalle text,
  otros_bienes_rd numeric(18,2),
  otros_bienes_usd numeric(18,2),
  valor_total_rd numeric(18,2),
  valor_total_usd numeric(18,2)
);

CREATE TABLE IF NOT EXISTS public.descripcion_edificio (
  inspeccion_id uuid PRIMARY KEY REFERENCES public.inspecciones(id) ON DELETE CASCADE,
  descripcion_general text,
  descripcion_por_niveles text[],
  observaciones_edificio text,
  anio_construccion integer,
  fecha_ultima_remodelacion date,
  pisos integer,
  mts_por_piso numeric(18,6),
  aptos_por_piso integer,
  mts_construccion numeric(18,6),
  diseno_antisismico boolean,
  construccion_unica boolean,
  construccion_separada boolean,
  predio text,
  sindicato text,
  descripcion_por_nivel text
);

CREATE TABLE IF NOT EXISTS public.colindancias (
  inspeccion_id uuid PRIMARY KEY REFERENCES public.inspecciones(id) ON DELETE CASCADE,
  colindancia_norte text,
  distancia_colindancia_norte numeric(18,6),
  colindancia_sur text,
  distancia_colindancia_sur numeric(18,6),
  colindancia_este text,
  distancia_colindancia_este numeric(18,6),
  colindancia_oeste text,
  distancia_colindancia_oeste numeric(18,6),
  colindancias_no_agravan boolean,
  colindancias_agravan boolean,
  colindancias_observaciones text
);

CREATE TABLE IF NOT EXISTS public.localizacion_riesgo (
  inspeccion_id uuid PRIMARY KEY REFERENCES public.inspecciones(id) ON DELETE CASCADE,
  calle text,
  sector text,
  municipio text,
  provincia text,
  manzana text,
  edificio text,
  piso text,
  apartamento text,
  residencial text,
  longitud numeric(18,6),
  latitud numeric(18,6),
  nivel_mar numeric(18,6),
  distancia_agua numeric(18,6),
  imagen_riesgo text
);

CREATE TABLE IF NOT EXISTS public.historial_perdidas (
  inspeccion_id uuid PRIMARY KEY REFERENCES public.inspecciones(id) ON DELETE CASCADE,
  historial_perdidas text
);

CREATE TABLE IF NOT EXISTS public.siniestralidad_zona (
  inspeccion_id uuid PRIMARY KEY REFERENCES public.inspecciones(id) ON DELETE CASCADE,
  siniestralidad text,
  siniestralidad_notas text
);

CREATE TABLE IF NOT EXISTS public.procesos_empresa (
  inspeccion_id uuid PRIMARY KEY REFERENCES public.inspecciones(id) ON DELETE CASCADE,
  descripcion_procesos text,
  manejo_inventario text
);

CREATE TABLE IF NOT EXISTS public.descripcion_peligros (
  inspeccion_id uuid PRIMARY KEY REFERENCES public.inspecciones(id) ON DELETE CASCADE,
  combustibles text,
  carga_combustible text,
  instalaciones_electricas text,
  orden_limpieza text,
  dentro_riesgo text,
  fuera_riesgo text,
  pasillos_libres text,
  procedencia_energetica text,
  generadores text,
  transformador text,
  subestacion text,
  puesta_tierra text,
  pararrayos text,
  calderas text,
  aire_comprimido text,
  peligros_otros text
);

CREATE TABLE IF NOT EXISTS public.prevencion_proteccion (
  inspeccion_id uuid PRIMARY KEY REFERENCES public.inspecciones(id) ON DELETE CASCADE,
  extintores_cantidad integer,
  agente_extintor text,
  bombas_incendio text,
  bombas_agua text,
  suministro_agua text,
  almacen_agua text,
  mangueras_incendio text,
  prevencion_otros text
);

CREATE TABLE IF NOT EXISTS public.seguridad (
  inspeccion_id uuid PRIMARY KEY REFERENCES public.inspecciones(id) ON DELETE CASCADE,
  camaras_cantidad integer,
  camaras_tipo text,
  camaras_duracion text,
  vigilantes_cantidad integer,
  vigilantes_subcontratados text,
  vigilantes_armas text,
  senalizacion_rutas text,
  simulacros text,
  simulacros_periodicidad text,
  simulacros_fecha_ultima date
);

CREATE TABLE IF NOT EXISTS public.estimacion_perdidas (
  inspeccion_id uuid PRIMARY KEY REFERENCES public.inspecciones(id) ON DELETE CASCADE,
  mpl text,
  eml text
);

CREATE TABLE IF NOT EXISTS public.servicios_auxiliares (
  inspeccion_id uuid PRIMARY KEY REFERENCES public.inspecciones(id) ON DELETE CASCADE,
  servicios_aux_cantidad integer,
  servicios_aux_tipo text,
  servicios_aux_marca text,
  servicios_aux_modelo text,
  servicios_aux_serie text,
  servicios_aux_anio integer,
  servicios_aux_horas text,
  servicios_aux_capacidad text
);

CREATE TABLE IF NOT EXISTS public.fotografias (
  inspeccion_id uuid PRIMARY KEY REFERENCES public.inspecciones(id) ON DELETE CASCADE,
  observaciones text,
  zip_storage_key text
);

CREATE TABLE IF NOT EXISTS public.conclusiones_inspector (
  inspeccion_id uuid PRIMARY KEY REFERENCES public.inspecciones(id) ON DELETE CASCADE,
  conclusiones_inspector text
);

-- Fotografías: almacenar archivos en almacenamiento propio; DANA se usa al finalizar.
CREATE TABLE IF NOT EXISTS public.archivos_inspeccion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspeccion_id uuid NOT NULL REFERENCES public.fotografias(inspeccion_id) ON DELETE CASCADE,
  categoria text NOT NULL CHECK (categoria IN ('techos','pisos','paredes','externas','otros')),
  storage_key text NOT NULL CHECK (btrim(storage_key) <> ''),
  nombre_original text NOT NULL,
  mime_type text NOT NULL CHECK (mime_type LIKE 'image/%'),
  tamanio_bytes bigint NOT NULL CHECK (tamanio_bytes > 0),
  sha256 text,
  dana_file_id text,
  creada_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (inspeccion_id, storage_key)
);
CREATE INDEX IF NOT EXISTS archivos_inspeccion_idx ON public.archivos_inspeccion(inspeccion_id, categoria);

-- Outbox transaccional. Payload construido en el servidor desde datos persistidos.
CREATE TABLE IF NOT EXISTS public.envios_dana (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspeccion_id uuid NOT NULL REFERENCES public.inspecciones(id),
  version_inspeccion bigint NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN
    ('pendiente','enviando','confirmado','error','incierto','cancelado')),
  intentos integer NOT NULL DEFAULT 0 CHECK (intentos >= 0),
  proximo_intento_en timestamptz,
  tomada_en timestamptz,
  http_status integer,
  respuesta jsonb,
  ultimo_error text,
  dana_id_row text,
  creada_en timestamptz NOT NULL DEFAULT now(),
  confirmado_en timestamptz,
  UNIQUE (inspeccion_id, version_inspeccion),
  CHECK (estado <> 'confirmado' OR confirmado_en IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS envio_dana_activo_idx ON public.envios_dana(inspeccion_id)
  WHERE estado <> 'cancelado';
CREATE INDEX IF NOT EXISTS envios_dana_pendientes_idx ON public.envios_dana(proximo_intento_en, creada_en)
  WHERE estado = 'pendiente';

-- Inicializar siempre las 15 secciones, incluso sin datos todavía.
CREATE OR REPLACE FUNCTION public.inicializar_progreso() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.progreso_secciones(inspeccion_id, seccion_id)
    SELECT NEW.id, id FROM public.catalogo_secciones;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS inspeccion_creada ON public.inspecciones;
CREATE TRIGGER inspeccion_creada AFTER INSERT ON public.inspecciones
  FOR EACH ROW EXECUTE FUNCTION public.inicializar_progreso();

-- El backend debe bloquear la cabecera ANTES de modificar secciones y comprobar
-- la version enviada por el cliente. Los triggers también serializan con el envío.
CREATE OR REPLACE FUNCTION public.bloquear_edicion(p_id uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM public.inspecciones WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inspección inexistente'; END IF;
  IF EXISTS (SELECT 1 FROM public.envios_dana
             WHERE inspeccion_id = p_id AND estado <> 'cancelado') THEN
    RAISE EXCEPTION 'Inspección congelada por un envío DANA';
  END IF;
END;
$$;

-- Guardar o modificar cualquier dato invalida la validación de esa sección.
CREATE OR REPLACE FUNCTION public.registrar_edicion() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_id uuid;
BEGIN
  v_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.inspeccion_id ELSE NEW.inspeccion_id END;
  -- Permitir borrado en cascada de una cabecera sin envíos.
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM public.inspecciones WHERE id = v_id) THEN
    RETURN OLD;
  END IF;
  -- El worker puede registrar el fileID recibido sin modificar las fotografías.
  IF TG_TABLE_NAME = 'archivos_inspeccion' AND TG_OP = 'UPDATE' THEN
    IF (to_jsonb(NEW) - 'dana_file_id') = (to_jsonb(OLD) - 'dana_file_id') THEN RETURN NEW; END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.inspeccion_id <> NEW.inspeccion_id THEN
    RAISE EXCEPTION 'No se permite mover datos entre inspecciones';
  END IF;
  PERFORM public.bloquear_edicion(v_id);
  UPDATE public.progreso_secciones
    SET estado = 'parcial', campos_no_aplican = '{}', motivo_no_aplica = NULL,
        version_reglas_validada = NULL, validada_por = NULL, validada_en = NULL
    WHERE inspeccion_id = v_id AND seccion_id = TG_ARGV[0]::smallint;
  UPDATE public.inspecciones SET version = version + 1, actualizada_en = now()
    WHERE id = v_id;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id, tabla FROM public.catalogo_secciones LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS datos_editados ON public.%I', r.tabla);
    EXECUTE format('CREATE TRIGGER datos_editados BEFORE INSERT OR UPDATE OR DELETE ON public.%I
      FOR EACH ROW EXECUTE FUNCTION public.registrar_edicion(%L)', r.tabla, r.id);
  END LOOP;
END;
$$;
DROP TRIGGER IF EXISTS archivos_editados ON public.archivos_inspeccion;
CREATE TRIGGER archivos_editados BEFORE INSERT OR UPDATE OR DELETE ON public.archivos_inspeccion
  FOR EACH ROW EXECUTE FUNCTION public.registrar_edicion('14');

-- Validación base en PostgreSQL; reglas condicionales y permisos pertenecen al backend.
-- Una sección sin reglas configuradas no puede marcarse completa.
CREATE OR REPLACE FUNCTION public.validar_progreso() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  r public.catalogo_secciones%ROWTYPE;
  datos jsonb;
  campo text;
  justificacion jsonb;
BEGIN
  PERFORM public.bloquear_edicion(NEW.inspeccion_id);
  IF TG_OP = 'UPDATE' AND (OLD.inspeccion_id <> NEW.inspeccion_id OR OLD.seccion_id <> NEW.seccion_id) THEN
    RAISE EXCEPTION 'No se permite mover el progreso';
  END IF;
  IF NEW.estado NOT IN ('completa', 'no_aplica') THEN RETURN NEW; END IF;
  SELECT * INTO STRICT r FROM public.catalogo_secciones WHERE id = NEW.seccion_id;
  IF r.campos_obligatorios IS NULL THEN
    RAISE EXCEPTION 'Falta configurar campos obligatorios de la sección %', r.id;
  END IF;
  IF NEW.version_reglas_validada IS DISTINCT FROM r.version_reglas THEN
    RAISE EXCEPTION 'Versión de reglas desactualizada en sección %', r.id;
  END IF;
  IF NEW.estado = 'no_aplica' THEN
    IF NOT r.permite_no_aplica THEN RAISE EXCEPTION 'Sección % no admite No aplica', r.id; END IF;
    RETURN NEW;
  END IF;
  EXECUTE format('SELECT to_jsonb(s) FROM public.%I s WHERE inspeccion_id = $1', r.tabla)
    INTO datos USING NEW.inspeccion_id;
  IF datos IS NULL THEN RAISE EXCEPTION 'Sección % sin datos', r.id; END IF;
  -- Las cinco categorías de fotos son campos del formulario, no columnas escalares.
  IF r.id = 14 THEN
    SELECT datos || coalesce(jsonb_object_agg(f.categoria, f.archivos), '{}'::jsonb)
      INTO datos FROM (
        SELECT categoria, jsonb_agg(storage_key ORDER BY creada_en, id) AS archivos
        FROM public.archivos_inspeccion WHERE inspeccion_id = NEW.inspeccion_id
        GROUP BY categoria
      ) f;
  END IF;
  FOR campo, justificacion IN SELECT key, value FROM jsonb_each(NEW.campos_no_aplican) LOOP
    IF NOT (datos ? campo) OR NOT (campo = ANY(r.campos_no_aplica_permitidos)) OR
       jsonb_typeof(justificacion) <> 'string' OR btrim(justificacion #>> '{}') = '' THEN
      RAISE EXCEPTION 'No aplica inválido en campo % de sección %', campo, r.id;
    END IF;
  END LOOP;
  FOREACH campo IN ARRAY r.campos_obligatorios LOOP
    IF NEW.campos_no_aplican ? campo THEN CONTINUE; END IF;
    IF NOT (datos ? campo) OR datos -> campo = 'null'::jsonb OR
       btrim(datos ->> campo) = '' OR datos -> campo IN ('[]'::jsonb, '{}'::jsonb) THEN
      RAISE EXCEPTION 'Campo obligatorio % pendiente en sección %', campo, r.id;
    END IF;
    IF jsonb_typeof(datos -> campo) = 'array' THEN
      IF EXISTS (SELECT 1 FROM jsonb_array_elements(datos -> campo) AS a(valor)
                 WHERE valor = 'null'::jsonb OR btrim(valor #>> '{}') = '') THEN
        RAISE EXCEPTION 'Campo obligatorio % contiene respuestas vacías en sección %', campo, r.id;
      END IF;
    END IF;
  END LOOP;
  IF r.id = 14 AND NOT EXISTS (
    SELECT 1 FROM public.archivos_inspeccion WHERE inspeccion_id = NEW.inspeccion_id
  ) THEN RAISE EXCEPTION 'Faltan fotografías'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS progreso_validado ON public.progreso_secciones;
CREATE TRIGGER progreso_validado BEFORE INSERT OR UPDATE ON public.progreso_secciones
  FOR EACH ROW EXECUTE FUNCTION public.validar_progreso();

CREATE OR REPLACE VIEW public.resumen_inspecciones AS
SELECT i.id, i.operador_id, i.version, i.creada_en, i.actualizada_en,
       count(*) FILTER (WHERE p.estado IN ('completa','no_aplica') AND
         p.version_reglas_validada = c.version_reglas AND c.campos_obligatorios IS NOT NULL)
         AS secciones_completas,
       count(*) = 15 AND bool_and(p.estado IN ('completa','no_aplica') AND
         p.version_reglas_validada IS NOT DISTINCT FROM c.version_reglas AND
         c.campos_obligatorios IS NOT NULL) AS lista_para_enviar
FROM public.inspecciones i
JOIN public.progreso_secciones p ON p.inspeccion_id = i.id
JOIN public.catalogo_secciones c ON c.id = p.seccion_id
GROUP BY i.id;

-- No acepta envíos prematuros, versiones viejas ni inserciones ya confirmadas.
CREATE OR REPLACE FUNCTION public.validar_encolado() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_version bigint;
BEGIN
  SELECT version INTO STRICT v_version FROM public.inspecciones
    WHERE id = NEW.inspeccion_id FOR UPDATE;
  IF NEW.estado <> 'pendiente' OR NEW.version_inspeccion <> v_version THEN
    RAISE EXCEPTION 'Estado o versión inválida para encolar';
  END IF;
  IF NOT coalesce((SELECT lista_para_enviar FROM public.resumen_inspecciones
                  WHERE id = NEW.inspeccion_id), false) THEN
    RAISE EXCEPTION 'Las 15 secciones deben estar completas o justificadas como No aplica';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS envio_validado ON public.envios_dana;
CREATE TRIGGER envio_validado BEFORE INSERT ON public.envios_dana
  FOR EACH ROW EXECUTE FUNCTION public.validar_encolado();

-- Congelar la identidad y el snapshot del envío durante los reintentos.
CREATE OR REPLACE FUNCTION public.conservar_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.estado IN ('confirmado','cancelado') AND NEW.estado <> OLD.estado THEN
    RAISE EXCEPTION 'Un envío finalizado no puede reactivarse';
  END IF;
  IF NEW.inspeccion_id <> OLD.inspeccion_id OR NEW.version_inspeccion <> OLD.version_inspeccion OR
     NEW.payload <> OLD.payload THEN RAISE EXCEPTION 'Snapshot de envío inmutable'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS snapshot_inmutable ON public.envios_dana;
CREATE TRIGGER snapshot_inmutable BEFORE UPDATE ON public.envios_dana
  FOR EACH ROW EXECUTE FUNCTION public.conservar_snapshot();
