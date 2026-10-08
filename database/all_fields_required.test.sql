-- Ejecutar en desarrollo después de 001 y 002. Todos los cambios se revierten.
BEGIN;
CREATE OR REPLACE FUNCTION pg_temp.expect_error(p_query text, p_message text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE mensaje text;
BEGIN
  BEGIN
    EXECUTE p_query;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS mensaje = MESSAGE_TEXT;
    IF mensaje NOT LIKE '%' || p_message || '%' THEN
      RAISE EXCEPTION 'Error inesperado: %', mensaje;
    END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'Se esperaba error: %', p_message;
END;
$$;
DO $$
DECLARE
  i uuid;
  r record;
  datos jsonb;
  esperados text[];
BEGIN
  IF (SELECT count(*) FROM public.catalogo_secciones) <> 15 THEN
    RAISE EXCEPTION 'Se requieren 15 secciones';
  END IF;
  FOR r IN SELECT * FROM public.catalogo_secciones LOOP
    IF r.permite_no_aplica OR cardinality(r.campos_no_aplica_permitidos) <> 0 THEN
      RAISE EXCEPTION 'No aplica debe estar deshabilitado en sección %', r.id;
    END IF;
    IF r.id = 14 THEN
      esperados := ARRAY['techos','pisos','paredes','externas','otros'];
    ELSE
      SELECT array_agg(attname::text ORDER BY attnum) INTO esperados
        FROM pg_attribute
        WHERE attrelid = format('public.%I', r.tabla)::regclass
          AND attnum > 0 AND NOT attisdropped AND attname <> 'inspeccion_id';
    END IF;
    IF r.campos_obligatorios IS NULL OR
       NOT (r.campos_obligatorios @> esperados AND r.campos_obligatorios <@ esperados) THEN
      RAISE EXCEPTION 'Faltan campos obligatorios en sección %', r.id;
    END IF;
  END LOOP;
  INSERT INTO public.inspecciones(operador_id) VALUES('operador-prueba') RETURNING id INTO i;
  FOR r IN SELECT * FROM public.catalogo_secciones LOOP
    -- Valores válidos por tipo: false y cero deben contar como respuestas.
    SELECT jsonb_build_object('inspeccion_id', i) || coalesce(jsonb_object_agg(attname,
      CASE
        WHEN atttypid = 'boolean'::regtype THEN 'false'::jsonb
        WHEN atttypid IN ('integer'::regtype, 'numeric'::regtype) THEN '0'::jsonb
        WHEN atttypid = 'date'::regtype THEN '"2026-10-08"'::jsonb
        WHEN atttypid = 'text[]'::regtype THEN '["Descripción nivel 1"]'::jsonb
        ELSE '"Respuesta de prueba"'::jsonb
      END), '{}'::jsonb)
      INTO datos FROM pg_attribute
      WHERE attrelid = format('public.%I', r.tabla)::regclass
        AND attnum > 0 AND NOT attisdropped AND attname <> 'inspeccion_id';
    EXECUTE format('INSERT INTO public.%I SELECT (jsonb_populate_record(NULL::public.%I, $1)).*',
      r.tabla, r.tabla) USING datos;
  END LOOP;
  INSERT INTO public.archivos_inspeccion(inspeccion_id,categoria,storage_key,nombre_original,mime_type,tamanio_bytes)
    SELECT i, categoria, 'test/' || categoria || '.jpg', categoria || '.jpg', 'image/jpeg', 100
    FROM unnest(ARRAY['techos','pisos','paredes','externas']) AS c(categoria);
  PERFORM pg_temp.expect_error(format(
    'UPDATE public.progreso_secciones SET estado=''completa'', version_reglas_validada=c.version_reglas,
     validada_por=''operador-prueba'', validada_en=now() FROM public.catalogo_secciones c
     WHERE inspeccion_id=%L AND seccion_id=14 AND c.id=14',i), 'otros pendiente');
  INSERT INTO public.archivos_inspeccion(inspeccion_id,categoria,storage_key,nombre_original,mime_type,tamanio_bytes)
    VALUES(i,'otros','test/otros.jpg','otros.jpg','image/jpeg',100);
  UPDATE public.progreso_secciones p SET estado='completa', version_reglas_validada=c.version_reglas,
    validada_por='operador-prueba', validada_en=now()
    FROM public.catalogo_secciones c WHERE p.inspeccion_id=i AND p.seccion_id=c.id;
  IF NOT (SELECT lista_para_enviar FROM public.resumen_inspecciones WHERE id=i) THEN
    RAISE EXCEPTION 'Formulario con todos los campos debe quedar listo';
  END IF;
  UPDATE public.datos_cliente SET sitio_web='   ' WHERE inspeccion_id=i;
  PERFORM pg_temp.expect_error(format(
    'UPDATE public.progreso_secciones SET estado=''completa'', version_reglas_validada=c.version_reglas,
     validada_por=''operador-prueba'', validada_en=now() FROM public.catalogo_secciones c
     WHERE inspeccion_id=%L AND seccion_id=1 AND c.id=1',i), 'sitio_web pendiente');
  UPDATE public.descripcion_edificio SET descripcion_por_niveles=ARRAY['Nivel 1',' ']
    WHERE inspeccion_id=i;
  PERFORM pg_temp.expect_error(format(
    'UPDATE public.progreso_secciones SET estado=''completa'', version_reglas_validada=c.version_reglas,
     validada_por=''operador-prueba'', validada_en=now() FROM public.catalogo_secciones c
     WHERE inspeccion_id=%L AND seccion_id=3 AND c.id=3',i), 'contiene respuestas vacías');
  PERFORM pg_temp.expect_error(format(
    'UPDATE public.progreso_secciones SET estado=''no_aplica'', motivo_no_aplica=''Prueba'',
     version_reglas_validada=c.version_reglas, validada_por=''operador-prueba'', validada_en=now()
     FROM public.catalogo_secciones c WHERE inspeccion_id=%L AND seccion_id=13 AND c.id=13',i),
    'no admite No aplica');
  IF (SELECT lista_para_enviar FROM public.resumen_inspecciones WHERE id=i) THEN
    RAISE EXCEPTION 'Un campo vacío debe bloquear el envío';
  END IF;
  RAISE NOTICE 'Pruebas de todos los campos obligatorios completadas';
END;
$$;
ROLLBACK;
