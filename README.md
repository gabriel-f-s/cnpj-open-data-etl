# CNPJ Open Data - CLI & Docker

Uma aplicação CLI de extrema performance baseada em Node.js e Docker para extração, transformação e carga (ETL) de dados públicos de CNPJ da Receita Federal.

A aplicação foi projetada para rodar em ambientes com recursos limitados, utilizando **Node.js Streams** e **Processamento Concorrente** para processar gigabytes de dados com baixo consumo de memória RAM, garantindo que o banco de dados esteja sempre sincronizado e atualizado com a fonte oficial.

## 🚀 Funcionalidades

* **Scraping Inteligente:** Identifica automaticamente novos diretórios de dados (mensais) na fonte governamental.
* **Gerenciamento de Estado:** Mantém um registro local (`state.json`) da última data processada, permitindo execuções incrementais (baixa apenas o que é novo).
* **Pipeline de Streaming Consolidado:**
* Download contínuo via Stream (o arquivo ZIP não é salvo no HD).
* Descompactação (Unzip) em memória.
* Parsing de CSV convertido nativamente de `win1252` para `UTF-8` on-the-fly.
* Inserção em lote de 10.000 registros (Batch Insert) no MongoDB para máxima velocidade de rede.


* **Processamento Paralelo:** Utiliza controle de concorrência (`p-limit`) para baixar e processar múltiplos arquivos simultaneamente.
* **Estratégia de Upsert Indexado:** Cria índices únicos no MongoDB antes da carga e utiliza `bulkWrite` para garantir a atualização dos dados das empresas sem criar duplicidade, mantendo a performance em milhões de registros.
* **Dockerizado:** Ambiente isolado e reproduzível, pronto para execução em qualquer SO.

## 📜 Conformidade com a Receita Federal

A arquitetura de dados segue rigorosamente o Novo Layout para os Dados Abertos do CNPJ.

* Utiliza o ponto e vírgula (`;`) como delimitador oficial.


* Suporta a formatação de dados sensíveis descaracterizados, preservando a ocultação de dígitos do CPF.


* Mapeia perfeitamente as tabelas de domínio (CNAES, Municípios, Naturezas, etc.).


* Estrutura o layout de Sócios contemplando a Faixa Etária e Representantes Legais na ordem correta.



## 📂 Estrutura do Projeto

A estrutura foi otimizada para manter a coesão do fluxo de dados em um único tubo de processamento.

```text
cnpj-etl-cli/
├── data/                    # Volume persistente do Docker
│   └── state.json           # Armazena o estado: { "last_processed_date": "YYYY-MM-DD" }
├── src/
│   ├── config/              # Configurações centralizadas
│   │   ├── database.js      # Singleton do Mongo e construção de Índices Únicos
│   │   ├── env.js           # Variáveis de ambiente
│   │   └── schemas.js       # Regras de negócio, transformações e chaves primárias
│   ├── scrapers/            # Lógica de navegação no site da Receita
│   │   └── html-parser.js   # Extrai datas e links dos arquivos ZIP
│   ├── pipeline/            # O núcleo do processamento
│   │   └── stream-processor.js # Tubo único: Download -> Unzip -> Decode -> CSV -> BulkWrite
│   ├── utils/
│   │   ├── file-categorizer.js # Mapeia arquivos governamentais para Collections
│   │   └── state-manager.js # Leitura e escrita do estado
│   └── index.js             # Ponto de entrada (Orquestrador e Concorrência)
├── Dockerfile               # Imagem otimizada baseada em Alpine Linux
├── docker-compose.yml       # Orquestração dos serviços (App + Banco)
├── package.json             # Dependências do Node.js
└── README.md                # Documentação do projeto

```

## 🛠️ Como Funciona o Fluxo de Dados

1. **Inicialização:** A CLI inicia, conecta ao banco, cria os índices e verifica o arquivo `data/state.json`.
2. **Verificação (Scraping):** Acessa a URL base, lista todas as pastas de datas disponíveis e filtra apenas aquelas **posteriores** à data salva no `state.json`.
3. **Iteração Concorrente:** Para cada data nova encontrada:
* Lista todos os arquivos `.zip` disponíveis.
* Dispara o **Pipeline de Stream** processando múltiplos arquivos em paralelo.


4. **Processamento (The Pipe):**
* `Internet` ➔ `Unzip Stream` ➔ `Iconv Decode` ➔ `CSV Parser` ➔ `Buffer (Lote de 10.000)` ➔ `MongoDB (Upsert & WriteConcern: 0)`.


5. **Conclusão:** Após o sucesso de todos os arquivos daquela data, a conexão com a Receita é interrompida (economizando banda) e o `state.json` é atualizado.

## 📋 Pré-requisitos

* [Docker](https://www.docker.com/) e Docker Compose instalados.

## 🚀 Como Executar

### 1. Configuração

Crie um arquivo `.env` na raiz (opcional) ou ajuste o `docker-compose.yml` diretamente:

```yaml
# Exemplo de variáveis no docker-compose.yml
environment:
  - MONGO_URI=mongodb://mongo:27017/cnpj_data
  - BASE_URL=https://dados-abertos-rf-cnpj.casadosdados.com.br/arquivos/
  # Limite de memória para o Garbage Collector do Node processar Streams grandes
  - NODE_OPTIONS="--max-old-space-size=4096"

```

### 2. Build e Execução

Para iniciar o processo completo:

```bash
docker-compose up --build

```

### 3. Verificar os Dados

Você pode conectar no MongoDB para ver a carga em tempo real:

```bash
# Acessar o container do Mongo
docker exec -it <nome_do_container_mongo> mongosh

# Dentro do shell do Mongo:
use cnpj_data
db.empresas.countDocuments()

```

### 4. Execuções Mensais (Recorrentes)

Como a aplicação salva o estado em `./data/state.json` (volume montado), você pode simplesmente agendar a inicialização do container mensalmente. Ele detectará automaticamente se há uma pasta nova (ex: `2026-02-15`) no site e processará apenas a diferença (Deltas).
