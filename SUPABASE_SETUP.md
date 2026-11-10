# Supabase setup

## Create the database

1. Create a Supabase project and keep its database password private.
2. In the Supabase SQL Editor, run `supabase/schema.sql` once.
3. In Authentication settings, configure email confirmation and the allowed redirect URLs. Validate confirmation and invitation links on a physical Android device before inviting customers.
4. Copy the project URL and public anon key into a local `.env.local` file based on `.env.example`. The anon key is intended for client apps because RLS protects the tables; never put the `service_role` key in the app, local client config, or GitHub Actions.
5. In repository Settings > Secrets and variables > Actions, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The CI and release workflows inject these only during their Vite builds.
6. Deploy the invitation and account deletion functions with the Supabase CLI:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy invite-member
npx supabase functions deploy delete-account
```

The SQL creates organization-scoped tables and enables row-level security. Customer, technician, and shop prices are stored as separate rows so one role cannot read another role's price tier. The first signed-up owner creates the organization through `create_organization`. Owner-issued team invitations go through the deployed `invite-member` Edge Function; its service-role key stays server-side.

Run the web version locally with `npm install` and `npm run dev`. Without valid Supabase environment variables, the app displays a setup screen and does not fall back to browser-only business storage. The CI workflow validates the SQL schema and builds an APK; for it to connect to your project, configure the GitHub Actions secrets above first.

## Production checklist

- Configure the Supabase project URL and anon key locally and in GitHub Actions, apply the schema, and deploy the invitation function before testing sign-in or team invites.
- Confirm Supabase email-confirmation and invitation links return to the app on Android. A native deep-link return flow still needs end-to-end testing before external users are invited.
- Verify RLS with separate owner, technician, shop, and customer accounts. Never let a client assign its own role or organization.
- Confirm GSTIN, registered business name/address, tax classification, HSN/SAC codes, intra/inter-state tax treatment, and invoice rules with your accountant before issuing legal GST invoices.
- Cancelling an invoice keeps its number and returns its stock. Ask your accountant whether invoices already reported in a GST return need a credit note instead; the app does not issue credit notes yet.
- Set up backups, account recovery, email delivery, support contact, and a public privacy policy before external users sign in.
- Complete Google Play Data safety, privacy policy, store listing, signed release AAB, and personal-account closed testing requirements before production release.

Do not use real customer data until authentication, database reads/writes, invitations, and role policies have all been tested in the deployed Supabase project.
## Upgrading the production database

`supabase/schema.sql` always describes a brand-new database. When it changes, a matching script in
`supabase/upgrades/` brings an existing database up to date. Run each new upgrade script once in
Supabase → SQL Editor. The scripts are safe to run again, and CI checks that they apply cleanly.

## Backups

The **Database backup** workflow dumps the production database every night at 02:00 IST,
encrypts it, and keeps 30 days of copies as workflow artifacts. It then test-restores each backup
into a throwaway local Supabase stack and checks every table's row count, so a backup that cannot be
restored fails the run and GitHub emails you. It needs two repository secrets:

- `SUPABASE_DB_URL`: Supabase → Connect → **Session pooler** connection string, with the database
  password filled in.
- `BACKUP_PASSPHRASE`: a long random passphrase. Store it in your password manager too. Without
  it, backups cannot be decrypted.

To restore a backup:

1. Download the artifact from the workflow run and unzip it.
2. Decrypt and unpack:
   `gpg --decrypt clearflow-backup-*.tar.gz.gpg > backup.tar.gz && tar -xzf backup.tar.gz`
3. Restore into a new Supabase project (Postgres 17 `psql` needed):
   `bash scripts/verify-backup-restore.sh backup "<connection string>"`. It loads the schema, then
   the data with triggers switched off (so audit-log triggers don't add rows), in one transaction,
   and reports each table's row count.

On the Supabase Pro plan, daily backups and point-in-time recovery are also available from the
dashboard.

## Error reports

Unexpected app errors are stored in the `client_errors` table. View them in Supabase → Table
Editor → `client_errors`. App users can add rows but never read them.

## Plans and payments (Razorpay)

Each business gets a 7-day free trial (`organizations.trial_ends_at`). After that it needs a paid
plan (`paid_until` in the future) to add or change records. Without one the workspace stays
readable, and a database trigger (`require_active_plan`) refuses inserts and updates. Plans are
₹199/month or ₹1,999/year and are bought only in the **web** app (My account). The Android app
shows no prices, buttons or links to pay, because Google Play's Payments policy allows a
"consumption-only" app to unlock a plan bought elsewhere but not to lead users to that payment.

One-time setup:

1. In the Razorpay dashboard, go to **Subscriptions → Plans** and create two plans: monthly ₹199
   and yearly ₹1,999. Copy both plan IDs (`plan_...`).
2. Go to **Settings → API keys** and generate a key ID and secret.
3. Go to **Settings → Webhooks** and add
   `https://YOUR_PROJECT_REF.supabase.co/functions/v1/razorpay-webhook`, with a secret you choose
   and the events `subscription.activated`, `subscription.charged` and `subscription.resumed`.
4. Set the function secrets and deploy:

```powershell
npx supabase secrets set RAZORPAY_KEY_ID=rzp_live_... RAZORPAY_KEY_SECRET=... RAZORPAY_WEBHOOK_SECRET=... RAZORPAY_PLAN_MONTHLY=plan_... RAZORPAY_PLAN_YEARLY=plan_...
npx supabase functions deploy create-subscription
npx supabase functions deploy razorpay-webhook
```

Use Razorpay's test mode keys and plans first. Switch to live keys after a test payment unlocks
a test business.

To give a business free access (for example the Google Play reviewer's demo business), set its
`paid_until` with the service key, for example in the SQL Editor:

```sql
update public.organizations set paid_until = '2099-12-31'
where created_by = (select id from auth.users where email = 'naveenroyal4b3+review@gmail.com');
```
