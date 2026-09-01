# Dossier de presentación · Voyago

Material comercial de la aplicación. **No forma parte del código de Voyago**:
esta carpeta es autocontenida y se puede borrar sin afectar al proyecto.

## Contenido

| Archivo | Qué es |
|---|---|
| `Voyago-dossier.pdf` | El documento final. 11 páginas, A4 vertical. |
| `voyago-dossier.html` | **La versión editable.** El PDF se genera desde aquí. |
| `capturas/` | 13 capturas de la interfaz real, 1000×1880 px (2×). |
| `assets/fotos/` | 12 ilustraciones de viaje en SVG, creadas para el dossier. |

## Cómo editarlo

Abre `voyago-dossier.html` en cualquier editor. Cada página es un
`<section class="page">` de 210×297 mm. La paleta y la tipografía salen de
`src/app/globals.css`, así que el dossier y la aplicación no se desincronizan.

## Cómo regenerar el PDF

```
chrome --headless=new --no-pdf-header-footer --virtual-time-budget=20000 \
  --print-to-pdf=Voyago-dossier.pdf voyago-dossier.html
```

En Windows, `chrome` suele estar en
`C:\Program Files\Google\Chrome\Application\chrome.exe`.

## Sobre las capturas

Son la interfaz **real** de Voyago: los componentes de `src/components`
renderizados con datos ficticios de un viaje a Japón en 2026. No hay maquetas
dibujadas a mano ni pantallas inventadas.

Dos apuntes sobre cómo se hicieron:

- Se usaron unos nombres y unas cifras inventados. No aparece ningún dato
  personal, ni correos, ni identificadores reales.
- El mapa se fotografió con un estilo de teselas propio
  (`NEXT_PUBLIC_MAP_STYLE_URL`) porque las teselas de CARTO que la aplicación
  usa por defecto llegan con una marca de agua **API KEY REQUIRED**. Es un
  problema real de la aplicación, no del dossier.

## Las ilustraciones

Son SVG generados para este documento: escenas planas de Japón (torii, Fuji,
Shibuya, ramen, bambú, sakura…). No son fotografías, no aparece ninguna persona
identificable y no hay derechos de terceros implicados. Se pueden sustituir por
fotografías reales cuando las haya.
