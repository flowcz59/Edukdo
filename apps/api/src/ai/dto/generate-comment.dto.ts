import { IsString, IsNotEmpty } from 'class-validator';

export class GenerateCommentDto {
  @IsString()
  @IsNotEmpty()
  bulletinId: string;
}
