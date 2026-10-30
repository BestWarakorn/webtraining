-- รันหลัง schema.sql ใน SQL Editor (คำสั่งซื้อเดิมยังอยู่ แต่ไม่มีเจ้าของจึงไม่แสดงในบัญชีใหม่)
begin;
alter table public.orders add column if not exists user_id uuid references auth.users(id) on delete set null;
create index if not exists orders_user_created_idx on public.orders(user_id,created_at desc);
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
grant select on public.orders, public.order_items to authenticated;
drop policy if exists orders_owner_read on public.orders;
create policy orders_owner_read on public.orders for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists order_items_owner_read on public.order_items;
create policy order_items_owner_read on public.order_items for select to authenticated using (exists (select 1 from public.orders where orders.id=order_items.order_id and orders.user_id=(select auth.uid())));
-- ปิด function เก่าที่สร้างคำสั่งซื้อโดยไม่มีเจ้าของ
revoke all on function public.place_order(uuid,jsonb,jsonb) from public, anon, authenticated, service_role;
create or replace function public.place_user_order(p_user_id uuid,p_request_id uuid,p_customer jsonb,p_items jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare order_row public.orders; item jsonb; total bigint;
begin
  if p_user_id is null then raise exception 'User required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select * into order_row from public.orders where request_id=p_request_id;
  if found then
    if order_row.user_id is distinct from p_user_id then raise exception 'Request belongs to another user'; end if;
    return jsonb_build_object('id',order_row.id,'total_cents',order_row.total_cents,'status',order_row.status);
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 30 then raise exception 'Invalid items'; end if;
  select sum((value->>'unit_price_cents')::bigint*(value->>'quantity')::integer) into total from jsonb_array_elements(p_items);
  insert into public.orders(user_id,request_id,customer_name,phone,address,total_cents)
  values(p_user_id,p_request_id,p_customer->>'customer_name',p_customer->>'phone',p_customer->>'address',total) returning * into order_row;
  for item in select value from jsonb_array_elements(p_items) loop
    insert into public.order_items(order_id,product_id,product_title,unit_price_cents,quantity)
    values(order_row.id,(item->>'product_id')::integer,item->>'product_title',(item->>'unit_price_cents')::bigint,(item->>'quantity')::integer);
  end loop;
  return jsonb_build_object('id',order_row.id,'total_cents',order_row.total_cents,'status',order_row.status);
end $$;
revoke all on function public.place_user_order(uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.place_user_order(uuid,uuid,jsonb,jsonb) to service_role;
commit;
