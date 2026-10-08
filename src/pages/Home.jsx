import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Card, Divider, Text, Textarea, TextInput, Title } from '@tremor/react';
import { usePing } from '../hooks/usePing';
import { createInspection, listInspections, getInspection, saveInspection } from '../services/apiClient';
import sectionFields from '../../database/section-fields.json';

const initialForm = {
  nombreRiesgo: '',
  propietario: '',
  rnc: '',
  poliza: '',
  tipoRiesgo: '',
  ubicacionInspeccionada: '',
  intermediario: '',
  entrevistado: '',
  telefono: '',
  celular: '',
  email: '',
  sitioWeb: '',
  edadRiesgo: '',
  movimientoComercial: '',
  orgContable: '',
  entidadPublica: '',
  tipoConstruccion: '',
  techoConstruccion: '',
  paredesConstruccion: '',
  tipoConstruccionResultado: '',
  niveles: '',
  empleados: '',
  horario: '',
  aseguradoraAnterior: '',
  inspeccionadoPor: '',
  fechaInspeccion: '',
  zip: '',
  edificacionRD: '',
  edificacionUSD: '',
  mobiliarioRD: '',
  mobiliarioUSD: '',
  maquinariaRD: '',
  maquinariaUSD: '',
  existenciaRD: '',
  existenciaUSD: '',
  bienesEspecificosRD: '',
  bienesEspecificosUSD: '',
  bienesEspecificosDetalle: '',
  otrosBienesRD: '',
  otrosBienesUSD: '',
  otrosBienesDetalle: '',
  valorTotalRD: '',
  valorTotalUSD: '',
  descripcionGeneral: '',
  descripcionPorNivel: '',
  descripcionPorNiveles: [],
  observacionesEdificio: '',
  anioConstruccion: '',
  fechaUltimaRemodelacion: '',
  pisos: '',
  mtsPorPiso: '',
  aptosPorPiso: '',
  mtsConstruccion: '',
  disenoAntisismico: null,
  construccionUnica: null,
  construccionSeparada: null,
  predio: '',
  sindicato: '',
  colindanciaNorte: '',
  distanciaColindanciaNorte: '',
  colindanciaSur: '',
  distanciaColindanciaSur: '',
  colindanciaEste: '',
  distanciaColindanciaEste: '',
  colindanciaOeste: '',
  distanciaColindanciaOeste: '',
  colindanciasNoAgravan: null,
  colindanciasAgravan: null,
  colindanciasObservaciones: '',
  calle: '',
  sector: '',
  municipio: '',
  provincia: '',
  manzana: '',
  edificio: '',
  piso: '',
  apartamento: '',
  residencial: '',
  longitud: '',
  latitud: '',
  nivelMar: '',
  distanciaAgua: '',
  imagenRiesgo: '',
  historialPerdidas: '',
  siniestralidad: '',
  siniestralidadNotas: '',
  descripcionProcesos: '',
  manejoInventario: '',
  combustibles: '',
  cargaCombustible: '',
  instalacionesElectricas: '',
  ordenLimpieza: '',
  dentroRiesgo: '',
  fueraRiesgo: '',
  pasillosLibres: '',
  procedenciaEnergetica: '',
  generadores: '',
  transformador: '',
  subestacion: '',
  puestaTierra: '',
  pararrayos: '',
  calderas: '',
  aireComprimido: '',
  peligrosOtros: '',
  extintoresCantidad: '',
  agenteExtintor: '',
  bombasIncendio: '',
  bombasAgua: '',
  suministroAgua: '',
  almacenAgua: '',
  manguerasIncendio: '',
  prevencionOtros: '',
  mpl: '',
  eml: '',
  camarasCantidad: '',
  camarasTipo: '',
  camarasDuracion: '',
  vigilantesCantidad: '',
  vigilantesSubcontratados: '',
  vigilantesArmas: '',
  senalizacionRutas: '',
  simulacros: '',
  simulacrosPeriodicidad: '',
  simulacrosFechaUltima: '',
  serviciosAuxCantidad: '',
  serviciosAuxTipo: '',
  serviciosAuxMarca: '',
  serviciosAuxModelo: '',
  serviciosAuxSerie: '',
  serviciosAuxAnio: '',
  serviciosAuxHoras: '',
  serviciosAuxCapacidad: '',
  conclusionesInspector: '',
};

const sections = [
  { id: '1', title: 'Datos del cliente' },
  { id: '2', title: 'Sumas aseguradas' },
  { id: '3', title: 'Descripción del edificio' },
  { id: '4', title: 'Colindancias' },
  { id: '5', title: 'Localización del riesgo' },
  { id: '6', title: 'Historial de pérdidas' },
  { id: '7', title: 'Siniestralidad de la zona' },
  { id: '8', title: 'Procesos de la empresa' },
  { id: '9', title: 'Descripción de peligros' },
  { id: '10', title: 'Prevención y protección' },
  { id: '11', title: 'Seguridad' },
  { id: '12', title: 'Estimación de pérdidas incendio' },
  { id: '13', title: 'Servicios Auxiliares' },
  { id: '14', title: 'Fotografías' },
  { id: '15', title: 'Conclusiones generales del inspector' },
];

const constructionOptionsTecho = [
  {
    value: 'piedra_ladrillo_concreto',
    label: 'Piedra, ladrillo, block de concreto, concreto armado o combinación',
  },
  { value: 'incombustible_sobre_combustible', label: 'Incombustible sobre combustible' },
  { value: 'incombustible_sobre_incombustible', label: 'Incombustible sobre incombustible' },
  { value: 'combustible_sobre_incombustible', label: 'Combustible sobre incombustible' },
  { value: 'combustible_sobre_combustible', label: 'Combustible sobre combustible' },
];

const constructionOptionsParedes = [
  ...constructionOptionsTecho,
  { value: 'mixto_50_50', label: '50% combustible y 50% incombustible' },
];

const constructionMatrix = {
  piedra_ladrillo_concreto: {
    piedra_ladrillo_concreto: 'SUPERIOR',
    incombustible_sobre_combustible: 'PRIMERA CLASE',
    incombustible_sobre_incombustible: 'PRIMERA ESPECIAL',
    combustible_sobre_incombustible: 'PRIMERA CLASE',
    combustible_sobre_combustible: 'TERCERA ESPECIAL',
  },
  incombustible_sobre_combustible: {
    incombustible_sobre_combustible: 'TERCERA ESPECIAL',
  },
  incombustible_sobre_incombustible: {
    incombustible_sobre_incombustible: 'SEGUNDA CLASE',
  },
  combustible_sobre_incombustible: {},
  combustible_sobre_combustible: {
    incombustible_sobre_combustible: 'TERCERA CLASE',
    combustible_sobre_combustible: 'CUARTA CLASE',
  },
  mixto_50_50: {
    incombustible_sobre_combustible: 'SEGUNDA CLASE',
    combustible_sobre_incombustible: 'SEGUNDA CLASE',
  },
};

function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <Text className="font-semibold text-slate-700">{label}</Text>
      {children}
    </div>
  );
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function sectionTitle(id, title) {
  return `${id}. ${title}`;
}

const emptyPhotos = () => ({ techos: [], pisos: [], paredes: [], externas: [], otros: [] });
const restoreForm = (saved) => Object.fromEntries(Object.entries(initialForm).map(([key, fallback]) => {
  const value = saved?.[key];
  return [key, value == null ? fallback : Array.isArray(fallback) || typeof fallback === 'boolean' || fallback === null ? value : String(value)];
}));

