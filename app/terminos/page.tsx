export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-white px-4 py-10 text-zinc-900 md:px-8">
      <div className="mx-auto max-w-[920px] rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm md:p-10">
        <div className="text-sm font-medium text-zinc-500">
          FanPush
        </div>
        <h1 className="mt-3 text-4xl font-semibold">Términos y condiciones</h1>
        <p className="mt-4 text-sm text-zinc-500">
          Última actualización: 18 de marzo de 2026. Este texto es una versión
          original y genérica para una plataforma de creadores y compradores de
          contenido digital.
        </p>

        <div className="mt-8 space-y-8 text-sm leading-7 text-zinc-700">
          <section>
            <h2 className="text-lg font-semibold text-zinc-900">1. Uso de la plataforma</h2>
            <p>
              FanPush permite a usuarios crear cuentas, subir contenido digital,
              vender publicaciones y enviar propinas. Al registrarte aceptas usar
              el servicio de forma lícita, respetando estos términos, la
              legislación aplicable y los derechos de terceros.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">2. Cuentas de usuario</h2>
            <p>
              Debes proporcionar información veraz y mantener la seguridad de tu
              cuenta. Eres responsable por toda actividad realizada con tu sesión.
              FanPush puede suspender o cerrar cuentas que incumplan estos
              términos, representen un riesgo de seguridad o intenten eludir
              restricciones del servicio.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">3. Edad mínima y verificación</h2>
            <p>
              Debes tener al menos 18 años para registrarte y usar FanPush. Para
              vender contenido, recibir pagos o acceder a funciones de autor,
              FanPush puede solicitar verificación de identidad, incluyendo datos
              personales y documentación oficial vigente. La plataforma podrá
              rechazar, suspender o revocar el acceso como autor si la
              información es incompleta, inexacta o no supera la revisión.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">4. Contenido subido por usuarios</h2>
            <p>
              Cada creador es responsable del contenido que publica y garantiza
              que tiene los derechos necesarios para subirlo, venderlo o licenciarlo.
              No está permitido publicar material ilegal, engañoso, violento,
              no autorizado, invasivo de privacidad, infractor de derechos de
              autor o fuera del contexto permitido por la plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">5. Moderación y eliminación</h2>
            <p>
              FanPush se reserva el derecho de revisar, restringir, ocultar o
              eliminar contenido y cuentas cuando sea necesario por seguridad,
              legalidad, cumplimiento de políticas internas o protección de la
              comunidad. La eliminación de contenido por parte de FanPush puede
              ocurrir sin previo aviso cuando exista riesgo o incumplimiento grave.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">6. Compras, propinas y comisiones</h2>
            <p>
              Las compras de contenido y las propinas se procesan mediante
              proveedores externos de pago. FanPush puede retener una comisión
              sobre cada transacción, según las condiciones comerciales vigentes
              dentro de la plataforma. El saldo mostrado al creador puede verse
              afectado por comisiones, reembolsos, contracargos, fraudes o
              revisiones internas.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">7. Propiedad intelectual</h2>
            <p>
              El contenido y las marcas de FanPush pertenecen a sus respectivos
              titulares. El usuario no adquiere derechos sobre el software, el
              diseño ni la marca de la plataforma. Tampoco puede copiar,
              redistribuir o explotar contenido ajeno fuera de los permisos
              expresamente otorgados.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">8. Limitación de responsabilidad</h2>
            <p>
              FanPush se ofrece según disponibilidad. No garantizamos que el
              servicio sea ininterrumpido, libre de errores o adecuado para un
              propósito específico. En la máxima medida permitida por la ley,
              FanPush no será responsable por pérdidas indirectas, lucro cesante,
              pérdida de datos o daños derivados del uso del servicio.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">9. Cambios en los términos</h2>
            <p>
              FanPush puede actualizar estos términos en cualquier momento. Si los
              cambios son relevantes, se podrá informar dentro de la plataforma.
              El uso continuado del servicio después de una actualización implica
              aceptación de la nueva versión.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
