# Changelog

- what_was_asked: Avanzar con el reemplazo de llamadas viejas por RTK Query en todo el front.
- what_was_approved: Refactor estructural para expandir RTK Query mas alla del perfil y usarlo en sesion, busqueda, notificaciones y commerce base.
- what_was_done: Se conectaron nuevas APIs RTK Query al store, se migraron componentes clave de navegacion y centro de notificaciones, se saco el polling global y saldo/checkout ahora usan mutations cacheadas para Mercado Pago.
- why_it_matches: El front ya reutiliza cache compartido en puntos centrales de navegacion y cuenta, y queda una base consistente para seguir migrando feed, explore, compras, ventas y admin sin volver al patron anterior.