function BooleanAnswer({ value, onChange, label }) {
  return <label className="inline-flex items-center gap-2 text-slate-700">
    {label}
    <select className="border rounded p-2" value={value == null ? '' : String(value)}
      onChange={(e) => onChange(e.target.value === '' ? null : e.target.value === 'true')}>
      <option value="">Sin responder</option><option value="true">Sí</option><option value="false">No</option>
    </select>
  </label>;
}

export default function Home() {
  const { loading: pingLoading, result: pingResult, error: pingError, run: runPing } = usePing();
  const [form, setForm] = useState(initialForm);
  const [operatorId, setOperatorId] = useState(() => localStorage.getItem('propiedades.operatorId') || 'operador-prueba');
  const [inspection, setInspection] = useState(null);
  const [resumeId, setResumeId] = useState(() => localStorage.getItem('propiedades.inspectionId') || '');
  const [drafts, setDrafts] = useState([]);
  const [nextOffset, setNextOffset] = useState(null);
  const [draftsListed, setDraftsListed] = useState(false);
  const [dirtySections, setDirtySections] = useState(new Set());
  const [expandedSections, setExpandedSections] = useState(() => new Set());
  const [photos, setPhotos] = useState({ techos: [], pisos: [], paredes: [], externas: [], otros: [] });
  const [streams, setStreams] = useState({});
  const streamsRef = useRef({});
  const [cameraFacingModes, setCameraFacingModes] = useState({});
  const [switchableCameras, setSwitchableCameras] = useState({});
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [geoStatus, setGeoStatus] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);
  const videoRefs = {
    techos: useRef(null),
    pisos: useRef(null),
    paredes: useRef(null),
    externas: useRef(null),
    otros: useRef(null),
  };

  const markDirty = (sectionId) => setDirtySections((prev) => new Set([...prev, String(sectionId)]));
  const toggleSection = (sectionId) => setExpandedSections((prev) => {
    const next = new Set(prev);
    if (next.has(sectionId)) next.delete(sectionId);
    else next.add(sectionId);
    return next;
  });
  const updateField = (name, value) => {
    const section = Object.entries(sectionFields).find(([, config]) => name in config.fields)?.[0];
    if (section) markDirty(section);
    setForm((prev) => ({ ...prev, [name]: value }));
  };
  const nivelesCount = useMemo(() => {
    const parsedNiveles = Number.parseInt(form.niveles, 10);
    if (Number.isFinite(parsedNiveles) && parsedNiveles > 0) return parsedNiveles;
    const parsedPisos = Number.parseInt(form.pisos, 10);
    return Number.isFinite(parsedPisos) && parsedPisos > 0 ? parsedPisos : 0;
  }, [form.niveles, form.pisos]);
  const tipoConstruccionResultado = useMemo(() => {
    if (!form.techoConstruccion || !form.paredesConstruccion) return '';
    return constructionMatrix[form.paredesConstruccion]?.[form.techoConstruccion] || '-';
  }, [form.techoConstruccion, form.paredesConstruccion]);
  const showTipoConstruccionWarning =
    form.techoConstruccion && form.paredesConstruccion && tipoConstruccionResultado === '-';

  const buildDescripcionPorNivel = (list) =>
    (list || [])
      .map((desc, idx) => `Nivel ${idx + 1}: ${desc || ''}`.trimEnd())
      .join('\n')
      .trim();

  const updateDescripcionNivel = (index, value) => {
    markDirty('3');
    setForm((prev) => {
      const next = [...(prev.descripcionPorNiveles || [])];
      next[index] = value;
      return { ...prev, descripcionPorNiveles: next, descripcionPorNivel: buildDescripcionPorNivel(next) };
    });
  };

  const fillLocationFields = (addressData, coords) => {
    const address = addressData?.address || {};
    const pick = (...keys) => keys.map((key) => address[key]).find(Boolean) || '';
    const withFallback = (current, next) => (next ? next : current || 'N/D');

    const calle = pick('road', 'pedestrian', 'footway', 'path');
    const sector = pick('neighbourhood', 'suburb', 'city_district', 'quarter');
    const municipio = pick('city', 'town', 'village', 'municipality', 'county');
    const provincia = pick('state', 'region', 'province');
    const manzana = pick('block');
    const edificio = pick('building', 'house_number', 'house_name');
    const piso = pick('floor');
    const apartamento = pick('apartment');
    const residencial = pick('residential');
    const lat = coords?.lat ?? addressData?.lat ?? '';
    const lon = coords?.lon ?? addressData?.lon ?? '';
    const latString = lat !== '' && Number.isFinite(Number(lat)) ? Number(lat).toFixed(6) : String(lat || '');
    const lonString = lon !== '' && Number.isFinite(Number(lon)) ? Number(lon).toFixed(6) : String(lon || '');

    markDirty('5');
    setForm((prev) => ({
      ...prev,
      calle: withFallback(prev.calle, calle),
      sector: withFallback(prev.sector, sector),
      municipio: withFallback(prev.municipio, municipio),
      provincia: withFallback(prev.provincia, provincia),
      manzana: withFallback(prev.manzana, manzana),
      edificio: withFallback(prev.edificio, edificio),
      piso: withFallback(prev.piso, piso),
      apartamento: withFallback(prev.apartamento, apartamento),
      residencial: withFallback(prev.residencial, residencial),
      latitud: withFallback(prev.latitud, latString),
      longitud: withFallback(prev.longitud, lonString),
      nivelMar: withFallback(prev.nivelMar, ''),
      distanciaAgua: withFallback(prev.distanciaAgua, ''),
      imagenRiesgo: withFallback(prev.imagenRiesgo, addressData?.display_name || ''),
    }));
  };

  const handleAutoFillLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus('Este navegador no soporta geolocalización.');
      return;
    }
    setGeoLoading(true);
    setGeoStatus('Obteniendo ubicación...');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          setGeoStatus('Consultando dirección...');
          const url = new URL('https://nominatim.openstreetmap.org/reverse');
          url.searchParams.set('format', 'jsonv2');
          url.searchParams.set('lat', String(lat));
          url.searchParams.set('lon', String(lon));
          url.searchParams.set('addressdetails', '1');
          url.searchParams.set('zoom', '18');
          url.searchParams.set('accept-language', 'es');
          const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
          if (!response.ok) throw new Error(`Nominatim ${response.status}`);
          const data = await response.json();
          fillLocationFields(data, { lat, lon });
          setGeoStatus('Ubicación completada.');
        } catch (error) {
          console.error(error);
          setGeoStatus('No se pudo obtener la dirección. Intenta de nuevo.');
        } finally {
          setGeoLoading(false);
        }
      },
      (error) => {
        console.error(error);
        setGeoStatus('No se pudo acceder a la ubicación.');
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handlePhotoChange = async (kind, fileList) => {
    const files = Array.from(fileList || []);
    const mapped = await Promise.all(
      files.map(async (file) => ({ name: file.name, dataUrl: await readFileAsDataUrl(file) }))
    );
    markDirty('14');
    setPhotos((prev) => ({ ...prev, [kind]: [...(prev[kind] || []), ...mapped] }));
  };

  const removePhoto = (kind, idx) => {
    markDirty('14');
    setPhotos((prev) => ({
      ...prev,
      [kind]: prev[kind].filter((_, i) => i !== idx),
    }));
  };

  const stopCamera = (kind) => {
    const stream = streamsRef.current[kind];
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      delete streamsRef.current[kind];
      setStreams((prev) => {
        const next = { ...prev };
        delete next[kind];
        return next;
      });
    }
    const video = videoRefs[kind]?.current;
    if (video) video.srcObject = null;
  };

  const startCamera = async (kind, requestedFacingMode = cameraFacingModes[kind] || 'environment') => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('El dispositivo no permite cámara en este navegador.');
      return;
    }
    stopCamera(kind);
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: requestedFacingMode } },
        audio: false,
      });
      const video = videoRefs[kind]?.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      streamsRef.current[kind] = stream;
      setStreams((prev) => ({ ...prev, [kind]: stream }));
      setCameraFacingModes((prev) => ({ ...prev, [kind]: requestedFacingMode }));

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameraCount = devices.filter((device) => device.kind === 'videoinput').length;
        setSwitchableCameras((prev) => ({ ...prev, [kind]: cameraCount > 1 }));
      } catch {
        setSwitchableCameras((prev) => ({ ...prev, [kind]: false }));
      }
      setStatus('');
    } catch (e) {
      stream?.getTracks().forEach((track) => track.stop());
      setStatus('No se pudo acceder a la cámara. Revisa permisos.');
    }
  };

  const switchCamera = async (kind) => {
    const nextFacingMode = cameraFacingModes[kind] === 'user' ? 'environment' : 'user';
    await startCamera(kind, nextFacingMode);
  };

  const capturePhoto = (kind) => {
    const video = videoRefs[kind]?.current;
    if (!video || !streamsRef.current[kind]) {
      setStatus('Primero inicia la cámara para ' + kind);
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (cameraFacingModes[kind] === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    markDirty('14');
    setPhotos((prev) => ({
      ...prev,
      [kind]: [...prev[kind], { name: `${kind}-${Date.now()}.jpg`, dataUrl }],
    }));
  };

  useEffect(() => {
    return () => {
      Object.values(streamsRef.current).forEach((stream) => {
        stream.getTracks().forEach((track) => track.stop());
      });
      streamsRef.current = {};
    };
  }, []);

  useEffect(() => {
    setForm((prev) => {
      if (prev.tipoConstruccion === tipoConstruccionResultado && prev.tipoConstruccionResultado === tipoConstruccionResultado) {
        return prev;
      }
      return {
        ...prev,
        tipoConstruccion: tipoConstruccionResultado,
        tipoConstruccionResultado,
      };
    });
  }, [tipoConstruccionResultado]);

  useEffect(() => {
    setForm((prev) => {
      if (!nivelesCount) {
        if (prev.descripcionPorNiveles?.length) {
          return { ...prev, descripcionPorNivel: buildDescripcionPorNivel(prev.descripcionPorNiveles) };
        }
        return prev;
      }
      const next = Array.from({ length: nivelesCount }, (_, idx) => prev.descripcionPorNiveles?.[idx] || '');
      return { ...prev, descripcionPorNiveles: next, descripcionPorNivel: buildDescripcionPorNivel(next) };
    });
  }, [nivelesCount]);

  const remember = (record) => {
    setInspection(record);
    setResumeId(record.id);
    localStorage.setItem('propiedades.inspectionId', record.id);
    localStorage.setItem('propiedades.operatorId', operatorId.trim());
  };
  const refreshDrafts = async (more = false) => {
    if (!operatorId.trim()) { setStatus('Indica el operador de pruebas.'); return; }
    setSubmitting(true);
    try {
      const result = await listInspections(operatorId.trim(), more ? nextOffset : 0);
      setDrafts((prev) => more ? [...prev, ...result.inspections] : result.inspections);
      setNextOffset(result.nextOffset);
      setDraftsListed(true);
    } catch (error) { setStatus(error.message); }
    finally { setSubmitting(false); }
  };
  const resume = async (id = resumeId) => {
    if (!id.trim() || !operatorId.trim()) { setStatus('Indica el operador y el ID del borrador.'); return; }
    if (dirtySections.size && !window.confirm('Hay cambios sin guardar. ¿Quieres descartarlos y abrir el borrador?')) return;
    setSubmitting(true);
    try {
      const result = await getInspection(id.trim(), operatorId.trim());
      remember(result);
      setForm(restoreForm(result.form));
      setPhotos(result.photos);
      setDirtySections(new Set());
      setStatus('Borrador recuperado.');
    } catch (error) { setStatus(error.message); }
    finally { setSubmitting(false); }
  };
  const newInspection = () => {
    if (dirtySections.size && !window.confirm('Hay cambios sin guardar. ¿Quieres descartarlos e iniciar otra inspección?')) return;
    Object.keys(streamsRef.current).forEach(stopCamera);
    setInspection(null);
    setForm({ ...initialForm });
    setPhotos(emptyPhotos());
    setDirtySections(new Set());
    setResumeId('');
    localStorage.removeItem('propiedades.inspectionId');
    setStatus('Nueva inspección. Se creará un ID al guardar.');
  };
  const persist = async (sectionId) => {
    if (!operatorId.trim()) { setStatus('Indica el operador de pruebas.'); return; }
    setSubmitting(true);
    setStatus('Guardando avance...');
    try {
      let current = inspection;
      if (!current) {
        current = await createInspection(operatorId.trim());
        remember(current);
      }
      const fields = sectionId
        ? Object.fromEntries(Object.keys(sectionFields[sectionId].fields).map((key) => [key, form[key]]))
        : form;
      const body = { expectedVersion: current.version, fields };
      if (!sectionId || sectionId === '14') body.photos = Object.fromEntries(Object.entries(photos).map(([kind, items]) => [
        kind, items.map((photo) => photo.id ? { id: photo.id } : { name: photo.name, dataUrl: photo.dataUrl })
      ]));
      const result = await saveInspection(current.id, operatorId.trim(), body, sectionId);
      remember(result);
      if (!sectionId) setForm(restoreForm(result.form));
      if (!sectionId || sectionId === '14') setPhotos(result.photos);
      setDirtySections((prev) => sectionId ? new Set([...prev].filter((id) => id !== sectionId)) : new Set());
      setStatus(result.ready
        ? 'Guardado. Las 15 secciones están completas. El envío a DANA se habilitará en la siguiente etapa.'
        : `Avance guardado. ${result.completedSections} de 15 secciones completas.`);
    } catch (error) {
      setStatus(error.status === 409 ? `${error.message} Tus cambios siguen en pantalla.` : error.message);
    } finally { setSubmitting(false); }
  };
  const handleSubmit = (event) => { event.preventDefault(); persist(); };

  return (
    <main className="legacy-background text-slate-900">
      <div className="legacy-page">
        <header className="legacy-header">
          <div className="legacy-logo">
            <img src="/seguros-crecer.png" alt="Seguros Crecer" />
          </div>
          <div>
            <h1 className="m-0 text-xl font-bold">Inspección de Riesgos</h1>
            <p className="m-0 text-sm opacity-90">Captura la información clave, toma fotografías con la cámara y envía.</p>
          </div>
        </header>

        <div className="p-4 md:p-6 space-y-4">
          <Card className="service-status-card">
            <div className="service-status-copy">
              <div className={`service-status-indicator ${pingError ? 'is-error' : pingResult ? 'is-online' : 'is-checking'}`} aria-hidden="true" />
              <div>
                <Text className="service-status-label">Servicio de inspecciones</Text>
                <Title className="service-status-title">
                  {pingLoading && !pingResult && !pingError ? 'Conectando…' : pingError ? 'Servicio no disponible' : pingResult ? 'Listo para guardar' : 'Conectando…'}
                </Title>
                {pingError && <Text className="service-status-help">No se pudo conectar. Comprueba tu conexión o inténtalo de nuevo más tarde.</Text>}
              </div>
            </div>
            <Badge color={pingError ? 'rose' : pingResult ? 'emerald' : 'gray'}>
              {pingError ? 'Sin conexión' : pingResult ? 'Conectado' : 'Verificando'}
            </Badge>
          </Card>

          <Card className="drafts-card">
            <div className="drafts-header">
              <div>
                <Title>Borradores de inspección</Title>
                <Text>Continúa una inspección guardada o comienza una nueva.</Text>
              </div>
              {inspection && <Badge color="emerald">{inspection.completedSections}/15 secciones completas</Badge>}
            </div>
            <div className="drafts-controls">
              <Field label="Operador">
                <TextInput value={operatorId} disabled aria-readonly="true" />
              </Field>
              <Field label="ID del borrador para retomar">
                <TextInput value={resumeId} disabled={submitting} placeholder="Pega aquí el ID del borrador"
                  onChange={(e) => setResumeId(e.target.value)} />
              </Field>
            </div>
            {inspection && <Text className="draft-current-id">Inspección actual: <span>{inspection.id}</span></Text>}
            {inspection?.dana && <Text className="text-amber-700">Estado de DANA: {inspection.dana.estado}. Este formulario está cerrado para edición.</Text>}
            <div className="draft-actions">
              <Button className="draft-action-button draft-action-primary" onClick={() => resume()} disabled={submitting}>Retomar borrador</Button>
              <Button className="draft-action-button draft-action-secondary" onClick={() => refreshDrafts()} disabled={submitting}>Ver mis borradores</Button>
              <Button className="draft-action-button draft-action-new" onClick={newInspection} disabled={submitting}>Nueva inspección</Button>
            </div>
            {draftsListed && drafts.length === 0 && <Text className="draft-empty-state">No hay borradores para este operador todavía.</Text>}
            {drafts.length > 0 && <div className="draft-list">
              {drafts.map((draft) => <div key={draft.id} className="draft-list-item">
                <div className="draft-list-copy">
                  <Text className="draft-list-name">{draft.nombre}</Text>
                  <Text>{draft.secciones_completas}/15 secciones completas{draft.dana_status ? ` · DANA: ${draft.dana_status}` : ''}</Text>
                  <Text className="draft-list-id">{draft.id}</Text>
                </div>
                <Button className="draft-action-button draft-action-primary" disabled={submitting} onClick={() => resume(draft.id)}>Abrir</Button>
              </div>)}
            </div>}
            {nextOffset != null && <Button className="draft-action-button draft-action-secondary draft-more-button" disabled={submitting} onClick={() => refreshDrafts(true)}>Ver más borradores</Button>}
          </Card>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <fieldset disabled={submitting || Boolean(inspection?.dana)} className="space-y-4">
            {sections.map((s) => {
              const isDirty = dirtySections.has(s.id);
              const isComplete = inspection?.sections?.find((item) => String(item.seccion_id) === s.id)?.estado === 'completa';
              const state = isDirty ? 'dirty' : isComplete ? 'complete' : 'pending';
              const label = isDirty ? 'Cambios sin guardar' : isComplete ? 'Completa' : 'Pendiente';
              return (
              <div key={s.id} className={`legacy-section-card${expandedSections.has(s.id) ? ' is-expanded' : ''}`}>
                <h2 className="legacy-section-title">
                  <button
                    type="button"
                    className="legacy-section-toggle"
                    aria-expanded={expandedSections.has(s.id)}
                    aria-controls={`inspection-section-${s.id}`}
                    onClick={() => toggleSection(s.id)}
                  >
                    <span>{sectionTitle(s.id, s.title)}</span>
                    <span className="legacy-section-chevron" aria-hidden="true">{expandedSections.has(s.id) ? '−' : '+'}</span>
                  </button>
                </h2>
                <div className="flex items-center justify-between gap-2 px-4 py-2">
                  <span className={`section-status section-status-${state}`}>
                    <span className="section-status-icon" aria-hidden="true">{isDirty ? '!' : isComplete ? '✓' : '○'}</span>
                    {label}
                  </span>
                  <button type="button" className="action-btn action-btn-secondary" onClick={() => persist(s.id)}>Guardar sección</button>
                </div>
                <div id={`inspection-section-${s.id}`} className="legacy-section-body" hidden={!expandedSections.has(s.id)}>
                  {s.id === '1' && (
                    <div className="legacy-grid-2">
                      <Field label="Nombre del Riesgo" className="legacy-field">
                        <TextInput value={form.nombreRiesgo} onChange={(e) => updateField('nombreRiesgo', e.target.value)} />
                      </Field>
                      <Field label="Propietario" className="legacy-field">
                        <TextInput value={form.propietario} onChange={(e) => updateField('propietario', e.target.value)} />
                      </Field>
                      <Field label="RNC/Cédula" className="legacy-field">
                        <TextInput value={form.rnc} onChange={(e) => updateField('rnc', e.target.value)} />
                      </Field>
                      <Field label="Póliza/No. Cotización" className="legacy-field">
                        <TextInput value={form.poliza} onChange={(e) => updateField('poliza', e.target.value)} />
                      </Field>
                      <Field label="Tipo de Riesgo" className="legacy-field">
                        <TextInput value={form.tipoRiesgo} onChange={(e) => updateField('tipoRiesgo', e.target.value)} />
                      </Field>
                      <Field label="Ubicación inspeccionada" className="legacy-field">
                        <Textarea
                          value={form.ubicacionInspeccionada}
                          onChange={(e) => updateField('ubicacionInspeccionada', e.target.value)}
                        />
                      </Field>
                      <Field label="Intermediario" className="legacy-field">
                        <TextInput
                          value={form.intermediario}
                          onChange={(e) => updateField('intermediario', e.target.value)}
                        />
                      </Field>
                      <Field label="Entrevistado" className="legacy-field">
                        <TextInput value={form.entrevistado} onChange={(e) => updateField('entrevistado', e.target.value)} />
                      </Field>
                      <Field label="Teléfono" className="legacy-field">
                        <TextInput value={form.telefono} onChange={(e) => updateField('telefono', e.target.value)} />
                      </Field>
                      <Field label="Celular" className="legacy-field">
                        <TextInput value={form.celular} onChange={(e) => updateField('celular', e.target.value)} />
                      </Field>
                      <Field label="Email" className="legacy-field">
                        <TextInput value={form.email} onChange={(e) => updateField('email', e.target.value)} />
                      </Field>
                      <Field label="Sitio Web del cliente" className="legacy-field">
                        <TextInput value={form.sitioWeb} onChange={(e) => updateField('sitioWeb', e.target.value)} />
                      </Field>
                      <Field label="Edad del riesgo" className="legacy-field">
                        <TextInput value={form.edadRiesgo} onChange={(e) => updateField('edadRiesgo', e.target.value)} />
                      </Field>
                      <Field label="Movimiento comercial" className="legacy-field">
                        <TextInput
                          value={form.movimientoComercial}
                          onChange={(e) => updateField('movimientoComercial', e.target.value)}
                        />
                      </Field>
                      <Field label="Organización contable" className="legacy-field">
                        <TextInput value={form.orgContable} onChange={(e) => updateField('orgContable', e.target.value)} />
                      </Field>
                      <Field label="Es autónoma o del sector público" className="legacy-field">
                        <TextInput value={form.entidadPublica} onChange={(e) => updateField('entidadPublica', e.target.value)} />
                      </Field>
                      <Field label="Tipo de construcción (techo)" className="legacy-field">
                        <select
                          value={form.techoConstruccion}
                          onChange={(e) => updateField('techoConstruccion', e.target.value)}
                        >
                          <option value="">Selecciona el tipo de techo</option>
                          {constructionOptionsTecho.map((option) => (
                            <option key={`techo-${option.value}`} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Tipo de construcción (paredes)" className="legacy-field">
                        <select
                          value={form.paredesConstruccion}
                          onChange={(e) => updateField('paredesConstruccion', e.target.value)}
                        >
                          <option value="">Selecciona el tipo de paredes</option>
                          {constructionOptionsParedes.map((option) => (
                            <option key={`paredes-${option.value}`} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Tipo de construcción (resultado)" className="legacy-field">
                        <TextInput value={tipoConstruccionResultado} readOnly />
                        {showTipoConstruccionWarning && (
                          <Text className="mt-2 text-sm font-semibold text-red-600">
                            La combinación seleccionada no aplica. Verifica el tipo de techo y paredes.
                          </Text>
                        )}
                      </Field>
                      <Field label="Cantidad de niveles" className="legacy-field">
                        <TextInput value={form.niveles} onChange={(e) => updateField('niveles', e.target.value)} />
                      </Field>
                      <Field label="No. de empleados" className="legacy-field">
                        <TextInput value={form.empleados} onChange={(e) => updateField('empleados', e.target.value)} />
                      </Field>
                      <Field label="Horario" className="legacy-field">
                        <TextInput value={form.horario} onChange={(e) => updateField('horario', e.target.value)} />
                      </Field>
                      <Field label="Aseguradora anterior" className="legacy-field">
                        <TextInput
                          value={form.aseguradoraAnterior}
                          onChange={(e) => updateField('aseguradoraAnterior', e.target.value)}
                        />
                      </Field>
                      <Field label="Inspeccionado por" className="legacy-field">
                        <TextInput
                          value={form.inspeccionadoPor}
                          onChange={(e) => updateField('inspeccionadoPor', e.target.value)}
                        />
                      </Field>
                      <Field label="Fecha de inspección" className="legacy-field">
                        <TextInput
                          type="date"
                          value={form.fechaInspeccion}
                          onChange={(e) => updateField('fechaInspeccion', e.target.value)}
                        />
                      </Field>
                      <Field label="Código ZIP" className="legacy-field">
                        <TextInput value={form.zip} onChange={(e) => updateField('zip', e.target.value)} />
                      </Field>
                    </div>
                  )}

                  {s.id === '2' && (
                    <div className="legacy-grid-2">
                      <Field label="Edificación RD$" className="legacy-field">
                        <TextInput value={form.edificacionRD} onChange={(e) => updateField('edificacionRD', e.target.value)} />
                      </Field>
                      <Field label="Edificación US$" className="legacy-field">
                        <TextInput value={form.edificacionUSD} onChange={(e) => updateField('edificacionUSD', e.target.value)} />
                      </Field>
                      <Field label="Mobiliario RD$" className="legacy-field">
                        <TextInput value={form.mobiliarioRD} onChange={(e) => updateField('mobiliarioRD', e.target.value)} />
                      </Field>
                      <Field label="Mobiliario US$" className="legacy-field">
                        <TextInput value={form.mobiliarioUSD} onChange={(e) => updateField('mobiliarioUSD', e.target.value)} />
                      </Field>
                      <Field label="Maquinaria y equipos RD$" className="legacy-field">
                        <TextInput value={form.maquinariaRD} onChange={(e) => updateField('maquinariaRD', e.target.value)} />
                      </Field>
                      <Field label="Maquinaria y equipos US$" className="legacy-field">
                        <TextInput value={form.maquinariaUSD} onChange={(e) => updateField('maquinariaUSD', e.target.value)} />
                      </Field>
                      <Field label="Existencia RD$" className="legacy-field">
                        <TextInput value={form.existenciaRD} onChange={(e) => updateField('existenciaRD', e.target.value)} />
                      </Field>
                      <Field label="Existencia US$" className="legacy-field">
                        <TextInput value={form.existenciaUSD} onChange={(e) => updateField('existenciaUSD', e.target.value)} />
                      </Field>
                      <Field label="Bienes específicos RD$" className="legacy-field">
                        <TextInput
                          value={form.bienesEspecificosRD}
                          onChange={(e) => updateField('bienesEspecificosRD', e.target.value)}
                        />
                      </Field>
                      <Field label="Bienes específicos US$" className="legacy-field">
                        <TextInput
                          value={form.bienesEspecificosUSD}
                          onChange={(e) => updateField('bienesEspecificosUSD', e.target.value)}
                        />
                      </Field>
                      <Field label="Detalle de bienes específicos" className="legacy-field">
                        <TextInput
                          value={form.bienesEspecificosDetalle}
                          onChange={(e) => updateField('bienesEspecificosDetalle', e.target.value)}
                        />
                      </Field>
                      <Field label="Detalle de otros bienes" className="legacy-field">
                        <TextInput
                          value={form.otrosBienesDetalle}
                          onChange={(e) => updateField('otrosBienesDetalle', e.target.value)}
                        />
                      </Field>
                      <Field label="Otros bienes RD$" className="legacy-field">
                        <TextInput value={form.otrosBienesRD} onChange={(e) => updateField('otrosBienesRD', e.target.value)} />
                      </Field>
                      <Field label="Otros bienes US$" className="legacy-field">
                        <TextInput value={form.otrosBienesUSD} onChange={(e) => updateField('otrosBienesUSD', e.target.value)} />
                      </Field>
                      <Field label="Valor total a asegurar RD$" className="legacy-field">
                        <TextInput value={form.valorTotalRD} onChange={(e) => updateField('valorTotalRD', e.target.value)} />
                      </Field>
                      <Field label="Valor total a asegurar US$" className="legacy-field">
                        <TextInput value={form.valorTotalUSD} onChange={(e) => updateField('valorTotalUSD', e.target.value)} />
                      </Field>
                    </div>
                  )}

                  {s.id === '3' && (
                    <div className="legacy-grid-2">
                      <Field label="Descripción general" className="legacy-field">
                        <Textarea
                          value={form.descripcionGeneral}
                          onChange={(e) => updateField('descripcionGeneral', e.target.value)}
                        />
                      </Field>
                      <Field label="Descripción por nivel" className="legacy-field">
                        <div className="space-y-3">
                          {Array.from(
                            { length: Math.max(nivelesCount, form.descripcionPorNiveles?.length || 1) },
                            (_, idx) => (
                              <div key={`nivel-${idx + 1}`} className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-3">
                                <TextInput value={`Nivel ${idx + 1}`} readOnly />
                                <Textarea
                                  value={form.descripcionPorNiveles?.[idx] || ''}
                                  onChange={(e) => updateDescripcionNivel(idx, e.target.value)}
                                />
                              </div>
                            )
                          )}
                          {!nivelesCount && (
                            <Text className="text-sm text-slate-500">
                              Si necesitas más niveles, indica la cantidad en "Cantidad de niveles" o "Cantidad de pisos".
                            </Text>
                          )}
                        </div>
                      </Field>
                      <Field label="Observaciones" className="legacy-field">
                        <Textarea
                          value={form.observacionesEdificio}
                          onChange={(e) => updateField('observacionesEdificio', e.target.value)}
                        />
                      </Field>
                      <Field label="Año de construcción" className="legacy-field">
                        <TextInput value={form.anioConstruccion} onChange={(e) => updateField('anioConstruccion', e.target.value)} />
                      </Field>
                      <Field label="Fecha de última remodelación o modificación" className="legacy-field">
                        <TextInput
                          value={form.fechaUltimaRemodelacion}
                          onChange={(e) => updateField('fechaUltimaRemodelacion', e.target.value)}
                        />
                      </Field>
                      <Field label="Cantidad de pisos" className="legacy-field">
                        <TextInput value={form.pisos} onChange={(e) => updateField('pisos', e.target.value)} />
                      </Field>
                      <Field label="Mts² por piso" className="legacy-field">
                        <TextInput value={form.mtsPorPiso} onChange={(e) => updateField('mtsPorPiso', e.target.value)} />
                      </Field>
                      <Field label="Aptos/oficinas por piso" className="legacy-field">
                        <TextInput value={form.aptosPorPiso} onChange={(e) => updateField('aptosPorPiso', e.target.value)} />
                      </Field>
                      <Field label="Mts² de construcción" className="legacy-field">
                        <TextInput value={form.mtsConstruccion} onChange={(e) => updateField('mtsConstruccion', e.target.value)} />
                      </Field>
                      <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-4">
                        <BooleanAnswer label="Diseño Antisísmico" value={form.disenoAntisismico} onChange={(value) => updateField('disenoAntisismico', value)} />
                        <BooleanAnswer label="Construcción Única" value={form.construccionUnica} onChange={(value) => updateField('construccionUnica', value)} />
                        <BooleanAnswer label="Construcción Separada" value={form.construccionSeparada} onChange={(value) => updateField('construccionSeparada', value)} />
                      </div>
                      <Field label="Predio (Arrendado / Propio)" className="legacy-field">
                        <TextInput value={form.predio} onChange={(e) => updateField('predio', e.target.value)} />
                      </Field>
                      <Field label="Sindicato (Sí / No)" className="legacy-field">
                        <TextInput value={form.sindicato} onChange={(e) => updateField('sindicato', e.target.value)} />
                      </Field>
                    </div>
                  )}

                  {s.id === '4' && (
                    <>
                      <div className="legacy-grid-2">
                        <Field label="Al Norte" className="legacy-field">
                          <TextInput
                            value={form.colindanciaNorte}
                            onChange={(e) => updateField('colindanciaNorte', e.target.value)}
                          />
                        </Field>
                        <Field label="Distancia Norte" className="legacy-field">
                          <TextInput
                            value={form.distanciaColindanciaNorte}
                            onChange={(e) => updateField('distanciaColindanciaNorte', e.target.value)}
                          />
                        </Field>
                        <Field label="Al Sur" className="legacy-field">
                          <TextInput
                            value={form.colindanciaSur}
                            onChange={(e) => updateField('colindanciaSur', e.target.value)}
                          />
                        </Field>
                        <Field label="Distancia Sur" className="legacy-field">
                          <TextInput
                            value={form.distanciaColindanciaSur}
                            onChange={(e) => updateField('distanciaColindanciaSur', e.target.value)}
                          />
                        </Field>
                        <Field label="Al Este" className="legacy-field">
                          <TextInput
                            value={form.colindanciaEste}
                            onChange={(e) => updateField('colindanciaEste', e.target.value)}
                          />
                        </Field>
                        <Field label="Distancia Este" className="legacy-field">
                          <TextInput
                            value={form.distanciaColindanciaEste}
                            onChange={(e) => updateField('distanciaColindanciaEste', e.target.value)}
                          />
                        </Field>
                        <Field label="Al Oeste" className="legacy-field">
                          <TextInput
                            value={form.colindanciaOeste}
                            onChange={(e) => updateField('colindanciaOeste', e.target.value)}
                          />
                        </Field>
                        <Field label="Distancia Oeste" className="legacy-field">
                          <TextInput
                            value={form.distanciaColindanciaOeste}
                            onChange={(e) => updateField('distanciaColindanciaOeste', e.target.value)}
                          />
                        </Field>
                      </div>
                      <BooleanAnswer label="Las colindancias no agravan el riesgo" value={form.colindanciasNoAgravan} onChange={(value) => updateField('colindanciasNoAgravan', value)} />
                      <BooleanAnswer label="Las colindancias agravan el riesgo" value={form.colindanciasAgravan} onChange={(value) => updateField('colindanciasAgravan', value)} />
                      {(
                        <Field label="Observaciones (colindancias)" className="legacy-field">
                          <Textarea
                            value={form.colindanciasObservaciones}
                            onChange={(e) => updateField('colindanciasObservaciones', e.target.value)}
                          />
                        </Field>
                      )}
                    </>
                  )}

                  {s.id === '5' && (
                    <div className="legacy-grid-2">
                      <div className="col-span-full space-y-2">
                        <button
                          type="button"
                          className="action-btn action-btn-primary"
                          onClick={handleAutoFillLocation}
                          disabled={geoLoading}
                        >
                          {geoLoading ? 'Obteniendo ubicación...' : 'Obtener ubicación'}
                        </button>
                        {geoStatus && <Text className="text-sm text-slate-600">{geoStatus}</Text>}
                        <Text className="text-xs text-slate-500">Datos de ubicación © OpenStreetMap contributors (Nominatim).</Text>
                      </div>
                      <Field label="Calle" className="legacy-field">
                        <TextInput value={form.calle} onChange={(e) => updateField('calle', e.target.value)} />
                      </Field>
                      <Field label="Sector/Paraje" className="legacy-field">
                        <TextInput value={form.sector} onChange={(e) => updateField('sector', e.target.value)} />
                      </Field>
                      <Field label="Municipio" className="legacy-field">
                        <TextInput value={form.municipio} onChange={(e) => updateField('municipio', e.target.value)} />
                      </Field>
                      <Field label="Provincia" className="legacy-field">
                        <TextInput value={form.provincia} onChange={(e) => updateField('provincia', e.target.value)} />
                      </Field>
                      <Field label="Manzana" className="legacy-field">
                        <TextInput value={form.manzana} onChange={(e) => updateField('manzana', e.target.value)} />
                      </Field>
                      <Field label="Edificio" className="legacy-field">
                        <TextInput value={form.edificio} onChange={(e) => updateField('edificio', e.target.value)} />
                      </Field>
                      <Field label="Piso" className="legacy-field">
                        <TextInput value={form.piso} onChange={(e) => updateField('piso', e.target.value)} />
                      </Field>
                      <Field label="Apartamento" className="legacy-field">
                        <TextInput value={form.apartamento} onChange={(e) => updateField('apartamento', e.target.value)} />
                      </Field>
                      <Field label="Residencial" className="legacy-field">
                        <TextInput value={form.residencial} onChange={(e) => updateField('residencial', e.target.value)} />
                      </Field>
                      <Field label="Longitud" className="legacy-field">
                        <TextInput value={form.longitud} onChange={(e) => updateField('longitud', e.target.value)} />
                      </Field>
                      <Field label="Latitud" className="legacy-field">
                        <TextInput value={form.latitud} onChange={(e) => updateField('latitud', e.target.value)} />
                      </Field>
                      <Field label="Nivel del mar" className="legacy-field">
                        <TextInput value={form.nivelMar} onChange={(e) => updateField('nivelMar', e.target.value)} />
                      </Field>
                      <Field label="Distancia al mar / agua más cercana" className="legacy-field">
                        <TextInput value={form.distanciaAgua} onChange={(e) => updateField('distanciaAgua', e.target.value)} />
                      </Field>
                      <Field label="Imagen del riesgo (según mapa)" className="legacy-field">
                        <div className="space-y-2">
                          <TextInput value={form.imagenRiesgo} onChange={(e) => updateField('imagenRiesgo', e.target.value)} />
                          {form.latitud && form.longitud && (
                            <a
                              className="action-btn action-btn-secondary"
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                `${form.latitud},${form.longitud}`
                              )}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Ver en Google Maps
                            </a>
                          )}
                        </div>
                      </Field>
                    </div>
                  )}

                  {s.id === '6' && (
                    <Field label="Historial de pérdidas" className="legacy-field">
                      <Textarea
                        value={form.historialPerdidas}
                        onChange={(e) => updateField('historialPerdidas', e.target.value)}
                      />
                    </Field>
                  )}

                  {s.id === '7' && (
                    <div className="legacy-grid-2">
                      <Field label="Siniestralidad de la zona" className="legacy-field">
                        <TextInput value={form.siniestralidad} onChange={(e) => updateField('siniestralidad', e.target.value)} />
                      </Field>
                      <Field label="Notas" className="legacy-field">
                        <TextInput
                          value={form.siniestralidadNotas}
                          onChange={(e) => updateField('siniestralidadNotas', e.target.value)}
                        />
                      </Field>
                    </div>
                  )}

                  {s.id === '8' && (
                    <div className="legacy-grid-2">
                      <Field label="Descripción de procesos" className="legacy-field">
                        <Textarea
                          value={form.descripcionProcesos}
                          onChange={(e) => updateField('descripcionProcesos', e.target.value)}
                        />
                      </Field>
                      <Field label="Manejo de inventario" className="legacy-field">
                        <Textarea
                          value={form.manejoInventario}
                          onChange={(e) => updateField('manejoInventario', e.target.value)}
                        />
                      </Field>
                    </div>
                  )}

                  {s.id === '9' && (
                    <div className="legacy-grid-2">
                      <Field label="Almacenamiento/uso de combustibles" className="legacy-field">
                        <Textarea value={form.combustibles} onChange={(e) => updateField('combustibles', e.target.value)} />
                      </Field>
                      <Field label="Carga combustible" className="legacy-field">
                        <Textarea
                          value={form.cargaCombustible}
                          onChange={(e) => updateField('cargaCombustible', e.target.value)}
                        />
                      </Field>
                      <Field label="Instalaciones eléctricas" className="legacy-field">
                        <Textarea
                          value={form.instalacionesElectricas}
                          onChange={(e) => updateField('instalacionesElectricas', e.target.value)}
                        />
                      </Field>
                      <Field label="Orden y limpieza" className="legacy-field">
                        <Textarea value={form.ordenLimpieza} onChange={(e) => updateField('ordenLimpieza', e.target.value)} />
                      </Field>
                      <Field label="Dentro del riesgo" className="legacy-field">
                        <Textarea value={form.dentroRiesgo} onChange={(e) => updateField('dentroRiesgo', e.target.value)} />
                      </Field>
                      <Field label="Fuera del riesgo" className="legacy-field">
                        <Textarea value={form.fueraRiesgo} onChange={(e) => updateField('fueraRiesgo', e.target.value)} />
                      </Field>
                      <Field label="Pasillos libres" className="legacy-field">
                        <Textarea value={form.pasillosLibres} onChange={(e) => updateField('pasillosLibres', e.target.value)} />
                      </Field>
                      <Field label="Procedencia energética" className="legacy-field">
                        <div className="flex flex-col gap-2">
                          <label className="inline-flex items-center gap-2 text-slate-700">
                            <input
                              type="radio"
                              name="procedenciaEnergetica"
                              value="Autónoma"
                              checked={form.procedenciaEnergetica === 'Autónoma'}
                              onChange={(e) => updateField('procedenciaEnergetica', e.target.value)}
                            />
                            Autónoma
                          </label>
                          <label className="inline-flex items-center gap-2 text-slate-700">
                            <input
                              type="radio"
                              name="procedenciaEnergetica"
                              value="Sector público"
                              checked={form.procedenciaEnergetica === 'Sector público'}
                              onChange={(e) => updateField('procedenciaEnergetica', e.target.value)}
                            />
                            Sector público
                          </label>
                        </div>
                      </Field>
                      <Field label="Generadores eléctricos" className="legacy-field">
                        <Textarea value={form.generadores} onChange={(e) => updateField('generadores', e.target.value)} />
                      </Field>
                      <Field label="Transformador" className="legacy-field">
                        <Textarea value={form.transformador} onChange={(e) => updateField('transformador', e.target.value)} />
                      </Field>
                      <Field label="Subestación eléctrica" className="legacy-field">
                        <Textarea value={form.subestacion} onChange={(e) => updateField('subestacion', e.target.value)} />
                      </Field>
                      <Field label="Puesta a tierra" className="legacy-field">
                        <Textarea value={form.puestaTierra} onChange={(e) => updateField('puestaTierra', e.target.value)} />
                      </Field>
                      <Field label="Sistema de pararrayos" className="legacy-field">
                        <Textarea value={form.pararrayos} onChange={(e) => updateField('pararrayos', e.target.value)} />
                      </Field>
                      <Field label="Calderas" className="legacy-field">
                        <Textarea value={form.calderas} onChange={(e) => updateField('calderas', e.target.value)} />
                      </Field>
                      <Field label="Aire comprimido" className="legacy-field">
                        <Textarea value={form.aireComprimido} onChange={(e) => updateField('aireComprimido', e.target.value)} />
                      </Field>
                      <Field label="Otros peligros" className="legacy-field">
                        <Textarea value={form.peligrosOtros} onChange={(e) => updateField('peligrosOtros', e.target.value)} />
                      </Field>
                    </div>
                  )}

                  {s.id === '10' && (
                    <div className="legacy-grid-2">
                      <Field label="Cantidad de extintores" className="legacy-field">
                        <TextInput
                          value={form.extintoresCantidad}
                          onChange={(e) => updateField('extintoresCantidad', e.target.value)}
                        />
                      </Field>
                      <Field label="Tipo de agente extintor" className="legacy-field">
                        <TextInput
                          value={form.agenteExtintor}
                          onChange={(e) => updateField('agenteExtintor', e.target.value)}
                        />
                      </Field>
                      <Field label="Bombas contra incendio" className="legacy-field">
                        <TextInput
                          value={form.bombasIncendio}
                          onChange={(e) => updateField('bombasIncendio', e.target.value)}
                        />
                      </Field>
                      <Field label="Bombas de agua uso general" className="legacy-field">
                        <TextInput value={form.bombasAgua} onChange={(e) => updateField('bombasAgua', e.target.value)} />
                      </Field>
                      <Field label="Suministro de agua" className="legacy-field">
                        <TextInput
                          value={form.suministroAgua}
                          onChange={(e) => updateField('suministroAgua', e.target.value)}
                        />
                      </Field>
                      <Field label="Almacenamiento de agua" className="legacy-field">
                        <TextInput value={form.almacenAgua} onChange={(e) => updateField('almacenAgua', e.target.value)} />
                      </Field>
                      <Field label="Mangueras contra incendios" className="legacy-field">
                        <TextInput
                          value={form.manguerasIncendio}
                          onChange={(e) => updateField('manguerasIncendio', e.target.value)}
                        />
                      </Field>
                      <Field label="Otros sistemas de protección" className="legacy-field">
                        <Textarea
                          value={form.prevencionOtros}
                          onChange={(e) => updateField('prevencionOtros', e.target.value)}
                        />
                      </Field>
                    </div>
                  )}

                  {s.id === '11' && (
                    <div className="legacy-grid-2">
                      <Field label="Cantidad de cámaras de vigilancia" className="legacy-field">
                        <TextInput value={form.camarasCantidad} onChange={(e) => updateField('camarasCantidad', e.target.value)} />
                      </Field>
                      <Field label="Tipo de cámara" className="legacy-field">
                        <TextInput value={form.camarasTipo} onChange={(e) => updateField('camarasTipo', e.target.value)} />
                      </Field>
                      <Field label="Duración de las grabaciones" className="legacy-field">
                        <TextInput value={form.camarasDuracion} onChange={(e) => updateField('camarasDuracion', e.target.value)} />
                      </Field>
                      <Field label="Cantidad de vigilantes" className="legacy-field">
                        <TextInput
                          value={form.vigilantesCantidad}
                          onChange={(e) => updateField('vigilantesCantidad', e.target.value)}
                        />
                      </Field>
                      <Field label="Vigilantes subcontratados o propios" className="legacy-field">
                        <TextInput
                          value={form.vigilantesSubcontratados}
                          onChange={(e) => updateField('vigilantesSubcontratados', e.target.value)}
                        />
                      </Field>
                      <Field label="Poseen armas o no" className="legacy-field">
                        <TextInput value={form.vigilantesArmas} onChange={(e) => updateField('vigilantesArmas', e.target.value)} />
                      </Field>
                      <Field label="Señalización y rutas de evacuación" className="legacy-field">
                        <TextInput
                          value={form.senalizacionRutas}
                          onChange={(e) => updateField('senalizacionRutas', e.target.value)}
                        />
                      </Field>
                      <Field label="Se realizan simulacros" className="legacy-field">
                        <TextInput value={form.simulacros} onChange={(e) => updateField('simulacros', e.target.value)} />
                      </Field>
                      <Field label="Periodicidad de los simulacros" className="legacy-field">
                        <TextInput
                          value={form.simulacrosPeriodicidad}
                          onChange={(e) => updateField('simulacrosPeriodicidad', e.target.value)}
                        />
                      </Field>
                      <Field label="Fecha de último simulacro" className="legacy-field">
                        <TextInput
                          value={form.simulacrosFechaUltima}
                          onChange={(e) => updateField('simulacrosFechaUltima', e.target.value)}
                        />
                      </Field>
                    </div>
                  )}

                  {s.id === '12' && (
                    <div className="legacy-grid-2">
                      <Field label="Pérdida Máxima Posible (MPL)" className="legacy-field">
                        <Textarea value={form.mpl} onChange={(e) => updateField('mpl', e.target.value)} />
                      </Field>
                      <Field label="Pérdida Máxima Estimada (EML)" className="legacy-field">
                        <Textarea value={form.eml} onChange={(e) => updateField('eml', e.target.value)} />
                      </Field>
                    </div>
                  )}

                  {s.id === '13' && (
                    <div className="legacy-grid-2">
                      <Field label="Cantidad de maquinarias" className="legacy-field">
                        <TextInput
                          value={form.serviciosAuxCantidad}
                          onChange={(e) => updateField('serviciosAuxCantidad', e.target.value)}
                        />
                      </Field>
                      <Field label="Tipo de maquinaria" className="legacy-field">
                        <TextInput value={form.serviciosAuxTipo} onChange={(e) => updateField('serviciosAuxTipo', e.target.value)} />
                      </Field>
                      <Field label="Marca" className="legacy-field">
                        <TextInput value={form.serviciosAuxMarca} onChange={(e) => updateField('serviciosAuxMarca', e.target.value)} />
                      </Field>
                      <Field label="Modelo" className="legacy-field">
                        <TextInput value={form.serviciosAuxModelo} onChange={(e) => updateField('serviciosAuxModelo', e.target.value)} />
                      </Field>
                      <Field label="No. Serie" className="legacy-field">
                        <TextInput value={form.serviciosAuxSerie} onChange={(e) => updateField('serviciosAuxSerie', e.target.value)} />
                      </Field>
                      <Field label="Año" className="legacy-field">
                        <TextInput value={form.serviciosAuxAnio} onChange={(e) => updateField('serviciosAuxAnio', e.target.value)} />
                      </Field>
                      <Field label="Horas de operación" className="legacy-field">
                        <TextInput value={form.serviciosAuxHoras} onChange={(e) => updateField('serviciosAuxHoras', e.target.value)} />
                      </Field>
                      <Field label="Capacidad" className="legacy-field">
                        <TextInput
                          value={form.serviciosAuxCapacidad}
                          onChange={(e) => updateField('serviciosAuxCapacidad', e.target.value)}
                        />
                      </Field>
                    </div>
                  )}

                  {s.id === '14' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {['techos', 'pisos', 'paredes', 'externas', 'otros'].map((kind) => (
                        <div key={kind} className="border border-slate-200 rounded-lg p-3 bg-slate-50 space-y-3 h-full flex flex-col">
                          <div className="flex items-center justify-between gap-2">
                            <Title className="text-base capitalize m-0">{kind}</Title>
                          </div>
                          <div className="flex items-center gap-2 flex-nowrap overflow-x-auto">
                            <button type="button" className="camera-btn camera-btn-start" onClick={() => startCamera(kind)}>
                              Iniciar cámara
                            </button>
                            {switchableCameras[kind] && streams[kind] && (
                              <button type="button" className="camera-btn camera-btn-switch" onClick={() => switchCamera(kind)}>
                                Cambiar cámara
                              </button>
                            )}
                            <button type="button" className="camera-btn camera-btn-shot" onClick={() => capturePhoto(kind)}>
                              Tomar foto
                            </button>
                            <button type="button" className="camera-btn camera-btn-stop" onClick={() => stopCamera(kind)}>
                              Detener
                            </button>
                          </div>
                          <Divider />
                          <div className="flex-1 grid grid-cols-1 gap-2">
                            <div className="relative border rounded-lg overflow-hidden bg-black min-h-[160px]">
                              <video
                                ref={videoRefs[kind]}
                                className={`w-full h-full object-cover ${
                                  cameraFacingModes[kind] === 'user' ? 'camera-video-front' : ''
                                }`}
                                muted
                                playsInline
                                autoPlay
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {(photos[kind] || []).map((photo, idx) => (
                                <div key={`${kind}-${idx}`} className="relative border rounded-lg overflow-hidden bg-white">
                                  {photo.dataUrl || photo.url ? <img src={photo.dataUrl || photo.url} alt={photo.name} className="w-full h-24 object-cover" />
                                    : <Text className="p-3">Fotografía guardada en DANA</Text>}
                                  <button
                                    type="button"
                                    className="absolute top-1 right-1 bg-rose-600 text-white text-xs px-2 py-1 rounded"
                                    onClick={() => removePhoto(kind, idx)}
                                  >
                                    x
                                  </button>
                                  <Text className="text-[11px] p-1 truncate">{photo.name}</Text>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {s.id === '15' && (
                    <Field label="Conclusiones generales del inspector" className="legacy-field">
                      <Textarea
                        value={form.conclusionesInspector}
                        onChange={(e) => updateField('conclusionesInspector', e.target.value)}
                      />
                    </Field>
                  )}
                </div>
              </div>
              );
            })}

            <div className="legacy-section-card p-4">
              <div className="legacy-actions">
                <button type="button" className="action-btn action-btn-secondary" onClick={newInspection}>Nueva inspección</button>
                <button type="submit" className="action-btn action-btn-primary" disabled={submitting}>
                  {submitting ? 'Guardando...' : 'Guardar avance'}
                </button>
              </div>
            </div>
            </fieldset>
          </form>
          {status && <Text role="status" aria-live="polite" className="mt-3">{status}</Text>}
        </div>
      </div>
    </main>
  );
}
