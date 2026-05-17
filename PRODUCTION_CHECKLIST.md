# EDUKDO — Checklist de Mise en Production

> À valider intégralement avant chaque déploiement en production.  
> Dernière mise à jour : Mai 2026 — MVP 0.1

---

## 1. Variables d'Environnement

Copier `.env.example` vers le système de secrets du fournisseur cloud (AWS Secrets Manager, Railway, etc.).  
**Ne jamais committer de valeurs réelles dans le dépôt git.**

| Variable | Criticité | Valeur de développement | Instructions de production |
|---|---|---|---|
| `DATABASE_URL` | 🔴 CRITIQUE | `postgresql://edukdo:edukdo_dev_password@localhost:5432/edukdo_db` | URL PostgreSQL production avec SSL requis (`?sslmode=require`) |
| `JWT_SECRET` | 🔴 CRITIQUE | `CHANGE_ME_IN_PRODUCTION_USE_STRONG_SECRET` | Générer avec `openssl rand -base64 64` — minimum 64 caractères |
| `JWT_REFRESH_SECRET` | 🔴 CRITIQUE | `CHANGE_ME_REFRESH_IN_PRODUCTION` | Générer avec `openssl rand -base64 64` — DIFFÉRENT de JWT_SECRET |
| `JWT_EXPIRES_IN` | 🟡 IMPORTANT | `15m` | Conserver `15m` en production (durée courte = surface d'attaque réduite) |
| `JWT_REFRESH_EXPIRES_IN` | 🟡 IMPORTANT | `7d` | Conserver `7d` ou réduire à `3d` pour plus de sécurité |
| `AWS_REGION` | 🟡 IMPORTANT | `eu-west-3` | `eu-west-3` (Paris) — respecte la localisation des données RGPD |
| `AWS_ACCESS_KEY_ID` | 🔴 CRITIQUE | _(vide en dev)_ | IAM Access Key avec permissions S3 + Textract uniquement (principe de moindre privilège) |
| `AWS_SECRET_ACCESS_KEY` | 🔴 CRITIQUE | _(vide en dev)_ | Stocker dans AWS Secrets Manager, jamais en clair |
| `AWS_S3_BUCKET_NAME` | 🟡 IMPORTANT | `edukdo-bulletins-dev` | `edukdo-bulletins-prod` — bucket privé, sans ACL public |
| `ANTHROPIC_API_KEY` | 🔴 CRITIQUE | _(vide en dev)_ | Clé Anthropic production — rotation mensuelle recommandée |
| `API_PORT` | 🟢 OPTIONNEL | `3000` | Laisser à `3000` derrière un reverse proxy (Nginx/ALB) |
| `NODE_ENV` | 🔴 CRITIQUE | `development` | Définir à `production` — active AWS Textract et S3 réels |
| `REDIS_URL` | 🟡 IMPORTANT | `redis://localhost:6379` | URL Redis production pour les sessions et le cache |
| `ALLOWED_ORIGINS` | 🔴 CRITIQUE | `*` (dangereux !) | Domaine(s) de production uniquement, ex: `https://app.edukdo.fr` |
| `EXPO_PUBLIC_API_URL` | 🟡 IMPORTANT | `http://localhost:3000` | URL HTTPS de l'API de production, ex: `https://api.edukdo.fr` |

### Commandes de génération des secrets

```bash
# Générer JWT_SECRET (64 octets en base64)
openssl rand -base64 64

# Générer JWT_REFRESH_SECRET (valeur DIFFÉRENTE)
openssl rand -base64 64

# Vérifier que les secrets sont bien différents
echo "JWT_SECRET=$JWT_SECRET"
echo "JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET"
```

---

## 2. Sécurité

### 2.1 Transport et CORS

- [ ] **HTTPS forcé** : L'API ne répond pas en HTTP simple en production. Le reverse proxy (Nginx/ALB) redirige tout HTTP vers HTTPS (301).
- [ ] **CORS restreint** : `ALLOWED_ORIGINS` contient uniquement le domaine de l'app mobile (`https://app.edukdo.fr`). Valeur `*` interdite en production.
- [ ] **Certificat TLS valide** : Certificat Let's Encrypt ou AWS ACM avec renouvellement automatique activé.
- [ ] **HSTS activé** : Header `Strict-Transport-Security: max-age=31536000; includeSubDomains` configuré dans Nginx.

### 2.2 Rate Limiting et protection DDoS

- [ ] **Rate limiting sur `/api/auth/login`** : Maximum 5 tentatives par IP par minute (configurer avec `@nestjs/throttler` ou nginx `limit_req`). Protège contre le brute-force.
- [ ] **Rate limiting sur `/api/auth/register`** : Maximum 3 inscriptions par IP par heure.
- [ ] **Rate limiting global** : Maximum 100 requêtes par IP par minute sur tous les endpoints.
- [ ] **Protection DDoS** : AWS Shield Standard activé (inclus dans AWS), ou Cloudflare Free plan.

### 2.3 Headers de sécurité

- [ ] **Helmet NestJS activé** : Ajouter `app.use(helmet())` dans `main.ts` pour la production.

  ```typescript
  // apps/api/src/main.ts — à ajouter pour la production
  import helmet from 'helmet';
  if (process.env.NODE_ENV === 'production') {
    app.use(helmet());
  }
  ```

- [ ] **CSP configuré** : Content-Security-Policy restrictif (pas de `unsafe-inline`, `unsafe-eval`).
- [ ] **X-Frame-Options** : `DENY` ou `SAMEORIGIN` (Helmet l'active par défaut).

### 2.4 Authentification et autorisation

- [ ] **JWT_SECRET ≥ 64 caractères** : Vérifiable avec `echo -n "$JWT_SECRET" | wc -c`.
- [ ] **Refresh tokens hachés en base** : Confirmé dans le code (`bcrypt.hash` avant stockage). ✅
- [ ] **Tokens d'accès en mémoire côté mobile** : Les tokens d'accès ne sont PAS dans le localStorage (Expo SecureStore utilisé). ✅
- [ ] **Ownership checks partout** : Chaque endpoint vérifie que la ressource appartient à l'utilisateur connecté. ✅
- [ ] **Validation des entrées** : `class-validator` et `ValidationPipe` activés globalement. ✅
- [ ] **Hash bcrypt salt rounds = 12** : Confirmé dans le code. ✅

### 2.5 Sécurité des fichiers uploadés

- [ ] **Taille maximale : 10 MB** : Limite configurée dans `bulletins.service.ts`. ✅
- [ ] **Types MIME whitelist** : Seuls `image/jpeg`, `image/png`, `image/heic` acceptés. ✅
- [ ] **Scan antivirus** : Intégrer AWS GuardDuty Malware Protection ou ClamAV sur les fichiers S3 avant traitement Textract (recommandé post-MVP).
- [ ] **Bucket S3 privé** : Accès public désactivé sur le bucket. Les URLs sont des pre-signed URLs, pas des URLs publiques.

### 2.6 Logs et monitoring

- [ ] **Aucune donnée personnelle dans les logs** : Vérifier que les logs NestJS n'incluent pas d'emails, noms, ou tokens. ✅ (`Logger.warn` avec email uniquement sur les tentatives de connexion échouées — acceptable car log de sécurité).
- [ ] **Aucun mot de passe ou token dans les logs** : Vérifiable par audit du code. ✅
- [ ] **Logs centralisés** : CloudWatch Logs, Datadog, ou Sentry configuré pour l'API.
- [ ] **Alertes d'erreur** : Notification sur erreurs 5xx (≥ 5 en 5 minutes) et erreurs d'authentification massives.

---

## 3. Infrastructure AWS

### 3.1 S3 — Stockage des photos de bulletins

- [ ] **Bucket créé dans `eu-west-3` (Paris)** : Conformité RGPD — données hébergées dans l'UE.
- [ ] **Accès public désactivé** : `Block all public access: ON`.
- [ ] **Versioning activé** : Protège contre les suppressions accidentelles.
- [ ] **Lifecycle policy** : Suppression automatique des fichiers après 3 ans (conformité RGPD).
- [ ] **Policy IAM minimale** : Le rôle IAM de l'API a uniquement `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` sur `arn:aws:s3:::edukdo-bulletins-prod/*`.

  ```json
  {
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::edukdo-bulletins-prod/*"
    }]
  }
  ```

- [ ] **Chiffrement at-rest** : SSE-S3 (AES-256) activé par défaut.

### 3.2 AWS Textract — OCR des bulletins

- [ ] **Région correcte** : Textract utilisé dans `eu-west-3` (même région que S3 pour éviter les coûts de transfert inter-région).
- [ ] **`NODE_ENV=production`** : La variable est bien à `production` pour déclencher le vrai Textract (pas le mock).
- [ ] **Gestion des erreurs Textract** : Timeout de 30 secondes configuré. Statut `NEEDS_REVIEW` si timeout ou erreur Textract.
- [ ] **Budget AWS** : Alerte configurée si les coûts Textract dépassent 50 €/mois.

### 3.3 CloudWatch — Logs et métriques

- [ ] **Log groups créés** : `/edukdo/api/production` et `/edukdo/api/errors`.
- [ ] **Métriques personnalisées** : Nombre de bulletins traités/jour, taux de rejet OCR, erreurs 5xx.
- [ ] **Rétention des logs** : 90 jours (RGPD : durée justifiée par les besoins d'audit).
- [ ] **Dashboard CloudWatch** : Vue d'ensemble des métriques clés configurée.

### 3.4 Base de données PostgreSQL

- [ ] **Instance RDS** : PostgreSQL 15+, Multi-AZ activé pour la haute disponibilité.
- [ ] **Backups automatiques** : Rétention 7 jours, backup quotidien à 3h00 (Europe/Paris).
- [ ] **SSL obligatoire** : `rds.force_ssl = 1` activé sur l'instance.
- [ ] **Accès réseau** : RDS dans un VPC privé, accessible uniquement depuis le security group de l'API. PAS d'accès public.
- [ ] **Migrations Prisma** : `npx prisma migrate deploy` (pas `migrate dev`) exécuté en CI/CD avant le démarrage de l'API.

---

## 4. RGPD — Conformité

### 4.1 Mineurs et consentement parental

- [ ] **Consentement parental pour les <15 ans** : L'inscription d'un élève né après `Date.now() - 15*365*24*3600*1000` doit exiger la validation d'un compte parent (à implémenter si non encore fait).
- [ ] **Consentement explicite** : Case à cocher "J'accepte les CGU et la politique de confidentialité" lors de l'inscription, non pré-cochée.
- [ ] **Age de l'élève calculé** : Le champ `birthDate` est requis pour les élèves et doit être validé (date passée, élève de 11 à 18 ans).

### 4.2 Droits des utilisateurs

- [ ] **Droit à l'accès** : L'endpoint `GET /api/users/me` (ou l'export de profil) retourne toutes les données personnelles d'un utilisateur.
- [ ] **Droit à l'effacement (soft delete)** : Le champ `deletedAt` sur le modèle `User` est présent dans le schéma Prisma. ✅ L'endpoint `DELETE /api/users/me` doit marquer `deletedAt = now()` et anonymiser le profil.
- [ ] **Droit à la portabilité** : Export JSON des données de l'utilisateur (bulletins, points, commandes) disponible.
- [ ] **Droit de rectification** : Endpoint `PATCH /api/users/profile` permet de modifier prénom/nom/établissement.

### 4.3 Information et transparence

- [ ] **Mentions légales** : Page accessible dans l'app (onglet Profil → "Mentions légales").
- [ ] **Politique de confidentialité** : Accessible avant l'inscription ET depuis le profil.
- [ ] **Éditeur identifié** : Nom de la société, adresse, SIRET visibles dans les mentions légales.
- [ ] **DPO désigné** : Délégué à la Protection des Données nommé. Adresse email DPO mentionnée dans la politique de confidentialité (ex: `dpo@edukdo.fr`).

### 4.4 Sécurité des données

- [ ] **Chiffrement des données sensibles** : Mots de passe hashés avec bcrypt (salt 12). ✅
- [ ] **Pas de transfert hors UE** : Vérifier qu'aucun service tiers n'envoie de données personnelles hors de l'UE (Anthropic : données envoyées aux USA — vérifier les clauses contractuelles standard si des données personnelles y transitent).
- [ ] **Registre des traitements** : Document RGPD listant tous les traitements de données (à créer avec le DPO).

### 4.5 Données des enfants (CNIL spécifique)

- [ ] **Autorisation parentale documentée** : Le lien parent-enfant est enregistré en base. Pour les élèves <15 ans, ce lien est obligatoire.
- [ ] **Pas de publicité ciblée** : EDUKDO n'utilise pas les données des mineurs à des fins publicitaires. ✅ (conforme à l'article 8 RGPD)
- [ ] **Notification CNIL** : Vérifier si une notification CNIL est requise pour le traitement de données de mineurs.

---

## 5. Pré-déploiement — Vérifications finales

### 5.1 Code et build

- [ ] **Tests unitaires passent** : `npm test` retourne 0 échecs.
- [ ] **Tests E2E passent** : `npm run test:e2e` retourne 10/10 tests verts.
- [ ] **TypeScript compile sans erreur** : `npm run build` complète sans erreur.
- [ ] **Lint sans erreur** : `npm run lint` retourne 0 erreurs (warnings acceptables).
- [ ] **Variables secrètes absentes du code** : `git grep -i "secret\|password\|apikey\|api_key" -- "*.ts" ":!*.spec.ts" ":!*.d.ts"` ne retourne aucune valeur en dur.

### 5.2 Base de données

- [ ] **Migration de production appliquée** : `npx prisma migrate deploy` exécuté sur la base de production.
- [ ] **Seed de production exécuté** : Récompenses initiales insérées via le seed adapté à la production.
- [ ] **Connexion SSL vérifiée** : La base accepte uniquement les connexions SSL (`sslmode=require` dans `DATABASE_URL`).

### 5.3 App mobile

- [ ] **`EXPO_PUBLIC_API_URL`** pointe vers l'API de production HTTPS.
- [ ] **Build EAS** : `eas build --platform all --profile production` complète sans erreur.
- [ ] **Smoke test validé** sur simulateur iOS et émulateur Android (voir `apps/mobile/e2e/smoke.md`).
- [ ] **Métadonnées App Store / Play Store** : Screenshots, description, mentions légales soumis.

---

## Lancement des tests E2E

```bash
# Depuis le répertoire apps/api/
cd apps/api

# Installer les dépendances (incluant supertest)
npm install

# Prérequis : PostgreSQL accessible
docker-compose up -d

# Initialiser la base de test
npx prisma migrate deploy

# Lancer les 10 tests E2E
npm run test:e2e
```

**Tests attendus : 10**  
**Temps d'exécution estimé : ~15 secondes** (dont ~3 s d'attente pour le traitement OCR asynchrone)

```
 PASS  test/mvp-cycle.e2e-spec.ts
  Test 1 — Inscription élève
    ✓ POST /api/auth/register crée un compte élève et retourne un token sans passwordHash
  Test 2 — Inscription parent
    ✓ POST /api/auth/register crée un compte parent et retourne un token sans passwordHash
  Test 3 — Login et récupération du token
    ✓ POST /api/auth/login retourne un token permettant d'accéder aux routes protégées
    ✓ POST /api/auth/login retourne 401 avec mauvais mot de passe
  Test 4 — Upload de bulletin
    ✓ POST /api/bulletins/upload accepte un JPEG et retourne un bulletinId
  Test 5 — Traitement asynchrone OCR
    ✓ GET /api/bulletins/:id retourne le statut VALIDATED après traitement
  Test 6 — Vérification du scoring
    ✓ GET /api/points/balance retourne 325 pts (moyenne 65 %, pas de bonus)
    ✓ GET /api/points/history contient l'événement BULLETIN_REWARD
  Test 7 — Création de commande
    ✓ POST /api/shop/orders débite 100 pts et crée la commande
  Test 8 — Sécurité : accès croisé
    ✓ GET /api/bulletins/:id avec token d'un autre élève retourne 403
    ✓ GET /api/bulletins sans token retourne 401
  Test 9 — Sécurité : fichier invalide
    ✓ POST /api/bulletins/upload avec un .pdf retourne 400
    ✓ POST /api/bulletins/upload sans fichier retourne 400
  Test 10 — Sécurité : points insuffisants
    ✓ POST /api/shop/orders avec récompense à 1000 pts retourne 400 "Solde insuffisant"

Tests: 14 passed (10 groupes de tests, 14 assertions individuelles)
Time: ~15s
```

> **Note :** Les tests 3 et 8-9 comprennent 2 assertions chacun, portant le total à 14 `it()` pour 10 groupes logiques (`describe()`).
