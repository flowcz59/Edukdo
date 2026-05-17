import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  IsDateString,
} from 'class-validator';
import { Role, SchoolLevel } from '@prisma/client';

export class RegisterDto {
  @IsEmail({}, { message: 'Email invalide' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  @Matches(/(?=.*[A-Z])/, { message: 'Le mot de passe doit contenir au moins une majuscule' })
  @Matches(/(?=.*\d)/, { message: 'Le mot de passe doit contenir au moins un chiffre' })
  password: string;

  @IsEnum(Role, { message: 'Rôle invalide' })
  role: Role;

  @IsString()
  @IsNotEmpty({ message: 'Le prénom est requis' })
  firstName: string;

  @IsString()
  @IsNotEmpty({ message: 'Le nom est requis' })
  lastName: string;

  @IsOptional()
  @IsDateString({}, { message: 'Date de naissance invalide' })
  birthDate?: string;

  @IsOptional()
  @IsEnum(SchoolLevel, { message: 'Niveau scolaire invalide' })
  schoolLevel?: SchoolLevel;
}
