export const SCHEMAS = {
  cnaes: {
    fileIdentifier: 'CNAECSV',
    primaryKeys: ['codigo'],
    headers: ['codigo', 'descricao']
  },
  empresas: {
    fileIdentifier: 'EMPRE',
    primaryKeys: ['cnpj_basico'],
    headers: [
      'cnpj_basico', 'razao_social', 'natureza_juridica',
      'qualificacao_responsavel', 'capital_social', 'porte_empresa',
      'ente_federativo_responsavel'
    ],
    transform: (chunk) => {
      if (chunk.capital_social) {
        chunk.capital_social = parseFloat(chunk.capital_social.replace(',', '.')) || 0;
      }
      return chunk;
    }
  },
  estabelecimentos: {
    fileIdentifier: 'ESTABELE',
    primaryKeys: ['cnpj_basico', 'cnpj_ordem', 'cnpj_dv'], 
    headers: [
      'cnpj_basico', 'cnpj_ordem', 'cnpj_dv', 'identificador_matriz_filial',
      'nome_fantasia', 'situacao_cadastral', 'data_situacao_cadastral',
      'motivo_situacao_cadastral', 'nome_cidade_exterior', 'pais',
      'data_inicio_atividade', 'cnae_fiscal_principal', 'cnae_fiscal_secundaria',
      'tipo_logradouro', 'logradouro', 'numero', 'complemento', 'bairro',
      'cep', 'uf', 'municipio', 'ddd_1', 'telefone_1', 'ddd_2', 'telefone_2',
      'ddd_fax', 'fax', 'correio_eletronico', 'situacao_especial',
      'data_situacao_especial'
    ]
  },
  motivos: {
    fileIdentifier: 'MOTICSV',
    primaryKeys: ['codigo'],
    headers: ['codigo', 'descricao']
  },
  municipios: {
    fileIdentifier: 'MUNICCSV',
    primaryKeys: ['codigo'],
    headers: ['codigo', 'descricao']
  },
  naturezas: {
    fileIdentifier: 'NATJUCSV',
    primaryKeys: ['codigo'],
    headers: ['codigo', 'descricao']
  },
  paises: {
    fileIdentifier: 'PAISCSV',
    primaryKeys: ['codigo'],
    headers: ['codigo', 'descricao']
  },
  qualificacoes: {
    fileIdentifier: 'QUALSCSV',
    primaryKeys: ['codigo'],
    headers: ['codigo', 'descricao']
  },
  simples: {
    fileIdentifier: 'SIMPLES',
    primaryKeys: ['cnpj_basico'],
    headers: [
      'cnpj_basico', 'opcao_pelo_simples', 'data_opcao_simples',
      'data_exclusao_simples', 'opcao_pelo_mei', 'data_opcao_mei',
      'data_exclusao_mei'
    ]
  },
  socios: {
    fileIdentifier: 'SOCIOCSV',
    primaryKeys: ['cnpj_basico', 'cnpj_cpf_do_socio', 'nome_socio'], 
    headers: [
      'cnpj_basico', 
      'identificador_de_socio', 
      'nome_socio',
      'cnpj_cpf_do_socio', 
      'qualificacao_socio', 
      'data_entrada_sociedade',
      'pais', 
      'representante_legal',
      'nome_do_representante',
      'qualificacao_representante_legal', 
      'faixa_etaria'
    ]
  }
};