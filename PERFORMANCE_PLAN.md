# Plan Técnico de Performance — Fanpush

Auditoría realizada el 2026-04-25. Problemas ordenados por impacto descendente.
Cada ítem incluye archivo exacto, líneas afectadas, y las instrucciones precisas de qué cambiar.

---

## Grupo 1 — Overhead en cada request autenticado (CRÍTICO)

Estos problemas acumulan 5-8 queries extra en **cada** request de cualquier usuario logueado, antes de ejecutar la lógica real del endpoint.

---

### P-01 · `getAdminSupabase()` crea una instancia nueva en cada llamada

**Archivo:** `lib/server/auth/session.ts`  
**Líneas:** 31–36

**Problema:** La función no cachea el cliente. Cada llamada a `getAuthenticatedUser()` (que se llama en cada endpoint autenticado) llama a `getAdminSupabase()` y crea una instancia nueva de Supabase.

**Código actual:**
```ts
export const getAdminSupabase = () => {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) return null;
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};
```

**Qué hacer:**
1. Declarar una variable de módulo `let cachedAdminClient: SupabaseClient | null = null;` justo antes de la función `getAdminSupabase`.
2. Al inicio de la función, retornar `cachedAdminClient` si no es null.
3. Asignar el cliente creado a `cachedAdminClient` antes de retornarlo.

**Resultado esperado:** Una sola instancia por proceso de Node.js, reutilizada en todos los requests.

---

### P-02 · `grantRoleByCode("user")` se ejecuta en cada request autenticado

**Archivo:** `lib/server/auth/session.ts`  
**Línea:** 167

**Problema:** `grantRoleByCode` hace 2 queries (resolver el role ID + INSERT con manejo de duplicate key) en absolutamente cada request autenticado. La enorme mayoría de las veces el rol ya está asignado y el INSERT falla silenciosamente con "duplicate key". Es trabajo que no produce ningún efecto.

**Código actual:**
```ts
try {
  await ensureServerUserRows(admin, user);
  await grantRoleByCode(admin, user.id, "user", user.id); // siempre se ejecuta
} catch (ensureError) { ... }
```

**Qué hacer:**
1. En `ensureServerUserRows` (líneas 38–116), la función ya sabe si el usuario es nuevo porque entra en el bloque `if (!existingUser)`.
2. Mover la llamada a `grantRoleByCode` dentro de ese bloque `if (!existingUser)`, justo después del INSERT exitoso en `users`.
3. Eliminar la línea 167 (`await grantRoleByCode(...)`) del flujo de `getAuthenticatedUser`.
4. La función `ensureServerUserRows` debe retornar un booleano `isNewUser` o llamar `grantRoleByCode` internamente solo cuando inserta por primera vez.

**Resultado esperado:** `grantRoleByCode` se ejecuta una sola vez en la vida del usuario (al crearse), no en cada request.

---

### P-03 · `ensureLegacyCreatorBalanceBaseline` se ejecuta en cada `/api/me`

**Archivo:** `app/api/me/route.ts`  
**Línea:** 63

**Archivo secundario:** `lib/server/repositories/ledger.ts`  
**Líneas:** 125–210

**Problema:** En cada carga de la app, `/api/me` llama a `ensureLegacyCreatorBalanceBaseline` que siempre hace al menos 2 queries (`getUserBalanceSnapshot` + `getUserLedgerEntryCount`). Si el usuario ya tiene balance, retorna. Si no, hace 2 queries más. Esto es overhead puro para usuarios que ya fueron migrados.

**Qué hacer:**
1. En la tabla `user_meta` (ya existe en el sistema), agregar una entrada con key `"balance_baseline_done"` y value `"1"` cuando la migración se completa por primera vez.
2. Al inicio de `ensureLegacyCreatorBalanceBaseline`, hacer una query a `user_meta` buscando esa key para el userId.
3. Si la key existe, retornar `getUserBalanceSnapshot(admin, userId)` directamente sin hacer el resto del trabajo.
4. Si no existe (usuario nuevo o sin migrar), ejecutar la lógica actual y al final hacer INSERT en `user_meta` con la key `"balance_baseline_done"`.
5. Usar `getUserMetaEntries` que ya existe en `lib/userMeta.ts` para leer ese flag, agregando `"balance_baseline_done"` a `USER_META_KEYS`.

