/**
 * Lectura del EXIF de una foto: donde y cuando se hizo.
 *
 * Hace falta porque el resto del canal lo pierde: la imagen se reduce a 2048 px
 * con un canvas antes de subirla, y un canvas devuelve pixeles pelados, sin
 * ningun metadato. Asi que esto se lee del archivo ORIGINAL, antes de tocarlo.
 *
 * Solo se busca lo que sirve para colocar la foto en el viaje:
 *   - las coordenadas, para situarla y asignarle el lugar mas cercano;
 *   - la fecha de disparo, que hasta ahora se sacaba de `file.lastModified`
 *     —cuando se copio el archivo, no cuando se hizo la foto— y por eso la
 *     galeria agrupaba por dias que no eran.
 *
 * Capa pura: recibe bytes y devuelve datos. Sin DOM, sin red.
 */

export interface PhotoExif {
  latitude: number | null;
  longitude: number | null;
  /** Instante ISO. Ver `exifDateToISO` para por que se trata como UTC. */
  takenAt: string | null;
}

const SIN_EXIF: PhotoExif = { latitude: null, longitude: null, takenAt: null };

/** Tipos TIFF, por su codigo. Solo los que aparecen en lo que leemos. */
const BYTES_POR_TIPO: Record<number, number> = {
  1: 1, // BYTE
  2: 1, // ASCII
  3: 2, // SHORT
  4: 4, // LONG
  5: 8, // RATIONAL
  7: 1, // UNDEFINED
  9: 4, // SLONG
  10: 8, // SRATIONAL
};

const TAG_EXIF_IFD = 0x8769;
const TAG_GPS_IFD = 0x8825;
const TAG_FECHA_ORIGINAL = 0x9003;
const TAG_FECHA_DIGITALIZADA = 0x9004;
const TAG_GPS_LAT_REF = 0x0001;
const TAG_GPS_LAT = 0x0002;
const TAG_GPS_LNG_REF = 0x0003;
const TAG_GPS_LNG = 0x0004;

/**
 * Lee el EXIF de un JPEG.
 *
 * Nunca lanza: una foto sin EXIF, con el EXIF roto o que no sea un JPEG es un
 * caso corriente —una captura de pantalla, una imagen recibida por mensajeria,
 * un PNG— y no puede impedir subirla. Devuelve nulos y el flujo manual sigue.
 */
export function readExif(buffer: ArrayBuffer): PhotoExif {
  try {
    return parse(new DataView(buffer));
  } catch {
    return SIN_EXIF;
  }
}

function parse(view: DataView): PhotoExif {
  const tiff = findExifTiffOffset(view);
  if (tiff === null) return SIN_EXIF;

  // El bloque TIFF dice en sus dos primeros bytes como se leen los numeros:
  // "II" (Intel) little endian, "MM" (Motorola) big endian.
  const marca = view.getUint16(tiff, false);
  if (marca !== 0x4949 && marca !== 0x4d4d) return SIN_EXIF;
  const le = marca === 0x4949;

  if (view.getUint16(tiff + 2, le) !== 0x002a) return SIN_EXIF;

  const ifd0 = tiff + view.getUint32(tiff + 4, le);
  const raiz = readIfd(view, tiff, ifd0, le);

  // Las coordenadas y la fecha viven en dos sub-bloques a los que IFD0 apunta.
  const gps = raiz.get(TAG_GPS_IFD);
  const exif = raiz.get(TAG_EXIF_IFD);

  const coords = gps ? readGps(view, tiff, tiff + valorEscalar(view, gps, le), le) : null;
  const fecha = exif ? readFecha(view, tiff, tiff + valorEscalar(view, exif, le), le) : null;

  return {
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
    takenAt: fecha,
  };
}

