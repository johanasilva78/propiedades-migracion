"""HTTP API de borradores. Handler: lambda_function.lambda_handler."""
import base64
import binascii
import datetime as dt
import decimal
import hashlib
import json
import logging
import os
from pathlib import Path
import re
import ssl
import socket
import uuid
import urllib.request
import urllib.error

ROOT = Path(__file__).parent
SECTIONS = json.loads((ROOT / "section-fields.json").read_text())
TYPES = json.loads((ROOT / "field-types.json").read_text())
CATEGORIES = SECTIONS["14"]["requiredPhotoCategories"]
LOG = logging.getLogger(__name__)


class ApiError(Exception):
    def __init__(self, status, message, **details):
        super().__init__(message)
        self.status, self.details = status, details


def encode(value):
    if isinstance(value, (dt.date, dt.datetime, uuid.UUID, decimal.Decimal)):
        return str(value)
    raise TypeError(type(value).__name__)


def error_diagnostic(error, stage):
    """Solo categorías y SQLSTATE; nunca mensajes que puedan contener secretos."""
    chain, seen = [], set()
    current = error
    while current is not None and id(current) not in seen and len(chain) < 8:
        seen.add(id(current))
        chain.append(current)
        current = current.__cause__ or current.__context__
    details = error.args[0] if error.args and isinstance(error.args[0], dict) else {}
    sqlstate = details.get("C")
    if not isinstance(sqlstate, str) or not re.fullmatch(r"[A-Z0-9]{5}", sqlstate):
        sqlstate = None
    code = "DATABASE_ERROR" if sqlstate else "OPERATION_ERROR"
    if any(isinstance(e, TimeoutError) for e in chain):
        code = "NETWORK_TIMEOUT"
    elif any(isinstance(e, socket.gaierror) for e in chain):
        code = "DNS_ERROR"
    elif any(isinstance(e, ConnectionRefusedError) for e in chain):
        code = "CONNECTION_REFUSED"
    elif any(isinstance(e, ssl.SSLError) for e in chain):
        code = "SSL_ERROR"
    elif isinstance(error, KeyError) and stage == "db_connect":
        code = "DB_CONFIG_MISSING"
    elif type(error).__name__ == "InterfaceError":
        code = "DATABASE_INTERFACE_ERROR"
    return {"code": code, "stage": stage, "sqlstate": sqlstate,
            "causes": [type(e).__name__ for e in chain]}


