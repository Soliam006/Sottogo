# Cómo se trabaja en Voyago

Dos entornos. `develop` es **PRE**, donde se prueba; `main` es **PRO**, lo que
ve la gente.

```
  issue                                            Kanban: Por hacer
    │
    ▼
  feat/lo-que-sea ──PR──► develop  (PRE)           Kanban: En curso → En PRE
    │                        │
    │                        │  se prueba de verdad, con datos de PRE
    │                        ▼
    └──────────────────►  main     (PRO)           Kanban: Hecho
                          PR de release
```

Nada llega a `main` sin haber pasado por `develop`.

## El día a día

**1. Un issue primero.** Aunque lo vayas a hacer tú en diez minutos. Es lo que
deja rastro de por qué existe un cambio, y lo que llena el tablero.

**2. Una rama por issue**, salida de `develop`:

```bash
git switch develop && git pull
git switch -c feat/mapa-agrupar-marcadores
```

Prefijos: `feat/` funcionalidad · `fix/` corrección · `perf/` rendimiento ·
`chore/` mantenimiento · `docs/` documentación.

**3. Commits que expliquen el porqué.** El formato es
`tipo(ámbito): qué cambia`, y el cuerpo cuenta el motivo y, si los hay, los
números. Compara:

```
malo   arreglado el visor
bien   fix(visor): la foto entera cabe y los diálogos dejan de quedar detrás
```

**4. PR hacia `develop`.** La plantilla se rellena sola; no la borres. El CI
tiene que estar en verde: tipos, estilo y build.

**5. Probar en PRE.** Si el cambio toca la base de datos, ejecuta
`supabase/schema.sql` en PRE antes de dar el PR por bueno. Es idempotente.

**6. Release a PRO.** Un PR de `develop` a `main` que agrupa lo probado. Ese es
el momento de ejecutar el SQL en producción, si toca.

## Reglas de las ramas

`main` y `develop` solo admiten cambios por PR y con el CI en verde. Como admin
puedes saltártelo en una urgencia, pero entonces dejas el rastro en un issue.

## Antes de abrir un PR

```bash
npx tsc --noEmit
npx eslint src
npm run build
```

Es exactamente lo que ejecuta el CI. Si pasa aquí, pasa allí.

## La base de datos

Cada entorno tiene la suya: `voyago-pre` para PRE, el proyecto original para
PRO. Solo cambian dos variables (`NEXT_PUBLIC_SUPABASE_URL` y
`NEXT_PUBLIC_SUPABASE_ANON_KEY`); el resto de la configuración es idéntica.

En local trabajas **siempre contra PRE**. Las claves de producción no deberían
estar en tu portátil.

`supabase/schema.sql` es idempotente: se ejecuta primero en PRE, se prueba con
datos, y solo entonces en PRO al hacer el release.

El montaje completo, paso a paso, está en [docs/entornos.md](docs/entornos.md).