/**
 * Localiza el bloque TIFF dentro del JPEG.
 *
 * Un JPEG es una cadena de segmentos `FF xx` con su longitud. El EXIF va en el
 * APP1 (`FFE1`) que empieza por "Exif\0\0". Se recorren los segmentos en vez de
 * buscar la cadena a lo bruto: una miniatura incrustada tambien contiene
 * "Exif" y buscar a ciegas caeria en ella.
 */
function findExifTiffOffset(view: DataView): number | null {
  if (view.byteLength < 4) return null;
  if (view.getUint16(0, false) !== 0xffd8) return null; // no es un JPEG

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) return null;

    const marcador = view.getUint8(offset + 1);
    // Inicio de los datos comprimidos: a partir de aqui ya no hay metadatos.
    if (marcador === 0xda) return null;

    const longitud = view.getUint16(offset + 2, false);
    if (longitud < 2) return null;

    if (marcador === 0xe1 && offset + 4 + 6 <= view.byteLength) {
      const cabecera = String.fromCharCode(
        view.getUint8(offset + 4),
        view.getUint8(offset + 5),
        view.getUint8(offset + 6),
        view.getUint8(offset + 7),
      );
      if (cabecera === "Exif") return offset + 10;
    }

    offset += 2 + longitud;
  }
  return null;
}

interface Entrada {
  tipo: number;
  cuenta: number;
  /** Desplazamiento donde estan los datos, ya resuelto. */
  datos: number;
}

/**
 * Lee un directorio de entradas (IFD) y devuelve sus etiquetas.
 *
 * Cada entrada son 12 bytes: etiqueta, tipo, cuantos, y el valor. El valor cabe
 * ahi mismo si ocupa 4 bytes o menos; si no, esos 4 bytes son un desplazamiento
 * relativo al inicio del TIFF. Eso se resuelve aqui para que quien lea no tenga
 * que volver a pensarlo.
 */
function readIfd(
  view: DataView,
  tiff: number,
  ifd: number,
  le: boolean,
): Map<number, Entrada> {
  const entradas = new Map<number, Entrada>();
  if (ifd + 2 > view.byteLength) return entradas;

  const total = view.getUint16(ifd, le);
  for (let i = 0; i < total; i += 1) {
    const base = ifd + 2 + i * 12;
    if (base + 12 > view.byteLength) break;

    const etiqueta = view.getUint16(base, le);
    const tipo = view.getUint16(base + 2, le);
    const cuenta = view.getUint32(base + 4, le);

    const ancho = BYTES_POR_TIPO[tipo];
    if (!ancho) continue; // tipo que no conocemos: se ignora la entrada

    const bytes = ancho * cuenta;
    const datos = bytes <= 4 ? base + 8 : tiff + view.getUint32(base + 8, le);
    if (datos < 0 || datos + Math.min(bytes, 4) > view.byteLength) continue;

    entradas.set(etiqueta, { tipo, cuenta, datos });
  }
  return entradas;
}

/** El primer valor de una entrada, como numero. */
function valorEscalar(view: DataView, entrada: Entrada, le: boolean): number {
  return leerNumero(view, entrada.datos, entrada.tipo, le);
}

function leerNumero(view: DataView, offset: number, tipo: number, le: boolean): number {
  switch (tipo) {
    case 1:
    case 7:
      return view.getUint8(offset);
    case 3:
      return view.getUint16(offset, le);
    case 4:
      return view.getUint32(offset, le);
    case 9:
      return view.getInt32(offset, le);
    case 5: {
      const den = view.getUint32(offset + 4, le);
      return den === 0 ? 0 : view.getUint32(offset, le) / den;
    }
    case 10: {
      const den = view.getInt32(offset + 4, le);
      return den === 0 ? 0 : view.getInt32(offset, le) / den;
    }
    default:
      return 0;
  }
}

interface Coordenadas {
  latitude: number;
  longitude: number;
}

