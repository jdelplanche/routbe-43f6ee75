# Rout Profile Creator

We bouwen verder aan ROUT (rout.be), een onafhankelijke, wereldwijde QR-code generator en profielenplatform (privacy-vriendelijke link-in-bio en QR-beheertool).

### 1. Project Broncode (GitHub):

Importeer en koppel de volgende publieke GitHub-repository als basis voor de codebase:

- **Repository:** https://github.com/jdelplanche/supabase-starter-hub-0a24c88e.git

### 2. Supabase Database & Koppeling:

- **Database Status:** De complete v3 database-migratie is reeds succesvol uitgevoerd. Alle tabellen (`profiles`, `tracked_qrs`, `saved_qrs`, `links`, `badges`, `analytics_events`, `custom_domains`, `user_roles`, etc.), RLS-policies, triggers en functies staan al volledig en foutloos in de gekoppelde Supabase-database.

- **Configuratie:** Maak geen nieuwe tabellen of migraties aan die het bestaande schema overschrijven of breken. Gebruik de bestaande omgevingsvariabelen en de service role key configuratie (`ROUT_SUPABASE_SERVICE_ROLE_KEY`) zoals die in de omgeving is ingesteld.

### 3. Belangrijke Regels:

- **Assets:** Geen lokale Vite-imports (`import logo from ...`) voor het logo of statische assets om te voorkomen dat de bundler een preview-domein afdwingt. Gebruik uitsluitend de absolute productie-URL (`https://rout.be/img/logo.png`) via `src/lib/site.ts`.

- **Handles:** Handles onder de 3 tekens zijn niet toegestaan. Handles van 3 of 4 tekens zijn gereserveerd (vereisen een VIP-grant). Handles vanaf 5 tekens zijn openbaar.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
