import { Module } from '@nestjs/common';
import { CnpjController } from './cnpj.controller';
import { CnpjService } from './cnpj.service';
import { MongoModule } from '../database/mongo.module';

@Module({
  imports: [MongoModule],
  controllers: [CnpjController],
  providers: [CnpjService],
})
export class CnpjModule {}

