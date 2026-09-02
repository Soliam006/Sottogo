# Entornos: PRE y PRO

Voyago tiene dos entornos. Cada uno con **su propia base de datos de Supabase**,
para que probar una migración no toque nunca los datos reales.

| | PRE | PRO |
|---|---|---|
| Rama | `develop` | `main` |
| Proyecto de Supabase | `voyago-pre` | el que ya existe |
| Despliegue en Vercel | Preview | Production |
| Datos | de prueba, desechables | reales |

## Lo bueno: solo cambian dos variables

Todo lo demás (Photon, tipos de cambio, estilo del mapa) es idéntico en los dos
entornos. Lo único que distingue PRE de PRO es:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

## Montar PRE desde cero

### 1. Crear el proyecto de Supabase

En [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.

- Nombre: `voyago-pre`
- Región: la misma que producción, para que los tiempos se parezcan
- Contraseña de base de datos: distinta a la de producción

> El plan gratuito permite un número limitado de proyectos activos y **pausa los
> que llevan tiempo sin uso**. Si PRE se queda dormido, se reactiva desde el
> panel: no se pierde nada, pero el primer arranque tarda.

### 2. Crear el esquema

SQL Editor → pegar `supabase/schema.sql` entero → ejecutar.

Es idempotente: crea tablas, funciones, políticas RLS, el bucket `trip-media` y
la publicación de tiempo real. Se puede reejecutar sin romper nada.

### 3. Permitir el acceso desde las URL de PRE

Authentication → **URL Configuration**. Sin esto, el registro y el inicio de
sesión fallan en las previews.

- *Site URL*: la URL de la preview de `develop`
- *Redirect URLs*: añade también `http://localhost:3000/**` y el comodín de las
  previews de Vercel (`https://*-soliam006.vercel.app/**` o el patrón que te dé
  Vercel), porque cada rama genera una URL distinta

### 4. Copiar las claves

Project Settings → **API**: `Project URL` y la clave `anon` `public`.

## En local

**Trabaja siempre contra PRE.** Las credenciales de producción no deberían estar
en tu portátil: viven solo en Vercel.

Deja tu `.env.local` apuntando a `voyago-pre`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<ref-de-pre>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<clave anon de pre>
```

El resto del archivo se queda como está. Arranca normal:

```bash
npm run dev
```

`.env.local` está en `.gitignore`, igual que cualquier `.env*.local`.

> Si algún día necesitas mirar producción desde local, cambia las dos líneas,
> haz lo que tengas que hacer y **devuélvelas a PRE**. No dejes las claves de
> PRO ahí: es demasiado fácil ejecutar un borrado creyendo que estás en pruebas.

## En Vercel

Vercel ya distingue Production de Preview, así que basta con dar cada valor a su
entorno. Settings → **Environment Variables**, y para cada una de las dos claves:

| Variable | Environment | Valor |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production | proyecto de PRO |
| `NEXT_PUBLIC_SUPABASE_URL` | Preview, Development | proyecto de PRE |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production | clave de PRO |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Preview, Development | clave de PRE |

La misma variable puede existir dos veces con ámbitos distintos: es el mecanismo
propio de Vercel para esto.

A partir de ahí, cada rama que no sea `main` despliega contra PRE
automáticamente. Si quieres una URL estable para PRE (en vez de una distinta por
commit), en Settings → Domains puedes asignar un subdominio a la rama `develop`.

**Después de cambiar variables hay que redesplegar**: Vercel las inyecta al
construir, no al servir.

## Cambios de esquema

1. Se edita `supabase/schema.sql` en la rama de trabajo.
2. Se ejecuta **en PRE** y se prueba de verdad, con datos.
3. El PR a `develop` marca la casilla de base de datos de la plantilla.
4. En el PR de release a `main`, se ejecuta **en PRO** antes de fusionar.

Como el esquema es idempotente, el orden natural es siempre el mismo: primero
PRE, luego PRO.

## Datos de prueba

PRE nace vacío. Regístrate con un correo cualquiera y crea un viaje a mano; es
más rápido que copiar datos y evita arrastrar información real a un entorno con
menos cuidado.

Si en algún momento hace falta un juego de datos repetible, el sitio para
ponerlo es un `supabase/seed.sql` aparte, nunca dentro de `schema.sql`.
