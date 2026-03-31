# Changelog

- what_was_asked: Usar una libreria como RTK Query para que el perfil no vuelva a vaciarse al cargarlo otra vez.
- what_was_approved: Refactor estructural del fetch del perfil hacia cache de RTK Query.
- what_was_done: Se agrego `profileApi`, se conecto al store, el perfil paso a usar `useGetProfileViewQuery` y settings invalida el cache cuando cambia el perfil.
- why_it_matches: El perfil ya no depende de estado local efimero para su carga inicial y puede reutilizar el dato cacheado entre navegaciones.
