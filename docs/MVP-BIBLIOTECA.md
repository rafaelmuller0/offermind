# OfferMind — MVP de pesquisa de anúncios

Esta branch substitui a interface do workspace por uma única tela de busca. O código anterior continua disponível no histórico; nenhum módulo antigo é mostrado na interface principal.

## Configuração administrativa

- Cloudflare Access: CF_ACCESS_TEAM_DOMAIN, CF_ACCESS_AUD e domínio protegido. O servidor valida assinatura e audiência do JWT.
- Redis REST: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN (controle de consultas).
- Fonte comercial: SEARCHAPI_API_KEY, OFFERMIND_RESEARCH_AUTHORIZED=true e OFFERMIND_LICENSED_COUNTRIES com os países licenciados, somente após confirmar autorização de uso e exibição. Não disponibilizar os segredos ao navegador.
- A API oficial Meta Ads Archive não oferece pesquisa geral de anúncios comerciais BR/US. A fonte de dados externa requer contrato/termos compatíveis com o uso pretendido. Documentação: https://www.searchapi.io/docs/meta-ad-library-api.

## Critério de aceite

1. Abrir domínio protegido, autenticar.
2. Buscar uma palavra-chave conhecida em BR/US com a fonte autorizada.
3. Confirmar anúncios reais e links originais, filtros, paginação, duplicatas, erros e estado vazio.
4. Executar bun install --frozen-lockfile, bun run test, bun run build e bunx tsc --noEmit.
5. Confirmar direitos de uso, segurança do ambiente, proteção de custos e funcionamento no navegador.

Nenhum anúncio de demonstração é servido como resultado. Testes de interface usam dados fictícios isolados. Falha de acesso é diferente de ausência de resultados. A consulta manual à Meta não preenche o aplicativo. Sem confirmação de uma consulta real, o MVP não deve ser considerado pronto para venda.
