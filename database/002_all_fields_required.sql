-- Ejecutar después de 001 en la misma base de datos; compatible con la Lambda.
-- La conexión controla commit/rollback; para psql usar -1 -v ON_ERROR_STOP=1.
-- Todos los campos del formulario son obligatorios para completar una sección.
-- Guardar parciales sigue permitido: NO se agrega NOT NULL a los datos.
-- Repetir esta migración conserva version_reglas si la política ya coincide.
WITH requisitos(seccion_id, campos_obligatorios) AS (
  VALUES
    (1, ARRAY['nombre_riesgo', 'propietario', 'rnc', 'poliza', 'tipo_riesgo', 'ubicacion_inspeccionada', 'intermediario', 'entrevistado', 'telefono', 'celular', 'email', 'sitio_web', 'edad_riesgo', 'movimiento_comercial', 'org_contable', 'entidad_publica', 'techo_construccion', 'paredes_construccion', 'niveles', 'empleados', 'horario', 'aseguradora_anterior', 'inspeccionado_por', 'fecha_inspeccion', 'zip', 'tipo_construccion', 'tipo_construccion_resultado']::text[]),
    (2, ARRAY['edificacion_rd', 'edificacion_usd', 'mobiliario_rd', 'mobiliario_usd', 'maquinaria_rd', 'maquinaria_usd', 'existencia_rd', 'existencia_usd', 'bienes_especificos_rd', 'bienes_especificos_usd', 'bienes_especificos_detalle', 'otros_bienes_detalle', 'otros_bienes_rd', 'otros_bienes_usd', 'valor_total_rd', 'valor_total_usd']::text[]),
    (3, ARRAY['descripcion_general', 'descripcion_por_niveles', 'observaciones_edificio', 'anio_construccion', 'fecha_ultima_remodelacion', 'pisos', 'mts_por_piso', 'aptos_por_piso', 'mts_construccion', 'diseno_antisismico', 'construccion_unica', 'construccion_separada', 'predio', 'sindicato', 'descripcion_por_nivel']::text[]),
    (4, ARRAY['colindancia_norte', 'distancia_colindancia_norte', 'colindancia_sur', 'distancia_colindancia_sur', 'colindancia_este', 'distancia_colindancia_este', 'colindancia_oeste', 'distancia_colindancia_oeste', 'colindancias_no_agravan', 'colindancias_agravan', 'colindancias_observaciones']::text[]),
    (5, ARRAY['calle', 'sector', 'municipio', 'provincia', 'manzana', 'edificio', 'piso', 'apartamento', 'residencial', 'longitud', 'latitud', 'nivel_mar', 'distancia_agua', 'imagen_riesgo']::text[]),
    (6, ARRAY['historial_perdidas']::text[]),
    (7, ARRAY['siniestralidad', 'siniestralidad_notas']::text[]),
    (8, ARRAY['descripcion_procesos', 'manejo_inventario']::text[]),
    (9, ARRAY['combustibles', 'carga_combustible', 'instalaciones_electricas', 'orden_limpieza', 'dentro_riesgo', 'fuera_riesgo', 'pasillos_libres', 'procedencia_energetica', 'generadores', 'transformador', 'subestacion', 'puesta_tierra', 'pararrayos', 'calderas', 'aire_comprimido', 'peligros_otros']::text[]),
    (10, ARRAY['extintores_cantidad', 'agente_extintor', 'bombas_incendio', 'bombas_agua', 'suministro_agua', 'almacen_agua', 'mangueras_incendio', 'prevencion_otros']::text[]),
    (11, ARRAY['camaras_cantidad', 'camaras_tipo', 'camaras_duracion', 'vigilantes_cantidad', 'vigilantes_subcontratados', 'vigilantes_armas', 'senalizacion_rutas', 'simulacros', 'simulacros_periodicidad', 'simulacros_fecha_ultima']::text[]),
    (12, ARRAY['mpl', 'eml']::text[]),
    (13, ARRAY['servicios_aux_cantidad', 'servicios_aux_tipo', 'servicios_aux_marca', 'servicios_aux_modelo', 'servicios_aux_serie', 'servicios_aux_anio', 'servicios_aux_horas', 'servicios_aux_capacidad']::text[]),
    (14, ARRAY['techos', 'pisos', 'paredes', 'externas', 'otros']::text[]),
    (15, ARRAY['conclusiones_inspector']::text[])
)
UPDATE public.catalogo_secciones AS c
SET campos_obligatorios = r.campos_obligatorios,
    campos_no_aplica_permitidos = '{}',
    permite_no_aplica = false,
    version_reglas = c.version_reglas + 1
FROM requisitos AS r
WHERE c.id = r.seccion_id
  AND (c.campos_obligatorios IS DISTINCT FROM r.campos_obligatorios
       OR c.campos_no_aplica_permitidos IS DISTINCT FROM '{}'::text[]
       OR c.permite_no_aplica IS DISTINCT FROM false);

-- Actualizar también el validador en las bases donde 001 ya se ejecutó.
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
