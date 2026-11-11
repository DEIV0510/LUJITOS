/** Traduce errores de PostgreSQL/PostgREST a mensajes en español sin detalles internos. */
type DbLikeError = { code?: string; message?: string } | null | undefined;

export function dbErrorMessage(error: DbLikeError): string {
  if (!error) return 'Ocurrió un error inesperado.';
  switch (error.code) {
    case '23505':
      return 'Ya existe un registro con esos datos.';
    case '23503':
      return 'La cuenta o categoría elegida no está disponible.';
    case '23514':
      // Las validaciones propias de LUJITOS ya traen un mensaje en español.
      return /[áéíóúñ]|cuenta|categor|movimiento/i.test(error.message ?? '')
        ? (error.message ?? 'Los datos no son válidos.')
        : 'Los datos no son válidos.';
    case '42501':
      return 'No tienes permiso para esta operación.';
    case 'PGRST116':
      return 'No encontramos el registro.';
    default:
      if (/network|fetch|Failed to fetch/i.test(error.message ?? '')) {
        return 'Sin conexión con el servidor. Revisa tu internet.';
      }
      return 'No pudimos guardar los cambios. Inténtalo de nuevo.';
  }
}
