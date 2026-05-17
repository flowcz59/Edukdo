import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadDir = path.join(process.cwd(), 'uploads');

  async store(
    buffer: Buffer,
    studentId: string,
    originalName: string,
    mimeType: string,
  ): Promise<string> {
    if (process.env.NODE_ENV === 'production') {
      return this.storeS3(buffer, studentId, originalName, mimeType);
    }
    return this.storeLocal(buffer, studentId, originalName);
  }

  private async storeLocal(
    buffer: Buffer,
    studentId: string,
    originalName: string,
  ): Promise<string> {
    const studentDir = path.join(this.uploadDir, studentId);
    fs.mkdirSync(studentDir, { recursive: true });
    const filename = `${Date.now()}-${originalName}`;
    const filePath = path.join(studentDir, filename);
    fs.writeFileSync(filePath, buffer);
    this.logger.log(`Fichier sauvegardé localement : ${filePath}`);
    return `uploads/${studentId}/${filename}`;
  }

  private async storeS3(
    buffer: Buffer,
    studentId: string,
    originalName: string,
    mimeType: string,
  ): Promise<string> {
    // Import dynamique pour éviter la dépendance AWS en développement
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = new S3Client({ region: process.env.AWS_REGION });
    const key = `bulletins/${studentId}/${Date.now()}-${originalName}`;
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );
    return `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  }
}
