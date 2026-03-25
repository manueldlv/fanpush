export default function AyudaPage() {
  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10 text-zinc-900 md:px-8">
      <div className="mx-auto max-w-[860px] rounded-[18px] border border-zinc-200 bg-white p-6 shadow-sm md:p-8">
        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-400">
          FanPush
        </div>
        <h1 className="mt-3 text-3xl font-semibold">Centro de ayuda</h1>
        <p className="mt-3 max-w-[680px] text-sm leading-6 text-zinc-600">
          Todo lo importante para usar FanPush sin perderte: cómo comprar, cómo
          convertirte en autor, cómo retirar tus ganancias y qué hacer si algo
          no sale como esperabas.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <section className="rounded-[16px] border border-zinc-200 bg-zinc-50 p-5">
            <h2 className="text-lg font-semibold">Comprar contenido</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Inicia sesión, abre una publicación bloqueada y completa el pago con
              Mercado Pago. Cuando el pago queda aprobado, el contenido se
              desbloquea en tu cuenta de FanPush.
            </p>
          </section>

          <section className="rounded-[16px] border border-zinc-200 bg-zinc-50 p-5">
            <h2 className="text-lg font-semibold">Convertirte en autor</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Para vender contenido necesitas verificación de identidad. Completa
              la solicitud, sube tu documento y espera la revisión del equipo.
            </p>
          </section>

          <section className="rounded-[16px] border border-zinc-200 bg-zinc-50 p-5">
            <h2 className="text-lg font-semibold">Cobros y retiros</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Tus ventas y propinas se reflejan en pesos argentinos. Cuando
              alcanzas el mínimo de retiro, puedes solicitarlo desde la pantalla
              de ventas usando tus datos de cobro.
            </p>
          </section>

          <section className="rounded-[16px] border border-zinc-200 bg-zinc-50 p-5">
            <h2 className="text-lg font-semibold">Seguridad y moderación</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              El contenido premium se entrega solo a compradores. Si ves algo
              inapropiado, puedes denunciarlo y el equipo de FanPush lo revisa.
            </p>
          </section>
        </div>

        <div className="mt-8 rounded-[16px] border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900">
          <div className="font-semibold">¿Necesitas ayuda puntual?</div>
          <p className="mt-2 leading-6">
            Puedes escribirnos a{" "}
            <a className="font-semibold underline" href="mailto:soporte@fanpush.com">
              soporte@fanpush.com
            </a>{" "}
            o revisar la sección de preguntas frecuentes.
          </p>
          <a
            href="/faq"
            className="mt-4 inline-flex rounded-[12px] bg-zinc-950 px-4 py-2 text-sm font-semibold text-white"
          >
            Ver preguntas frecuentes
          </a>
        </div>
      </div>
    </div>
  );
}
