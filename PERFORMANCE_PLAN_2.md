# Plan Técnico de Performance — Ronda 2

Auditoría realizada el 2026-04-25. Estos son problemas no detectados en la ronda anterior.
Ordenados por impacto descendente. Cada ítem tiene archivo, líneas exactas e instrucciones precisas.

---

## Problema 1 — `refreshViewer` invalida todo el caché ante cualquier evento (CRÍTICO)

**Archivo principal:** `components/AppStateBootstrap.tsx`  
**Líneas clave:** 105–124

### Qué pasa

La función `refreshViewer` (línea 105) invalida simultáneamente los tags `["Session", "Viewer", "AdminAccess"]` y `["ProfileView"]`. Está registrada como listener de **5 eventos diferentes**:

```
"balance-updated"
"purchases-updated"
"earnings-updated"
"creator-status-updated"
"profile-updated"
```

Esos eventos se disparan desde al menos **8 lugares distintos** del frontend:
- `FeedLayout.tsx` líneas 524-525, 775-776
- `PerfilPageClient.tsx` líneas 766-767, 1093-1094
- `favoritos/page.tsx` líneas 80-81, 148-149
- `mensajes/page.tsx` líneas 1441-1442, 1674-1675
- `checkout/return/page.tsx` líneas 135, 143, 151

Cuando el usuario hace una compra, se emiten `purchases-updated` + `balance-updated` en el mismo tick. Eso invoca `refreshViewer` dos veces seguidas, forzando **dos refetches completos de `/api/me`** (el endpoint más pesado del sistema) en todos los componentes que consumen `["Session", "Viewer", "AdminAccess"]` simultáneamente.

### Por qué importa

`/api/me` hace 8 queries a la DB. Con 5 componentes suscritos a esos tags (TopBar, FeedLayout, SidebarLeft, SidebarRight, AuthGate), una sola compra puede generar **10+ requests** a `/api/me` en menos de un segundo.

### Qué hacer

**Paso 1 — Separar los tags por tipo de dato:**

En `lib/redux/api/sessionApi.ts` (líneas 365–398), dividir los tags actuales en tags más granulares:

- `"ViewerProfile"` — para username, avatar, fullName, bio (cambia al editar perfil)
- `"ViewerAccess"` — para roles, permisos, authorStatus (cambia al aprobar/revocar)
- `"ViewerCommerce"` — para balance, earnings (cambia al comprar o recibir pago)
- `"Session"` — solo para isAuthenticated y userId (cambia al hacer login/logout)
- `"AdminAccess"` — solo para isAdmin (raramente cambia)

Ajustar `providesTags` del endpoint `getViewer` para que provea los 3 tags nuevos: `["ViewerProfile", "ViewerAccess", "ViewerCommerce"]`.

**Paso 2 — Invalidar solo el tag relevante por evento:**

En `AppStateBootstrap.tsx`, reemplazar la función única `refreshViewer` por funciones específicas:

```
"balance-updated"       → invalidar solo ["ViewerCommerce"]
"purchases-updated"     → invalidar solo ["ViewerCommerce"]  
"earnings-updated"      → invalidar solo ["ViewerCommerce"]
"creator-status-updated"→ invalidar solo ["ViewerAccess"]
"profile-updated"       → invalidar solo ["ViewerProfile", "ProfileView"]
```

Eliminar la invalidación de `"Session"` y `"AdminAccess"` de estos eventos — esos datos no cambian cuando el usuario hace una compra o actualiza su perfil.

**Paso 3 — Debounce de invalidaciones simultáneas:**

En `AppStateBootstrap.tsx`, cuando se reciben múltiples eventos en el mismo tick (ej: `purchases-updated` + `balance-updated`), ambos invalidan `"ViewerCommerce"`. RTK Query ya maneja que si el mismo tag se invalida dos veces, solo hace un refetch. Verificar que esto funcione correctamente después de separar los tags.

**Paso 4 — Ajustar los componentes que leen el viewer:**

Los componentes que solo usan datos de perfil (TopBar mostrando avatar/username) deben suscribirse únicamente con un selector que lea `ViewerProfile`. Los que muestran balance deben suscribirse a `ViewerCommerce`. Así un evento `balance-updated` no re-renderiza el TopBar.

---

## Problema 2 — `useEffect` con dependencia `posts` crea loop de re-renders en FeedLayout (ALTO)

**Archivo:** `components/FeedLayout.tsx`  
**Líneas:** 279–312

