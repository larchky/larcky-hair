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

## Payment and order setup

Orders are saved from server routes only after Flutterwave confirms the
transaction. Add these server variables before taking live orders:

```bash
FLUTTERWAVE_SECRET_KEY=FLWSECK_...
SUPABASE_SERVICE_ROLE_KEY=...
```

In Flutterwave, set the webhook URL to:

```text
https://your-domain.com/api/flutterwave/webhook
```

If you set a Flutterwave webhook secret hash, add the same value as:

```bash
FLW_SECRET_HASH=...
```

Email notifications are optional. To send a new-order email through Resend, add:

```bash
RESEND_API_KEY=...
ORDER_NOTIFICATION_EMAIL=admin@example.com
ORDER_NOTIFICATION_FROM="Dolapo Orders <orders@your-domain.com>"
```

Run `supabase/orders-customer-details.sql` in the Supabase SQL editor after
deploying these changes so orders are created only by the verified server flow.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
