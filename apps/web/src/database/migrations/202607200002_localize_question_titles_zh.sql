-- The beta ships with a Chinese interface. Keep curriculum titles in the same
-- language so existing databases do not show English skill names in Chinese UI.
update public.questions
set
  title = case content_key
    when 'stg-7day-v1-day-1' then '结论先行'
    when 'stg-7day-v1-day-2' then '分类表达'
    when 'stg-7day-v1-day-3' then '完整案例'
    when 'stg-7day-v1-day-4' then '事实证据'
    when 'stg-7day-v1-day-5' then '冲突处理'
    when 'stg-7day-v1-day-6' then '向上沟通'
    when 'stg-7day-v1-day-7' then '最终自我推荐'
    else title
  end,
  updated_at = timezone('utc', now())
where content_key in (
  'stg-7day-v1-day-1',
  'stg-7day-v1-day-2',
  'stg-7day-v1-day-3',
  'stg-7day-v1-day-4',
  'stg-7day-v1-day-5',
  'stg-7day-v1-day-6',
  'stg-7day-v1-day-7'
);

-- Existing beta profiles must not keep producing English feedback inside the
-- Chinese interface. A future English product version will use its own locale.
update public.user_profiles
set
  preferred_answer_language = 'zh',
  updated_at = timezone('utc', now())
where preferred_answer_language <> 'zh';
