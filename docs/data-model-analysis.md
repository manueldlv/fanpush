# Análisis exhaustivo del modelo de datos

## 1. Estado actual del schema

El archivo `supabase/setup.sql` no representa el modelo completo que usa la app. Formalmente sólo define:
- `profiles`
- trigger `handle_new_user()`

Pero el código usa además:
- `users`
- `albums`
- `posts`
- `album_posts`
- `likes`
- `follows`
- `purchases`
- `notifications`

Esto implica un problema serio de gobierno del schema:
- el SQL no es fuente de verdad
- hay drift entre base y aplicación
- el onboarding del entorno depende de conocimiento implícito

## 2. Entidades detectadas

## 2.1 Identidad

### `auth.users`
Fuente de identidad administrada por Supabase.

Campos relevantes inferidos:
- `id`
- `email`
- `raw_user_meta_data`

Uso actual:
- login
- registro
- recuperación
- metadata de `username`, `full_name`

### `profiles`
Tabla privada vinculada 1:1 con `auth.users`.

Campos definidos:
- `id`
- `full_name`
- `email`
- `created_at`

Uso actual:
- nombre completo
- email espejo
- parte del perfil funcional

### `users`
Tabla pública y social.

Campos inferidos:
- `id`
- `username`
- `avatar_url`
- `bio`
- `created_at`

Uso actual:
- búsqueda
- perfil público
- navegación por username
- avatar

Observación:
La separación `users` pública + `profiles` privada es buena, pero hoy está mezclada con upserts manuales y bootstrap duplicado.

## 2.2 Social graph

### `follows`
Campos inferidos:
- `follower_id`
- `following_id`

Uso:
- follow/unfollow
- recomendaciones simples
- notificaciones derivadas

Sugerencias:
- FK doble a `users/auth.users`
- unique `(follower_id, following_id)`
- check para impedir self-follow si no está ya

### `likes`
Campos inferidos:
- `user_id`
- `post_id`

Uso:
- likes sobre posts
- limpieza al eliminar contenido o cuenta

Sugerencias:
- unique `(user_id, post_id)`
- FK a `posts`

## 2.3 Contenido

### `albums`
Es la unidad principal de publicación y venta.

Campos inferidos:
- `id`
- `user_id`
- `description`
- `price`
- `created_at`

Rol en dominio:
- agrupa posts/media
- representa la publicación comercial
- unidad sobre la que se reporta/modera

Comentario:
Esta decisión es razonable. La moderación y compra trabajan sobre el álbum, no sobre un único media item.

### `posts`
Es la unidad física de contenido multimedia.

Campos inferidos:
- `id`
- `user_id`
- `media_url`
- `media_type`
- `is_locked`
- `likes_count`
- `caption`
- `created_at`

Uso:
- feed
- modal de contenido
- media premium
- likes
- purchases por post

Riesgos:
- `likes_count` parece denormalizado; si se mantiene, necesita estrategia de consistencia

### `album_posts`
Tabla de unión entre álbum y posts.

Campos inferidos:
- `album_id`
- `post_id`

Uso:
- un álbum contiene varios posts

Sugerencias:
- unique `(album_id, post_id)`
- cascadas controladas

## 2.4 Monetización

### `purchases`
Registra compras acreditadas por pago aprobado.

Campos inferidos:
- `id`
- `user_id`
- `post_id`
- `payment_id`
- `amount`
- `status`
- `created_at`

Uso:
- acceso a media premium
- cálculo de ingresos
- historial de compra

Problemas:
- si la compra de un álbum multipost genera filas por post, entonces `payment_id` requiere claridad semántica
- el monto queda repartido con monto real en una fila y cero en otras

Sugerencia:
- considerar `orders` / `order_items` a futuro
- para MVP puede seguir, pero hay que documentarlo bien

## 2.5 Tabla multipropósito

### `notifications`
Es la tabla más problemática del sistema.

Hoy parece contener:
- follow
- purchase
- tip
- payout_profile
- withdrawal_request
- withdrawal_history
- author_application
- author_application_history
- author_application_update
- content_report
- moderation_action
- moderation_archive
- moderation_content_state
- user_commission_profile
- profile_meta
- content_removed_update
- withdrawal_update

Eso significa que cumple simultáneamente roles de:
- inbox del usuario
- event store parcial
- configuración
- historial administrativo
- estado actual
- comunicación funcional

## 3. Problemas del modelo actual

### 3.1 Falta de normalización
El uso intensivo de `message` serializado produce datos semiestructurados sin contrato fuerte.

### 3.2 Integridad limitada
No hay garantías SQL fuertes sobre payloads embebidos.

### 3.3 Consultas caras y frágiles
El admin reconstruye datasets parseando mensajes y filtrando tipos.

### 3.4 Auditoría débil
Hay historial implícito, pero no un log formal con estructura consistente.

