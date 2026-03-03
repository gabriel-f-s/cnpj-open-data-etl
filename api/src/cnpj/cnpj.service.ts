import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { Db } from 'mongodb';
import { MONGO_DB } from '../database/mongo.module';
import { EmpresaDocument } from './entities/empresa.entity';
import { EstabelecimentoDocument } from './entities/estabelecimento.entity';
import { SocioDocument } from './entities/socio.entity';
import { SimplesDocument } from './entities/simples.entity';
import { CodigoDescricaoDocument } from './entities/domains.entity';
import { ListCnpjsQueryDto } from './dto/list-cnpjs-query.dto';
import { CnpjListItemDto } from './dto/cnpj-list-item.dto';
import {
  CnaeInfo,
  CnpjDetailDto,
  EmpresaDetail,
  EstabelecimentoDetail,
  SocioDetail,
  SimplesDetail,
} from './dto/cnpj-detail.dto';

@Injectable()
export class CnpjService {
  constructor(@Inject(MONGO_DB) private readonly db: Db) {}

  async listCnpjs(query: ListCnpjsQueryDto): Promise<{ data: CnpjListItemDto[]; total: number; page: number; limit: number }> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 && query.limit <= 100 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const estabelecimentos = this.db.collection<EstabelecimentoDocument>('estabelecimentos');
    const empresas = this.db.collection<EmpresaDocument>('empresas');

    const filter: Record<string, unknown> = {};
    let hasFilter = false;
    let hasCnpjFilter = false;

    if (query.cnpj) {
      hasFilter = true;
      hasCnpjFilter = true;
      if (query.cnpj.length === 14) {
        const cnpjBasico = query.cnpj.slice(0, 8);
        const cnpjOrdem = query.cnpj.slice(8, 12);
        const cnpjDv = query.cnpj.slice(12);
        filter.cnpj_basico = cnpjBasico;
        filter.cnpj_ordem = cnpjOrdem;
        filter.cnpj_dv = cnpjDv;
      } else if (query.cnpj.length === 8) {
        filter.cnpj_basico = query.cnpj;
      }
    }

    if (query.uf) {
      hasFilter = true;
      filter.uf = query.uf.toUpperCase();
    }

    if (query.municipio) {
      hasFilter = true;
      filter.municipio = query.municipio;
    }

    try {
      let total = 0;

      if (!hasFilter) {
        total = await estabelecimentos.estimatedDocumentCount();
      } else {
        total = await estabelecimentos.countDocuments(filter);
      }

      const sortRule: Record<string, 1 | -1> = hasCnpjFilter
        ? { cnpj_basico: 1, cnpj_ordem: 1, cnpj_dv: 1 }
        : { _id: 1 };

      const docs = await estabelecimentos
        .find(filter, {
          projection: {
            cnpj_basico: 1,
            cnpj_ordem: 1,
            cnpj_dv: 1,
            uf: 1,
            municipio: 1,
            cnae_fiscal_principal: 1,
          },
          skip,
          limit,
          sort: sortRule,
        })
        .toArray();

      const cnpjBasicos = Array.from(new Set(docs.map((d) => d.cnpj_basico)));

      let empresasPorCnpj: Record<string, EmpresaDocument> = {};

      if (cnpjBasicos.length > 0) {
        const empresasDocs = await empresas
          .find(
            { cnpj_basico: { $in: cnpjBasicos } },
            {
              projection: {
                cnpj_basico: 1,
                razao_social: 1,
              },
            },
          )
          .toArray();

        empresasPorCnpj = empresasDocs.reduce<Record<string, EmpresaDocument>>((acc, doc) => {
          acc[doc.cnpj_basico] = doc;
          return acc;
        }, {});
      }

      const data: CnpjListItemDto[] = docs.map((doc) => {
        const cnpj = `${doc.cnpj_basico}${doc.cnpj_ordem}${doc.cnpj_dv}`;
        const empresa = empresasPorCnpj[doc.cnpj_basico];

        return {
          cnpj,
          cnpj_basico: doc.cnpj_basico,
          razao_social: empresa?.razao_social,
          uf: doc.uf,
          municipio: doc.municipio,
          cnae_fiscal_principal: doc.cnae_fiscal_principal,
        };
      });

      return {
        data,
        total,
        page,
        limit,
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Erro ao listar CNPJs:', error);
      throw new InternalServerErrorException('Erro ao listar CNPJs');
    }
  }

