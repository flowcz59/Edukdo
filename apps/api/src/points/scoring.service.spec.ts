import { Test, TestingModule } from '@nestjs/testing';
import { BulletinType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GradeInput, ScoringService } from './scoring.service';

// Typed partial mock — only the bulletin methods used by ScoringService
const mockPrisma = {
  bulletin: {
    findFirst: jest.fn(),
    count: jest.fn(),
  },
};

describe('ScoringService', () => {
  let service: ScoringService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScoringService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ScoringService>(ScoringService);
  });

  afterEach(() => jest.clearAllMocks());

  // Reusable fixtures
  const grades14sur20: GradeInput[] = [
    { subject: 'Mathématiques', grade: 14, maxGrade: 20, coefficient: 1 },
  ];

  const baseInput = {
    studentId: 'student-1',
    bulletinId: 'bulletin-current',
    type: BulletinType.BULLETIN_TRIMESTRIEL,
    academicYear: '2025-2026',
    confidenceScore: 0.9,
  };

  // ── Test 1 ─────────────────────────────────────────────────────────────
  describe('Test 1 — Premier bulletin 14/20, pas de progression', () => {
    it('retourne 350 points de base, 0 progression, régularité selon count', async () => {
      mockPrisma.bulletin.findFirst.mockResolvedValue(null);
      mockPrisma.bulletin.count.mockResolvedValue(0);

      const result = await service.calculateScore({ ...baseInput, grades: grades14sur20 });

      expect(result.baseScore).toBe(350);          // floor(70 * 5)
      expect(result.progressBonus).toBe(0);
      expect(result.previousMoyenne).toBeNull();
      expect(result.regularityBonus).toBe(0);      // count < 3
      expect(result.totalPoints).toBe(350);
    });
  });

  // ── Test 2 ─────────────────────────────────────────────────────────────
  describe('Test 2 — Progression de 11.5/20 à 12.8/20', () => {
    it('calcule un bonus de progression de 26 pts', async () => {
      const previousGrades: GradeInput[] = [
        { subject: 'Mathématiques', grade: 11.5, maxGrade: 20, coefficient: 1 },
      ];
      mockPrisma.bulletin.findFirst.mockResolvedValue({ extractedGrades: previousGrades });
      mockPrisma.bulletin.count.mockResolvedValue(0);

      const currentGrades: GradeInput[] = [
        { subject: 'Mathématiques', grade: 12.8, maxGrade: 20, coefficient: 1 },
      ];

      const result = await service.calculateScore({
        ...baseInput,
        bulletinId: 'bulletin-t2',
        grades: currentGrades,
      });

      // floor((12.8-11.5)*20) = floor(26) = 26
      expect(result.progressBonus).toBe(26);
    });
  });

  // ── Test 3 ─────────────────────────────────────────────────────────────
  describe('Test 3 — Régression de 13/20 à 11/20', () => {
    it('ne pénalise jamais une régression (bonus progression = 0)', async () => {
      const previousGrades: GradeInput[] = [
        { subject: 'Mathématiques', grade: 13, maxGrade: 20, coefficient: 1 },
      ];
      mockPrisma.bulletin.findFirst.mockResolvedValue({ extractedGrades: previousGrades });
      mockPrisma.bulletin.count.mockResolvedValue(0);

      const currentGrades: GradeInput[] = [
        { subject: 'Mathématiques', grade: 11, maxGrade: 20, coefficient: 1 },
      ];

      const result = await service.calculateScore({
        ...baseInput,
        bulletinId: 'bulletin-t3',
        grades: currentGrades,
      });

      expect(result.progressBonus).toBe(0);
      expect(result.baseScore).toBeGreaterThan(0); // base score still awarded
    });
  });

  // ── Test 4 ─────────────────────────────────────────────────────────────
  describe('Test 4 — 3 bulletins validés sur 30 jours', () => {
    it('attribue le bonus de régularité de 50 pts', async () => {
      mockPrisma.bulletin.findFirst.mockResolvedValue(null);
      mockPrisma.bulletin.count.mockResolvedValue(3);

      const result = await service.calculateScore({ ...baseInput, grades: grades14sur20 });

      expect(result.regularityBonus).toBe(50);
      expect(result.totalPoints).toBe(350 + 50); // base + regularity, no progress
    });
  });

  // ── Test 5 ─────────────────────────────────────────────────────────────
  describe('Test 5 — 2 bulletins validés sur 30 jours', () => {
    it('pas de bonus de régularité sous le seuil de 3', async () => {
      mockPrisma.bulletin.findFirst.mockResolvedValue(null);
      mockPrisma.bulletin.count.mockResolvedValue(2);

      const result = await service.calculateScore({ ...baseInput, grades: grades14sur20 });

      expect(result.regularityBonus).toBe(0);
    });
  });

  // ── Test 6 ─────────────────────────────────────────────────────────────
  describe('Test 6 — Confiance OCR 0.75 (< seuil 0.8)', () => {
    it('applique une pénalité de 20% sur le total', async () => {
      mockPrisma.bulletin.findFirst.mockResolvedValue(null);
      mockPrisma.bulletin.count.mockResolvedValue(0);

      const result = await service.calculateScore({
        ...baseInput,
        grades: grades14sur20,
        confidenceScore: 0.75,
      });

      const rawTotal = result.baseScore + result.progressBonus + result.regularityBonus;
      expect(result.totalPoints).toBe(Math.floor(rawTotal * 0.8));
      expect(result.confidencePenalty).toBe(rawTotal - result.totalPoints);
      expect(result.confidencePenalty).toBeGreaterThan(0);
    });
  });

  // ── Test 7 ─────────────────────────────────────────────────────────────
  describe('Test 7 — Confiance OCR 0.85 (≥ seuil 0.8)', () => {
    it('aucune pénalité de confiance', async () => {
      mockPrisma.bulletin.findFirst.mockResolvedValue(null);
      mockPrisma.bulletin.count.mockResolvedValue(0);

      const result = await service.calculateScore({
        ...baseInput,
        grades: grades14sur20,
        confidenceScore: 0.85,
      });

      expect(result.confidencePenalty).toBe(0);
      expect(result.totalPoints).toBe(result.baseScore + result.progressBonus + result.regularityBonus);
    });
  });

  // ── Test 8 ─────────────────────────────────────────────────────────────
  describe('Test 8 — Bulletin DEVOIR', () => {
    it('calcul simplifié, pas de bonus régularité, count non appelé', async () => {
      mockPrisma.bulletin.findFirst.mockResolvedValue(null);

      const devoirGrades: GradeInput[] = [
        { subject: 'Histoire', grade: 15, maxGrade: 20, coefficient: 1 },
      ];

      const result = await service.calculateScore({
        studentId: 'student-1',
        bulletinId: 'bulletin-devoir',
        type: BulletinType.DEVOIR,
        grades: devoirGrades,
        subjectName: 'Histoire',
        confidenceScore: 0.9,
      });

      expect(result.baseScore).toBe(75);        // floor((15/20)*100)
      expect(result.regularityBonus).toBe(0);
      expect(result.totalPoints).toBe(75);
      expect(mockPrisma.bulletin.count).not.toHaveBeenCalled();
    });

    it('note 14/20 → 70 pts de base', async () => {
      mockPrisma.bulletin.findFirst.mockResolvedValue(null);

      const result = await service.calculateScore({
        studentId: 'student-1',
        bulletinId: 'bulletin-devoir-2',
        type: BulletinType.DEVOIR,
        grades: [{ subject: 'Maths', grade: 14, maxGrade: 20, coefficient: 1 }],
        subjectName: 'Maths',
        confidenceScore: 0.9,
      });

      expect(result.baseScore).toBe(70); // floor((14/20)*100)
    });
  });
});
