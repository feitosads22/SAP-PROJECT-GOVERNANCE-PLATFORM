-- =====================================================================
-- Gera o conteúdo de src/types/database.types.ts a partir do schema real.
-- Alternativa ao `supabase gen types typescript` quando a CLI não está
-- disponível. Roda no SQL Editor; devolve UMA célula de texto — clique
-- nela, copie e cole no arquivo.
-- Introspecção pura: nenhum campo é inventado.
-- =====================================================================
with cols as (
  select
    c.table_name,
    c.column_name,
    c.ordinal_position,
    c.is_nullable = 'YES'                                as nullable,
    c.column_default is not null
      or c.is_nullable = 'YES'
      or c.is_identity = 'YES'                           as tem_default,
    case
      when c.data_type in ('uuid','text','character varying','character',
                           'date','timestamp with time zone',
                           'timestamp without time zone','time','inet')  then 'string'
      when c.data_type in ('integer','bigint','smallint','numeric','real',
                           'double precision')                            then 'number'
      when c.data_type = 'boolean'                                        then 'boolean'
      when c.data_type in ('json','jsonb')                                then 'Json'
      when c.data_type = 'ARRAY'                                          then 'string[]'
      else 'unknown'
    end                                                  as ts_type
  from information_schema.columns c
  join information_schema.tables t
    on t.table_schema = c.table_schema and t.table_name = c.table_name
  where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
),
por_tabela as (
  select
    table_name,
    string_agg(format('          %s%s: %s%s',
        column_name,
        case when nullable then '' else '' end,
        ts_type,
        case when nullable then ' | null' else '' end),
      E'\n' order by ordinal_position)                    as linhas_row,
    string_agg(format('          %s%s: %s%s',
        column_name,
        case when tem_default then '?' else '' end,
        ts_type,
        case when nullable then ' | null' else '' end),
      E'\n' order by ordinal_position)                    as linhas_insert,
    string_agg(format('          %s?: %s%s',
        column_name, ts_type,
        case when nullable then ' | null' else '' end),
      E'\n' order by ordinal_position)                    as linhas_update
  from cols
  group by table_name
)
select
  '// Gerado por introspecção do schema em ' || to_char(now(),'YYYY-MM-DD HH24:MI') || E'.\n'
  || '// Substituir por `supabase gen types typescript` assim que a CLI estiver disponível.' || E'\n\n'
  || 'export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]' || E'\n\n'
  || 'export type Database = {' || E'\n'
  || '  public: {' || E'\n'
  || '    Tables: {' || E'\n'
  || string_agg(
       format(E'      %s: {\n        Row: {\n%s\n        }\n        Insert: {\n%s\n        }\n        Update: {\n%s\n        }\n      }',
              table_name, linhas_row, linhas_insert, linhas_update),
       E'\n' order by table_name)
  || E'\n    }' || E'\n'
  || '    Views: { [_ in never]: never }' || E'\n'
  || '    Functions: {' || E'\n'
  || '      create_organization: {' || E'\n'
  || '        Args: { p_name: string; p_slug: string; p_sap_client_number?: string | null }' || E'\n'
  || '        Returns: string' || E'\n'
  || '      }' || E'\n'
  || '      current_org_id: { Args: Record<string, never>; Returns: string }' || E'\n'
  || '      current_role: { Args: Record<string, never>; Returns: string }' || E'\n'
  || '    }' || E'\n'
  || '    Enums: { [_ in never]: never }' || E'\n'
  || '  }' || E'\n'
  || '}' || E'\n\n'
  || 'export type Tables<T extends keyof Database[''public''][''Tables'']> =' || E'\n'
  || '  Database[''public''][''Tables''][T][''Row'']' || E'\n'
  as database_types_ts
from por_tabela;