def response(status, data, origin):
    headers = {"Content-Type": "application/json", "Cache-Control": "no-store"}
    allowed = [s.strip() for s in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")]
    if origin in allowed:
        headers.update({"Access-Control-Allow-Origin": origin, "Vary": "Origin",
                        "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Operator-Id",
                        "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS"})
    return {"statusCode": status, "headers": headers,
            "body": json.dumps(data, default=encode, ensure_ascii=False)}


def operator(event, headers):
    authorizer = event.get("requestContext", {}).get("authorizer", {})
    claims = authorizer.get("jwt", {}).get("claims") or authorizer.get("claims") or {}
    identity = claims.get("sub")
    if not identity and os.getenv("ALLOW_TEST_OPERATOR", "false").lower() == "true":
        identity = headers.get("x-operator-id", "").strip()
    if not isinstance(identity, str) or not identity.strip() or len(identity) > 128:
        raise ApiError(401, "Identifica al operador antes de consultar o guardar borradores.")
    return identity


def connect():
    import pg8000.dbapi
    options = {}
    mode = os.getenv("DB_SSLMODE", "prefer")
    if mode in ("require", "verify-full"):
        context = ssl.create_default_context(cafile=os.getenv("DB_SSL_CA_FILE") or None)
        if mode == "require":
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
        options["ssl_context"] = context
    elif mode == "disable":
        options["ssl_context"] = False
    elif mode != "prefer":
        raise ApiError(503, "DB_SSLMODE no está configurado correctamente.")
    connection = pg8000.dbapi.connect(
        host=os.environ["DB_HOST"], port=int(os.getenv("DB_PORT", "5432")),
        database=os.environ["DB_NAME"], user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"], timeout=15, **options,
    )
    connection.autocommit = False
    return connection


def rows(cursor):
    names = [c[0] for c in cursor.description]
    return [dict(zip(names, row)) for row in cursor.fetchall()]


def json_value(value):
    return json.loads(value, parse_float=decimal.Decimal) if isinstance(value, str) else value


def normalise(field, value):
    kind = TYPES[field]
    if value is None or (isinstance(value, str) and not value.strip()):
        return None
    try:
        if kind == "boolean":
            if not isinstance(value, bool):
                raise ValueError()
            return value
        if kind == "integer":
            if isinstance(value, bool) or not re.fullmatch(r"[+-]?\d+", str(value).strip()):
                raise ValueError()
            result = int(value)
            if not -(2 ** 31) <= result < 2 ** 31:
                raise ValueError()
            return result
        if kind == "numeric":
            if isinstance(value, bool):
                raise ValueError()
            result = decimal.Decimal(str(value).strip())
            if not result.is_finite():
                raise ValueError()
            return result
        if kind == "date":
            if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
                raise ValueError()
            return dt.date.fromisoformat(value)
        if kind == "text[]":
            if not isinstance(value, list) or len(value) > 250 or any(not isinstance(v, str) for v in value):
                raise ValueError()
            return [v.strip() for v in value]
        if not isinstance(value, str) or len(value) > 50000:
            raise ValueError()
        return value.strip()
    except (ValueError, TypeError, decimal.InvalidOperation):
        raise ApiError(422, "Hay un valor con formato inválido.", invalidFields=[field]) from None


def valid_fields(fields, section=None):
    if not isinstance(fields, dict):
        raise ApiError(422, "Los datos del formulario deben ser un objeto.")
    allowed = SECTIONS[section]["fields"] if section else TYPES
    unknown = sorted(set(fields) - set(allowed))
    if unknown:
        raise ApiError(422, "Se recibieron campos desconocidos.", invalidFields=unknown)
    return {f: normalise(f, v) for f, v in fields.items()}


def valid_photos(photos):
    if photos is None:
        return None
    if not isinstance(photos, dict) or set(photos) != set(CATEGORIES):
        raise ApiError(422, "Incluye las cinco categorías al guardar fotografías.")
    result, ids = {}, set()
    total = 0
    for kind, items in photos.items():
        if not isinstance(items, list) or len(items) > 50:
            raise ApiError(422, "Lista de fotografías inválida.")
        result[kind] = []
        for photo in items:
            if not isinstance(photo, dict):
                raise ApiError(422, "Fotografía inválida.")
            if photo.get("id"):
                try:
                    photo_id = str(uuid.UUID(photo["id"]))
                except (ValueError, TypeError, AttributeError):
                    raise ApiError(422, "Identificador de fotografía inválido.") from None
                if photo_id in ids:
                    raise ApiError(422, "La fotografía está repetida.")
                ids.add(photo_id)
                result[kind].append({"id": photo_id})
                continue
            match = re.fullmatch(r"data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)", str(photo.get("dataUrl", "")))
            if not match:
                raise ApiError(422, "Usa imágenes JPEG, PNG o WebP.")
            try:
                content = base64.b64decode(match[2], validate=True)
            except binascii.Error:
                raise ApiError(422, "Fotografía codificada incorrectamente.") from None
            total += len(content)
            if not content or total > 3 * 1024 * 1024:
                raise ApiError(413, "Guarda las fotografías por grupos de hasta 3 MB.")
            result[kind].append({"content": content, "mime": match[1],
                                 "name": str(photo.get("name") or f"{kind}.jpg")[:255]})
    return result


def upload_to_dana(photo):
    user = os.environ.get("DANA_USER")
    password = os.environ.get("DANA_PASSWORD")
    company = os.environ.get("DANA_EMPRESA")
    if not all((user, password, company)):
        raise ApiError(503, "Configura las credenciales de Fileupload de DANA en Lambda.")
    endpoint = os.getenv("DANA_UPLOAD_URL", "https://appserv.danaconnect.com/dana/conversation/http/rest/file/upload")
    if not endpoint.startswith("https://"):
        raise ApiError(503, "Fileupload de DANA requiere un endpoint HTTPS.")
    boundary = "draft-" + uuid.uuid4().hex
    name = re.sub(r'[\r\n"\\]', "_", photo["name"])
    payload = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\n'
               f'Content-Type: {photo["mime"]}\r\n\r\n').encode() + photo["content"] + f"\r\n--{boundary}--\r\n".encode()
    identity = user if "@" in user else f"{user}@{company}"
    auth = base64.b64encode(f"{identity}:{password}".encode()).decode()
    request = urllib.request.Request(endpoint, data=payload, method="POST", headers={
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "Authorization": "Basic " + auth, "X-Empresa": company,
    })
    try:
        with urllib.request.urlopen(request, timeout=20) as result:
            text = result.read(1024 * 1024).decode("utf-8", errors="replace")
    except (urllib.error.URLError, TimeoutError):
        raise ApiError(502, "No se pudo confirmar la carga de la fotografía en DANA. Los datos no se han guardado.") from None
    def find_file_id(value):
        if isinstance(value, dict):
            for key, item in value.items():
                if key.lower() in ("fileid", "id") and isinstance(item, (str, int)) and str(item).strip():
                    return str(item)
            for item in value.values():
                found = find_file_id(item)
                if found:
                    return found
        if isinstance(value, list):
            for item in value:
                found = find_file_id(item)
                if found:
                    return found
        return None
    try:
        file_id = find_file_id(json.loads(text))
    except ValueError:
        file_id = None
    if not file_id:
        match = re.search(r"<fileID>([^<]+)</fileID>", text, re.I)
        file_id = match[1].strip() if match else None
    if not file_id:
        raise ApiError(502, "DANA no devolvió un identificador de archivo. La fotografía no se ha guardado.")
    return file_id