### Qué pasa

El `useEffect` de la línea 279 tiene como dependencia `posts` (línea 312: `[currentUserId, dispatch, posts]`). El handler `purchasesHandler` dentro del efecto llama a `dispatch(setFeedPosts(resolved))` (línea 302), que actualiza el slice de Redux `posts`. Eso hace que la referencia de `posts` cambie, lo que re-dispara el efecto, que vuelve a ejecutar `setFeedPosts`, creando un ciclo potencial.

El ciclo se corta solo porque el handler está atado al evento `"purchases-updated"` (no corre en cada render), pero el efecto **se re-registra y des-registra el event listener en cada cambio de `posts`**, lo cual es innecesario overhead.

### Qué hacer

1. Cambiar la dependencia `posts` del `useEffect` por una ref: crear un `postsRef = useRef(posts)` y mantenerlo actualizado con otro `useEffect` de una línea: `useEffect(() => { postsRef.current = posts; }, [posts])`.

2. En el handler `purchasesHandler`, leer `postsRef.current` en lugar de `posts` del closure.

3. Las dependencias del `useEffect` de la línea 279 quedan como `[currentUserId, dispatch]` — la referencia estable. El event listener se registra una sola vez por `currentUserId` y no se vuelve a registrar cuando cambia el feed.

---

## Problema 3 — `refreshViewer()` se llama al montar el componente en cada render inicial (ALTO)

**Archivo:** `components/AppStateBootstrap.tsx`  
**Línea:** 114

### Qué pasa

`refreshViewer()` se llama incondicionalmente en el cuerpo del `useEffect` (línea 114), es decir, al montar el componente. Eso invalida los tags de sesión en cada montaje de `AppStateBootstrap`, forzando un refetch de `/api/me` aunque el caché de RTK Query todavía sea válido (el `keepUnusedDataFor` es 300s).

En práctica: cada vez que el usuario navega entre páginas y `AppStateBootstrap` se remonta (si está fuera del layout raíz) o en modo desarrollo con Fast Refresh, se fuerza un refetch innecesario.

### Qué hacer

1. Verificar en el árbol de componentes si `AppStateBootstrap` está en el layout raíz (`app/layout.tsx`) o en layouts específicos de página. Si está en múltiples layouts, puede montarse y desmontarse al navegar.

2. Si el call a `refreshViewer()` en línea 114 es para garantizar datos frescos al iniciar, reemplazarlo por una verificación: solo invalidar si el caché está vacío o expiró. RTK Query ya maneja esto internamente si `providesTags` está bien configurado — en ese caso, eliminar la línea 114 directamente y dejar que RTK Query haga el fetch inicial on-demand.

3. El call a `refreshNotifications()` en línea 115 tiene el mismo problema — aplicar la misma lógica.

---

## Problema 4 — Discovery (`/explorar`) hace 4 queries en cascada cliente-a-Supabase directamente (ALTO)

**Archivo:** `lib/redux/api/discoveryApi.ts`  
**Líneas:** 108–202

### Qué pasa

`getExploreFeed` corre en el browser y hace:

1. Línea 108: `supabase.auth.getUser()` — 1 request a Supabase Auth
2. Líneas 111–116: query a `user_roles` para obtener autores — 1 request a Supabase DB
3. Líneas 136–147: query a `follows` (solo si hay currentUserId) — 1 request
4. Líneas 150–166: `Promise.all` con query a `users` + query a `albums` — 2 requests
5. Líneas 195–202: query a `purchases` — 1 request

**Total: 6 round-trips browser → Supabase en Virginia**, todos secuenciales o semi-secuenciales. Desde Argentina, cada uno suma ~200ms. El discover feed tarda inherentemente ~800ms solo en latencia.

### Qué hacer

1. Crear un endpoint de API en Next.js: `app/api/explore/route.ts` (server-side).

2. Mover toda la lógica de `getExploreFeed` a ese endpoint. En el servidor, los 6 requests a Supabase se ejecutan con latencia de red interna de AWS (< 5ms por hop en lugar de ~200ms).

3. En `discoveryApi.ts`, reemplazar el `queryFn` con `fakeBaseQuery` por un `baseQuery` HTTP estándar que llame a `/api/explore` con el access token del usuario en el header.

4. El endpoint server-side recibe el token, llama a `getAuthenticatedUser`, y ejecuta todas las queries en paralelo máximo posible (las queries independientes en un solo `Promise.all`).

