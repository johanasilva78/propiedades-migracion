-- Prueba de integración: ejecutar después de la migración, con ON_ERROR_STOP=1.
-- Todos los datos y cambios de configuración se revierten al finalizar.
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
  v bigint;
  trabajo uuid;
  n integer;
BEGIN
  -- Estado inicial independiente de la configuración existente; ROLLBACK lo restaura.
  UPDATE public.catalogo_secciones SET campos_obligatorios = NULL,
    campos_no_aplica_permitidos = '{}', permite_no_aplica = false, version_reglas = 1;
  INSERT INTO public.inspecciones(operador_id) VALUES ('operador-prueba') RETURNING id INTO i;
  SELECT count(*) INTO n FROM public.progreso_secciones WHERE inspeccion_id = i;
  IF n <> 15 THEN RAISE EXCEPTION 'No se inicializaron las 15 secciones'; END IF;
  INSERT INTO public.datos_cliente(inspeccion_id, nombre_riesgo) VALUES (i, 'Borrador');
  IF (SELECT lista_para_enviar FROM public.resumen_inspecciones WHERE id = i) THEN
    RAISE EXCEPTION 'Un borrador parcial no debe estar listo';
  END IF;
  PERFORM pg_temp.expect_error(format(
    'INSERT INTO public.envios_dana(inspeccion_id,version_inspeccion,payload)
     SELECT id,version,''{}''::jsonb FROM public.inspecciones WHERE id=%L', i),
    '15 secciones');
  PERFORM pg_temp.expect_error(format(
    'UPDATE public.progreso_secciones SET estado=''completa'', version_reglas_validada=1,
     validada_por=''operador-prueba'', validada_en=now() WHERE inspeccion_id=%L AND seccion_id=1', i),
    'Falta configurar');

  -- Fixture mínimo; NO configura requisitos reales de negocio.
  UPDATE public.catalogo_secciones SET campos_obligatorios = '{}';
  UPDATE public.catalogo_secciones SET campos_obligatorios = ARRAY['nombre_riesgo','email'],
    campos_no_aplica_permitidos = ARRAY['email'] WHERE id = 1;
  PERFORM pg_temp.expect_error(format(
    'UPDATE public.progreso_secciones SET estado=''completa'', version_reglas_validada=1,
     validada_por=''operador-prueba'', validada_en=now() WHERE inspeccion_id=%L AND seccion_id=1', i),
    'email pendiente');
  UPDATE public.progreso_secciones SET estado = 'completa', version_reglas_validada = 1,
    validada_por = 'operador-prueba', validada_en = now(),
    campos_no_aplican = '{"email":"Cliente sin correo"}'
    WHERE inspeccion_id = i AND seccion_id = 1;
  UPDATE public.datos_cliente SET nombre_riesgo = 'Borrador editado' WHERE inspeccion_id = i;
  IF (SELECT estado FROM public.progreso_secciones WHERE inspeccion_id = i AND seccion_id = 1) <> 'parcial' THEN
    RAISE EXCEPTION 'La edición no invalidó la sección';
  END IF;
  UPDATE public.datos_cliente SET email = 'cliente@example.test' WHERE inspeccion_id = i;
  FOR r IN SELECT * FROM public.catalogo_secciones WHERE id > 1 LOOP
    EXECUTE format('INSERT INTO public.%I(inspeccion_id) VALUES ($1)', r.tabla) USING i;
  END LOOP;

  -- Cero y false deben aceptarse; NULL debe seguir pendiente.
  UPDATE public.catalogo_secciones SET campos_obligatorios = ARRAY['diseno_antisismico','pisos'] WHERE id = 3;
  UPDATE public.descripcion_edificio SET diseno_antisismico = false, pisos = 0 WHERE inspeccion_id = i;
  PERFORM pg_temp.expect_error(format(
    'UPDATE public.progreso_secciones SET estado=''completa'', version_reglas_validada=1,
     validada_por=''operador-prueba'', validada_en=now() WHERE inspeccion_id=%L AND seccion_id=14', i),
    'Faltan fotografías');
  INSERT INTO public.archivos_inspeccion(inspeccion_id,categoria,storage_key,nombre_original,mime_type,tamanio_bytes)
    VALUES (i,'techos','test/techo.jpg','techo.jpg','image/jpeg',100);
  PERFORM pg_temp.expect_error(format(
    'UPDATE public.progreso_secciones SET estado=''no_aplica'', motivo_no_aplica=''Sin equipos'',
     version_reglas_validada=1, validada_por=''operador-prueba'', validada_en=now()
     WHERE inspeccion_id=%L AND seccion_id=13', i), 'no admite No aplica');
  UPDATE public.catalogo_secciones SET permite_no_aplica = true WHERE id = 13;
  UPDATE public.progreso_secciones SET estado = 'completa', version_reglas_validada = 1,
    validada_por = 'operador-prueba', validada_en = now() WHERE inspeccion_id = i;
  UPDATE public.progreso_secciones SET estado = 'no_aplica', motivo_no_aplica = 'Sin equipos'
    WHERE inspeccion_id = i AND seccion_id = 13;
  IF NOT (SELECT lista_para_enviar FROM public.resumen_inspecciones WHERE id = i) THEN
    RAISE EXCEPTION 'Formulario completo no está listo';
  END IF;
  UPDATE public.catalogo_secciones SET version_reglas = 2 WHERE id = 2;
  IF (SELECT lista_para_enviar FROM public.resumen_inspecciones WHERE id = i) THEN
    RAISE EXCEPTION 'Reglas nuevas deben invalidar completitud anterior';
  END IF;
  UPDATE public.progreso_secciones SET version_reglas_validada = 2
    WHERE inspeccion_id = i AND seccion_id = 2;
  SELECT version INTO v FROM public.inspecciones WHERE id = i;
  PERFORM pg_temp.expect_error(format(
    'INSERT INTO public.envios_dana(inspeccion_id,version_inspeccion,payload) VALUES (%L,%s,''{}'')',i,v-1),
    'versión inválida');
  INSERT INTO public.envios_dana(inspeccion_id,version_inspeccion,payload)
    VALUES(i,v,'{"FORM_DATA":{"nombreRiesgo":"Borrador editado"}}') RETURNING id INTO trabajo;
  PERFORM pg_temp.expect_error(format(
    'INSERT INTO public.envios_dana(inspeccion_id,version_inspeccion,payload) VALUES (%L,%s,''{}'')',i,v),
    'duplicate key');
  PERFORM pg_temp.expect_error(format(
    'UPDATE public.datos_cliente SET propietario=''Cambio tardío'' WHERE inspeccion_id=%L',i),
    'congelada');
  PERFORM pg_temp.expect_error(format(
    'UPDATE public.envios_dana SET payload=''{}'' WHERE id=%L',trabajo), 'inmutable');
  UPDATE public.archivos_inspeccion SET dana_file_id = 'file-id-prueba' WHERE inspeccion_id = i;
  IF (SELECT version FROM public.inspecciones WHERE id = i) <> v THEN
    RAISE EXCEPTION 'Guardar fileID no debe cambiar versión';
  END IF;
  UPDATE public.envios_dana SET estado = 'incierto', ultimo_error = 'Timeout' WHERE id = trabajo;
  PERFORM pg_temp.expect_error(format(
    'UPDATE public.progreso_secciones SET estado=''parcial'' WHERE inspeccion_id=%L AND seccion_id=1',i),
    'congelada');

  -- Comprobar cascada de un borrador que nunca se envió.
  INSERT INTO public.inspecciones(operador_id) VALUES ('operador-prueba') RETURNING id INTO i;
  INSERT INTO public.datos_cliente(inspeccion_id) VALUES(i);
  DELETE FROM public.inspecciones WHERE id = i;
  IF EXISTS (SELECT 1 FROM public.datos_cliente WHERE inspeccion_id = i) THEN
    RAISE EXCEPTION 'La cascada no borró los datos';
  END IF;
  RAISE NOTICE 'Pruebas de parciales y encolado completadas';
END;
$$;
ROLLBACK;
