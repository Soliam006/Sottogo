# Sottogo
Aplicación web colaborativa para organizar y recordar viajes, combinando itinerarios, lugares reales, mapas interactivos, gastos, fotografías y momentos en un único espacio compartido.
# Voyago

> Un espacio digital colaborativo para vivir, organizar y recordar un viaje.

Todo gira alrededor de una entidad central, el **Viaje**. Gastos, lugares, fotos,
itinerario y momentos no son módulos aislados: están conectados entre sí a través
de lugares reales del mundo.

---

## Por qué este stack

La funcionalidad principal es el **mapa**, así que la decisión técnica se tomó desde ahí:

| Pieza | Elección | Motivo |
|---|---|---|
| Lenguaje | **TypeScript** | Es el único ecosistema donde viven las librerías de mapas web maduras (MapLibre / Mapbox / Leaflet). Cualquier backend en otro lenguaje acabaría igualmente sirviendo un cliente JS para el mapa. |
| Mapa | **MapLibre GL JS 4** | WebGL, vectorial, 60 fps con miles de marcadores, sin API key ni licencia propietaria. Fork libre de Mapbox GL. |
| Framework | **Next.js 15 (App Router)** | Permite que las *API keys* de proveedores externos vivan solo en el servidor (Route Handlers) mientras el mapa se renderiza en cliente. |
| Estilos | **Tailwind CSS 4** | Tokens de tema en CSS puro, modo oscuro por clase. |
| Backend | **Supabase** (Postgres + Auth + Storage + Realtime) | El modelo del brief es claramente relacional. RLS en la propia base de datos hace imposible leer un viaje del que no eres miembro, aunque un cliente esté comprometido. Realtime cubre "Will añade un gasto y Mei lo ve". |
| Lugares | **Photon (OpenStreetMap)** por defecto, **Google Places** opcional | Datos reales sin tarjeta de crédito para empezar; la interfaz `PlacesProvider` permite cambiar de proveedor sin tocar la UI. |
| Divisas | **Frankfurter (BCE)** | Sin key. Detrás de la interfaz `ExchangeRateProvider`. |

No hay datos simulados en ninguna pantalla. Si algo no está configurado, la app lo dice.

---

## Puesta en marcha

### 1. Dependencias

```bash
npm install
```

### 2. Proyecto de Supabase

1. Crea un proyecto gratuito en <https://supabase.com/dashboard>.
2. Abre **SQL Editor** y ejecuta el contenido completo de [`supabase/schema.sql`](supabase/schema.sql).
   Crea tablas, funciones, triggers, políticas RLS, el bucket de almacenamiento y la publicación de Realtime.
   Es idempotente: puedes volver a ejecutarlo.
3. En **Authentication → Providers**, deja activado *Email*.
   Para probar en local sin correo, desactiva *Confirm email*.

### 3. Variables de entorno

```bash
cp .env.example .env.local
```

Rellena como mínimo:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

### 4. Arrancar

```bash
npm run dev      # http://localhost:3000
npm run build    # build de producción
npm run typecheck
```

---

## Arquitectura

```
src/
├── core/                 Dominio puro. No conoce React, Next ni Supabase.
│   ├── models/           Tipos del negocio (Trip, Place, TripPlace, Expense…)
│   ├── places/           PlacesProvider + Photon + Google  (intercambiables)
│   ├── currency/         ExchangeRateProvider + Frankfurter
│   ├── expenses/         Balance, liquidación y categorías (algoritmos puros)
│   └── identity/         Parseo de `Nombre#Código`
│
├── services/             Infraestructura. Traduce el mundo exterior al dominio.
│   ├── supabase/         Clientes (browser / server / middleware)
│   ├── repositories/     Un repositorio por agregado; devuelven modelos de dominio
│   ├── storage/          Subida de fotos, miniaturas y URLs firmadas
│   ├── api/              Clientes de nuestras propias rutas /api
│   └── mappers.ts        snake_case (BD) → camelCase (dominio), en un único sitio
│
├── hooks/                Estado de carga, realtime, debounce, moneda de lectura
├── components/           UI. Sin lógica de negocio.
│   ├── providers/        Session, Trip, Theme, Toast
│   ├── ui/               Sistema de diseño (Button, Card, Modal, estados…)
│   ├── map/              MapLibre encapsulado
│   └── …                 Un módulo por sección
└── app/                  Rutas (App Router) + Route Handlers
```

**Regla que se respeta en todo el proyecto:** los componentes visuales no hablan
con la base de datos ni con proveedores externos. Llaman a repositorios y servicios.

### Flujo de una búsqueda de lugar

```
PlaceSearchInput  →  /api/places/search  →  getPlacesProvider()  →  Photon | Google
      (cliente)          (servidor)            (factory)              (externo)
                                   ↓
                         PlaceSearchResult
                                   ↓
              placesRepo.addToTrip()  →  rpc upsert_place  →  places (catálogo global)
                                                            →  trip_places (contexto del viaje)
