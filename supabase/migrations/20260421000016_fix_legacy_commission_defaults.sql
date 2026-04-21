update public.user_commission_profiles
set
  creator_share_rate = 0.7000,
  platform_share_rate = 0.3000
where round(coalesce(creator_share_rate, 0)::numeric, 4) = 0.3000
  and round(coalesce(platform_share_rate, 0)::numeric, 4) = 0.7000;
