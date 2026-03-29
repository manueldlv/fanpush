# Análisis exhaustivo de reglas de negocio

## 1. Identidad y registro

### Regla 1
Un usuario puede registrarse con email y contraseña.

### Regla 2
En el registro se exige:
- nombre completo
- username
- email válido
- contraseña mínima
- aceptación de términos

### Regla 3
El `username`:
- se normaliza a minúsculas
- elimina espacios
- sólo permite `[a-z0-9._]`
- debe tener al menos 3 caracteres
- debe estar disponible

### Regla 4
Tras crear cuenta, puede requerirse confirmación por email según Supabase.

## 2. Inicio de sesión y sesión

### Regla 5
El login normal se resuelve con `signInWithPassword`.

### Regla 6
El login admin hoy usa una sesión browser separada, pero funcionalmente sigue siendo sesión Supabase.

### Regla 7
La sesión válida hoy habilita gran parte del acceso, incluso antes de verificar completamente el estado del usuario de dominio.

## 3. Perfil y cuenta

### Regla 8
Todo usuario tiene:
- perfil público en `users`
- perfil privado/base en `profiles`

### Regla 9
El usuario puede editar:
- username
- full name
- avatar
- bio
- website
- instagram
- datos de cobro

### Regla 10
Existe eliminación de cuenta con limpieza de datos relacionados.

## 4. Social

### Regla 11
Un usuario autenticado puede seguir a otro usuario.

### Regla 12
No puede seguirse a sí mismo.

### Regla 13
Seguir genera una notificación de tipo `follow`.

## 5. Publicación de contenido

### Regla 14
El contenido se publica como un `album` con uno o más `posts`.

### Regla 15
Cada item subido puede ser imagen o video.

### Regla 16
Restricciones detectadas:
- imagen máximo 8 MB
- lado mayor máximo 2000 px
- video máximo 200 MB
- video máximo 10 minutos
- lado mayor máximo 1920 px

### Regla 17
La publicación puede ser:
- gratis
- paga

### Regla 18
Si la publicación es paga:
- puede haber previews públicas
- el resto del media queda bloqueado

### Regla 19
El precio debe ser numérico y positivo para monetización válida.

## 6. Reglas de autor / creador

### Regla 20
Existe un proceso para solicitar acceso como autor.

### Regla 21
La solicitud exige:
- nombre completo
- fecha de nacimiento
- tipo y número de documento
- país, provincia, ciudad, dirección
- frente y dorso del documento

### Regla 22
El postulante debe ser mayor de 18 años.

### Regla 23
Estados detectados de solicitud:
- `pending`
- `approved`
- `rejected`

### Regla 24
Una solicitud ya procesada puede archivarse y luego restaurarse.

### Regla 25
Una aprobación habilita comercialmente al usuario según el mensaje funcional del sistema, aunque la autorización no está formalizada en un rol persistido.

## 7. Compras

### Regla 26
Un usuario autenticado puede comprar contenido pago.

### Regla 27
No puede comprar su propio contenido.

### Regla 28
La compra se procesa vía Mercado Pago.

### Regla 29
El `external_reference` del pago codifica:
- tipo de operación
- buyer id
- target id
- amount

### Regla 30
Cuando el pago queda `approved`, se acredita compra o tip.

### Regla 31
Para una compra de álbum, se crean filas en `purchases` por post.

## 8. Acceso a contenido premium

### Regla 32
El contenido premium sólo debe abrirse para:
- el dueño
- quien lo compró

### Regla 33
El acceso al media premium se materializa con signed URLs temporales.

## 9. Propinas

### Regla 34
Un usuario puede enviar propinas a otro usuario.

### Regla 35
No puede enviarse propina a sí mismo.

### Regla 36
La propina aprobada genera notificación `tip`.

## 10. Reportes y moderación

### Regla 37
Un usuario autenticado puede reportar contenido ajeno.

### Regla 38
No puede reportar su propio contenido.

### Regla 39
El reporte guarda:
- albumId
- reason
- reportedAt
- estado implícito

### Regla 40
Estados detectados en reportes:
- `open`
- `reviewed`
- `dismissed`
- `removed`

### Regla 41
Un admin puede:
- revisar
- descartar
- archivar revisión
- eliminar contenido

### Regla 42
Eliminar contenido también limpia:
- likes
- purchases asociadas
- links álbum-post
- posts
- álbum

## 11. Ganancias y comisiones

### Regla 43
La ganancia bruta de un creador surge de:
- compras de sus posts
- propinas recibidas

### Regla 44
La comisión del creador surge de `user_commission_profile`.

### Regla 45
Si no existe comisión específica, se usa share por defecto `0.7`.

### Regla 46
`platformShare = 1 - creatorShare`.

## 12. Datos de cobro y retiros

### Regla 47
Para pedir retiro debe existir perfil de cobro.

### Regla 48
El perfil de cobro exige:
- alias
- titular
- documento del titular

### Regla 49
Sólo puede existir una solicitud de retiro por mes.

### Regla 50
El monto disponible para retiro descuenta retiros ya reservados/no rechazados.

### Regla 51
El mínimo para solicitar retiro es `50.000 ARS`.

### Regla 52
Estados detectados:
- `requested`
- `sent`
- `rejected`

## 13. Admin

### Regla 53
Hoy admin se resuelve por email o username configurado en entorno.

### Regla 54
El admin puede:
- ver dashboard
- revisar autores
- revisar retiros
- moderar contenido
- cambiar comisiones

## 14. Reglas implícitas no formalizadas

### Regla 55
Debería existir distinción entre usuario autenticado y autor habilitado.

### Regla 56
Debería existir ownership formal para recursos.

### Regla 57
Deberían existir permisos finos para admin/moderación/finanzas.

## 15. Reglas ambiguas o faltantes

No se ve formalmente definido:
- si cualquier usuario autenticado puede entrar a `/crear`
- si el rol autor se deriva sólo de solicitud aprobada
- cómo se resuelve reembolso
- política de contenido reincidente
- bloqueo/suspensión de usuarios
- límites antiabuso
- si hay contenido draft/published/archived

## 16. Conclusión
Las reglas de negocio existen y el producto ya tiene dominio real, pero muchas viven como convenciones distribuidas y no como políticas explícitas del sistema. La siguiente evolución correcta es convertir esas reglas en permisos, estados y entidades de dominio formales.
