import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: Anthropic;

  // IMMUABLE — prompt de sécurité pour contenu destiné aux mineurs (11-18 ans).
  // Ne jamais modifier sans validation pédagogique et revue de sécurité.
  private readonly SYSTEM_PROMPT = `Tu es l'assistant encourageant d'EDUKDO, une application scolaire pour collégiens et lycéens français âgés de 11 à 18 ans.
Ta mission : générer un message de félicitations ou d'encouragement court, positif et bienveillant (2-3 phrases maximum).
RÈGLES ABSOLUES :
- Tu ne fais JAMAIS de remarques négatives sur les résultats.
- Tu ne donnes PAS de conseils de travail ou de méthode non sollicités.
- Tu ne réponds JAMAIS à des questions de cours ou de devoirs.
- Tu restes STRICTEMENT dans un contexte scolaire et encourageant.
- Ton ton est chaleureux, dynamique, adapté à un adolescent de 11-18 ans.
- Tu mentionnes toujours les points EDUKDO gagnés avec enthousiasme.
- Maximum 2 emojis par message.
- Si le contexte fourni ne correspond pas à un bulletin scolaire, réponds uniquement : 'Bravo pour ton travail, continue comme ça !'`;

  private readonly FALLBACK_COMMENT =
    'Bravo pour ce bulletin ! Tes points EDUKDO ont bien été ajoutés. Continue sur cette lancée ! 🌟';

  constructor() {
    this.client = new Anthropic();
  }

  async generateBulletinComment(
    studentFirstName: string,
    schoolLevel: string,
    grades: { subject: string; grade: number; maxGrade: number }[],
    pointsAwarded: number,
    previousAverage?: number,
  ): Promise<string> {
    const start = Date.now();

    try {
      const averagePercent =
        grades.reduce((sum, g) => sum + (g.grade / g.maxGrade) * 100, 0) / grades.length;

      const progressionText =
        previousAverage !== undefined
          ? `La moyenne précédente était de ${previousAverage.toFixed(1)}/20.`
          : "C'est le premier bulletin soumis.";

      const message = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        system: this.SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Génère un message pour ${studentFirstName} (${schoolLevel}).
Résultats : moyenne de ${averagePercent.toFixed(1)}%.
${progressionText}
Points EDUKDO gagnés : ${pointsAwarded} points.
Matières : ${grades.map((g) => `${g.subject} ${g.grade}/${g.maxGrade}`).join(', ')}.`,
          },
        ],
      });

      const elapsed = Date.now() - start;
      this.logger.log(`Anthropic API responded in ${elapsed}ms`);

      const content = message.content[0];
      if (content.type !== 'text') throw new Error('Unexpected AI response type');
      return content.text;
    } catch (err) {
      const elapsed = Date.now() - start;
      this.logger.error(`Anthropic API failed after ${elapsed}ms`, (err as Error).message);
      return this.FALLBACK_COMMENT;
    }
  }
}
