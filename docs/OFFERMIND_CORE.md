# OfferMind Core v0.1
## Escopo implementado
Primeira fatia funcional, compatível com o template Lovable existente (TanStack Start + React + TypeScript + Tailwind). Dashboard responsivo, pesquisa assistida na Meta, cadastro/edição de ofertas, importação JSON de anúncios, validação determinística, evidências, revisão manual de conceitos, comparação de até quatro ofertas, favoritos, monitoramento manual, pipeline, exportação JSON, regras configuráveis e demo isolada.

## Executar
npm install
npm run dev
npm run test
npm run build

## Dados
A versão atual utiliza localStorage. Não é um ambiente multiusuário seguro, não armazene segredos nem dados privados. Não há autenticação, sincronização em nuvem ou cobrança real. Use exportação JSON para preservar os registros. A demonstração é fictícia e não é persistida junto aos dados locais.

Cadastre uma oferta, abra os detalhes e importe uma lista JSON autorizada. Campos: id, country, status (active/inactive/unknown), start, observed (YYYY-MM-DD), source (HTTP(S)), headline, concept, format. O vínculo com a oferta é atribuído pelo usuário. Conceitos entram sem revisão e só contam após confirmação manual. Registros com IDs repetidos na mesma observação são deduplicados. O motor conta registros ativos associados na última data observada, não o total estimado da página. A aprovação é interna à amostra importada, sem verificação independente. Não comprova situação atual na Meta ou lucro.

## Provedores — bloqueios
Acesso comercial automatizado à Meta não foi validado para este SaaS. A integração disponível no ChatGPT não é uma credencial reutilizável. A pesquisa abre a Biblioteca de Anúncios oficial em outra aba. Não há scraping nem uso de credenciais de terceiros. Antes de contratar ou habilitar um provedor, validar cobertura US comercial, permissões, custos, retenção e redistribuição.
## Roadmap
1. Prova de viabilidade de fonte autorizada de anúncios.
2. Supabase Auth, workspaces, RLS, migrations, importação server-side e persistência.
3. Provedor real, paginação, proveniência e snapshots comparáveis.
4. IA no backend com saídas estruturadas, Creative DNA multimodal, relatórios, Copilot e Score.
5. Monitoramento agendado, alertas, Factory, funis e Brasil Intelligence.
6. Billing em sandbox, entitlements e auditoria; validar disposição a pagar R$497 antes de comercializar.
## Segurança
Não há credenciais neste código. Antes de produção: RLS e testes de isolamento, gestão de sessões, autorização no servidor, rate limits, validação de webhooks, política de privacidade/LGPD, segurança de integrações e revisão de dependências.
