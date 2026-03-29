# Análisis funcional exhaustivo

## 1. Visión funcional del producto

FanPush funciona como una plataforma híbrida entre:
- red social
- distribución de contenido premium
- monetización directa a creadores
- operación administrativa de moderación y pagos

No es sólo una app social. Ya tiene al menos cuatro dominios funcionales claros:
- identidad y acceso
- social y contenido
- monetización
- trust & safety / operaciones

## 2. Actores del sistema

### 2.1 Invitado
Puede:
- abrir páginas públicas
- registrarse
- iniciar sesión

### 2.2 Usuario autenticado
Puede:
- navegar
- seguir usuarios
- editar cuenta
- comprar
- propinar
- reportar

### 2.3 Autor / creador
Puede:
- publicar contenido
- monetizar
- ver ventas
- configurar cobros
- pedir retiros

### 2.4 Admin / operador
Puede:
- revisar contenido
- revisar retiros
- revisar autores
- ver métricas
- ajustar comisión

## 3. Módulos funcionales

## 3.1 Módulo de identidad
Funciones:
- registro
- login
- logout
- recuperación de contraseña
- manejo de sesión

Observación:
Está resuelto funcionalmente, pero no bien separado de autorización.

## 3.2 Módulo de perfil
Funciones:
- avatar
- username
- full name
- bio
- links externos
- datos de cobro
- eliminación de cuenta

Observación:
Mezcla datos públicos, privados y operativos.

## 3.3 Módulo social
Funciones:
- búsqueda de usuarios
- follow/unfollow
- notificaciones
- acceso a perfiles

Observación:
Es relativamente simple y entendible.

## 3.4 Módulo de publicación
Funciones:
- carga de media
- preview
- selección de monetización
- publicación de álbum

Observación:
El concepto de álbum como unidad de publicación es bueno y consistente con compra/moderación.

## 3.5 Módulo de consumo
Funciones:
- feed
- apertura de post/modal
- resolución de media premium
- historial de compras

Observación:
El acceso premium está relativamente bien resuelto del lado backend.

## 3.6 Módulo de pagos
Funciones:
- crear preferencia Mercado Pago
- volver desde checkout
- finalizar pago
- acreditar compras/propinas

Observación:
Hay una integración funcional, pero el módulo de pagos está mezclado con auth helper y bootstrap de usuario.

## 3.7 Módulo de creadores
Funciones:
- solicitud de autor
- ver estado
- posterior monetización

Observación:
Existe negocio real de onboarding/KYC liviano, pero no está modelado como subdominio explícito.

## 3.8 Módulo financiero
Funciones:
- cálculo de earnings
- comisiones por usuario
- perfil de cobro
- retiro mensual

Observación:
Es el módulo más sensible después de auth y debería tener mejor modelo de datos.

## 3.9 Módulo de trust & safety
Funciones:
- reportar contenido
- revisar reportes
- moderar
- archivar historial

Observación:
Tiene lógica real, pero se sostiene sobre `notifications`.

## 3.10 Módulo admin
Funciones:
- panel consolidado
- decisiones operativas
- lectura de datasets agregados

Observación:
Más que un panel, ya es un backoffice operativo.

## 4. Flujos funcionales principales

### Flujo A: alta de usuario
1. usuario se registra
2. Supabase crea identidad
3. sistema intenta crear perfil de dominio
4. usuario entra al producto

Riesgo:
el alta de dominio no está encapsulada en un único flujo.

### Flujo B: onboarding a creador
1. usuario completa solicitud
2. sube documento
3. admin revisa
4. sistema notifica
5. usuario queda habilitado para vender

Riesgo:
la habilitación no está formalizada en rol persistido.

### Flujo C: publicación paga
1. creador sube media
2. marca previews
3. define precio
4. backend crea álbum/posts
5. contenido aparece en feed

### Flujo D: compra
1. consumidor inicia compra
2. backend crea preferencia
3. Mercado Pago procesa
4. sistema finaliza pago
5. se acredita compra
6. media premium se habilita

### Flujo E: retiro
1. creador carga datos de cobro
2. sistema calcula disponible
3. creador solicita retiro
4. admin revisa
5. sistema registra decisión y notifica

### Flujo F: moderación
1. usuario reporta álbum
2. admin revisa
3. aprueba, descarta o elimina
4. sistema registra acción
5. usuario afectado recibe aviso

## 5. Fortalezas funcionales

- hay producto usable con múltiples loops de valor
- social + monetización están integrados
- existe panel operativo
- existe diferenciación básica entre usuario, creador y admin

## 6. Debilidades funcionales

- muchas capacidades críticas no están formalizadas como roles/estados
- parte del sistema depende de comportamientos implícitos
- el módulo admin reconstruye demasiado desde datos semiestructurados
- auth y negocio están demasiado acoplados

## 7. Oportunidades de rediseño funcional

### 7.1 Definir bounded contexts
- Identity & Access
- Social & Content
- Payments & Earnings
- Creator Operations
- Trust & Safety
- Admin Backoffice

### 7.2 Hacer explícitos los estados
- usuario base
- autor pending/approved/rejected
- retiro requested/sent/rejected
- reporte open/reviewed/dismissed/removed

### 7.3 Mover reglas a backend
La UX puede seguir en cliente, pero las decisiones deben vivir en backend.

## 8. Conclusión
FanPush ya no es un prototipo de una sola feature. Tiene suficiente complejidad funcional como para requerir un diseño de plataforma, aunque todavía puede mantenerse en una sola app. El siguiente salto no es agregar más features, sino ordenar dominios, permisos y datos para que las features actuales sean sostenibles.
