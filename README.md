# EDUKDO

Application mobile multiplateforme (iOS + Android) qui récompense les collégiens et lycéens pour leurs résultats scolaires. Les élèves photographient leurs bulletins, gagnent des points, et les échangent dans une boutique de récompenses (cinéma, streaming, parcs d'attractions, cartes cadeaux).

---

## Architecture

```
edukdo/
├── apps/
│   ├── mobile/          # Application Expo React Native (iOS + Android)
│   │   ├── app/         # Routes expo-router (file-based routing)
│   │   │   ├── (auth)/  # Écrans non protégés : login, register
│   │   │   └── (app)/   # Écrans protégés : home, submit, shop, profile
│   │   ├── components/  # Composants UI réutilisables
│   │   ├── hooks/       # Custom hooks (useAuth, usePoints…)
│   │   ├── services/    # Couche appels API vers le backend
│   │   ├── store/       # État global Zustand
│   │   └── constants/   # Thème, couleurs, config
│   │
│   └── api/             # Backend NestJS — REST API
│       ├── src/
│       │   ├── auth/       # Authentification JWT (register, login, refresh)
│       │   ├── users/      # Gestion utilisateurs (élève + parent)
│       │   ├── bulletins/  # Upload, OCR Textract, cycle de vie bulletin
│       │   ├── points/     # Calcul des points, historique (audit trail)
│       │   ├── shop/       # Catalogue récompenses, commandes
│       │   ├── ai/         # Intégration Claude API (commentaires IA)
│       │   └── prisma/     # Service Prisma ORM
│       └── prisma/
│           └── schema.prisma
│
└── packages/
    └── shared/          # Types TypeScript partagés mobile ↔ API
        └── src/types/   # DTOs, interfaces, enums communs
```

---

## Démarrage

```bash
# 1. Cloner et installer les dépendances
git clone <repo> && cd edukdo
npm install

# 2. Lancer la base de données et Redis en local
docker-compose up -d

# 3. Configurer les variables d'environnement
cp .env.example .env
# Éditer .env et remplir au minimum : DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET

# 4. Initialiser la base de données et insérer les données de test
cd apps/api
npx prisma migrate dev --name init
npx prisma db seed

# 5. Lancer le backend (port 3000)
npm run start:dev

# 6. Dans un autre terminal, lancer l'app mobile
cd apps/mobile
npx expo start
# Scanner le QR code avec l'app Expo Go sur votre téléphone
```

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Mobile | React Native + Expo SDK, expo-router |
| Backend | Node.js 20 LTS + NestJS, REST |
| Base de données | PostgreSQL 16 via Prisma ORM |
| Cache / Queues | Redis 7 + Bull |
| Authentification | JWT (access 15 min + refresh 7 j), expo-secure-store |
| OCR | AWS Textract (mock en développement) |
| Stockage fichiers | AWS S3 (filesystem local en développement) |
| IA | Anthropic Claude Haiku via @anthropic-ai/sdk |
| Infrastructure | Docker Compose |