def load_inspection(cursor, inspection_id, identity, lock=False):
    cursor.execute("SELECT id, version FROM public.inspecciones WHERE id=%s AND operador_id=%s"
                   + (" FOR UPDATE" if lock else ""), (inspection_id, identity))
    record = cursor.fetchone()
    if not record:
        raise ApiError(404, "No se encontró un borrador de este operador con ese ID.")
    return record


def document(cursor, inspection_id, identity):
    load_inspection(cursor, inspection_id, identity)
    cursor.execute("SELECT * FROM public.resumen_inspecciones WHERE id=%s", (inspection_id,))
    summary = rows(cursor)[0]
    form = {}
    for section in SECTIONS.values():
        cursor.execute(f'SELECT to_jsonb(s)::text FROM public.{section["table"]} s WHERE inspeccion_id=%s', (inspection_id,))
        row = cursor.fetchone()
        data = json_value(row[0]) if row else {}
        form.update({field: data.get(col) for field, col in section["fields"].items()})
    cursor.execute("SELECT p.seccion_id, p.estado, c.nombre, c.campos_obligatorios FROM public.progreso_secciones p "
                   "JOIN public.catalogo_secciones c ON c.id=p.seccion_id WHERE inspeccion_id=%s ORDER BY seccion_id", (inspection_id,))
    progress = rows(cursor)
    cursor.execute("SELECT id, categoria, dana_file_id, nombre_original FROM public.archivos_inspeccion "
                   "WHERE inspeccion_id=%s ORDER BY creada_en,id", (inspection_id,))
    photos = {kind: [] for kind in CATEGORIES}
    files = rows(cursor)
    for photo in files:
        photos[photo["categoria"]].append({"id": str(photo["id"]), "name": photo["nombre_original"],
                                          "fileId": photo["dana_file_id"]})
    for state in progress:
        field_map = SECTIONS[str(state["seccion_id"])]["fields"]
        missing = []
        for col in state.pop("campos_obligatorios") or []:
            if state["seccion_id"] == 14 and col in CATEGORIES:
                if not photos[col]:
                    missing.append(col)
            else:
                field = next((f for f, c in field_map.items() if c == col), col)
                if empty(form.get(field)):
                    missing.append(field)
        state["missingFields"] = missing
    cursor.execute("SELECT id, estado, ultimo_error FROM public.envios_dana WHERE inspeccion_id=%s "
                   "AND estado <> 'cancelado' ORDER BY creada_en DESC LIMIT 1", (inspection_id,))
    jobs = rows(cursor)
    return {"id": str(summary["id"]), "version": summary["version"], "operatorId": identity,
            "form": form, "photos": photos, "sections": progress,
            "completedSections": summary["secciones_completas"], "ready": summary["lista_para_enviar"],
            "dana": jobs[0] if jobs else None}


