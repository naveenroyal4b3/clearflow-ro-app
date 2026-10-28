# Supabase setup

## Create the database

1. Create a Supabase project and keep its database password private.
2. In the Supabase SQL Editor, run `supabase/schema.sql` once.
3. In Authentication settings, configure email confirmation and the allowed redirect URLs. Validate confirmation and invitation links on a physical Android device before inviting customers.
4. Copy the project URL and public anon key into a local `.env.local` file based on `.env.example`. The anon key is intended for client apps because RLS protects the tables; never put the `service_role` key in the app, local client config, or GitHub Actions.
5. In repository Settings > Secrets and variables > Actions, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The APK workflow injects these only during its Vite build.
6. Deploy the invitation function with the Supabase CLI:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy invite-member
```

The SQL creates organization-scoped tables and enables row-level security. Customer, technician, and shop prices are stored as separate rows so one role cannot read another role's price tier. The first signed-up owner creates the organization through `create_organization`. Owner-issued team invitations go through the deployed `invite-member` Edge Function; its service-role key stays server-side.

Run the web version locally with `npm install` and `npm run dev`. Without valid Supabase environment variables, the app displays a setup screen and does not fall back to browser-only business storage. The Android workflow validates the SQL schema and builds an APK; for it to connect to your project, configure the GitHub Actions secrets above first.

## Production checklist

- Configure the Supabase project URL and anon key locally and in GitHub Actions, apply the schema, and deploy the invitation function before testing sign-in or team invites.
- Confirm Supabase email-confirmation and invitation links return to the app on Android. A native deep-link return flow still needs end-to-end testing before external users are invited.
- Verify RLS with separate owner, technician, shop, and customer accounts. Never let a client assign its own role or organization.
- Confirm GSTIN, registered business name/address, tax classification, HSN/SAC codes, intra/inter-state tax treatment, and invoice rules with your accountant before issuing legal GST invoices.
- Add stock-return/cancellation handling and an audit log before relying on inventory and invoice records for accounting.
- Set up backups, account recovery, email delivery, support contact, and a public privacy policy before external users sign in.
- Complete Google Play Data safety, privacy policy, store listing, signed release AAB, and personal-account closed testing requirements before production release.

Do not use real customer data until authentication, database reads/writes, invitations, and role policies have all been tested in the deployed Supabase project.
## Upgrading the production database

`supabase/schema.sql` always describes a brand-new database. When it changes, a matching script in
`supabase/upgrades/` brings an existing database up to date. Run each new upgrade script once in
Supabase → SQL Editor. The scripts are safe to run again, and CI checks that they apply cleanly.

## Backups

The **Database backup** workflow dumps the production database every night at 02:00 IST,
encrypts it, and keeps 30 days of copies as workflow artifacts. It needs two repository secrets:

- `SUPABASE_DB_URL`: Supabase → Connect → **Session pooler** connection string, with the database
  password filled in.
- `BACKUP_PASSPHRASE`: a long random passphrase. Store it in your password manager too. Without
  it, backups cannot be decrypted.

To restore a backup:

1. Download the artifact from the workflow run and unzip it.
2. Decrypt and unpack:
   `gpg --decrypt clearflow-backup-*.tar.gz.gpg > backup.tar.gz && tar -xzf backup.tar.gz`
3. Restore into a new Supabase project with `psql "<connection string>"`, running
   `backup/schema.sql`, then `backup/auth-data.sql`, then `backup/data.sql`.

On the Supabase Pro plan, daily backups and point-in-time recovery are also available from the
dashboard.

## Error reports

Unexpected app errors are stored in the `client_errors` table. View them in Supabase → Table
Editor → `client_errors`. App users can add rows but never read them.