**Resultado esperado:** Un solo round-trip a `user_meta` por request en lugar de 2-4 queries al ledger.

---

### P-04 · `getUserAccessSnapshot` hace 2 queries secuenciales

**Archivo:** `lib/server/auth/roles.ts`  
**Líneas:** 150–198

**Problema:** Primero llama a `getUserActiveRoles` (query 1 a `user_roles` + join a `roles`), espera el resultado para obtener los `roleIds`, y recién entonces hace la segunda query a `role_permissions` + join a `permissions`. Son 2 round-trips a la DB que pueden ser 1.

**Código actual (simplificado):**
```ts
const roles = await getUserActiveRoles(admin, user.id); // query 1
if (roles.roleIds.length > 0) {
  const { data } = await admin
    .from("role_permissions")
    .select("permission:permissions!inner(code)")
    .in("role_id", roles.roleIds); // query 2, secuencial
}
```

**Qué hacer:**
1. Reemplazar las 2 queries por una sola query que parta de `user_roles` y haga JOIN hacia `roles` y hacia `role_permissions` + `permissions` en un solo select.
2. La query nueva sería sobre `user_roles` con select:
   ```
   role_id,
   role:roles!inner(code),
   role_permissions(permission:permissions!inner(code))
   ```
   filtrando por `user_id` e `is("revoked_at", null)`.
3. Del resultado, extraer `roleCodes` y `permissionCodes` en un solo `.map()`.
4. Mantener el manejo de `isMissingRelationError` igual que antes por compatibilidad.

**Resultado esperado:** 1 query en lugar de 2 para obtener roles + permisos del usuario.

---

## Grupo 2 — N+1 y signed URLs en loop (ALTO)

---

### P-05 · `createSignedUrl()` individual por cada attachment en direct-chats

**Archivo:** `lib/server/repositories/direct-chats.ts`  
**Líneas:** 693–714

**Problema:** Por cada mensaje en un thread, y por cada attachment de ese mensaje, se llama a `admin.storage.from(PREMIUM_MEDIA_BUCKET).createSignedUrl(path, 300)` individualmente dentro de un `Promise.all`. Si hay 20 mensajes con 3 attachments cada uno = 60 llamadas al storage de Supabase.

**Código actual:**
```ts
const resolvedPreviews = await Promise.all(
  attachments.map(async (attachment) => {
    const resolvedPath = canSeePremium && attachment.premiumPath
      ? await admin.storage.from(PREMIUM_MEDIA_BUCKET).createSignedUrl(attachment.premiumPath, 60 * 5)
          .then((result) => result.data?.signedUrl || ...)
      : ...
  })
);
```

**Qué hacer:**
1. Antes del loop de mensajes (antes del `Promise.all` de `orderedMessageRows.map`), recolectar todos los `premiumPath` de todos los attachments de todos los mensajes en un array plano.
2. Filtrar solo los paths donde `canSeePremium` aplica.
3. Hacer una sola llamada a `admin.storage.from(PREMIUM_MEDIA_BUCKET).createSignedUrls(paths, 300)` — nota el plural `createSignedUrls` que acepta un array.
4. Construir un `Map<path, signedUrl>` con el resultado.
5. Dentro del loop de mensajes, en vez de llamar al storage, consultar el Map por el path.

**Resultado esperado:** 1 llamada al storage en lugar de N×M.

---

### P-06 · `createSignedUrl()` individual en purchases

**Archivo:** `app/api/purchases/route.ts`  
**Líneas:** 223–281

**Problema:** Mismo patrón que P-05. Por cada `direct_message_purchase`, por cada attachment del mensaje, se llama a `createSignedUrl` individualmente.

**Qué hacer:**
1. Igual que P-05: recolectar todos los `premiumPath` en un array antes del loop.
2. Una sola llamada a `createSignedUrls(paths, 300)`.
3. Construir Map y consultar dentro del loop.

---

### P-07 · `resolveModerationMediaUrl()` en loops anidados en dashboard

**Archivo:** `app/api/admin/dashboard/route.ts`  
**Líneas:** 536–590

