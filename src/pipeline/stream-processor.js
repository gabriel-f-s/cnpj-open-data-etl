import axios from 'axios';
import unzipper from 'unzipper';
import csvParser from 'csv-parser';
import iconv from 'iconv-lite';
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import cliProgress from 'cli-progress';
import { getDB } from '../config/database.js';
import { SCHEMAS } from '../config/schemas.js';

// Função principal que gerencia as tentativas (Substitui o axios-retry)
export async function processFilePipeline(url, config, attempt = 1) {
  const MAX_RETRIES = 5;

  try {
    await executeStreamLogic(url, config);
  } catch (error) {
    if (attempt <= MAX_RETRIES) {
      const waitTime = attempt * 10000; // 10s, 20s, 30s...
      console.log(`\n⚠️ Falha na conexão ou extração: ${error.message}`);
      console.log(`⏳ Aguardando ${waitTime / 1000}s para a tentativa ${attempt + 1} de ${MAX_RETRIES}...`);
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Chama a si mesma recursivamente, recriando TUDO do zero
      return processFilePipeline(url, config, attempt + 1); 
    }
    
    // Se esgotar as tentativas, lança o erro para o Docker reiniciar
    throw new Error(`Falha definitiva após ${MAX_RETRIES} tentativas: ${error.message}`);
  }
}

// A lógica de extração isolada
async function executeStreamLogic(url, config) {
  const db = getDB();
  const collection = db.collection(config.collectionName);

  console.log(`\n⬇️  Acessando: ${url}`);
  
  const response = await axios({
    method: 'get',
    url: url,
    responseType: 'stream',
    timeout: 30000 
  });

  const totalBytes = parseInt(response.headers['content-length'], 10);
  
  const progressBar = new cliProgress.SingleBar({
    format: `📂 Destino: '${config.collectionName}' | {bar} | {percentage}% | 💾 Upserts no DB: {savedCount} | {value}/{total} Bytes`,
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });

  if (totalBytes) progressBar.start(totalBytes, 0, { savedCount: 0 });

  return new Promise((resolve, reject) => {
    // 🐕 --- CÃO DE GUARDA AGRESSIVO ---
    let idleTimeout;
    const resetIdleTimeout = () => {
      clearTimeout(idleTimeout);
      idleTimeout = setTimeout(() => {
        if (totalBytes) progressBar.stop();
        console.error(`\n⏳ NETWORK TIMEOUT: O servidor congelou há 60 segundos.`);
        if (response.data) response.data.destroy();
        // A rejeição direta garante que a promessa nunca fica pendurada
        reject(new Error('NETWORK_IDLE_TIMEOUT')); 
      }, 60000); 
    };

    response.data.on('data', (chunk) => {
      if (totalBytes) progressBar.increment(chunk.length);
      resetIdleTimeout(); 
    });
    
    resetIdleTimeout(); 

    // Limpeza de eventos do Axios
    response.data.on('end', () => clearTimeout(idleTimeout));
    response.data.on('close', () => clearTimeout(idleTimeout));
    response.data.on('error', (err) => {
      clearTimeout(idleTimeout);
      if (totalBytes) progressBar.stop();
      reject(err);
    });

    let fileProcessed = false;
    const unzipStream = unzipper.Parse();

    unzipStream.on('entry', async (entry) => {
      const fileName = entry.path.toUpperCase();

      if (entry.type === 'File' && fileName.includes(config.fileIdentifier.toUpperCase())) {
        fileProcessed = true;

        const decodeStream = iconv.decodeStream('win1252');
        const csvStream = csvParser({ separator: ';', headers: config.headers, skipLines: 0 });
        const batchInsertStream = createBatchInsertStream(collection, config.collectionName, progressBar);

        try {
          await pipeline(entry, decodeStream, csvStream, batchInsertStream);
          
          if (totalBytes) progressBar.stop(); 
          clearTimeout(idleTimeout);
          console.log(`✅ Ficheiro '${fileName}' processado e sincronizado com sucesso!`);
          
          response.data.destroy(); 
          resolve(); 
        } catch (err) {
          if (totalBytes) progressBar.stop();
          clearTimeout(idleTimeout);
          reject(err);
        }
      } else {
        entry.autodrain(); 
      }
    });

    unzipStream.on('finish', () => {
      if (!fileProcessed) {
        if (totalBytes) progressBar.stop();
        clearTimeout(idleTimeout);
        console.warn(`\n⚠️ O identificador '${config.fileIdentifier}' não foi encontrado no ZIP.`);
        resolve(); 
      }
    });

    unzipStream.on('error', (err) => {
      if (err.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
        if (totalBytes) progressBar.stop();
        clearTimeout(idleTimeout);
        reject(err);
      }
    });

    // Inicia o fluxo
    response.data.pipe(unzipStream);
  });
}

function createBatchInsertStream(collection, collectionName, progressBar) {
  let batch = [];
  let totalSaved = 0;
  const BATCH_SIZE = 10000; 

  return new Writable({
    objectMode: true,
    async write(chunk, encoding, callback) {
      batch.push(chunk);

      if (batch.length >= BATCH_SIZE) {
        try {
          await executeBulkWrite(collection, collectionName, batch);
          totalSaved += batch.length;
          if (progressBar) progressBar.update({ savedCount: totalSaved });
          batch = []; 
          callback();
        } catch (error) {
          callback(error); 
        }
      } else {
        callback();
      }
    },
    async final(callback) {
      if (batch.length > 0) {
        try {
          await executeBulkWrite(collection, collectionName, batch);
          totalSaved += batch.length;
          if (progressBar) progressBar.update({ savedCount: totalSaved });
          callback();
        } catch (error) {
          callback(error);
        }
      } else {
        callback();
      }
    }
  });
}

async function executeBulkWrite(collection, collectionName, batch) {
  const schemaConfig = SCHEMAS[collectionName];
  if (!schemaConfig) throw new Error(`Schema não encontrado: ${collectionName}`);

  const operations = batch.map((row) => {
    const processedRow = schemaConfig.transform ? schemaConfig.transform(row) : row;
    const filter = {};
    schemaConfig.primaryKeys.forEach(key => { filter[key] = processedRow[key] || null; });

    return {
      updateOne: { filter: filter, update: { $set: processedRow }, upsert: true }
    };
  });

  await collection.bulkWrite(operations, { ordered: false, writeConcern: { w: 0 } });
}