  async getCnpjDetail(cnpj: string): Promise<CnpjDetailDto | null> {
    const estabelecimentos = this.db.collection<EstabelecimentoDocument>('estabelecimentos');
    const empresas = this.db.collection<EmpresaDocument>('empresas');
    const socios = this.db.collection<SocioDocument>('socios');
    const simples = this.db.collection<SimplesDocument>('simples');
    const cnaes = this.db.collection<CodigoDescricaoDocument>('cnaes');
    const municipios = this.db.collection<CodigoDescricaoDocument>('municipios');
    const paises = this.db.collection<CodigoDescricaoDocument>('paises');
    const motivos = this.db.collection<CodigoDescricaoDocument>('motivos');
    const naturezas = this.db.collection<CodigoDescricaoDocument>('naturezas');
    const qualificacoes = this.db.collection<CodigoDescricaoDocument>('qualificacoes');

    if (cnpj.length !== 14) {
      return null;
    }

    const cnpjBasico = cnpj.slice(0, 8);
    const cnpjOrdem = cnpj.slice(8, 12);
    const cnpjDv = cnpj.slice(12);

    try {
      const estabelecimentoDoc = await estabelecimentos.findOne({
        cnpj_basico: cnpjBasico,
        cnpj_ordem: cnpjOrdem,
        cnpj_dv: cnpjDv,
      });

      if (!estabelecimentoDoc) {
        return null;
      }

      const [empresaDoc, sociosDocs, simplesDoc] = await Promise.all([
        empresas.findOne({ cnpj_basico: cnpjBasico }),
        socios
          .find(
            { cnpj_basico: cnpjBasico },
            {
              sort: { nome_socio: 1 },
            },
          )
          .toArray(),
        simples.findOne({ cnpj_basico: cnpjBasico }),
      ]);

      const cnaePrincipalCodigo = estabelecimentoDoc.cnae_fiscal_principal;
      const municipioCodigo = estabelecimentoDoc.municipio;
      const paisEstabCodigo = estabelecimentoDoc.pais;
      const motivoCodigo = estabelecimentoDoc.motivo_situacao_cadastral;
      const naturezaCodigo = empresaDoc?.natureza_juridica;
      const qualificacaoRespCodigo = empresaDoc?.qualificacao_responsavel;

      const qualificacoesSociosCodigos = Array.from(
        new Set(
          sociosDocs
            .map((s) => s.qualificacao_socio)
            .filter((value): value is string => Boolean(value)),
        ),
      );

      const paisesSociosCodigos = Array.from(
        new Set(
          sociosDocs
            .map((s) => s.pais)
            .filter((value): value is string => Boolean(value)),
        ),
      );

      const [
        cnaePrincipalDoc,
        municipioDoc,
        paisEstabDoc,
        motivoDoc,
        naturezaDoc,
        qualificacaoRespDoc,
        qualificacoesSociosDocs,
        paisesSociosDocs,
      ] = await Promise.all([
        cnaePrincipalCodigo ? cnaes.findOne({ codigo: cnaePrincipalCodigo }) : Promise.resolve(null),
        municipioCodigo ? municipios.findOne({ codigo: municipioCodigo }) : Promise.resolve(null),
        paisEstabCodigo ? paises.findOne({ codigo: paisEstabCodigo }) : Promise.resolve(null),
        motivoCodigo ? motivos.findOne({ codigo: motivoCodigo }) : Promise.resolve(null),
        naturezaCodigo ? naturezas.findOne({ codigo: naturezaCodigo }) : Promise.resolve(null),
        qualificacaoRespCodigo ? qualificacoes.findOne({ codigo: qualificacaoRespCodigo }) : Promise.resolve(null),
        qualificacoesSociosCodigos.length
          ? qualificacoes
              .find({ codigo: { $in: qualificacoesSociosCodigos } })
              .toArray()
          : Promise.resolve([]),
        paisesSociosCodigos.length
          ? paises
              .find({ codigo: { $in: paisesSociosCodigos } })
              .toArray()
          : Promise.resolve([]),
      ]);

      const qualificacoesSociosMap = qualificacoesSociosDocs.reduce<Record<string, CodigoDescricaoDocument>>(
        (acc, doc) => {
          acc[doc.codigo] = doc;
          return acc;
        },
        {},
      );

      const paisesSociosMap = paisesSociosDocs.reduce<Record<string, CodigoDescricaoDocument>>((acc, doc) => {
        acc[doc.codigo] = doc;
        return acc;
      }, {});

      let empresa: EmpresaDetail | undefined;

      let cnaesSecundariosTratados: CnaeInfo[] | undefined;

      if (estabelecimentoDoc.cnae_fiscal_secundaria) {
        const codigosSecundarios = estabelecimentoDoc.cnae_fiscal_secundaria
          .split(',')
          .map((codigo) => codigo.trim())
          .filter((codigo) => codigo.length > 0);

        if (codigosSecundarios.length > 0) {
          const cnaesSecundariosDocs = await cnaes
            .find({ codigo: { $in: codigosSecundarios } })
            .toArray();

          const cnaesMap = cnaesSecundariosDocs.reduce<Record<string, string>>((acc, doc) => {
            acc[doc.codigo] = doc.descricao || '';
            return acc;
          }, {});

          cnaesSecundariosTratados = codigosSecundarios.map((codigo) => ({
            codigo,
            descricao: cnaesMap[codigo] || undefined,
          }));
        }
      }

      if (empresaDoc) {
        empresa = {
          cnpj_basico: empresaDoc.cnpj_basico,
          razao_social: empresaDoc.razao_social,
          natureza_juridica: naturezaDoc
            ? {
                codigo: naturezaDoc.codigo,
                descricao: naturezaDoc.descricao,
              }
            : undefined,
          qualificacao_responsavel: qualificacaoRespDoc
            ? {
                codigo: qualificacaoRespDoc.codigo,
                descricao: qualificacaoRespDoc.descricao,
              }
            : undefined,
          capital_social: empresaDoc.capital_social,
          porte_empresa: empresaDoc.porte_empresa,
        };
      }

      const estabelecimento: EstabelecimentoDetail = {
        cnpj,
        identificador_matriz_filial: estabelecimentoDoc.identificador_matriz_filial,
        nome_fantasia: estabelecimentoDoc.nome_fantasia,
        situacao_cadastral: estabelecimentoDoc.situacao_cadastral,
        data_situacao_cadastral: estabelecimentoDoc.data_situacao_cadastral,
        motivo_situacao_cadastral: motivoDoc
          ? {
              codigo: motivoDoc.codigo,
              descricao: motivoDoc.descricao,
            }
          : undefined,
        nome_cidade_exterior: estabelecimentoDoc.nome_cidade_exterior,
        pais: paisEstabDoc
          ? {
              codigo: paisEstabDoc.codigo,
              descricao: paisEstabDoc.descricao,
            }
          : undefined,
        data_inicio_atividade: estabelecimentoDoc.data_inicio_atividade,
        cnae_fiscal_principal: cnaePrincipalDoc
          ? {
              codigo: cnaePrincipalDoc.codigo,
              descricao: cnaePrincipalDoc.descricao,
            }
          : estabelecimentoDoc.cnae_fiscal_principal
          ? { codigo: estabelecimentoDoc.cnae_fiscal_principal }
          : undefined,
        cnae_fiscal_secundaria: cnaesSecundariosTratados,
        tipo_logradouro: estabelecimentoDoc.tipo_logradouro,
        logradouro: estabelecimentoDoc.logradouro,
        numero: estabelecimentoDoc.numero,
        complemento: estabelecimentoDoc.complemento,
        bairro: estabelecimentoDoc.bairro,
        cep: estabelecimentoDoc.cep,
        uf: estabelecimentoDoc.uf,
        municipio: municipioDoc
          ? {
              codigo: municipioDoc.codigo,
              descricao: municipioDoc.descricao,
            }
          : estabelecimentoDoc.municipio
          ? { codigo: estabelecimentoDoc.municipio }
          : undefined,
        ddd_1: estabelecimentoDoc.ddd_1,
        telefone_1: estabelecimentoDoc.telefone_1,
        ddd_2: estabelecimentoDoc.ddd_2,
        telefone_2: estabelecimentoDoc.telefone_2,
        ddd_fax: estabelecimentoDoc.ddd_fax,
        fax: estabelecimentoDoc.fax,
        correio_eletronico: estabelecimentoDoc.correio_eletronico,
        situacao_especial: estabelecimentoDoc.situacao_especial,
        data_situacao_especial: estabelecimentoDoc.data_situacao_especial,
      };

      const sociosDetalhe: SocioDetail[] = sociosDocs.map((socioDoc) => {
        const qualificacaoSocio = socioDoc.qualificacao_socio
          ? qualificacoesSociosMap[socioDoc.qualificacao_socio]
          : undefined;

        const paisSocio = socioDoc.pais ? paisesSociosMap[socioDoc.pais] : undefined;

        return {
          nome_socio: socioDoc.nome_socio,
          cnpj_cpf_do_socio: socioDoc.cnpj_cpf_do_socio,
          qualificacao_socio: qualificacaoSocio
            ? {
                codigo: qualificacaoSocio.codigo,
                descricao: qualificacaoSocio.descricao,
              }
            : socioDoc.qualificacao_socio
            ? { codigo: socioDoc.qualificacao_socio }
            : undefined,
          data_entrada_sociedade: socioDoc.data_entrada_sociedade,
          pais: paisSocio
            ? {
                codigo: paisSocio.codigo,
                descricao: paisSocio.descricao,
              }
            : socioDoc.pais
            ? { codigo: socioDoc.pais }
            : undefined,
          representante_legal: socioDoc.representante_legal,
          nome_do_representante: socioDoc.nome_do_representante,
          qualificacao_representante_legal: socioDoc.qualificacao_representante_legal
            ? {
                codigo: socioDoc.qualificacao_representante_legal,
                descricao:
                  qualificacoesSociosMap[socioDoc.qualificacao_representante_legal]?.descricao,
              }
            : undefined,
          faixa_etaria: socioDoc.faixa_etaria,
        };
      });

      let simplesDetalhe: SimplesDetail | undefined;

      if (simplesDoc) {
        simplesDetalhe = {
          opcao_pelo_simples: simplesDoc.opcao_pelo_simples,
          data_opcao_simples: simplesDoc.data_opcao_simples,
          data_exclusao_simples: simplesDoc.data_exclusao_simples,
          opcao_pelo_mei: simplesDoc.opcao_pelo_mei,
          data_opcao_mei: simplesDoc.data_opcao_mei,
          data_exclusao_mei: simplesDoc.data_exclusao_mei,
        };
      }

      return {
        cnpj,
        empresa,
        estabelecimento,
        simples: simplesDetalhe,
        socios: sociosDetalhe,
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Erro ao buscar detalhes do CNPJ ${cnpj}:`, error);
      throw new InternalServerErrorException('Erro ao buscar detalhes do CNPJ');
    }
  }
}