```

La separación **`Place` / `TripPlace`** es la que permite que Senso-ji sea el mismo
lugar en todos los viajes, pero con notas, valoración y estado propios en cada uno.

---

## Itinerario

- **Un dia por pestana**, como en Gastos. Las pestanas son el rango del viaje
  unido a las fechas que tengan actividades, asi que mover algo a un dia fuera
  del viaje no lo esconde.
- **El orden se DERIVA de (fecha, hora de inicio).** `itinerary_items` no tiene
  columna `position` y no se guarda ninguna: cambiar la hora recoloca la
  actividad, y cambiar la fecha la mueve de pestana. Sin hora va al final del
  dia; a igualdad de hora desempata el titulo, para que el orden sea estable.
- **Editar reutiliza el modal de alta.** El mismo formulario crea y actualiza
  segun reciba o no una actividad. Al guardar, la pestana **sigue** a la
  actividad: si le cambiaste la fecha, la vista salta a su nuevo dia.
- Se anadio la **hora de fin** al formulario: existia en el modelo y en la base
  de datos (`end_time`) pero no habia forma de rellenarla.

`src/core/calendar/days.ts` es la base compartida por Gastos e Itinerario
(aritmetica de fechas en UTC, union de dias y dia por defecto); cada seccion
pone encima solo lo suyo.

### Dos mapas, dos contextos

```
TripPlace          -> mapa GENERAL: lugares, fotos, momentos y gastos
ItineraryLocation  -> mapa del ITINERARIO: solo actividades planificadas
```

Antes el formulario del itinerario usaba `PlacePicker`, que da de alta un
`trip_place`; por eso el mapa general se llenaba de puntos que solo servian
para planificar. Ahora la actividad guarda su ubicacion propia
(`itinerary_items.latitude/longitude/location_name/place_id`) con el mismo
selector que fotos, momentos y reservas.

**`place_id` apunta al catalogo global `places`, no a `trip_places`.** Ahi esta
la clave: se reutiliza el lugar real (nombre, direccion, provider +
`external_place_id`) sin duplicar nada, y sin que el punto entre en el mapa
general — que solo dibuja `trip_places`.

- El tab **🗺️ Mapa** del Itinerario respeta la fecha seleccionada: marcadores
  numerados por turno y una linea discontinua que une las paradas del dia. Es
  una ayuda visual del recorrido, no una ruta calculada.
- `itineraryLocation()` cae al `trip_place` heredado si una fila antigua aun no
  tiene coordenadas propias, asi que **nada deja de funcionar** durante la
  migracion.
- La migracion del esquema copia las coordenadas del `trip_place` enlazado a la
  actividad. **No borra ningun `trip_place`**: puede que el viajero quiera
  conservarlo en el mapa general.

---

## Gastos

- **Pestanas por dia.** Una pestana por cada dia del viaje, mas "Todos". La
  logica vive en `src/core/expenses/days.ts` y las pestanas son la union del
  rango del viaje con las fechas que tienen gastos: un gasto registrado antes de
  salir o despues de volver tiene su dia y nunca queda escondido.
  Estando de viaje la vista se abre en **Hoy**; fuera del viaje, en "Todos".
- **El filtro solo afecta a Movimientos.** Balance y Por categoria son de TODO
  el viaje: quien debe a quien no tiene sentido por dias.
- **En movil el Balance va primero.** Es lo que se quiere ver al abrir Gastos.
  En escritorio vuelve a su columna de la derecha con `lg:order-2`, asi que la
  distribucion de siempre no cambia.

---

## Momentos

Muro de tarjetas donde manda la fotografia: ocupa el ancho completo de la
tarjeta, sin margenes, y el resto se apoya debajo.

- **Sin "me gusta", a proposito.** Las unicas dos acciones son comentar y
  compartir.
- **Comentarios** en `moment_comments`, plegados por defecto (se ven los dos
  ultimos) y desplegables. Tienen politicas RLS propias y no entran en el bucle
  `%I_member_all`: cualquiera del viaje los lee, nadie publica en nombre de
  otro, y borrar es cosa del autor o del propietario del viaje.
  Se cargan de una vez para todo el viaje y la vista los agrupa por momento:
  una consulta y una suscripcion, no una por tarjeta.
- **Carrusel** con `scroll-snap` nativo: en movil se pasa con el dedo con el
  desplazamiento del sistema, y en escritorio aparecen flechas al pasar el
  raton. El indice sale de la posicion real del scroll, asi que el contador
  acierta tambien al deslizar.
- **Compartir** usa `navigator.share` (la hoja nativa del movil). Fuera de
  contexto seguro o en navegadores sin soporte cae al portapapeles, y si
  tampoco hay portapapeles avisa: `src/lib/share.ts` distingue los cuatro
  desenlaces para que el boton nunca falle en silencio.

---

## Preparacion del viaje

Cuatro apartados en pestanas: **Vuelos**, **Hoteles**, **Coche** y **Otros**.

Los tres primeros son reservas y comparten UNA tabla, `trip_bookings`, con un
discriminante `kind`. No son tres tablas porque los tres tienen la misma forma
real: un proveedor, un localizador, un inicio y un fin y, a veces, un origen y
un destino.

```
vuelo   Iberia   IB6800   Madrid T4S  -> Tokio T3     12 abr 09:35 -> 13 abr 06:20
hotel   Gracery           Shinjuku                    check-in     -> check-out
coche   Hertz             Kioto       -> Kansai       recogida     -> devolucion
```

Lo que cambia entre tipos son los NOMBRES de cada campo, y eso vive en
`BOOKING_KINDS` (`src/core/bookings`): etiquetas, placeholders, que campos
aplican y los textos del estado vacio. Consecuencia practica: **anadir un tipo
nuevo** (tren, ferry, actividad) es una entrada en ese array y un valor en el
enum de la base de datos — ni el formulario ni la vista ni el repositorio
cambian.

- **"Otros" es la checklist de siempre**, movida a `ChecklistPanel`: mismos
  `checklist_items`, mismo repositorio y mismos elementos. No hay migracion.
- Las ubicaciones de hotel y coche reutilizan el buscador de lugares reales
  (`MemoryLocationPicker`) y guardan `place_id` cuando el lugar viene de ahi,
  pero **se pueden escribir a mano**: nada obliga a tener un `Place`.
- No se almacenan pasaportes, documentos de identidad ni tarjetas: solo los
  datos de la reserva.

---

## Iconografia

Sin emojis en la interfaz: el set es **Phosphor Icons**, centralizado en
`src/components/ui/icons.tsx`. Nadie importa de `@phosphor-icons/react`
directamente, asi que cambiar un icono o el grosor se hace en un unico sitio.

Los grosores dan la voz de la app:

| Grosor    | Donde |
|-----------|-------|
| `fill`    | navegacion activa, categorias, marcadores, acentos |
| `regular` | navegacion inactiva y acciones secundarias |
| `duotone` | ilustracion: estados vacios y placeholders grandes |

Dos detalles que conviene conocer:

- **`src/core` no conoce React**, asi que las categorias de gasto y los iconos
  del itinerario guardan una **clave** (`"food"`, `"temple"`) y es
  `components/ui/iconFor.tsx` quien la traduce a componente.
- **`itinerary_items.icon` guardaba el emoji en crudo.** `ItineraryItemIcon`
  pinta el icono si el valor es una clave conocida y, si no, muestra el texto
  original: las filas antiguas se siguen viendo y **no hace falta migrar datos**.
- **Los marcadores del mapa** los construye MapLibre con DOM imperativo, donde
  no caben componentes de React. `src/components/map/markerGlyphs.ts` tiene los
  mismos iconos como cadenas SVG, **extraidas del propio paquete** para no
  transcribir path data a mano.

Las banderas de pais (`flagEmoji`) siguen siendo emoji a proposito: son
banderas reales, no iconos, y Phosphor no las cubre.

---

## Mapa jerarquico

El mapa tiene dos niveles y dos conceptos de ubicacion que NO se mezclan:

```
Nivel 1  mapa global      TripPlace          Shinjuku, Kyoto, Akihabara
                          + "📸 12 · ✨ 4 · 💰 3"
   |  pulsar un lugar
   v
