/**
 * EDUKDO MVP — Tests d'intégration E2E
 *
 * Ce fichier valide le cycle de valeur complet du MVP en 10 tests séquentiels.
 * Il nécessite une base PostgreSQL accessible via DATABASE_URL (variable d'env).
 *
 * Lancer avec : npm run test:e2e (depuis apps/api/)
 * Prérequis    : docker-compose up -d && npx prisma migrate deploy
 *
 * Mock OCR (NODE_ENV !== 'production') retourne :
 *   Maths 14/20 (coeff 4), Français 12/20 (coeff 4), Histoire 13/20 (coeff 3),
 *   Anglais 15/20 (coeff 3), Physique 11/20 (coeff 3)
 *   → moyenneGenerale = 1105/17 = 65 %  → baseScore = 325 pts
 *
 * Score attendu pour le 1er bulletin (pas de bonus progression ni régularité) : 325 pts
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AiService } from '../src/ai/ai.service';

// ─── Constantes de scoring calculées depuis le mock OCR ──────────────────────
// grades: Maths 14/20 c4, Français 12/20 c4, Histoire 13/20 c3, Anglais 15/20 c3, Physique 11/20 c3
// moyenneGenerale = (70×4 + 60×4 + 65×3 + 75×3 + 55×3) / 17 = 1105/17 = 65 %
// baseScore = Math.floor(65 × 5) = 325 pts (premier bulletin → 0 bonus progression + régularité)
const EXPECTED_POINTS = 325;
const CHEAP_REWARD_COST = 100;   // Récompense test à 100 pts (< 325 pts disponibles)
const COSTLY_REWARD_COST = 1000; // Récompense test à 1000 pts (> 325 pts disponibles)

// Image JPEG 1×1 pixel valide (fixture de test)
const JPEG_1PX_B64 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8U' +
  'HRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAAR' +
  'CAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAA' +
  'AAAAAAAP/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAA' +
  'wDAQACEQMRAD8AJQAB/9k=';

// ─── Setup global ─────────────────────────────────────────────────────────────

let app: INestApplication;
let prisma: PrismaService;

// Contexte partagé entre tests (ordre d'exécution séquentiel)
let studentToken: string;
let parentToken: string;
let studentUserId: string;
let secondStudentToken: string;
let secondStudentUserId: string;
let bulletinId: string;
let cheapRewardId: string;
let costlyRewardId: string;

// Emails uniques par run pour éviter les collisions si la base n'est pas nettoyée
const RUN_ID = Date.now();
const STUDENT_EMAIL = `eleve.e2e.${RUN_ID}@test.fr`;
const PARENT_EMAIL = `parent.e2e.${RUN_ID}@test.fr`;
const SECOND_STUDENT_EMAIL = `eleve2.e2e.${RUN_ID}@test.fr`;

beforeAll(async () => {
  // Variables d'environnement minimales pour bootstrapper sans vraie config
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'e2e-test-secret-32-chars-minimum!!';
  process.env.JWT_REFRESH_SECRET = 'e2e-refresh-secret-32-chars-min!';
  process.env.JWT_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  process.env.ANTHROPIC_API_KEY = 'test-key-not-used';

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    // L'AiService est non-bloquant. On le mock pour éviter tout appel réseau Anthropic.
    .overrideProvider(AiService)
    .useValue({
      generateBulletinComment: jest.fn().mockResolvedValue(
        'Bravo ! Tu as gagné 325 points EDUKDO 🎉',
      ),
    })
    .compile();

  app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.init();

  prisma = moduleFixture.get<PrismaService>(PrismaService);

  // Création des récompenses de test directement en base
  const cheapReward = await prisma.reward.create({
    data: {
      name: 'Billet Musée Test',
      description: 'Billet test pour les E2E',
      category: 'MUSEE',
      partnerName: 'Musée Test',
      pointsCost: CHEAP_REWARD_COST,
      stock: 10,
      isActive: true,
    },
  });
  cheapRewardId = cheapReward.id;

  const costlyReward = await prisma.reward.create({
    data: {
      name: 'Pass Premium Test',
      description: 'Récompense coûteuse pour tester le solde insuffisant',
      category: 'PARC_ATTRACTION',
      partnerName: 'Park Test',
      pointsCost: COSTLY_REWARD_COST,
      stock: -1,
      isActive: true,
    },
  });
  costlyRewardId = costlyReward.id;
}, 30000);

afterAll(async () => {
  // Nettoyage dans l'ordre des contraintes FK
  if (prisma) {
    await prisma.pointEvent.deleteMany({
      where: { student: { user: { email: { in: [STUDENT_EMAIL, SECOND_STUDENT_EMAIL] } } } },
    });
    await prisma.order.deleteMany({
      where: { student: { user: { email: { in: [STUDENT_EMAIL, SECOND_STUDENT_EMAIL] } } } },
    });
    await prisma.bulletin.deleteMany({
      where: { student: { user: { email: { in: [STUDENT_EMAIL, SECOND_STUDENT_EMAIL] } } } },
    });
    await prisma.studentProfile.deleteMany({
      where: { user: { email: { in: [STUDENT_EMAIL, SECOND_STUDENT_EMAIL] } } },
    });
    await prisma.parentProfile.deleteMany({
      where: { user: { email: PARENT_EMAIL } },
    });
    await prisma.refreshToken.deleteMany({
      where: { user: { email: { in: [STUDENT_EMAIL, PARENT_EMAIL, SECOND_STUDENT_EMAIL] } } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [STUDENT_EMAIL, PARENT_EMAIL, SECOND_STUDENT_EMAIL] } },
    });
    await prisma.reward.deleteMany({
      where: { id: { in: [cheapRewardId, costlyRewardId] } },
    });
  }
  await app?.close();
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST 1 — Inscription élève
// ═════════════════════════════════════════════════════════════════════════════
describe('Test 1 — Inscription élève', () => {
  it('POST /api/auth/register crée un compte élève et retourne un token sans passwordHash', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: STUDENT_EMAIL,
        password: 'Test1234!',
        role: 'STUDENT',
        firstName: 'Emma',
        lastName: 'Durand',
        birthDate: '2008-03-15',
        schoolLevel: 'SECONDE',
      });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(STUDENT_EMAIL);
    expect(res.body.user.role).toBe('STUDENT');
    // SÉCURITÉ : le hash du mot de passe ne doit jamais être exposé
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.user.studentProfile).toBeDefined();
    expect(res.body.user.studentProfile.firstName).toBe('Emma');

    studentToken = res.body.accessToken;
    studentUserId = res.body.user.id;
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST 2 — Inscription parent
// ═════════════════════════════════════════════════════════════════════════════
describe('Test 2 — Inscription parent', () => {
  it('POST /api/auth/register crée un compte parent et retourne un token sans passwordHash', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: PARENT_EMAIL,
        password: 'Parent1234!',
        role: 'PARENT',
        firstName: 'Marie',
        lastName: 'Durand',
      });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.role).toBe('PARENT');
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.user.parentProfile).toBeDefined();

    parentToken = res.body.accessToken;
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST 3 — Login et accès aux routes protégées
// ═════════════════════════════════════════════════════════════════════════════
describe('Test 3 — Login et récupération du token', () => {
  it('POST /api/auth/login retourne un token permettant d\'accéder aux routes protégées', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: STUDENT_EMAIL, password: 'Test1234!' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.accessToken).toBeDefined();

    const freshToken = loginRes.body.accessToken;

    // Vérifie que le token permet d'accéder à une route protégée
    const balanceRes = await request(app.getHttpServer())
      .get('/api/points/balance')
      .set('Authorization', `Bearer ${freshToken}`);

    expect(balanceRes.status).toBe(200);
    expect(balanceRes.body.totalPoints).toBeDefined();
  });

  it('POST /api/auth/login retourne 401 avec mauvais mot de passe', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: STUDENT_EMAIL, password: 'WrongPassword!' });

    expect(res.status).toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST 4 — Upload de bulletin
// ═════════════════════════════════════════════════════════════════════════════
describe('Test 4 — Upload de bulletin', () => {
  it('POST /api/bulletins/upload accepte un JPEG et retourne un bulletinId', async () => {
    const jpegBuffer = Buffer.from(JPEG_1PX_B64, 'base64');

    const res = await request(app.getHttpServer())
      .post('/api/bulletins/upload')
      .set('Authorization', `Bearer ${studentToken}`)
      .attach('file', jpegBuffer, { filename: 'bulletin.jpg', contentType: 'image/jpeg' })
      .field('type', 'BULLETIN_TRIMESTRIEL')
      .field('trimester', '1')
      .field('academicYear', '2025-2026');

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('PENDING');

    bulletinId = res.body.id;
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST 5 — Traitement asynchrone OCR
// ═════════════════════════════════════════════════════════════════════════════
describe('Test 5 — Traitement asynchrone OCR', () => {
  it('GET /api/bulletins/:id retourne le statut VALIDATED après traitement', async () => {
    // L'OCR mock prend ~0 ms en mode test (pas de vraie latence réseau).
    // On attend 3 s pour absorber setImmediate + tout traitement async.
    await new Promise((r) => setTimeout(r, 3000));

    const res = await request(app.getHttpServer())
      .get(`/api/bulletins/${bulletinId}`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(bulletinId);
    // Le mock renvoie confidence=0.92 > 0.8 → statut VALIDATED (pas NEEDS_REVIEW)
    expect(res.body.status).toBe('VALIDATED');
    expect(res.body.processedAt).not.toBeNull();
    expect(res.body.pointsAwarded).toBe(EXPECTED_POINTS);
  }, 10000);
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST 6 — Vérification du scoring
// ═════════════════════════════════════════════════════════════════════════════
describe('Test 6 — Vérification du scoring', () => {
  it(`GET /api/points/balance retourne ${EXPECTED_POINTS} pts (moyenne 65 %, pas de bonus)`, async () => {
    const res = await request(app.getHttpServer())
      .get('/api/points/balance')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.totalPoints).toBe(EXPECTED_POINTS);
    expect(res.body.pointsEarned).toBe(EXPECTED_POINTS);
    expect(res.body.pointsSpent).toBe(0);
  });

  it('GET /api/points/history contient l\'événement BULLETIN_REWARD', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/points/history')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    const event = res.body.data.find((e: { type: string }) => e.type === 'BULLETIN_REWARD');
    expect(event).toBeDefined();
    expect(event.amount).toBe(EXPECTED_POINTS);
    expect(event.balanceAfter).toBe(EXPECTED_POINTS);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST 7 — Création de commande et débit de points
// ═════════════════════════════════════════════════════════════════════════════
describe('Test 7 — Création de commande', () => {
  it(`POST /api/shop/orders débite ${CHEAP_REWARD_COST} pts et crée la commande`, async () => {
    // Vérification préalable : la récompense est visible dans le catalogue
    const rewardsRes = await request(app.getHttpServer())
      .get('/api/shop/rewards')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(rewardsRes.status).toBe(200);
    const reward = rewardsRes.body.find((r: { id: string }) => r.id === cheapRewardId);
    expect(reward).toBeDefined();
    expect(reward.pointsCost).toBe(CHEAP_REWARD_COST);

    // Commande
    const orderRes = await request(app.getHttpServer())
      .post('/api/shop/orders')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ rewardId: cheapRewardId });

    expect(orderRes.status).toBe(201);
    expect(orderRes.body.pointsSpent).toBe(CHEAP_REWARD_COST);
    // L'élève n'a pas de parent lié → commande directement DELIVERED
    expect(orderRes.body.status).toBe('DELIVERED');

    // Le solde doit avoir diminué
    const balanceRes = await request(app.getHttpServer())
      .get('/api/points/balance')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(balanceRes.body.totalPoints).toBe(EXPECTED_POINTS - CHEAP_REWARD_COST);
    expect(balanceRes.body.pointsSpent).toBe(CHEAP_REWARD_COST);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST 8 — Sécurité : accès croisé entre élèves
// ═════════════════════════════════════════════════════════════════════════════
describe('Test 8 — Sécurité : accès croisé', () => {
  beforeAll(async () => {
    // Créer un 2ème élève pour tester la séparation des données
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: SECOND_STUDENT_EMAIL,
        password: 'Test1234!',
        role: 'STUDENT',
        firstName: 'Lucas',
        lastName: 'Martin',
        birthDate: '2007-09-01',
        schoolLevel: 'PREMIERE',
      });
    secondStudentToken = res.body.accessToken;
    secondStudentUserId = res.body.user.id;
  });

  it('GET /api/bulletins/:id avec token d\'un autre élève retourne 403', async () => {
    // Le bulletin appartient à l'élève 1, mais la requête est avec le token de l'élève 2
    const res = await request(app.getHttpServer())
      .get(`/api/bulletins/${bulletinId}`)
      .set('Authorization', `Bearer ${secondStudentToken}`);

    expect(res.status).toBe(403);
  });

  it('GET /api/bulletins sans token retourne 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/bulletins');
    expect(res.status).toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST 9 — Sécurité : upload fichier invalide
// ═════════════════════════════════════════════════════════════════════════════
describe('Test 9 — Sécurité : fichier invalide', () => {
  it('POST /api/bulletins/upload avec un .pdf retourne 400', async () => {
    const fakePdfBuffer = Buffer.from('%PDF-1.4 test content');

    const res = await request(app.getHttpServer())
      .post('/api/bulletins/upload')
      .set('Authorization', `Bearer ${studentToken}`)
      .attach('file', fakePdfBuffer, { filename: 'notes.pdf', contentType: 'application/pdf' })
      .field('type', 'BULLETIN_TRIMESTRIEL')
      .field('trimester', '1');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/type de fichier|non accepté/i);
  });

  it('POST /api/bulletins/upload sans fichier retourne 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/bulletins/upload')
      .set('Authorization', `Bearer ${studentToken}`)
      .field('type', 'BULLETIN_TRIMESTRIEL');

    expect(res.status).toBe(400);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST 10 — Sécurité : points insuffisants
// ═════════════════════════════════════════════════════════════════════════════
describe('Test 10 — Sécurité : points insuffisants', () => {
  it(`POST /api/shop/orders avec récompense à ${COSTLY_REWARD_COST} pts retourne 400 "Solde insuffisant"`, async () => {
    // Après l'achat du test 7, le solde est EXPECTED_POINTS - CHEAP_REWARD_COST = 225 pts
    // La récompense coûte 1000 pts → insuffisant
    const res = await request(app.getHttpServer())
      .post('/api/shop/orders')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ rewardId: costlyRewardId });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/solde|insuffisant/i);
  });
});
