-- รันใน Supabase > SQL Editor > New query
begin;
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  customer_name text not null,
  phone text not null,
  address text not null,
  status text not null default 'pending' check (status in ('pending','confirmed','cancelled')),
  currency text not null default 'USD' check (currency = 'USD'),
  total_cents bigint not null check (total_cents >= 0),
  created_at timestamptz not null default now()
);
create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id integer not null check (product_id > 0),
  product_title text not null,
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  quantity integer not null check (quantity between 1 and 99),
  unique(order_id, product_id)
);
create index if not exists orders_created_at_idx on public.orders(created_at desc);
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
revoke all on public.orders, public.order_items from anon, authenticated;
grant all on public.orders, public.order_items to service_role;
grant usage, select on sequence public.order_items_id_seq to service_role;
-- บันทึกหัวคำสั่งซื้อและรายการพร้อมกัน และใช้ request_id ป้องกันการกดซ้ำ
create or replace function public.place_order(p_request_id uuid, p_customer jsonb, p_items jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare order_row public.orders; item jsonb; total bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  select * into order_row from public.orders where request_id = p_request_id;
  if found then return jsonb_build_object('id',order_row.id,'total_cents',order_row.total_cents,'status',order_row.status); end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 30 then raise exception 'Invalid items'; end if;
  select sum((value->>'unit_price_cents')::bigint * (value->>'quantity')::integer) into total from jsonb_array_elements(p_items);
  insert into public.orders(request_id,customer_name,phone,address,total_cents)
  values(p_request_id,p_customer->>'customer_name',p_customer->>'phone',p_customer->>'address',total) returning * into order_row;
  for item in select value from jsonb_array_elements(p_items) loop
    insert into public.order_items(order_id,product_id,product_title,unit_price_cents,quantity)
    values(order_row.id,(item->>'product_id')::integer,item->>'product_title',(item->>'unit_price_cents')::bigint,(item->>'quantity')::integer);
  end loop;
  return jsonb_build_object('id',order_row.id,'total_cents',order_row.total_cents,'status',order_row.status);
end $$;
revoke all on function public.place_order(uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.place_order(uuid,jsonb,jsonb) to service_role;
commit;
