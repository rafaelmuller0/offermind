# Auto Miner (beta)
O fluxo padrão agora é descobrir ofertas, e não cadastrar. O conector candidato SearchAPI consulta a biblioteca de anúncios por termos e país e aprofunda até três anunciantes, com paginação limitada. O operador seleciona um nicho, aceita o orçamento de chamadas (6, 12 ou 18) e fornece sua própria chave. A chave fica apenas em memória durante a rodada e é enviada ao endpoint de servidor via POST; não é persistida nem colocada na URL do fornecedor. Não há chave compartilhada nem cobrança do OfferMind. Não use com credenciais de produção até verificar o HTTPS e a política de logs/segurança da hospedagem.

Documentação do fornecedor: https://www.searchapi.io/docs/meta-ad-library-api
O conector é uma implementação candidata baseada na documentação, não uma integração verificada com credenciais reais. Antes de usar comercialmente, verificar autorização, cobertura de anúncios comerciais dos EUA, termos da Meta, condições de retenção/redistribuição e custo. Nenhum contrato foi firmado.

## Estratégia
1. Até 3 termos por nicho, pesquisa inicial com janela configurada.
2. Paginação de até 2 páginas por termo.
3. Investigação de até 3 anunciantes com mais IDs observados; até 4 páginas por anunciante, sem restringir idade, respeitando teto global de chamadas.
4. Deduplicação por ID e país. Agrupamento conservador por anunciante e destino normalizado. Anúncios ambíguos ficam fora do agrupamento.
5. Volume e idade avaliados com os IDs realmente observados. Textos distintos são sinais textuais, não conceitos criativos confirmados.
6. Resultados aparecem automaticamente na tela; usuário pode salvar candidatas com um clique. Nenhum resultado é apresentado como oferta integralmente validada.
7. Consulta parcial, erro e cancelamento são explicitados.

## Limitações
Destino compartilhado pode conter múltiplos produtos, então os grupos são candidatas. A seleção de nicho gera termos, mas não garante que todos os resultados sejam daquele nicho. Não há análise visual automatizada, cobertura integral, IA, login ou armazenamento em nuvem. Não foi executado build ou teste de integração no ambiente atual. Antes de lançamento comercial, integrar autenticação, rate limits e provedor licenciado com segurança e testar o fluxo.