5. Retornar el JSON construido. El browser hace **1 request HTTP** en lugar de 6 requests directos a Supabase.

**Impacto estimado:** Reducción de ~800ms a ~200ms en la carga de Explorar para usuarios en Argentina.

---

## Problema 5 — Polling de 15s en `/crear` sin throttle cuando la tab está oculta (MEDIO)

**Archivo:** `app/crear/page.tsx`  
**Línea:** 454

### Qué pasa

```ts
const interval = window.setInterval(loadAuthorStatus, 15000);
```

El `clearInterval` sí existe en el cleanup (línea 458), por lo que no es un memory leak. Pero el polling corre aunque la tab del browser esté en segundo plano o el usuario no esté mirando la pantalla.

### Qué hacer

1. Antes de llamar `loadAuthorStatus` dentro del interval, verificar `document.visibilityState === "visible"`. Si la tab está oculta, saltear el fetch.

2. Agregar un listener de `"visibilitychange"` que ejecute `loadAuthorStatus` inmediatamente cuando la tab vuelve a estar visible (para recuperar el estado actualizado sin esperar el próximo tick del interval).

3. El listener de `"visibilitychange"` debe agregarse y removerse junto con el interval en el mismo `useEffect` cleanup.

---

## Problema 6 — Múltiples eventos duplicados emitidos al mismo tiempo (MEDIO)

**Archivos:** `components/FeedLayout.tsx` líneas 524-525 y 775-776, `app/perfil/PerfilPageClient.tsx` líneas 766-767 y 1093-1094, entre otros.

### Qué pasa

En muchos flujos de compra o tip, se emiten dos o tres eventos seguidos:

```ts
window.dispatchEvent(new Event("purchases-updated"));
window.dispatchEvent(new Event("balance-updated"));
```

Cada uno dispara `refreshViewer` por separado en `AppStateBootstrap`. Aunque implementar el Problema 1 mitiga esto (cada evento invalidará tags distintos), sigue siendo un doble dispatch innecesario si ambos terminan invalidando el mismo tag.

### Qué hacer

1. Después de implementar el Problema 1 (tags granulares), revisar qué eventos invalidan los mismos tags.

2. Si `"purchases-updated"` y `"balance-updated"` terminan invalidando el mismo tag `"ViewerCommerce"`, crear un evento unificado `"commerce-updated"` y reemplazar las emisiones dobles por una sola.

3. Hacer find en todo el repo por `dispatchEvent(new Event("purchases-updated"))` y `dispatchEvent(new Event("balance-updated"))` y reemplazar cada par por el evento unificado.

4. Actualizar `AppStateBootstrap` para escuchar `"commerce-updated"` en lugar de los dos eventos separados.

---

## Problema 7 — `getExploreFeed` llama a `supabase.auth.getUser()` en cada ejecución (MEDIO)

**Archivo:** `lib/redux/api/discoveryApi.ts`  
**Línea:** 108

### Qué pasa

```ts
const { data: authData } = await supabase.auth.getUser();
```

`getUser()` hace un request a Supabase Auth para validar el token. En el contexto de `discoveryApi`, que ya tiene acceso al store de Redux donde el `currentUserId` está disponible en el slice de sesión, este call es redundante.

### Qué hacer

1. En el `queryFn` de `getExploreFeed`, en lugar de llamar a `supabase.auth.getUser()`, leer el `currentUserId` desde el store de Redux usando `getState()` (disponible en `queryFn` como segundo argumento del builder).

2. Si ya hay datos de sesión en el store (`state.sessionApi.queries.getSession`), leer `userId` desde ahí.

3. Eliminar la línea 108 y su variable `authData`. El `currentUserId` queda como `state?.sessionApi?.queries?.getSession?.data?.userId ?? null`.

**Nota:** Si se implementa el Problema 4 (mover a endpoint server-side), este problema desaparece automáticamente.

---

## Problema 8 — Discovery hace deduplicación en JS que podría ser `.distinct()` en SQL (MEDIO)

**Archivo:** `lib/redux/api/discoveryApi.ts`  
**Líneas:** 122–128 y 200

### Qué pasa

```ts
const authorIds = Array.from(
  new Set(
    ((authorRoles ?? []) as AuthorRoleRow[])
      .map((row) => row.user_id)
      .filter(...)
  )
);
```

Y luego en línea 200:
```ts
.in("post_id", Array.from(new Set(candidatePostIds)))
```

Se traen filas con posibles duplicados desde la DB y se deduplican en JS.