def empty(value):
    return value is None or (isinstance(value, str) and not value.strip()) or (
        isinstance(value, list) and (not value or any(empty(v) for v in value)))


def store_fields(cursor, inspection_id, values):
    for section in SECTIONS.values():
        pairs = [(col, values[f]) for f, col in section["fields"].items() if f in values]
        if not pairs:
            continue
        table = section["table"]
        cols = [col for col, _ in pairs]
        cursor.execute(f'SELECT {",".join(cols)} FROM public.{table} WHERE inspeccion_id=%s', (inspection_id,))
        old = cursor.fetchone()
        proposed = tuple(v for _, v in pairs)
        if (old is not None and tuple(old) == proposed) or (old is None and all(v is None for v in proposed)):
            continue
        setters = ",".join(f'{col}=EXCLUDED.{col}' for col in cols)
        different = " OR ".join(f'{table}.{col} IS DISTINCT FROM EXCLUDED.{col}' for col in cols)
        cursor.execute(f'INSERT INTO public.{table}(inspeccion_id,{",".join(cols)}) '
                       f'VALUES({",".join(["%s"] * (len(cols) + 1))}) '
                       f'ON CONFLICT(inspeccion_id) DO UPDATE SET {setters} WHERE {different}',
                       (inspection_id, *(v for _, v in pairs)))


def store_photos(cursor, inspection_id, photos):
    if photos is None:
        return
    cursor.execute("SELECT id,categoria,storage_key FROM public.archivos_inspeccion WHERE inspeccion_id=%s", (inspection_id,))
    existing = {str(row["id"]): row for row in rows(cursor)}
    retained = set()
    for kind, items in photos.items():
        for photo in items:
            if "id" in photo:
                old = existing.get(photo["id"])
                if not old or old["categoria"] != kind:
                    raise ApiError(422, "La fotografía no pertenece a este borrador o categoría.")
                retained.add(photo["id"])
    if retained == set(existing) and not any("content" in p for ps in photos.values() for p in ps):
        return
    cursor.execute("SELECT 1 FROM public.fotografias WHERE inspeccion_id=%s", (inspection_id,))
    if not cursor.fetchone():
        cursor.execute("INSERT INTO public.fotografias(inspeccion_id) VALUES(%s)", (inspection_id,))
    for kind, items in photos.items():
        for photo in items:
            if "content" not in photo:
                continue
            photo_id = str(uuid.uuid4())
            file_id = upload_to_dana(photo)
            key = "dana:" + file_id
            cursor.execute("INSERT INTO public.archivos_inspeccion(id,inspeccion_id,categoria,storage_key,"
                           "nombre_original,mime_type,tamanio_bytes,sha256,dana_file_id) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                           (photo_id, inspection_id, kind, key, photo["name"], photo["mime"], len(photo["content"]),
                            hashlib.sha256(photo["content"]).hexdigest(), file_id))
    for photo_id, photo in existing.items():
        if photo_id not in retained:
            cursor.execute("DELETE FROM public.archivos_inspeccion WHERE id=%s AND inspeccion_id=%s", (photo_id, inspection_id))


