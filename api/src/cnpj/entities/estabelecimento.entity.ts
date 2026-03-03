export interface EstabelecimentoDocument {
  cnpj_basico: string;
  cnpj_ordem: string;
  cnpj_dv: string;
  identificador_matriz_filial?: string;
  nome_fantasia?: string;
  situacao_cadastral?: string;
  data_situacao_cadastral?: string;
  motivo_situacao_cadastral?: string;
  nome_cidade_exterior?: string;
  pais?: string;
  data_inicio_atividade?: string;
  cnae_fiscal_principal?: string;
  cnae_fiscal_secundaria?: string;
  tipo_logradouro?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cep?: string;
  uf?: string;
  municipio?: string;
  ddd_1?: string;
  telefone_1?: string;
  ddd_2?: string;
  telefone_2?: string;
  ddd_fax?: string;
  fax?: string;
  correio_eletronico?: string;
  situacao_especial?: string;
  data_situacao_especial?: string;
}

