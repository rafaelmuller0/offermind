# OfferMind — pesquisa guiada e catálogo salvo

## Experiência disponível
O Feed é a única interface de mineração. A pesquisa guiada apresenta mercado, nicho, micronicho/palavra-chave, tipo de produto, critérios de evidência e revisão. Ao concluir, aplica os critérios ao catálogo salvo, exibe até cinco cards inicialmente e permite carregar mais cinco. A busca avançada também funciona localmente. Os nichos são categorias de navegação e contagens do catálogo, não rankings de demanda. O sistema não fabrica resultados nem apresenta ativos históricos como ativos atuais.

Favoritos, comparação, etapas de projeto e histórico de pesquisas funcionam neste navegador. A entrada manual de ofertas e importação de anúncios são mantidas para alimentar um workspace com registros autorizados. Dados persistidos e arquivos de catálogo passam por validação de estrutura, país, referências, URLs e datas; dados locais inválidos não são sobrescritos.

## Fontes e limites
Os arquivos public/offermind-catalog-BR.json e public/offermind-catalog-US.json estão vazios até existir coleta autorizada. Outros mercados podem ter registros locais importados. Os campos opcionais microniche e productType devem ser preenchidos apenas quando identificados. Evidências visuais não são inferidas de textos, e uma URL de destino não confirma a página de vendas.

A coleta em tempo real está fora da interface, mas os módulos existentes permanecem no repositório para uma futura fase autorizada. Nenhum cliente precisa de uma chave para pesquisar o catálogo salvo.

## Configuração futura de pesquisa externa (não necessária ao Feed local)
## Acesso e persistência

Proteja o domínio do aplicativo com uma política de admissão do Cloudflare Access. Configure CF_ACCESS_TEAM_DOMAIN (domínio da equipe sem https) e CF_ACCESS_AUD (audiência da aplicação). O servidor valida a assinatura do token e usa o identificador do usuário para separar históricos e limites diários. Configure UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN em armazenamento privado compatível com a API REST do Redis, com TLS, suporte a EVAL e capacidade para históricos e arquivos. Nenhuma conta é provisionada pela aplicação. As preferências, anotações e evidências do Vault existente continuam no navegador.

## Pesquisa e evidências

Configure OPENAI_API_KEY no backend e, opcionalmente, OFFERMIND_OPENAI_MODEL para um modelo compatível com Responses e web_search. A aplicação usa a Responses API direta, com store=false. O serviço recebe o manual, o contexto da operação e as escolhas. O limite por usuário é de 24 solicitações de IA por dia UTC. O modelo só pode produzir texto com as ferramentas atuais. Fontes dos rankings e da análise da oferta precisam ter citações retornadas pela API. Uma URL de destino recebida do anúncio permanece candidata. A análise mostra separadamente a página de vendas e o checkout quando cada URL apresentada consta nas páginas abertas pela pesquisa e nas citações.

Configure SEARCHAPI_API_KEY em segredos do servidor. Habilite OFFERMIND_RESEARCH_AUTHORIZED=true e OFFERMIND_LICENSED_COUNTRIES (códigos separados por vírgula, como BR,US) somente para mercados e usos cobertos pela autorização obtida. A mineração sob demanda limita o consumo a 60 consultas por usuário por dia UTC. O catálogo agendado usa a mesma lista de países e seu próprio segredo do GitHub Actions. O job diário na branch padrão exige também OFFERMIND_CATALOG_ENABLED=true e OFFERMIND_PUBLIC_DATA_AUTHORIZED=true. Esta última opção autoriza gravar dados em arquivos públicos do site e no histórico Git. Verifique o alcance da licença para textos, URLs de mídia, armazenamento, envio à IA e exibição a assinantes antes de ativar cada uso. O coletor preserva a versão anterior ao falhar. Os lotes podem ter menos de cinco resultados e uma candidata pode não cumprir os critérios de validação.

A Biblioteca oficial da Meta limita anúncios sem entrega na UE a temas sociais, eleições e política. SearchAPI documenta BR e US, mas sua documentação técnica não comprova os direitos específicos do OfferMind. Consulte a [cobertura oficial](https://www.facebook.com/ads/library/api/), as [regiões da SearchAPI](https://www.searchapi.io/docs/parameters/meta-ad-library/country) e seus [termos](https://www.searchapi.io/legal/terms).


## Critérios de lançamento comercial
Antes de cobrar assinantes, implementar e testar login e autorização no servidor, isolamento por conta, controle de assinatura e revogação, persistência e backup, LGPD, observabilidade, limites de consumo e autorização específica para distribuição dos dados. Não publicar dados licenciados em arquivos públicos sem direito explícito de distribuição pública. Os catálogos públicos são apenas a arquitetura provisória da versão local, não uma proteção de conteúdo pago.

CI: `bun install --frozen-lockfile`, `bun run test`, `bun run build`, `bunx tsc --noEmit`. Aprovação do CI não substitui testes em navegador, auditoria de dependências, segurança do ambiente publicado ou validação comercial.
