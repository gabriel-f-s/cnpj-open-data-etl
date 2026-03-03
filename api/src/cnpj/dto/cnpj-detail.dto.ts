export interface CnaeInfo {
  codigo: string;
  descricao?: string;
}

export interface MunicipioInfo {
  codigo: string;
  descricao?: string;
}

export interface PaisInfo {
  codigo: string;
  descricao?: string;
}

export interface MotivoSituacaoInfo {
  codigo: string;
  descricao?: string;
}

export interface NaturezaJuridicaInfo {
  codigo: string;
  descricao?: string;
}

export interface QualificacaoInfo {
  codigo: string;
  descricao?: string;
}

export interface EmpresaDetail {
  cnpj_basico: string;
  razao_social: string;
  natureza_juridica?: NaturezaJuridicaInfo;
  qualificacao_responsavel?: QualificacaoInfo;
  capital_social?: number;
  porte_empresa?: string;
}

export interface EstabelecimentoDetail {
  cnpj: string;
  identificador_matriz_filial?: string;
  nome_fantasia?: string;
  situacao_cadastral?: string;
  data_situacao_cadastral?: string;
  motivo_situacao_cadastral?: MotivoSituacaoInfo;
  nome_cidade_exterior?: string;
  pais?: PaisInfo;
  data_inicio_atividade?: string;
  cnae_fiscal_principal?: CnaeInfo;
  cnae_fiscal_secundaria?: CnaeInfo[];
  tipo_logradouro?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cep?: string;
  uf?: string;
  municipio?: MunicipioInfo;
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

export interface SocioDetail {
  nome_socio: string;
  cnpj_cpf_do_socio?: string;
  qualificacao_socio?: QualificacaoInfo;
  data_entrada_sociedade?: string;
  pais?: PaisInfo;
  representante_legal?: string;
  nome_do_representante?: string;
  qualificacao_representante_legal?: QualificacaoInfo;
  faixa_etaria?: string;
}

export interface SimplesDetail {
  opcao_pelo_simples?: string;
  data_opcao_simples?: string;
  data_exclusao_simples?: string;
  opcao_pelo_mei?: string;
  data_opcao_mei?: string;
  data_exclusao_mei?: string;
}

export interface CnpjDetailDto {
  cnpj: string;
  empresa?: EmpresaDetail;
  estabelecimento: EstabelecimentoDetail;
  simples?: SimplesDetail;
  socios: SocioDetail[];
}