def validate_sections(cursor, inspection_id, identity):
    cursor.execute("SELECT id,tabla,campos_obligatorios,version_reglas FROM public.catalogo_secciones ORDER BY id")
    for rule in rows(cursor):
        cursor.execute(f'SELECT to_jsonb(s)::text FROM public.{rule["tabla"]} s WHERE inspeccion_id=%s', (inspection_id,))
        row = cursor.fetchone()
        data = json_value(row[0]) if row else None
        if data is None:
            continue
        if rule["id"] == 14:
            cursor.execute("SELECT categoria,count(*) FROM public.archivos_inspeccion WHERE inspeccion_id=%s GROUP BY categoria", (inspection_id,))
            data.update({category: count for category, count in cursor.fetchall()})
        required = rule["campos_obligatorios"]
        complete = required is not None and all(not empty(data.get(field)) for field in required)
        cursor.execute("UPDATE public.progreso_secciones SET estado=%s, version_reglas_validada=%s, "
                       "validada_por=%s, validada_en=%s WHERE inspeccion_id=%s AND seccion_id=%s",
                       ("completa" if complete else "parcial", rule["version_reglas"] if complete else None,
                        identity if complete else None, dt.datetime.now(dt.timezone.utc) if complete else None,
                        inspection_id, rule["id"]))