### 3.5 Schema drift
El SQL no documenta el modelo real.

## 4. Modelo recomendado por dominios

## 4.1 Identidad
Mantener:
- `auth.users`
- `users`
- `profiles`

## 4.2 Acceso
Agregar:
- `roles`
- `permissions`
- `role_permissions`
- `user_roles`

## 4.3 Social
Mantener:
- `follows`
- `likes`

## 4.4 Contenido
Mantener:
- `albums`
- `posts`
- `album_posts`

Opcional futuro:
- `album_visibility`
- `post_assets`

## 4.5 Monetización
Mantener o evolucionar:
- `purchases`

Futuro más sólido:
- `payments`
- `orders`
- `order_items`
- `tips`

## 4.6 Creator operations
Crear:
- `author_applications`
- `author_application_history`
- `payout_profiles`
- `withdrawal_requests`
- `withdrawal_history`
- `user_commission_profiles`

## 4.7 Trust & safety
Crear:
- `content_reports`
- `moderation_actions`
- `moderation_archives`
- `content_states`

## 4.8 Inbox de usuario
Dejar `notifications` sólo para:
- follow
- purchase
- tip
- author_application_update
- withdrawal_update
- content_removed_update

## 5. Revisión tabla por tabla

### 5.1 `users`
Debe tener:
- `id`
- `username` unique
- `avatar_url`
- `created_at`
- `updated_at`

No debería almacenar:
- datos KYC
- datos de payout
- flags administrativos complejos

### 5.2 `profiles`
Debe tener:
- `full_name`
- `email`
- datos privados básicos
- tal vez `country`, `locale`, etc. si luego se expande

### 5.3 `author_applications`
Debería tener columnas propias:
- `id`
- `user_id`
- `status`
- `full_name`
- `birth_date`
- `document_type`
- `document_number`
- `country`
- `province`
- `city`
- `address`
- `document_front_url`
- `document_back_url`
- `submitted_at`
- `reviewed_at`
- `reviewed_by`
- `rejection_reason`
- `archived_at`

### 5.4 `withdrawal_requests`
Debería tener:
- `id`
- `user_id`
- `amount`
- `status`
- `month_key`
- `requested_at`
- `reviewed_at`
- `reviewed_by`
- `reason`

### 5.5 `payout_profiles`
Debería tener:
- `id`
- `user_id`
- `alias`
- `holder_name`
- `holder_document`
- `notes`
- `updated_at`

### 5.6 `content_reports`
Debería tener:
- `id`
- `album_id`
- `reported_by`
- `owner_user_id`
- `reason`
- `status`
- `reported_at`
- `reviewed_at`
- `reviewed_by`
- `archived_at`

### 5.7 `moderation_actions`
Debería tener:
- `id`
- `report_id` nullable
- `album_id`
- `actor_id`
- `action`
- `reason`
- `acted_at`

### 5.8 `user_commission_profiles`
Debería tener:
- `id`
- `user_id`
- `creator_share`
- `platform_share`
- `updated_at`
- `updated_by`

## 6. Reglas de integridad sugeridas

### Constraints
- `users.username` unique
- `creator_share` entre 0 y 1
- `platform_share` entre 0 y 1
- estados por enum o check
- `withdrawal_requests.month_key` con formato consistente

### Foreign keys
- todas las entidades de negocio deben apuntar a `auth.users/users`
- evitar referencias sólo implícitas en `message`

### Índices
- `albums(user_id, created_at desc)`
- `posts(user_id, created_at desc)`
- `purchases(user_id, created_at desc)`
- `purchases(post_id, created_at desc)`
- `notifications(user_id, is_read, created_at desc)`
- índices específicos por tipo si `notifications` se mantiene

## 7. RLS y seguridad

Hoy sólo `profiles` tiene políticas explícitas visibles en SQL.

Falta definir RLS para:
- `users`
- `follows`
- `likes`
- `posts`
- `albums`
- `purchases`
- tablas nuevas de negocio

Recomendación:
- RLS por tabla
- service role sólo para operaciones backend sensibles
- el cliente no debería depender de libertad excesiva sobre tablas críticas

## 8. Plan de saneamiento del modelo

### Etapa 1
- documentar schema real
- generar migraciones faltantes
- alinear `setup.sql` o reemplazarlo por migraciones reales

### Etapa 2
- sacar comisiones, retiros, author applications y reports de `notifications`

### Etapa 3
- dejar `notifications` para inbox
- mantener historial estructurado en tablas dedicadas

### Etapa 4
- ajustar admin/dashboard a nuevo modelo

## 9. Conclusión
El modelo actual alcanza para un MVP, pero está desbalanceado: pocas tablas bien definidas y demasiada lógica metida en `notifications.message`. La prioridad debe ser normalizar los dominios operativos y volver a hacer del schema SQL una fuente de verdad real.