Nivel 2  mapa de recuerdos  latitude/longitude de cada foto y momento
                            Omoide Yokocho, la estacion, el ramen...
```

- **`TripPlace`** = lugar general del itinerario (contexto).
- **`Photo.latitude/longitude` y `Moment.latitude/longitude`** = donde ocurrio
  exactamente el recuerdo. Son independientes: una foto puede estar
  geolocalizada **sin** `tripPlaceId` y sin `placeId`.
- Al entrar en un lugar, los demas marcadores globales desaparecen, el mapa
  hace zoom y aparecen las ubicaciones exactas. `← Mapa del viaje` vuelve.
- `src/core/map/` es logica pura y testeable: `geo.ts` (haversine,
  metros/pixel, vecino mas cercano), `memories.ts` (`collectForPlace` +
  `clusterMemories`) y `location.ts`.
- **Agrupamiento**: el umbral se expresa en pixeles de pantalla y se traduce a
  metros con el zoom actual, asi que los grupos se abren solos al acercarse.
- **`collectForPlace` se calcula una sola vez** y alimenta tanto el recuento del
  marcador global como los puntos del nivel 2: el "12 fotos" que ves fuera y lo
  que encuentras dentro no pueden discrepar. Los recuerdos asociados al lugar
  pero sin coordenadas se declaran aparte ("N sin ubicación exacta").
- **`MemoryLocationField`** ("📍 ¿Dónde ocurrió?") ofrece las tres vias: GPS del
  dispositivo, busqueda de lugares reales y punto en el mapa. Si la ubicacion
  cae cerca de un lugar del itinerario lo **sugiere**, nunca lo impone.

---

## Layout y scroll

Un unico modelo para toda la app, definido en `globals.css`:

- **Un solo scroll vertical: el del documento.** Ninguna pestaña crea su propio
  contenedor de scroll. `html, body { overflow-x: clip }` (no `hidden`, que
  romperia el `sticky` del header y del sidebar) actua de red de seguridad.
- **`--app-header-h` / `--app-nav-h`** son la altura real del chrome fijo. Las
  aplican la barra superior y la navegacion inferior, y de ahi las consumen
  `.app-nav-gap` (hueco bajo el contenido) y `.app-fill` (viewport menos
  chrome). En `lg` la navegacion inferior desaparece y su token pasa a `0rem`,
  asi que no hay que duplicar reglas ni ajustar numeros a mano.
- **`.app-fill`** es la unica excepcion al scroll natural: la usa el mapa, que
  debe ocupar exactamente el hueco disponible.
- **`.app-page`** es el contenedor de todas las vistas (el `max-w-*` lo pone
  cada una). `.app-page .grid > * { min-width: 0 }` evita el desbordamiento
  clasico de los items de grid con contenido `truncate`.
- **`.app-scroll-y` / `.app-scroll-x`** marcan el scroll interno *intencionado*
  (modales, listas de sugerencias, carruseles) y lo aislan con
  `overscroll-behavior: contain`.

---

## Modelo de datos

`profiles · trips · trip_members · trip_invitations · places · trip_places ·
expenses · photos · itinerary_items · moments · moment_photos · journal_entries ·
checklist_items`

Puntos de diseño relevantes:

- **Identidad pública `Nombre#Código`.** Un trigger sobre `auth.users` crea el perfil
  y genera un código de 4 dígitos verificando que la pareja `(lower(name), code)` sea
  única. La búsqueda usa `find_profile_by_handle()`, que solo expone campos públicos.
