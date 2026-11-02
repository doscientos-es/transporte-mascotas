# Rutas con Google Maps (`route-times`)

El panel calcula con Google Routes API:

- **Tiempo entre paradas** de cada ruta diaria (Compute Routes).
- **Posición recomendada de una parada nueva** (Compute Route Matrix).

Si Google no está configurado o falla, el panel usa Valhalla y, si tampoco responde, OSRM (gratuitos y menos precisos). Por eso la app **no da error** si falta la clave: simplemente calcula peor. Para saber qué fuente se está usando, mira el paso 6.

La clave de Google nunca llega al navegador: la usa la Edge Function `route-times`, que sólo acepta usuarios con rol `admin`.

## Estado actual

- El código del panel y la función `route-times` (versión 2, con Compute Route Matrix) ya están desplegados en el proyecto `ajhooctikydsqimotogf` con `verify_jwt = true`.
- **Lo único que falta es crear la API key de Google y guardarla como secreto.**

## Pasos

### 1. Proyecto de Google Cloud (lo hace el cliente)

1. Entra en <https://console.cloud.google.com> con la cuenta de la empresa.
2. Crea un proyecto (p. ej. `kache-envios`) o elige uno existente.
3. **Facturación**: asocia una cuenta de facturación al proyecto (menú _Facturación_). Sin ella la API devuelve error 403. Google da un crédito mensual gratuito, pero la tarjeta es obligatoria.

### 2. Activar la API

1. Menú _APIs y servicios_ → _Biblioteca_.
2. Busca **Routes API** y pulsa _Habilitar_.

No hace falta activar Directions API, Distance Matrix API, Geocoding ni Places: el código sólo usa Routes API.

### 3. Crear la API key

1. _APIs y servicios_ → _Credenciales_ → _Crear credenciales_ → _Clave de API_.
2. Edita la clave (_Restricciones de API_ → _Restringir clave_) y marca **solo Routes API**.
3. En _Restricciones de aplicación_ deja **Ninguna**. No uses restricción por IP ni por dominio: la llama Supabase desde servidores con IP variable.

### 4. Guardar la clave como secreto en Supabase

Elige una opción (no pegues la clave en el chat, en el código ni en un commit):

- **Panel**: proyecto `transporte-mascotas` → _Edge Functions_ → _Secrets_ → añadir `GOOGLE_MAPS_API_KEY` con el valor de la clave.
- **CLI** (con un archivo local no versionado `.env.google` que contenga `GOOGLE_MAPS_API_KEY=...`):

  ```
  supabase secrets set --env-file .env.google --project-ref ajhooctikydsqimotogf
  ```

Los secretos se aplican al instante; no hace falta volver a desplegar.

### 5. Límite de gasto (recomendado, cliente)

En Google Cloud: _Facturación_ → _Presupuestos y alertas_ → crea un presupuesto con alerta. Y en _APIs y servicios_ → _Routes API_ → _Cuotas_, pon un tope diario de solicitudes.

### 6. Comprobar que funciona

1. Entra en el panel como administrador y abre una ruta diaria con al menos dos paradas con coordenadas.
2. Encima del mapa aparece el panel de verificación:
   - **Verde, «Verificado con Google Maps»**: los tiempos guardados coinciden con los de Google. Muestra conducción total, kilómetros y, en «Ver tramos», cada tramo.
   - **Ámbar, «Google calcula X más/menos»**: hay diferencia. El botón «Usar tiempos de Google» guarda los de Google sin volver a consultarlos.
   - **Gris**: Google no está disponible (falta la clave o ha fallado) y se usan estimaciones.
3. En el mapa se dibuja la carretera real de cada tramo (se traza con una animación) con una etiqueta de minutos y km. Si el mapa une las paradas con líneas rectas, Google no ha respondido.
4. Si necesitas confirmarlo a nivel técnico, en la pestaña _Red_ del navegador busca la petición `route-times`: `200` con `legs` (o `matrix` al añadir una parada) significa que Google responde.

La verificación se hace al abrir la ruta y cada vez que cambian las paradas o su orden. Se guarda en memoria durante la sesión, así que volver a abrir la misma ruta no vuelve a facturar. No cambia nada en la base de datos.

| Respuesta de `route-times`             | Causa                                                                   |
| -------------------------------------- | ----------------------------------------------------------------------- |
| `503 Google Maps no está configurado.` | Falta el secreto `GOOGLE_MAPS_API_KEY` (paso 4).                        |
| `502 Google Routes 403`                | Routes API no activada, sin facturación o clave restringida a otra API. |
| `502 Google Routes 400`                | Coordenadas inválidas en alguna parada.                                 |
| `502 Google Routes 429`                | Cuota agotada (paso 5).                                                 |
| `401` / `No tienes permisos…`          | El usuario no es `admin` o la sesión caducó.                            |

## Límites y comportamiento a tener en cuenta

- Los tiempos son **sin tráfico en tiempo real** (`TRAFFIC_UNAWARE`, SKU Essentials, el más barato). Son los tiempos típicos de conducción de Google Maps. Para incluir tráfico habría que cambiar a `TRAFFIC_AWARE` y enviar una hora de salida; cuesta más.
- Rutas de hasta 120 paradas (se parten en tramos de 12). La recomendación de posición de una parada nueva funciona con hasta 25 paradas; con más, usa Valhalla/OSRM.
- Las paradas sin coordenadas guardadas se localizan con Photon (gratuito). Para máxima coherencia con Google conviene que cada parada tenga latitud y longitud al guardarla.

## Redesplegar la función (sólo si se cambia el código)

```
supabase functions deploy route-times --project-ref ajhooctikydsqimotogf
```

`supabase/config.toml` ya fija `verify_jwt = true` para esta función.
