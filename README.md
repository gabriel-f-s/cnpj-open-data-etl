# CNPJ Open Data - CLI & Docker

Uma aplicação CLI de alta performance baseada em Node.js e Docker para extração, transformação e carga (ETL) de dados públicos de CNPJ da Receita Federal.

A aplicação foi projetada para rodar em ambientes com recursos limitados, utilizando **Node.js Streams** para processar gigabytes de dados com baixo consumo de memória RAM, garantindo que o banco de dados esteja sempre sincronizado com a fonte oficial.

## 🚀 Funcionalidades

* **Scraping Inteligente:** Identifica automaticamente novos diretórios de dados (mensais) na fonte governamental.
* **Gerenciamento de Estado:** Mantém um registro local (`state.json`) da última data processada, permitindo execuções incrementais (baixa apenas o que é novo).
* **Pipeline de Streaming:**
    * Download via Stream (sem salvar arquivos gigantes em disco).
    * Descompactação (Unzip) em memória.
    * Parsing de CSV linha a linha.
    * Inserção em lote (Batch Insert) no MongoDB.


* **Upsert Strategy:** Utiliza operações de "Update or Insert" para garantir que os dados sejam atualizados sem criar duplicidade de CNPJs.
* **Dockerizado:** Ambiente isolado e reproduzível, pronto para execução em qualquer SO.

## 📂 Estrutura do Projeto

A estrutura foi pensada para separar responsabilidades entre a lógica de "busca" (scraping) e a lógica de "processamento" (pipeline).

```text
cnpj-etl-cli/
├── data/                    # Volume persistente do Docker
│   └── state.json           # Armazena o estado: { "last_processed_date": "YYYY-MM-DD" }
├── src/
│   ├── config/              # Variáveis de ambiente e conexões de banco
│   ├── scrapers/            # Lógica de navegação no site da Receita
│   │   ├── html-parser.js   # Extrai datas e links dos arquivos ZIP
│   │   └── source-map.js    # Mapeia a estrutura de diretórios do site
│   ├── pipeline/            # O núcleo do processamento pesado
│   │   ├── downloader.js    # Gerencia o stream de download (Axios)
│   │   ├── stream-parser.js # Transforma binário -> CSV -> JSON
│   │   └── db-loader.js     # Gerencia Buffers e BulkWrite no MongoDB
│   ├── utils/
│   │   └── state-manager.js # Leitura e escrita do arquivo de estado
│   └── index.js             # Ponto de entrada (Orquestrador)
├── Dockerfile               # Imagem otimizada baseada em Alpine Linux
├── docker-compose.yml       # Orquestração dos serviços (App + Banco)
├── package.json             # Dependências do Node.js
└── README.md                # Documentação do projeto

```

## 🛠️ Como Funciona o Fluxo de Dados

1. **Inicialização:** A CLI inicia e verifica o arquivo `data/state.json`.
2. **Verificação (Scraping):** Acessa a URL base, lista todas as pastas de datas disponíveis e filtra apenas aquelas que são **posteriores** à data salva no `state.json`.
3. **Iteração:** Para cada data nova encontrada (da mais antiga para a mais recente):
* Lista todos os arquivos `.zip` (Empresas, Estabelecimentos, Sócios, etc.).
* Inicia o **Pipeline de Stream** para cada arquivo sequencialmente.


4. **Processamento (The Pipe):**
* `Internet` ➔ `Unzip Stream` ➔ `CSV Parser` ➔ `Buffer (Lote de 1000)` ➔ `MongoDB (Upsert)`.


5. **Conclusão:** Após o sucesso de todos os arquivos daquela data, o `state.json` é atualizado.

## 📋 Pré-requisitos

* [Docker](https://www.docker.com/) e Docker Compose instalados.

## 🚀 Como Executar

### 1. Configuração

Crie um arquivo `.env` na raiz (opcional, pois o `docker-compose.yml` já possui defaults para desenvolvimento) ou ajuste o `docker-compose.yml` diretamente:

```yaml
# Exemplo de variáveis no docker-compose.yml
environment:
  - MONGO_URI=mongodb://mongo:27017/cnpj_data
  - BASE_URL=https://dados-abertos-rf-cnpj.casadosdados.com.br/arquivos/
  # Limite de memória para o Garbage Collector do Node (ajuste conforme sua máquina)
  - NODE_OPTIONS="--max-old-space-size=4096"

```

### 2. Build e Execução

Para iniciar o processo completo (banco de dados + aplicação):

```bash
docker-compose up --build

```

Isso irá:

1. Subir o container do **MongoDB**.
2. Construir a imagem da **Aplicação Node.js**.
3. Iniciar o processamento imediatamente.

> **Nota:** A primeira execução pode levar várias horas dependendo da sua velocidade de internet e disco, pois baixará e processará o histórico completo (ou o snapshot mais recente, dependendo da configuração).

### 3. Verificar os Dados

Você pode conectar no MongoDB para ver o progresso:

```bash
# Acessar o container do Mongo
docker exec -it <nome_do_container_mongo> mongosh

# Dentro do shell do Mongo:
use cnpj_data
db.estabelecimentos.countDocuments()

```

### 4. Execuções Mensais (Recorrentes)

Como a aplicação salva o estado em `./data/state.json` (que é um volume montado), você pode parar o container e rodá-lo novamente mês que vem.

```bash
# Mês seguinte: apenas rode novamente
docker-compose up

```

A aplicação detectará automaticamente se há uma pasta nova (ex: `2026-02-15`) no site e processará apenas ela.

## ⚙️ Detalhes Técnicos

* **Idempotência:** O loader do banco utiliza `updateOne` com `{ upsert: true }`. Se o CNPJ já existe, ele atualiza os dados; se não, cria um novo. Isso permite reiniciar o processo em caso de falha sem duplicar dados.
* **Backpressure:** O pipeline utiliza `stream.pipeline` do Node.js. Se o banco de dados ficar lento, o download diminui a velocidade automaticamente para não estourar a memória RAM.
