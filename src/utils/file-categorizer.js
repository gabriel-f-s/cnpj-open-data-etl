export function getCollectionName(filename) {
  const nameWithoutExt = filename.replace('.zip', '');
  
  const cleanName = nameWithoutExt.replace(/[0-9]+$/, '');

  const map = {
    'Empresas': 'empresas',
    'Estabelecimentos': 'estabelecimentos',
    'Socios': 'socios',
    'Simples': 'simples',
    'Cnaes': 'cnaes',
    'Motivos': 'motivos',
    'Municipios': 'municipios',
    'Naturezas': 'naturezas',
    'Paises': 'paises',
    'Qualificacoes': 'qualificacoes'
  };

  return map[cleanName] || null;
}