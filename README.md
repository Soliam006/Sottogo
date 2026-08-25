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
