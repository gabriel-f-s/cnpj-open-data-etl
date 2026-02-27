import axios from 'axios';
import unzipper from 'unzipper';
import csvParser from 'csv-parser';
import iconv from 'iconv-lite';
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import cliProgress from 'cli-progress';
import { getDB } from '../config/database.js';
import { SCHEMAS } from '../config/schemas.js';

export async function processFilePipeline(url, config, state, fileName, saveStateFn) {
  const db = getDB();
  const collection = db.collection(config.collectionName);

  const linesToSkip = state.file_progress[fileName] || 0;

  console.log(`\n⬇️  Acessando: ${url}`);
  if (linesToSkip > 0) {
    console.log(`⏩ Micro-Checkpoint: Pulando as primeiras ${linesToSkip} linhas já processadas...`);
  }

  const response = await axios({
    method: 'get',
    url: url,
    responseType: 'stream',
    timeout: 30000
  });

  const totalBytes = parseInt(response.headers['content-length'], 10);

  const progressBar = new cliProgress.SingleBar({
    format: `📂 Destino: '${config.collectionName}' | {bar} | {percentage}% | 💾 Inserções: {savedCount} | {value}/{total} Bytes`,
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });

  if (totalBytes) progressBar.start(totalBytes, 0, { savedCount: linesToSkip });

  let idleTimeout;
  const resetIdleTimeout = () => {
    clearTimeout(idleTimeout);
    idleTimeout = setTimeout(() => {
      if (totalBytes) progressBar.stop();
      console.error(`\n⏳ NETWORK TIMEOUT: Servidor do governo parou de responder há 5 minutos.`);
      response.data.destroy(new Error('NETWORK_IDLE_TIMEOUT'));
    }, 300000);
  };

  response.data.on('data', (chunk) => {
    if (totalBytes) progressBar.increment(chunk.length);
    resetIdleTimeout();
  });
  resetIdleTimeout();

  return new Promise((resolve, reject) => {
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
      const entryName = entry.path.toUpperCase();

      if (entry.type === 'File' && entryName.includes(config.fileIdentifier.toUpperCase())) {
        fileProcessed = true;

        const decodeStream = iconv.decodeStream('win1252');
        const csvStream = csvParser({ separator: ';', headers: config.headers, skipLines: linesToSkip });
        const batchInsertStream = createBatchInsertStream(collection, config.collectionName, progressBar, state, fileName, saveStateFn, linesToSkip);

        try {
          await pipeline(entry, decodeStream, csvStream, batchInsertStream);
          if (totalBytes) progressBar.stop();
          clearTimeout(idleTimeout);
          console.log(`✅ Ficheiro '${entryName}' processado e sincronizado com sucesso!`);
          response.data.destroy();
          resolve();
        } catch (err) {
          if (totalBytes) progressBar.stop();
          clearTimeout(idleTimeout);
          console.error(`\n❌ Erro durante o pipeline de inserção:`, err.message);
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

    response.data.pipe(unzipStream);
  });
}

function createBatchInsertStream(collection, collectionName, progressBar, state, fileName, saveStateFn, linesToSkip) {
  let batch = [];
  let totalSaved = linesToSkip;
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

          state.file_progress[fileName] = totalSaved;
          await saveStateFn(state);

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
          state.file_progress[fileName] = totalSaved;
          await saveStateFn(state);
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

  const transformedBatch = batch.map((row) => schemaConfig.transform ? schemaConfig.transform(row) : row);

  try {
    await collection.insertMany(transformedBatch, { ordered: false, writeConcern: { w: 0 } });
  } catch (error) {
    if (error.code === 11000 || (error.writeErrors && error.writeErrors.some(e => e.code === 11000))) {
      return;
    }
    throw error;
  }
}