function readGps(view: DataView, tiff: number, ifd: number, le: boolean): Coordenadas | null {
  const gps = readIfd(view, tiff, ifd, le);

  const lat = gradosDesde(view, gps.get(TAG_GPS_LAT), le);
  const lng = gradosDesde(view, gps.get(TAG_GPS_LNG), le);
  if (lat === null || lng === null) return null;

  const refLat = letra(view, gps.get(TAG_GPS_LAT_REF));
  const refLng = letra(view, gps.get(TAG_GPS_LNG_REF));

  const latitude = refLat === "S" ? -lat : lat;
  const longitude = refLng === "W" ? -lng : lng;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

  // Algunas camaras escriben el bloque GPS vacio, con ceros, cuando no habia
  // senal. La isla Nula esta en mitad del Atlantico: nadie hace fotos ahi.
  if (latitude === 0 && longitude === 0) return null;

  return { latitude, longitude };
}

/**
 * Los tres RATIONAL de grados, minutos y segundos, ya sumados.
 *
 * Un denominador a cero invalida la coordenada entera en vez de contar como un
 * cero. Tratarlo como cero es peor que no saber nada: con la longitud buena y
 * la latitud a cero, la foto aterriza en el golfo de Guinea con toda la
 * confianza del mundo.
 */
function gradosDesde(view: DataView, entrada: Entrada | undefined, le: boolean): number | null {
  if (!entrada || entrada.tipo !== 5 || entrada.cuenta < 3) return null;
  if (entrada.datos + 24 > view.byteLength) return null;

  let total = 0;
  for (let i = 0; i < 3; i += 1) {
    const base = entrada.datos + i * 8;
    const denominador = view.getUint32(base + 4, le);
    if (denominador === 0) return null;
    total += view.getUint32(base, le) / denominador / 60 ** i;
  }
  return total;
}

function letra(view: DataView, entrada: Entrada | undefined): string | null {
  if (!entrada || entrada.datos >= view.byteLength) return null;
  return String.fromCharCode(view.getUint8(entrada.datos)).toUpperCase();
}

function readFecha(view: DataView, tiff: number, ifd: number, le: boolean): string | null {
  const exif = readIfd(view, tiff, ifd, le);
  const entrada = exif.get(TAG_FECHA_ORIGINAL) ?? exif.get(TAG_FECHA_DIGITALIZADA);
  if (!entrada || entrada.tipo !== 2) return null;

  const largo = Math.min(entrada.cuenta, 20);
  if (entrada.datos + largo > view.byteLength) return null;

  let texto = "";
  for (let i = 0; i < largo; i += 1) {
    const codigo = view.getUint8(entrada.datos + i);
    if (codigo === 0) break;
    texto += String.fromCharCode(codigo);
  }
  return exifDateToISO(texto);
}

/**
 * "2026:04:09 18:30:00" -> "2026-04-09T18:30:00.000Z"
 *
 * El EXIF guarda la hora LOCAL del sitio donde se disparo, sin zona horaria:
 * una foto de las seis de la tarde en Tokio pone las 18:00 y no dice que sea
 * Tokio. Por eso se trata como UTC en vez de convertirla desde la zona de quien
 * sube: asi `takenAt.slice(0, 10)` devuelve el dia que vivio quien hizo la
 * foto, que es por donde agrupa la galeria. Convertirla daria el dia de quien
 * la sube, y una foto de la noche en Japon subida desde Madrid saltaria de dia.
 */
export function exifDateToISO(texto: string): string | null {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(texto.trim());
  if (!m) return null;

  const [, ano, mes, dia, hora, minuto, segundo] = m;
  const fecha = new Date(
    Date.UTC(+ano, +mes - 1, +dia, +hora, +minuto, +segundo),
  );
  if (Number.isNaN(fecha.getTime())) return null;

  // Date.UTC acepta meses y dias fuera de rango y los desborda al mes
  // siguiente. Una fecha imposible es EXIF corrupto, no una fecha.
  if (fecha.getUTCFullYear() !== +ano || fecha.getUTCMonth() !== +mes - 1) return null;

  return fecha.toISOString();
}