- **Gastos.** Se guarda `amount` + `currency` **y además** `converted_amount` +
  `exchange_rate` congelados en el alta. Los balances no dependen de que una API
  externa siga viva ni cambian retroactivamente si el cambio se mueve.
- **Fotos.** La base de datos guarda ruta y metadatos; los ficheros van a un bucket
  **privado**, con miniatura generada en el navegador y URLs firmadas de 1 hora.
- **La foto es un recurso compartido.** Una misma fila `photos` puede alimentar a la
  vez la galería (`photos.in_gallery`), varios momentos (`moment_photos`) y varios
  gastos (`expenses.photo_id`). El archivo se sube **una sola vez**: subida física y
  fila de base de datos están separadas (`uploadPhotoFile` → `photosRepo.create`), y
  todo el contenido relacionado se crea a partir de esa Photo ya resuelta.
  `in_gallery` distingue una foto de galería de un ticket de gasto o un adjunto de
  momento: todas existen y se ven en su sitio, pero solo las marcadas llenan la galería.
- **Seguridad.** RLS en todas las tablas. `is_trip_member()` / `is_trip_owner()` son
  `SECURITY DEFINER` para evitar recursión infinita en las políticas.
  Las políticas del bucket comprueban que la primera carpeta de la ruta sea un viaje
  del que eres miembro.

