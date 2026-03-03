import { IsString, Matches } from 'class-validator';

export class CnpjParamDto {
  @IsString()
  @Matches(/^\d{14}$/)
  cnpj!: string;
}

