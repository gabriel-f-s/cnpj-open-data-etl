import { CacheInterceptor } from '@nestjs/cache-manager';
import { Controller, Get, NotFoundException, Param, Query, UseInterceptors } from '@nestjs/common';
import { CnpjService } from './cnpj.service';
import { ListCnpjsQueryDto } from './dto/list-cnpjs-query.dto';
import { CnpjParamDto } from './dto/cnpj-param.dto';

@Controller('cnpjs')
export class CnpjController {
  constructor(private readonly cnpjService: CnpjService) {}

  @Get()
  async list(@Query() query: ListCnpjsQueryDto) {
    return this.cnpjService.listCnpjs(query);
  }

  @UseInterceptors(CacheInterceptor)
  @Get(':cnpj')
  async detail(@Param() params: CnpjParamDto) {
    const result = await this.cnpjService.getCnpjDetail(params.cnpj);

    if (!result) {
      throw new NotFoundException(`O CNPJ ${params.cnpj} não foi encontrado na base de dados.`);
    }

    return result;
  }
}