---

## Estado de la implementación

Implementado y funcional de extremo a extremo:

- Autenticación, perfil e identificador `Nombre#Código`
- Creación de viajes, participantes, invitaciones con estados y notificaciones in-app
- Mapa (modos **Lugares** y **📸 Fotos**), búsqueda de lugares reales, punto en el mapa
- Lugares (quiero visitar / visitados, progreso, notas, valoración)
- Gastos: categorías, conversión de divisa, balance con liquidación, gráfico por categoría,
  alternar la moneda de lectura
- Galería: subida múltiple, miniaturas, agrupación por fecha / lugar / persona, destacadas
- Contenido relacionado: desde los modales de Foto, Momento y Gasto se puede crear el
  resto reutilizando la **misma** imagen (y desde la galería, con «📎 Hacer algo más»)
- Itinerario por días, Momentos, Preparación (checklist), Resumen del viaje, Configuración
- Tiempo real en gastos, fotos, lugares, itinerario, momentos, checklist e invitaciones

Preparado en el modelo pero **sin interfaz todavía**: `journal_entries` (diario largo).

Limitaciones conscientes:

- El reparto de gastos es a partes iguales entre los participantes. El modelo admite
  añadir después reparto por porcentajes sin migración destructiva.
- Los mapas base por defecto usan teselas de CARTO/OpenStreetMap, pensadas para
  desarrollo. Para producción, define `NEXT_PUBLIC_MAP_STYLE_URL` con un estilo propio
  (MapTiler, Stadia, Protomaps) y respeta sus condiciones de uso.
- Photon es un servicio público con límite de peticiones. Para producción, cambia a
  `PLACES_PROVIDER=google` o despliega tu propia instancia de Photon.
- No se almacenan pasaportes, documentos de identidad ni datos bancarios, por diseño.

---

## Cambiar de proveedor

**Lugares** → implementa `PlacesProvider` (`src/core/places/types.ts`) y regístralo en
`getPlacesProvider()`. Ninguna pantalla cambia.

**Divisas** → implementa `ExchangeRateProvider` (`src/core/currency/types.ts`) y úsalo en
`src/app/api/exchange-rate/route.ts`.

**Tipos de la base de datos** → si prefieres tipos generados en lugar del mapeo manual:

```bash
npx supabase gen types typescript --project-id <id> > src/services/supabase/database.types.ts
```

y parametriza los clientes con `createBrowserClient<Database>(…)`. El único fichero que
necesita ajustarse es `src/services/mappers.ts`.
