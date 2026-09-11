-- Troca os nomes fake "Org Alpha"/"Org Beta" por nomes de cliente mais reais
-- (fictícios, só para o sistema ficar apresentável em demonstração).

update public.organizations set name = 'Aurora Química Industrial S.A.', slug = 'aurora-quimica'
where id = '11111111-1111-1111-1111-111111111111';

update public.organizations set name = 'Cerrado Logística e Transportes Ltda.', slug = 'cerrado-logistica'
where id = '22222222-2222-2222-2222-222222222222';

select name, slug from public.organizations order by created_at;
