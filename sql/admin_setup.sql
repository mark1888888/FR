-- ============================================================
-- FlowRich 管理後台 — Supabase SQL 設定
-- 請在 Supabase Dashboard → SQL Editor 中執行以下語句
-- ============================================================

-- ============================================================
-- 1. get_all_user_data()
--    取得所有使用者資料（僅限管理員呼叫）
--    此函式使用 SECURITY DEFINER，以便存取 auth.users 表
--    管理員白名單寫在函式內部，與前端保持一致
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_all_user_data()
RETURNS TABLE (
  user_id   uuid,
  email     text,
  data      jsonb,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_email text;
BEGIN
  -- 取得呼叫者的 email
  SELECT au.email INTO caller_email
    FROM auth.users au
   WHERE au.id = auth.uid();

  -- 檢查是否為管理員
  IF caller_email IS NULL OR caller_email NOT IN ('mark800413@gmail.com') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- 回傳所有使用者資料，關聯 auth.users 以取得 email
  RETURN QUERY
    SELECT
      ud.user_id,
      au.email::text,
      ud.data,
      ud.updated_at
    FROM public.user_data ud
    JOIN auth.users au ON au.id = ud.user_id
    ORDER BY ud.updated_at DESC;
END;
$$;

-- 授予已驗證使用者執行權限（函式內部會再做管理員檢查）
GRANT EXECUTE ON FUNCTION public.get_all_user_data() TO authenticated;


-- ============================================================
-- 2. admin_delete_user(target_user_id uuid)
--    刪除指定使用者的資料及帳號（僅限管理員呼叫）
--    會同時刪除 user_data 表中的資料與 auth.users 中的帳號
--    注意：刪除 auth.users 需要 SECURITY DEFINER 權限
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_email text;
BEGIN
  -- 取得呼叫者的 email
  SELECT au.email INTO caller_email
    FROM auth.users au
   WHERE au.id = auth.uid();

  -- 檢查是否為管理員
  IF caller_email IS NULL OR caller_email NOT IN ('mark800413@gmail.com') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- 防止管理員刪除自己
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION '無法刪除自己的帳號';
  END IF;

  -- 先刪除 user_data 中的記錄
  DELETE FROM public.user_data WHERE user_data.user_id = target_user_id;

  -- 再刪除 auth.users 中的帳號
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

-- 授予已驗證使用者執行權限（函式內部會再做管理員檢查）
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;


-- ============================================================
-- 使用說明：
-- 1. 登入 Supabase Dashboard (https://app.supabase.com)
-- 2. 選擇你的專案
-- 3. 前往左側選單 → SQL Editor
-- 4. 將以上所有 SQL 貼入編輯器
-- 5. 點擊「Run」執行
-- 6. 執行成功後即可使用 admin.html 管理後台
--
-- 注意事項：
-- - 若需新增管理員，請同時修改兩個地方：
--   (a) admin.html 中的 ADMIN_EMAILS 陣列
--   (b) 本 SQL 檔中兩個函式內的 IN (...) 白名單
-- - SECURITY DEFINER 函式會以建立者的權限執行，
--   因此能存取 auth.users 表。請確保只有管理員能呼叫。
-- - admin_delete_user 會同時刪除使用者資料與帳號，此操作無法復原。
-- ============================================================