def lambda_handler(event, context):
    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    origin = headers.get("origin", "")
    method = event.get("requestContext", {}).get("http", {}).get("method") or event.get("httpMethod", "")
    path = (event.get("rawPath") or event.get("path") or "").rstrip("/")
    prefix = os.getenv("API_PATH_PREFIX", "").rstrip("/")
    if prefix and path.startswith(prefix + "/"):
        path = path[len(prefix):]
    if method == "OPTIONS":
        return response(204, {}, origin)
    connection = cursor = None
    committed = False
    stage = "request"
    try:
        raw = event.get("body") or "{}"
        if len(raw) > 4_500_000:
            raise ApiError(413, "Guarda las fotografías en grupos más pequeños.")
        try:
            if event.get("isBase64Encoded"):
                raw = base64.b64decode(raw, validate=True).decode()
            body = json.loads(raw)
        except (ValueError, TypeError, UnicodeError, binascii.Error):
            raise ApiError(400, "El cuerpo de la solicitud no es JSON válido.") from None
        if not isinstance(body, dict):
            raise ApiError(400, "El cuerpo de la solicitud debe ser un objeto.")
        identity = operator(event, headers) if path != "/ping" else None
        match = re.fullmatch(r"/api/inspections/([0-9a-fA-F-]{36})(?:/sections/(\d+))?", path)
        inspection_id = section_id = None
        if match:
            try:
                inspection_id = str(uuid.UUID(match[1]))
            except ValueError:
                raise ApiError(422, "ID de borrador inválido.") from None
            section_id = match[2]
            if section_id and section_id not in SECTIONS:
                raise ApiError(404, "Sección inexistente.")
        stage = "db_connect"
        connection = connect()
        stage = "db_session"
        cursor = connection.cursor()
        cursor.execute("SET LOCAL statement_timeout = '10s'")
        cursor.execute("SET LOCAL lock_timeout = '3s'")
        stage = "db_operation"
        if method == "GET" and path == "/ping":
            cursor.execute("SELECT 1")
            data = {"message": "PostgreSQL disponible", "source": "postgres", "timestamp": dt.datetime.now(dt.timezone.utc).isoformat()}
        elif path == "/api/inspections" and method == "GET":
            query = event.get("queryStringParameters") or {}
            try:
                offset = max(0, int(query.get("offset") or "0"))
            except ValueError:
                raise ApiError(422, "Paginación inválida.") from None
            cursor.execute("SELECT r.id,r.version,r.actualizada_en,r.secciones_completas,r.lista_para_enviar,"
                           "coalesce(d.nombre_riesgo,d.propietario,'Sin nombre') AS nombre,"
                           "(SELECT estado FROM public.envios_dana e WHERE e.inspeccion_id=r.id AND estado <> 'cancelado' LIMIT 1) AS dana_status "
                           "FROM public.resumen_inspecciones r LEFT JOIN public.datos_cliente d ON d.inspeccion_id=r.id "
                           "WHERE operador_id=%s ORDER BY actualizada_en DESC,id DESC LIMIT 51 OFFSET %s", (identity, offset))
            found = rows(cursor)
            data = {"inspections": found[:50], "nextOffset": offset + 50 if len(found) > 50 else None}
        elif path == "/api/inspections" and method == "POST":
            cursor.execute("INSERT INTO public.inspecciones(operador_id) VALUES(%s) RETURNING id", (identity,))
            inspection_id = str(cursor.fetchone()[0])
            data = document(cursor, inspection_id, identity)
        elif match and not section_id and method == "GET":
            # Mantener una fotografía coherente de datos/version/progreso durante la lectura.
            load_inspection(cursor, inspection_id, identity, lock=True)
            data = document(cursor, inspection_id, identity)
        elif match and method == "PATCH":
            version = body.get("expectedVersion")
            if isinstance(version, bool) or not isinstance(version, int) or version < 0:
                raise ApiError(422, "Incluye la versión del borrador que estás editando.")
            values = valid_fields(body.get("fields", {}), section_id)
            if section_id and section_id != "14" and "photos" in body:
                raise ApiError(422, "Guarda las fotografías en su sección.")
            photos = valid_photos(body.get("photos"))
            _, current = load_inspection(cursor, inspection_id, identity, lock=True)
            if current != version:
                raise ApiError(409, "Otro guardado actualizó el borrador. Recárgalo antes de guardar.", currentVersion=current)
            cursor.execute("SELECT id FROM public.envios_dana WHERE inspeccion_id=%s AND estado <> 'cancelado'", (inspection_id,))
            if cursor.fetchone():
                raise ApiError(409, "El borrador tiene un envío a DANA y no admite modificaciones.")
            store_fields(cursor, inspection_id, values)
            store_photos(cursor, inspection_id, photos)
            validate_sections(cursor, inspection_id, identity)
            data = document(cursor, inspection_id, identity)
            data["saved"] = True
            # Primera etapa: guardar/revalidar. No se inicia ninguna conversación DANA.
        else:
            raise ApiError(404, "Ruta inexistente.")
        stage = "db_commit"
        connection.commit()
        committed = True
        return response(201 if method == "POST" else 200, data, origin)
    except ApiError as error:
        return response(error.status, {"error": str(error), **error.details}, origin)
    except Exception as error:
        # Evitar devolver/loguear credenciales o mensajes SQL con datos del formulario.
        diagnostic = error_diagnostic(error, stage)
        request_id = getattr(context, "aws_request_id", "local")
        LOG.error("Error en borradores (%s), requestId=%s, stage=%s, diagnostic=%s, sqlstate=%s, causes=%s",
                  type(error).__name__, request_id, stage, diagnostic["code"],
                  diagnostic["sqlstate"], ">".join(diagnostic["causes"]))
        details = error.args[0] if error.args and isinstance(error.args[0], dict) else {}
        if details.get("C") in ("22003", "22007", "22P02"):
            return response(422, {"error": "Hay un valor fuera de rango o con formato inválido."}, origin)
        return response(503, {"error": "No se pudo completar la operación. El borrador no se ha confirmado.",
                              "diagnostic": diagnostic, "requestId": request_id}, origin)
    finally:
        if connection and not committed:
            try:
                connection.rollback()
            except Exception:
                LOG.warning("No se pudo confirmar el rollback de la conexión.")
        try:
            if cursor:
                cursor.close()
            if connection:
                connection.close()
        except Exception:
            LOG.warning("No se pudo cerrar completamente la conexión.")