**Problema:** El código hace `await Promise.all(albums.map(async (album) => { ... await resolveModerationMediaUrl(...) ... await Promise.all(album.album_posts.map(async (link) => { await resolveModerationMediaUrl(...) })) }))`. Dos niveles de Promise.all anidados, cada uno con awaits al storage.

**Qué hacer:**
1. Revisar qué hace `resolveModerationMediaUrl` — si internamente llama a `createSignedUrl`, extraer todos los `media_url` de todos los albums y posts en un array plano.
2. Resolver todas las URLs en una sola pasada antes del `Promise.all` de albums.
3. Construir un `Map<media_url, resolvedUrl>`.
4. En el `.map()` de albums, en lugar de `await resolveModerationMediaUrl(...)`, consultar el Map directamente (operación síncrona).
5. Eliminar los `async` innecesarios de los `.map()` si ya no hay awaits adentro.

---

## Grupo 3 — Queries sin límite que crecen con los datos (ALTO)

---

### P-08 · Dashboard admin descarga tablas enteras sin LIMIT

**Archivo:** `app/api/admin/dashboard/route.ts`  
**Líneas:** 150–168

**Problema:** Las siguientes queries no tienen `.limit()`:

- Línea 150: `admin.from("users").select("id,username,avatar_url,created_at")` — todos los usuarios
- Línea 151: `admin.from("profiles").select("id,full_name,email,created_at")` — todos los perfiles
- Línea 152: `admin.from("follows").select("follower_id,following_id")` — todos los follows
- Línea 153–158: `admin.from("albums").select(...)` sin limit — todos los álbumes con joins anidados
- Líneas 81–84: `admin.from("purchases").select(...).order(...)` — todas las compras
- Línea 86–89: `admin.from("notifications")...eq("type","tip")` — todos los tips

**Qué hacer:**

Para `users`, `profiles`, `follows` (líneas 150–152):
- Estas se usan para construir un `userMap` para enriquecer otros datos. Cambiar el approach: en lugar de traer todos los usuarios, extraer los `user_id` únicos de los otros datasets ya cargados (purchases, albums, reports, etc.) y hacer una query con `.in("id", uniqueUserIds)`.

Para `allAlbumsResult` (líneas 153–158):
- Agregar `.limit(500)` como máximo razonable para el dashboard.
- O mejor: eliminar esta query y reusar `recentAlbumsResult` (que ya tiene `.limit(30)`) para la sección de contenido del dashboard.

Para `purchasesRowsResult` (líneas 81–84):
- Esta query trae TODAS las compras para calcular el gross total. Cambiar por una query de agregación: `admin.from("purchases").select("amount.sum()")` usando la función de agregación de Supabase, o agregar `.limit(1000)` y documentar que es una aproximación.

Para `tipRowsResult` (líneas 85–89):
- Igual que purchases: usar agregación o poner `.limit(1000)`.

---

### P-09 · `/api/purchases` y `/api/sales` sin paginación

**Archivo:** `app/api/purchases/route.ts`  
**Líneas:** 46–60

**Archivo secundario:** `app/api/sales/route.ts` (buscar el mismo patrón)

**Problema:** Un usuario con miles de compras descarga todo de una vez.

**Qué hacer:**
1. Agregar soporte para query param `?limit=50&before=<ISO_timestamp>` en el endpoint GET.
2. Leer `limit` y `before` del `request.url` con `new URL(request.url).searchParams`.
3. Agregar `.limit(limit)` a ambas queries (`purchases` y `direct_message_purchases`).
4. Si `before` está presente, agregar `.lt("created_at", before)` para cursor-based pagination.
5. Retornar en la respuesta un campo `nextCursor` con el `created_at` del último item si hay items = limit (indica que hay más).
6. En el frontend (componente que llama a este endpoint), implementar "cargar más" usando el cursor.

---

## Grupo 4 — Promise.all anidados innecesarios (MEDIO)

---

### P-10 · Nested Promise.all en feedApi

**Archivo:** `lib/redux/api/feedApi.ts`  
**Líneas:** 130–191

