-- Nomes fictícios (porém realistas) para consultorias-clientes e projetos.
-- Substitui/supera o 004_rename_orgs.sql — pode rodar mesmo se já rodou o 004.
--
-- Modelo: cada "organization" (tenant do SaaS) é uma CONSULTORIA SAP que usa
-- a plataforma. Cada "project" dentro dela é a implementação SAP de um
-- CLIENTE FINAL dessa consultoria. Nenhum nome corresponde a empresa real.

-- ---------------------------------------------------------------
-- Organizações → consultorias SAP fictícias (tenants do SaaS)
-- ---------------------------------------------------------------
update public.organizations
set name = 'Vantus Consultoria SAP', slug = 'vantus-consultoria'
where id = '11111111-1111-1111-1111-111111111111';

update public.organizations
set name = 'Prisma Sistemas Empresariais Ltda.', slug = 'prisma-sistemas'
where id = '22222222-2222-2222-2222-222222222222';

-- ---------------------------------------------------------------
-- Projetos da Vantus → nome de clientes finais fictícios
-- ---------------------------------------------------------------
update public.projects set name = 'S/4HANA — Ferronorte Siderúrgica S.A.'          where code = 'ALPHA-S4';
update public.projects set name = 'Migração ECC — Metalúrgica Andrade Ltda.'       where code = 'ALPHA-MIGR';
update public.projects set name = 'Integração Bancária — Banco Confiança S.A.'     where code = 'ALPHA-BANK';
update public.projects set name = 'SuccessFactors — Grupo Varejo Estrela'          where code = 'ALPHA-SF';
update public.projects set name = 'BW Analytics — Distribuidora Horizonte'         where code = 'ALPHA-BW';

-- Projeto(s) da Prisma, se existir(em)
update public.projects set name = 'Upgrade SAP — Agropecuária Boa Vista Ltda.'     where code = 'BETA-UPG';

select code, name from public.projects order by code;
select name, slug from public.organizations order by created_at;
