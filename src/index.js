import axios from 'axios';
import pLimit from 'p-limit';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config/env.js';
import { connectDB, closeDB } from './config/database.js';
import { extractDateDirectories, extractZipFiles } from './scrapers/html-parser.js';
import { processFilePipeline } from './pipeline/stream-processor.js';
import { SCHEMAS } from './config/schemas.js';

const STATE_FILE = path.resolve('./data/state.json');

async function loadState() {
  try {
    const data = await fs.readFile(STATE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { last_processed_date: null, processed_files: [] };
  }
}

async function saveState(state) {
  await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

async function processWithRetry(url, config, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await processFilePipeline(url, config);
      return;
    } catch (error) {
      console.warn(`\n⚠️ Falha no arquivo ${config.fileIdentifier} (Tentativa ${attempt}/${maxRetries}): ${error.message}`);

      if (attempt === maxRetries) {
        throw new Error(`Falha definitiva após ${maxRetries} tentativas no arquivo ${config.fileIdentifier}.`);
      }

      const waitTime = attempt * 10000;
      console.log(`⏳ Aguardando ${waitTime / 1000}s para tentar reconexão...`);
      await new Promise(res => setTimeout(res, waitTime));
    }
  }
}

async function main() {
  console.time('⏱️ Tempo Total de Execução');
  console.log('🚀 A iniciar CLI de ETL (Modo Resiliente com Checkpoint por Arquivo)...\n');

  let hadError = false;
  try {
    await connectDB();

    console.log(`\n🔍 A procurar diretórios de datas em: ${config.app.baseUrl}`);
    const rootResponse = await axios.get(config.app.baseUrl);
    const allDirectories = extractDateDirectories(rootResponse.data);

    if (allDirectories.length === 0) {
      console.log('❌ Nenhuma data encontrada no site.');
      return;
    }

    const latestDateDir = allDirectories[allDirectories.length - 1];
    console.log(`📂 Último Snapshot encontrado: ${latestDateDir}`);

    let state = await loadState();

    if (state.last_processed_date !== latestDateDir) {
      console.log(`🔄 Novo mês detectado. Limpando histórico de arquivos processados...`);
      state.last_processed_date = latestDateDir;
      state.processed_files = [];
      await saveState(state);
    }

    const baseUrlNormalized = config.app.baseUrl.endsWith('/') ? config.app.baseUrl : `${config.app.baseUrl}/`;
    const targetUrl = `${baseUrlNormalized}${latestDateDir}/`;

    const dateResponse = await axios.get(targetUrl);
    const files = extractZipFiles(dateResponse.data, targetUrl);

    console.log(`\n======================================================`);
    console.log(`📅 A PROCESSAR O SNAPSHOT: ${latestDateDir}`);
    console.log(`======================================================`);
    console.log(`📦 ${files.length} ficheiros ZIP encontrados no total.\n`);

    const limit = pLimit(1);
    const promises = [];

    for (const file of files) {
      const fileName = file.url.split('/').pop();

      if (state.processed_files.includes(fileName)) {
        console.log(`⏩ Checkpoint: Pulando ficheiro já processado -> ${fileName}`);
        continue;
      }

      const schemaConfig = SCHEMAS[file.collection];
      if (!schemaConfig) continue;

      const pipelineConfig = {
        collectionName: file.collection,
        fileIdentifier: schemaConfig.fileIdentifier,
        headers: schemaConfig.headers
      };

      promises.push(limit(async () => {
        await processWithRetry(file.url, pipelineConfig);
        state.processed_files.push(fileName);
        await saveState(state);
        console.log(`📝 Estado guardado: '${fileName}' marcado como concluído no Checkpoint.`);
      }));
    }

    await Promise.all(promises);

    console.log('\n🎉 ETL concluído! Todos os dados estão perfeitamente sincronizados.');

  } catch (error) {
    hadError = true;
    console.error('\n❌ ERRO FATAL DURANTE A EXECUÇÃO:', error.message);
  } finally {
    await closeDB();
    console.timeEnd('⏱️ Tempo Total de Execução');
    process.exit(hadError ? 1 : 0);
  }
}

main();
