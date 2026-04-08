# Changelog

- what_was_asked: Poder cancelar retiros desde `Mis ventas` con un tachito rojo y evitar desbloqueos accidentales en el chat agregando confirmación.
- what_was_approved: Ajuste frontend y API puntual sobre retiros del propio autor, más mejora UX en el chat premium.
- what_was_done: Se añadió el botón de cancelar al final de cada retiro pendiente, se implementó la ruta `/api/withdrawals/[id]/cancel`, y la card premium del chat ahora pasa por un estado de confirmación antes de desbloquear.
- why_it_matches: El retiro puede anularse desde la fila correspondiente y el usuario ya no pierde saldo por un toque involuntario en el chat.