**Problema:** Hay un `await Promise.all(posts.map(async (post) => { ... await Promise.all(albumPosts.map(async (item) => buildInitialPostMediaState(...))) }))`. El inner Promise.all resuelve URLs de media que son URLs públicas (no signed), por lo que en realidad no necesitan ser async en absoluto — `resolvePublicUrl` es síncrona.

**Qué hacer:**
1. Verificar si `buildInitialPostMediaState` y `resolvePublicUrl` son funciones síncronas (muy probable que sí).
2. Si lo son, eliminar el `await` y el `async` del `.map()` interno, convirtiéndolo en un `.map()` síncrono normal.
3. Verificar si el outer `Promise.all` sigue siendo necesario o si también puede ser `.map()` síncrono.
4. Si `buildInitialPostMediaState` es genuinamente async, dejarlo como está pero documentar por qué.

---

### P-11 · Nested async/await en dashboard (albums map)

**Archivo:** `app/api/admin/dashboard/route.ts`  
**Líneas:** 536–590

**Problema:** Ya cubierto en P-07 desde la perspectiva de storage. Complementariamente, si se implementa P-07 (Map pre-computado), el `.map()` de albums ya no necesita ser `async` y el `Promise.all` externo puede eliminarse o simplificarse.

**Qué hacer:**
1. Después de implementar P-07, revisar si quedan `await` dentro del `.map()` de albums.
2. Si no quedan, cambiar `await Promise.all(albums.map(async ...))` por `albums.map(album => {...})` síncrono.

---

## Grupo 5 — Instancias de cliente redundantes (BAJO)

---

### P-12 · Dos clientes browser con el mismo anon key

**Archivo:** `lib/supabase.ts`  
**Líneas:** 10–34

**Problema:** `getSupabaseClient()` y `getSupabaseAdminBrowserClient()` usan las mismas credenciales pero diferente `storageKey`. Ambas cachean su instancia, lo que está bien, pero son dos conexiones distintas al mismo Supabase.

**Qué hacer:**
Esta separación existe para mantener sesiones independientes (usuario normal vs admin en el mismo browser). Es una decisión de diseño válida. **No cambiar** — el costo es mínimo y la alternativa rompería el flujo de admin.

**Acción:** Documentar en comentario por qué existen dos instancias para que futuros devs no lo "unifiquen" pensando que es un error.

---

## Orden de implementación recomendado

| # | Item | Archivos | Impacto | Esfuerzo estimado |
|---|------|----------|---------|-------------------|
| 1 | P-01: Singleton getAdminSupabase | 1 archivo, 5 líneas | Alto | 15 min |
| 2 | P-02: grantRoleByCode solo al crear | 1 archivo, 10 líneas | Alto | 30 min |
| 3 | P-05: batch createSignedUrls en chats | 1 archivo, ~40 líneas | Alto | 1h |
| 4 | P-06: batch createSignedUrls en purchases | 1 archivo, ~30 líneas | Alto | 45 min |
| 5 | P-04: getUserAccessSnapshot en 1 query | 1 archivo, ~30 líneas | Medio | 1h |
| 6 | P-08: LIMITs y userMap por IDs en dashboard | 1 archivo, ~20 líneas | Alto | 1.5h |
| 7 | P-03: flag balance_baseline_done | 2 archivos, ~20 líneas | Medio | 1h |
| 8 | P-07 + P-11: aplanar nested awaits en dashboard | 1 archivo, ~30 líneas | Medio | 1h |
| 9 | P-09: paginación en purchases/sales | 2 archivos + frontend | Medio | 2h |
| 10 | P-10: eliminar async innecesario en feedApi | 1 archivo, ~10 líneas | Bajo | 20 min |

**Total estimado:** ~10 horas de implementación.

---

## Impacto esperado por grupo

- **P-01 + P-02 + P-04:** Reducción de 3-5 queries por cada request autenticado. Mejora directa en todos los endpoints.
- **P-03:** Reducción de 2-4 queries por cada carga de `/api/me`. Mejora visible en tiempo de arranque de la app.
- **P-05 + P-06 + P-07:** Reducción de N×M llamadas al storage a 1 por endpoint. Mejora drástica en threads con adjuntos.
- **P-08:** Previene degradación catastrófica del dashboard cuando crezca la BD.
- **P-09:** Previene degradación lineal de purchases/sales con el tiempo.
