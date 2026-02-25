import axios from 'axios';
import pLimit from 'p-limit';
import { config } from './config/env.js';
import { connectDB, closeDB } from './config/database.js';
import { extractDateDirectories, extractZipFiles } from './scrapers/html-parser.js';
import { processFilePipeline } from './pipeline/stream-processor.js';
import { SCHEMAS } from './config/schemas.js';

async function main() {
  console.time('⏱️ Tempo Total de Execução');
  console.log('🚀 A iniciar CLI de ETL (Modo Resiliente - Upsert)...\n');

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

    const baseUrlNormalized = config.app.baseUrl.endsWith('/') ? config.app.baseUrl : `${config.app.baseUrl}/`;
    const targetUrl = `${baseUrlNormalized}${latestDateDir}/`;

    const dateResponse = await axios.get(targetUrl);
    const files = extractZipFiles(dateResponse.data, targetUrl);

    console.log(`\n======================================================`);
    console.log(`📅 A PROCESSAR O SNAPSHOT: ${latestDateDir}`);
    console.log(`======================================================`);
    console.log(`📦 ${files.length} ficheiros ZIP encontrados.\n`);

    const limit = pLimit(3);
    const promises = [];

    for (const file of files) {
      const schemaConfig = SCHEMAS[file.collection];
      if (!schemaConfig) continue;

      const pipelineConfig = {
        collectionName: file.collection,
        fileIdentifier: schemaConfig.fileIdentifier,
        headers: schemaConfig.headers
      };

      promises.push(limit(() => processFilePipeline(file.url, pipelineConfig)));
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
