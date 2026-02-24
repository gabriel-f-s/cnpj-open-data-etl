import { MongoClient } from 'mongodb';
import { config } from './env.js';
import { SCHEMAS } from './schemas.js';

let client = null;
let db = null;

export async function connectDB() {
  if (client) return client;

  try {
    console.log('🔌 Conectando ao MongoDB...');
    
    client = new MongoClient(config.mongo.uri, {
      minPoolSize: 5,
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 60000,
    });

    await client.connect();
    db = client.db(config.mongo.dbName);
    console.log('✅ Conectado ao MongoDB com sucesso!');
    
    await ensureIndexes(db);
    
    return client;
  } catch (error) {
    console.error('❌ Erro ao conectar no MongoDB:', error);
    process.exit(1); 
  }
}

export function getDB() {
  if (!db) throw new Error('Banco de dados não inicializado.');
  return db;
}

export async function closeDB() {
  if (client) {
    await client.close();
    console.log('🔌 Conexão com MongoDB encerrada.');
    client = null;
    db = null;
  }
}

async function ensureIndexes(database) {
  console.log('⏳ Verificando e criando índices... Isto pode demorar alguns segundos.');
  
  for (const [collectionName, schema] of Object.entries(SCHEMAS)) {
    if (schema.primaryKeys && schema.primaryKeys.length > 0) {
      const indexDefinition = {};
      schema.primaryKeys.forEach(key => {
        indexDefinition[key] = 1;
      });

      try {
        await database.collection(collectionName).createIndex(
          indexDefinition, 
          { unique: true }
        );
      } catch (err) {
        console.warn(`⚠️ Aviso ao criar índice para ${collectionName}: ${err.message}`);
      }
    }
  }
  console.log('ℹ️ Índices otimizados com sucesso.');
}