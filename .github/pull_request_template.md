<!--
  Los PR de funcionalidad van contra `develop` (PRE).
  Solo los de `develop` -> `main` llevan cambios a produccion (PRO).
-->

## Qué cambia

<!-- Una o dos frases. Si arregla un issue: "Cierra #12". -->

## Por qué

<!-- El problema que resuelve, no la solucion otra vez. Si hay numeros
     (tamanos, tiempos, filas afectadas), aqui es donde valen mas. -->

## Cómo se ha comprobado

<!-- Lo que has ejecutado o mirado de verdad. Si algo no has podido probar,
     dilo: es mas util saber que falta que suponer que esta cubierto. -->

- [ ] `npx tsc --noEmit`
- [ ] `npx eslint src`
- [ ] `npm run build`
- [ ] Probado a mano en PRE

## Qué NO entra

<!-- Lo que queda fuera a proposito, y lo que has detectado de paso pero no has
     tocado. Evita que el siguiente lo busque creyendo que se olvido. -->

## Base de datos

<!-- Marca si aplica. Si hay SQL, hay que ejecutarlo en PRE antes de fusionar y
     en PRO antes de desplegar. -->

- [ ] No toca la base de datos
- [ ] Requiere ejecutar `supabase/schema.sql` (es idempotente)
- [ ] Requiere una migracion manual, descrita arriba
