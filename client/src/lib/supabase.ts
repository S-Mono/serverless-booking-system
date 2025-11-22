import { createClient } from '@supabase/supabase-js'

// 環境変数から読み込むのがベストですが、
// 学習用として今回はここに直接URLとキーを記述します。
// ※公開されるフロントエンドコードに含まれるため、
//   ここでは必ず「anon key (public key)」を使用してください。
//   「service_role key」は絶対に使わないでください。

const SUPABASE_URL = 'https://eughodyfziabqnqjozof.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_qDY4VNID27tOi9szso4HZA_GvYXeQJA'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)