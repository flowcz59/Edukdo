import { Injectable, Logger } from '@nestjs/common';

export interface ExtractedGrade {
  subject: string;
  grade: number;
  maxGrade: number;
  coefficient: number;
}

export interface OcrResult {
  grades: ExtractedGrade[];
  confidenceScore: number;
  rawData: Record<string, unknown>;
  metadata: {
    schoolName?: string;
    trimester?: number;
    academicYear?: string;
  };
}

const MOCK_OCR_RESULT: OcrResult = {
  grades: [
    { subject: 'Mathématiques', grade: 12, maxGrade: 20, coefficient: 4 },
    { subject: 'Français', grade: 11, maxGrade: 20, coefficient: 4 },
    { subject: 'Histoire-Géographie', grade: 13, maxGrade: 20, coefficient: 3 },
    { subject: 'Anglais LV1', grade: 14, maxGrade: 20, coefficient: 3 },
    { subject: 'Physique-Chimie', grade: 10, maxGrade: 20, coefficient: 3 },
    { subject: 'SVT', grade: 13, maxGrade: 20, coefficient: 2 },
    { subject: 'EPS', grade: 15, maxGrade: 20, coefficient: 2 },
    { subject: 'Arts plastiques', grade: 14, maxGrade: 20, coefficient: 1 },
  ],
  confidenceScore: 0.92,
  rawData: { source: 'mock', version: '1.0' },
  metadata: {
    schoolName: 'Lycée Victor Hugo',
    trimester: 1,
    academicYear: '2025-2026',
  },
};

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  async extractGrades(imageBuffer: Buffer): Promise<OcrResult> {
    if (process.env.NODE_ENV !== 'production') {
      return this.mockExtract();
    }
    return this.textractExtract(imageBuffer);
  }

  private async mockExtract(): Promise<OcrResult> {
    await new Promise<void>((resolve) => setTimeout(resolve, 1500));
    this.logger.log('OCR mock : données simulées retournées');
    return MOCK_OCR_RESULT;
  }

  private async textractExtract(imageBuffer: Buffer): Promise<OcrResult> {
    // Import dynamique pour éviter la dépendance AWS en développement
    const { TextractClient, AnalyzeDocumentCommand } = await import(
      '@aws-sdk/client-textract'
    );
    const client = new TextractClient({ region: process.env.AWS_REGION });
    const response = await client.send(
      new AnalyzeDocumentCommand({
        Document: { Bytes: imageBuffer },
        FeatureTypes: ['TABLES', 'FORMS'],
      }),
    );

    const responseRecord = response as unknown as Record<string, unknown>;
    const grades = this.parseTextractResponse(responseRecord);
    const confidenceScore = this.computeConfidence(responseRecord);

    return {
      grades,
      confidenceScore,
      rawData: response as unknown as Record<string, unknown>,
      metadata: {},
    };
  }

  private parseTextractResponse(response: Record<string, unknown>): ExtractedGrade[] {
    // Parcourt les blocs LINE de Textract pour détecter les lignes "Matière note/noteMax"
    const grades: ExtractedGrade[] = [];
    const blocks = (response['Blocks'] as Record<string, unknown>[]) ?? [];

    for (const block of blocks) {
      if (block['BlockType'] === 'LINE' && typeof block['Text'] === 'string') {
        const match = (block['Text'] as string).match(
          /^(.+?)\s+(\d+(?:[.,]\d+)?)\s*\/\s*(\d+)/,
        );
        if (match) {
          grades.push({
            subject: match[1].trim(),
            grade: parseFloat(match[2].replace(',', '.')),
            maxGrade: parseFloat(match[3]),
            coefficient: 1,
          });
        }
      }
    }
    return grades;
  }

  private computeConfidence(response: Record<string, unknown>): number {
    const blocks = (response['Blocks'] as Record<string, unknown>[]) ?? [];
    if (blocks.length === 0) return 0;
    const confidences = blocks
      .filter((b) => b['Confidence'] !== undefined)
      .map((b) => (b['Confidence'] as number) / 100);
    if (confidences.length === 0) return 0;
    return confidences.reduce((a, b) => a + b, 0) / confidences.length;
  }
}
