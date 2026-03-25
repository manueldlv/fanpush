const items = [
  {
    title: "¿Necesito verificarme para comprar?",
    body: "No. Cualquier usuario puede registrarse, iniciar sesión y comprar contenido o enviar propinas. La verificación solo es obligatoria para vender.",
  },
  {
    title: "¿Cuándo se desbloquea una compra?",
    body: "Apenas Mercado Pago confirma el pago, el contenido queda asociado a tu cuenta y puedes verlo desde el feed o la sección de compras.",
  },
  {
    title: "¿Qué necesito para convertirme en autor?",
    body: "Debes ser mayor de 18 años, completar tus datos y subir fotos del frente y dorso de tu documento para revisión manual.",
  },
  {
    title: "¿Cuándo puedo retirar mis ganancias?",
    body: "Cuando alcanzas el mínimo de retiro configurado en la plataforma y tienes completos tus datos de cobro. Los retiros se procesan por lote mensual.",
  },
  {
    title: "¿Qué pasa si rechazan mi solicitud de autor?",
    body: "Recibirás una notificación con el motivo. Luego podrás volver a enviar la solicitud corrigiendo los datos o documentos.",
  },
  {
    title: "¿Cómo denuncio contenido?",
    body: "Desde el menú de cada publicación puedes elegir “Denunciar”, escribir el motivo y el equipo de FanPush lo revisará.",
  },
];

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10 text-zinc-900 md:px-8">
      <div className="mx-auto max-w-[860px] rounded-[18px] border border-zinc-200 bg-white p-6 shadow-sm md:p-8">
        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-400">
          FanPush
        </div>
        <h1 className="mt-3 text-3xl font-semibold">Preguntas frecuentes</h1>
        <p className="mt-3 max-w-[680px] text-sm leading-6 text-zinc-600">
          Respuestas rápidas sobre compras, autores, pagos, retiros y
          moderación del sitio.
        </p>

        <div className="mt-8 space-y-4">
          {items.map((item) => (
            <section
              key={item.title}
              className="rounded-[16px] border border-zinc-200 bg-zinc-50 p-5"
            >
              <h2 className="text-lg font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{item.body}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
