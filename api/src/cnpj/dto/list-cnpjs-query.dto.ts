import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, Min, Length } from 'class-validator';

export class ListCnpjsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{8}$|^\d{14}$/)
  cnpj?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  uf?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  municipio?: string;
}

