-- Fase 20 — Cronograma alinhado ao template PMO SAP Activate
-- (Frente/Bloco por tarefa, Criticidade por marco — SPI/%Planejado são
-- calculados no frontend a partir de datas/progresso, sem precisar de coluna nova)

alter table public.tasks add column if not exists frente text;

alter table public.milestones add column if not exists criticality text
  check (criticality in ('baixa','media','alta','critica'));

comment on column public.tasks.frente is 'Frente/bloco de trabalho (ex: Discovery, Governança, Basis/Cloud, FI, CO, MM...) — livre, não é o mesmo que module_id.';
comment on column public.milestones.criticality is 'Criticidade do marco (baixa/media/alta/critica), como no cronograma PMO Activate.';
