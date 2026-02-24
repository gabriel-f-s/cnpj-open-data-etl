import dotenv from 'dotenv';

dotenv.config();

export const config = {
  mongo: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017',
    dbName: process.env.DB_NAME || 'cnpj_data',
  },
  app: {
    baseUrl: process.env.BASE_URL || 'https://dados-abertos-rf-cnpj.casadosdados.com.br/arquivos/',
    batchSize: parseInt(process.env.BATCH_SIZE, 10) || 1000, 
    userAgent: 'Mozilla/5.0 (compatible; CNPJ-ETL-Bot/1.0; +http://seusite.com)',
  }
};