### Qué hacer

Para `authorIds` (líneas 122–128):
- La query a `user_roles` (línea 111) puede tener un usuario con múltiples roles activos. Agregar `.select("user_id")` con un group/distinct implícito, o simplemente seleccionar solo `user_id` y confiar en que el `limit` ya acota el resultado. La deduplicación con `new Set` es barata para arrays pequeños — mantener si el tamaño es < 200 items (caso típico).

Para `candidatePostIds` (línea 200):
- La query de `purchases` usa `.in("post_id", deduplicatedIds)`. Si `candidatePostIds` tiene duplicados, la query SQL los maneja correctamente de todas formas (IN con duplicados es equivalente a IN sin duplicados en SQL). Eliminar el `Array.from(new Set(...))` de la línea 200 — es procesamiento innecesario en JS para un array que SQL va a deduplicar internamente.

---

## Problema 9 — `onAuthStateChange` en `AppStateBootstrap` siempre invalida todo (MEDIO)

**Archivo:** `components/AppStateBootstrap.tsx`  
**Líneas:** 142–147

### Qué pasa

```ts
const authSubscription = supabase?.auth.onAuthStateChange(() => {
  refreshViewer();
  refreshNotifications();
  void finalizeReferralIfNeeded();
});
```

`onAuthStateChange` se dispara ante cualquier cambio de estado de auth: login, logout, **token refresh**. Supabase refresca el access token automáticamente cada ~55 minutos. Cada refresh de token dispara `refreshViewer()`, que invalida todos los tags y refetcha `/api/me` completo — innecesariamente, porque el userId y los datos del viewer no cambiaron.

### Qué hacer

1. Agregar el tipo de evento al callback: `onAuthStateChange((event, session) => { ... })`.

2. Dentro del callback, verificar el valor de `event` antes de invalidar:
   - Si `event === "SIGNED_IN"`: invalidar todo (el usuario acaba de iniciar sesión).
   - Si `event === "SIGNED_OUT"`: invalidar todo (el usuario cerró sesión).
   - Si `event === "TOKEN_REFRESHED"`: NO invalidar nada — el token se renovó pero los datos del viewer no cambiaron.
   - Si `event === "USER_UPDATED"`: invalidar solo `["ViewerProfile"]`.

3. Supabase Auth SDK expone estos eventos como strings constantes — usar los valores exactos del tipo `AuthChangeEvent`.

---

## Orden de implementación recomendado

| # | Problema | Archivos | Impacto | Esfuerzo |
|---|----------|----------|---------|----------|
| 1 | P-1: Tags granulares en RTK Query | `sessionApi.ts` + `AppStateBootstrap.tsx` + componentes | Crítico | 2h |
| 2 | P-9: Filtrar TOKEN_REFRESHED en onAuthStateChange | `AppStateBootstrap.tsx` | Alto | 20 min |
| 3 | P-3: Eliminar refreshViewer() al montar | `AppStateBootstrap.tsx` | Alto | 15 min |
| 4 | P-2: Ref para posts en useEffect de FeedLayout | `FeedLayout.tsx` | Alto | 30 min |
| 5 | P-4: Mover getExploreFeed a endpoint server-side | `discoveryApi.ts` + nuevo `app/api/explore/route.ts` | Alto | 2h |
| 6 | P-6: Unificar eventos duplicados | Todos los archivos que hacen `dispatchEvent` | Medio | 1h |
| 7 | P-5: Throttle polling en tab oculta | `app/crear/page.tsx` | Medio | 20 min |
| 8 | P-7: Leer userId del store en lugar de getUser() | `discoveryApi.ts` | Medio | 20 min |
| 9 | P-8: Eliminar Set() en candidatePostIds | `discoveryApi.ts` línea 200 | Bajo | 5 min |

---

## Impacto esperado por grupo

- **P-1 + P-9 + P-3:** Eliminan la mayoría de los refetches innecesarios de `/api/me`. Una compra que hoy genera 10+ requests debería generar 1-2. Es el cambio de mayor impacto visible para el usuario.
- **P-2:** Elimina re-registros de event listeners en cada cambio del feed. Mejora estabilidad de renders.
- **P-4:** Reduce la carga de Explorar de ~800ms a ~200ms para usuarios en Argentina. El cambio más grande en latencia percibida.
- **P-6 + P-7 + P-8 + P-9:** Pequeñas mejoras acumulativas, fáciles de implementar.
