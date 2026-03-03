import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongoClient, Db } from 'mongodb';

export const MONGO_DB = 'MONGO_DB';

@Module({
  providers: [
    {
      provide: MONGO_DB,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService): Promise<Db> => {
        const uri = configService.get<string>('MONGO_URI') || 'mongodb://localhost:27017';
        const dbName = configService.get<string>('DB_NAME') || 'cnpj_data';

        const client = new MongoClient(uri);

        try {
          await client.connect();
        } catch (error) {
          Logger.error('Erro ao conectar ao MongoDB na API Nest:', error);
          throw error;
        }

        return client.db(dbName);
      },
    },
  ],
  exports: [MONGO_DB],
})
export class MongoModule {}

