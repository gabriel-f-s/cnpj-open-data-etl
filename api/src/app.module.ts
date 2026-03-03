import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongoModule } from './database/mongo.module';
import { CnpjModule } from './cnpj/cnpj.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    CacheModule.register({
      isGlobal: true,
      ttl: 60, // segundos
      max: 100,
    }),
    MongoModule,
    CnpjModule,
  ],
})
export class AppModule {}

