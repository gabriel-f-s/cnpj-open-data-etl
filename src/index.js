import axios from 'axios';
import pLimit from 'p-limit';
import { config } from './config/env.js';
import { connectDB, closeDB } from './config/database.js';
import { extractDateDirectories, extractZipFiles } from './scrapers/html-parser.js';
import { getState, saveState } from './utils/state-manager.js';
import { processFilePipeline } from './pipeline/stream-processor.js';
import { SCHEMAS } from './config/schemas.js';

async function main() {
  console.time('⏱️ Tempo Total de Execução');
  console.log('🚀 A iniciar CLI de ETL de Dados do CNPJ...\n');

  try {
    await connectDB();
    const state = await getState();
    
    console.log(`📌 Última data processada: ${state.last_processed_date || 'Nenhuma (Vai processar todo o histórico)'}`);

    console.log(`\n🔍 A procurar diretórios de datas em: ${config.app.baseUrl}`);
    const rootResponse = await axios.get(config.app.baseUrl);
    const allDirectories = extractDateDirectories(rootResponse.data);

    const newDirectories = allDirectories.filter(date => {
      if (!state.last_processed_date) return true;
      return date > state.last_processed_date;
    });

    if (newDirectories.length === 0) {
      console.log('\n✅ Nenhuma data nova encontrada. O banco de dados já está atualizado!');
      return;
    }

    console.log(`📂 Encontradas ${newDirectories.length} novas datas para processar: ${newDirectories.join(', ')}`);

    for (const dateDir of newDirectories) {
      console.log(`\n======================================================`);
      console.log(`📅 A PROCESSAR DIRETÓRIO: ${dateDir}`);
      console.log(`======================================================`);

      const baseUrlNormalized = config.app.baseUrl.endsWith('/') ? config.app.baseUrl : `${config.app.baseUrl}/`;
      const targetUrl = `${baseUrlNormalized}${dateDir}/`;

      const dateResponse = await axios.get(targetUrl);
      const files = extractZipFiles(dateResponse.data, targetUrl);

      console.log(`📦 ${files.length} ficheiros ZIP encontrados em ${dateDir}.`);

      const limit = pLimit(3);
      const promises = [];

      for (const file of files) {
        const schemaConfig = SCHEMAS[file.collection];
        if (!schemaConfig) {
          console.warn(`⚠️ Aviso: Nenhum Schema configurado para a coleção '${file.collection}'. Ficheiro ignorado: ${file.fileName}`);
          continue;
        }

        const pipelineConfig = {
          collectionName: file.collection,
          fileIdentifier: schemaConfig.fileIdentifier,
          headers: schemaConfig.headers
        };

        promises.push(limit(() => processFilePipeline(file.url, pipelineConfig)));
      }

      await Promise.all(promises);

      await saveState(dateDir);
    }

    console.log('\n🎉 ETL concluído! Todos os ficheiros novos foram processados e carregados no banco de dados.');

  } catch (error) {
    console.error('\n❌ ERRO FATAL DURANTE A EXECUÇÃO:', error);
    if (error.response) {
      console.error(`Status da resposta: ${error.response.status}`);
    }
  } finally {
    await closeDB();
    console.timeEnd('⏱️ Tempo Total de Execução');
    process.exit(0);
  }
}

main();