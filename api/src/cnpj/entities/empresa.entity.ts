export interface EmpresaDocument {
  cnpj_basico: string;
  razao_social: string;
  natureza_juridica?: string;
  qualificacao_responsavel?: string;
  capital_social?: number;
  porte_empresa?: string;
  ente_federativo_responsavel?: string | null;
}

