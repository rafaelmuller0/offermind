# OfferMind Collector

Coleta agendada que alimenta o catálogo compartilhado (`public/offermind-catalog.json`)
sem depender de navegador aberto nem de cadastro manual.

## Estado atual: o que foi e o que NÃO foi verificado

| Item                                                                          | Estado                                                                      |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Camada de provedor (`src/lib/collector/searchapi.ts`)                         | Testada com respostas **sintéticas** no formato documentado                 |
| Motor (`collector.ts`): orçamento, retentativas, parada em erro de credencial | Testado com provedor simulado                                               |
| Catálogo (`catalog.ts`): mescla, retenção, falha sem apagar dados             | Testado                                                                     |
| Script `scripts/refresh-catalog.mjs` ponta a ponta                            | Executado com `fetch` simulado; sucesso, falha 401 e ausência de credencial |
| Interface: banner de falha, catálogo vazio e coleta antiga                    | Verificada no navegador com catálogos de teste                              |
| **Consulta real ao SearchAPI**                                                | **Não executada.** Não há `SEARCHAPI_API_KEY` configurada                   |
| **Cobertura de anúncios comerciais dos EUA**                                  | **Não confirmada.** A documentação não afirma isso                          |
| **Direitos de armazenar e exibir os dados**                                   | **Não confirmados.** A documentação não trata do assunto                    |
| **Custo por requisição e limites**                                            | **Não informados** na página de documentação consultada                     |

O catálogo publicado continua vazio (`not_configured`). Nada neste repositório
é dado real de anúncio.

## O que impedia a mineração

- O catálogo nunca tinha sido gerado: sem chave do fornecedor nem a variável
  `OFFERMIND_CATALOG_ENABLED`, a coleta agendada não roda, e a interface mostrava
  apenas "não configurada".
- O código apontava para um domínio `.org` que não é o da documentação oficial do
  fornecedor, que está em `searchapi.io`. O endpoint de consulta ficou centralizado em um único arquivo e um
  teste impede o domínio errado de voltar.
- Uma coleta com falha não deixava rastro: o workflow não publicava o estado de
  falha e a interface não o exibia.

## Como o Collector se comporta

- Plano diário determinístico: rotação de palavras-chave por nicho, janela de datas
  de 14 a 30 dias, depois aprofundamento dos anunciantes com mais anúncios.
- Orçamento de chamadas (`OFFERMIND_MAX_CALLS`, padrão 18, máximo 100) contando
  retentativas. Nunca é ultrapassado.
- Retentativa com backoff exponencial só para erro temporário (429, 5xx, rede, tempo
  esgotado).
- Credencial inválida (401/403) interrompe a rodada na primeira chamada.
- Três falhas seguidas abortam a rodada.
- Cobertura registrada como `complete`, `partial` ou `failed`. Resultados não lidos
  (cursor restante, orçamento, anunciantes não aprofundados) tornam a cobertura
  `partial`.
- Falha total **não apaga** nada: o catálogo anterior continua, com o erro e a data da
  tentativa gravados. Oferta ausente da amostra de hoje permanece até sair da
  retenção (30 dias).
- A chave nunca vai para a URL, o catálogo ou as mensagens de erro. O fetch não segue
  redirecionamentos para que o cabeçalho `Authorization` não vaze.

## Ativação (ação do administrador)

1. Contratar um plano do SearchAPI **somente depois** de confirmar com o fornecedor
   a cobertura de anúncios comerciais dos EUA e os direitos de armazenar e exibir os
   dados em um produto multiusuário.
2. Em Settings → Secrets and variables → Actions do repositório:
   - secret `SEARCHAPI_API_KEY`
   - variável `OFFERMIND_CATALOG_ENABLED` = `true`
   - variável opcional `OFFERMIND_MAX_CALLS`
3. Rodar o workflow `offermind-catalog` manualmente uma vez e conferir o resultado.

## Limitações conhecidas

- O agrupamento por anunciante e destino é um **candidato** a oferta, não prova de que
  os anúncios são da mesma oferta. Conceitos criativos não são verificados.
- Nicho vem do termo de pesquisa, não de classificação do conteúdo.
- O catálogo é um arquivo JSON versionado no Git. Serve para a primeira fatia; para
  histórico, Scale Tracker e multiusuário será necessário banco de dados. Alterações de
  schema devem ser pedidas ao Lovable (ver `AGENTS.md`).

## Busca automática no feed (tempo real)

O feed busca sozinho ao ser aberto e de novo ao clicar em **Caçar novas ofertas**
(usa o texto da barra de pesquisa e o mercado selecionado). A chamada passa por uma
função de servidor (`src/lib/hunt.functions.ts`); o navegador nunca envia nem recebe
chave.

Perfil de busca, espelhando o link da Biblioteca de Anúncios pedido
(`src/lib/collector/hunt.ts`):

| Parâmetro do link                            | Enviado ao SearchAPI                                  |
| -------------------------------------------- | ----------------------------------------------------- |
| `active_status=active`                       | `active_status=active`                                |
| `ad_type=political_and_issue_ads`            | `ad_type=political_and_issue_ads`                     |
| `country=BR`                                 | `country=BR` (segue o mercado selecionado; padrão BR) |
| `media_type=all`                             | `media_type=all`                                      |
| `sort_data[mode]=total_impressions` + `desc` | `sort_by=impressions_high_to_low`                     |
| `is_targeted_country=false`                  | **não enviado: o SearchAPI não tem esse parâmetro**   |

Limites e comportamento:

- Credencial: secret `SEARCHAPI_API_KEY` no servidor. Sem ela, a tela informa que a
  busca está indisponível e nada é consultado.
- Automática no máximo a cada 30 minutos por navegador e mercado. O botão força nova
  busca.
- Cache de 30 minutos no servidor; visitantes simultâneos com a mesma busca dividem
  uma única consulta; falhas ficam em cache por 1 minuto.
- Teto de 60 chamadas por hora no servidor, somando todos os visitantes, e no máximo 2
  páginas por busca. Esses limites ficam na memória do processo: valem por instância e
  não substituem um limite no próprio fornecedor.
- A ordenação é a do fornecedor. **A página de documentação do SearchAPI não descreve
  campos de impressões, gasto ou financiador** para anúncios políticos, então o feed
  não mostra esses números.
- Só entram no feed anúncios agrupáveis por anunciante e destino. A documentação não
  confirma que anúncios políticos tragam `link_url`; os que não trazem ficam de fora e
  a quantidade aparece no aviso.
- As regras de validação de oferta (volume, idade) foram pensadas para anúncios
  comerciais e não medem relevância política.
