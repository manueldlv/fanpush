export default function PrivacidadPage() {
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10 text-zinc-900">
      <div className="mx-auto max-w-[900px] rounded-[20px] border border-zinc-200 bg-white p-6 shadow-sm md:p-10">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">
          FanPush
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Política de privacidad
        </h1>
        <div className="mt-6 space-y-5 text-sm leading-7 text-zinc-600">
          <p>
            FanPush recopila la información necesaria para crear cuentas, operar
            el servicio, procesar compras, registrar propinas, administrar
            retiros y moderar contenido dentro de la plataforma.
          </p>
          <p>
            Los datos que podemos tratar incluyen correo electrónico, nombre de
            usuario, nombre visible, avatar, contenido publicado, historial de
            compras, propinas, solicitudes de retiro y datos de cobro cargados
            por el creador para procesar pagos manuales.
          </p>
          <p>
            La información se usa para autenticar usuarios, prestar el servicio,
            prevenir fraude, moderar actividad, responder reportes, cumplir
            obligaciones legales y mejorar la experiencia de uso.
          </p>
          <p>
            Los pagos son procesados por proveedores externos como Mercado Pago.
            FanPush no almacena datos completos de tarjetas y solo conserva la
            información necesaria para reflejar transacciones dentro del sitio.
          </p>
          <p>
            Los datos de cobro cargados por creadores se utilizan únicamente para
            gestionar retiros y pagos manuales. El acceso a esa información está
            restringido al equipo administrativo autorizado.
          </p>
          <p>
            FanPush puede conservar registros de actividad, reportes,
            notificaciones y transacciones mientras sean necesarios para operar
            la plataforma, resolver disputas, prevenir abuso o cumplir
            requerimientos legales.
          </p>
          <p>
            Podés solicitar la eliminación de tu cuenta desde la configuración.
            Algunas evidencias mínimas de actividad o transacciones pueden
            conservarse cuando sea necesario por motivos operativos, legales o
            de seguridad.
          </p>
          <p>
            El uso continuado de FanPush implica la aceptación de esta política
            de privacidad junto con los términos y condiciones de la plataforma.
          </p>
        </div>
      </div>
    </main>
  );
}
