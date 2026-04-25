This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Dummy Seed

Para poblar la base con datos dummy de prueba:

```bash
npm run seed:dummy
```

Para borrar ese seed:

```bash
npm run seed:dummy:clean
```

Guía completa en [docs/dummy-seed-guide.md](/Users/devforce/Documents/GitHub/fanpush/docs/dummy-seed-guide.md).

## Supabase Migrations

Levantar `npm run dev` no aplica migraciones de Supabase automaticamente.

Para empujar las migraciones de [supabase/migrations](/Users/devforce/Documents/GitHub/fanpush/supabase/migrations:1):

```bash
npm run db:push
```

El script soporta estos modos:

- `SUPABASE_DB_URL`
- `SUPABASE_HOST`, `SUPABASE_PORT`, `SUPABASE_USER`, `SUPABASE_DATABASE`, `SUPABASE_PASSWORD`
- proyecto linkeado con `supabase link` y `supabase/config.toml`

Si no hay ninguna de esas configuraciones, el script falla con instrucciones claras.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
