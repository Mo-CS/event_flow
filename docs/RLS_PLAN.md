# خطة RLS — الخطة الأولى: هوية حقيقية لكل طلب (JWT من قاعدة البيانات)

> الهدف: إغلاق الثغرة التي تسمح لأي شخص يملك `VITE_SUPABASE_ANON_KEY` بتعديل أو حذف بيانات النظام، **دون تغيير أي شيء في تجربة المستخدم**: نفس صفحة الدخول، نفس الأزرار، نفس الصفحات.

---

## 1) لماذا هذه الخطة؟

النظام يستخدم مصادقة مخصّصة (جدول `users` + جلسات في `device_sessions`) مع مفتاح `anon`. مدير PostgREST لا يعرف من هو المستخدم، لذلك كانت كل سياسات RLS مكتوبة `using (true)` — أي أن القاعدة تسمح للجميع بكل شيء.

الخطة الأولى تعطي القاعدة هوية موثوقة:

1. دالة `authenticate_user` (وهي `security definer`) تصدر **JWT موقّعًا داخل PostgreSQL** بعد التحقق من كلمة المرور.
2. التطبيق يرسل هذا الـ JWT في ترويسة `Authorization` بدل مفتاح `anon`.
3. PostgREST يتحقق من التوقيع، فتصبح `auth.uid()` معرّف المستخدم الحقيقي، ويصبح الدور متاحًا في السياسات.

النتيجة:

| الطرف | قبل | بعد |
|---|---|---|
| زائر غير مسجّل | يقرأ ويكتب ويحذف كل شيء | يقرأ الكتالوج العام فقط |
| مستخدم مسجّل | يكتب في كل الجداول | يكتب في بياناته ودوره فقط |
| منظّم | كل شيء | فعالياته وحضورها وتقييماتها |
| مدير | كل شيء | كل شيء (كما هو متوقع) |

الخطتان الأخريان (بوابة Vite محلية، أو الانتقال إلى Supabase Auth) لم تُعتمدا: الأولى تعمل في التطوير فقط، والثانية تتطلب ترحيل كل كلمات المرور إلى `auth.users` وتغيير تجربة الدخول.

---

## 2) ما لا يتغيّر

- شاشة الدخول والتسجيل واستعادة كلمة المرور.
- الجلسات الحالية في `device_sessions` و`localStorage`.
- كل صفحات الواجهة العامة ولوحة التحكم.
- شكل ردود دوال المصادقة (`user`, `profile`, `role`) — يُضاف إليها حقل `access_token` فقط.

---

## 3) المتطلبات

1. الوصول إلى **SQL Editor** في مشروع Supabase.
2. **JWT Secret** الخاص بالمشروع:
   `Project Settings → API → JWT Settings → JWT Secret`
   في تشغيل محلي عبر `supabase start` القيمة الافتراضية:
   `super-secret-jwt-token-with-at-least-32-characters-long`

> لا تضف أي متغيّر بيئة جديد إلى الواجهة. السر يبقى داخل قاعدة البيانات فقط.

---

## 4) الخطوة 1: إصدار الهوية

### 4.1 نفّذ الملف

```
supabase/migrations/2026-11-15_rls_step1_identity.sql
```

هذا الملف **لا يغيّر أي سياسة**، لذلك لا يمكن أن يكسر التطبيق. يضيف:

- مخطط `app_private` مغلق تمامًا أمام الـ API، ويحفظ السر.
- `app_issue_jwt(...)` لتوقيع التوكن (HS256 عبر `pgcrypto`).
- `public.whoami()` للتحقق.
- إعادة تعريف `authenticate_user` و`get_session_user` و`register_user` بحيث تعيد `access_token` إضافيًا.

### 4.2 احفظ السر

```sql
insert into app_private.settings (key, value)
values ('jwt_secret', 'الصق-JWT-Secret-هنا')
on conflict (key) do update
  set value = excluded.value, updated_at = now();
```

### 4.3 تحقّق أن التوقيع يعمل

```sql
select public.app_issue_jwt(gen_random_uuid(), 'attendee', 'test@example.com') is not null;
-- يجب أن يعيد: true
```

### 4.4 شغّل التطبيق ثم تحقّق من الهوية

```powershell
npm run dev
```

سجّل الدخول، ثم من Console المتصفح:

```js
await window.supabase?.rpc?.("whoami")
```

أو مباشرة بعد الدخول جرّب في SQL Editor:

```sql
select public.whoami();
```

وأفضل تحقق عملي: افتح Console في المتصفح بعد تسجيل الدخول ونفّذ:

```js
const { data, error } = await (await import("/src/lib/supabase.ts")).supabase.rpc("whoami")
console.log({ data, error })
```

**المطلوب:** `data.user_id` يساوي معرّف المستخدم، و`data.app_role` يساوي دوره، و`data.db_role` يساوي `authenticated`.

إذا ظهر `error` أو بقي `db_role = anon`، **لا تنفّذ الخطوة 2**. راجع القسم 7.

---

## 5) الخطوة 2: تفعيل السياسات

بعد نجاح 4.4 فقط:

```
supabase/migrations/2026-11-15_rls_step2_policies.sql
```

ماذا يفعل:

1. يحذف **كل** السياسات القديمة `using (true)`.
2. يفعّل RLS على 47 جدولًا.
3. يسحب كل صلاحيات الكتابة من `anon` ويمنحه القراءة العامة فقط.
4. ينشئ سياسات حسب الدور والملكية.

### المصفوفة المختصرة

| المجموعة | قراءة anon | الكتابة |
|---|---|---|
| `events`, `categories`, `venues`, `roles`, `currencies`, `speakers`, `sessions`, `files`, `app_settings`, `email_templates` | نعم | حسب الدور |
| `profiles`, `event_organizers`, `registrations`, `evaluations`, `evaluation_questions`, `evaluation_submissions`, `evaluation_answers`, `feedback`, `invitation_links` | نعم | حسب الدور |
| `users`, `notifications`, `tickets`, `attendance`, `device_sessions`, `chat_*`, `meeting_*` | لا | المستخدم المسجّل / صاحب السجل |
| `event_costs`, `event_requests`, `ban_revoke_requests` | لا | حسب الملكية أو الدور |
| `funding_sources`, `expenses`, `fund_transfers` | لا | قراءة للمنظّم والمدير؛ طلب مصروف للمنظّم؛ اعتماد/تعديل للمدير |
| `user_bans` | لا | قراءة للمنظّم والمدير وصاحب الحظر؛ طلب حظر `pending` للمنظّم؛ اعتماد/تعديل للمدير |
| `audience_contacts` | لا | المدير، أو حامل `view`/`edit`، أو صاحب البريد نفسه (مزامنة التسجيل) |
| `audience_access_grants` | لا | قراءة للمدير ولصاحب المنحة؛ الكتابة للمدير |
| `email_campaigns`, `email_campaign_recipients` | لا | المدير أو حامل `can_send` |
| `admin_messages*`, `password_reset_requests`, `audit_logs` | لا | `admin` |
| `password_otp_codes`, `password_reset_tokens`, `auth_attempts` | لا | لا شيء (دوال `security definer` فقط) |

### دوال السياسات

| الدالة | المعنى |
|---|---|
| `app_is_authenticated()` | يوجد JWT صالح |
| `app_role()` | `admin` / `organizer` / `attendee` / `anon` |
| `app_is_admin()` | الدور مدير |
| `app_is_staff()` | مدير أو منظّم |
| `app_owns_event(uuid)` | الفعالية له (أو `manages_all_events` أو مدير) |
| `app_owns_profile(uuid)` | البروفايل له |
| `app_owns_registration(uuid)` | التسجيل له |
| `app_owns_ticket(uuid)` | التذكرة له |
| `app_email()` | بريد صاحب الطلب من التوكن |
| `app_audience_can(text)` | منحة جمهور فعّالة: `view` / `edit` / `send` |
| `app_promote_waitlist(uuid, text)` | ترقية أول منتظر (للمنظّم/المدير) |
| `app_cancel_registration(uuid)` | إلغاء التسجيل لصاحبه أو للإدارة + ترقية تلقائية |

### ترقية قائمة الانتظار

ترقية المنتظر تتطلب الكتابة على تسجيل مستخدم آخر وإنشاء تذكرته، وهذا ما تمنعه
سياسات الملكية على حساب المشارك. لذلك انتقلت الكتابة إلى دالة `security definer`:

- `app_private.promote_first_waitlisted(event_id, mode)` — الترقية الفعلية وإنشاء التذكرة.
- `public.app_promote_waitlist(event_id, mode)` — للمنظّم/المدير فقط (حذف تسجيل، ترقية يدوية).
- `public.app_cancel_registration(registration_id)` — للمشارك صاحب التسجيل أو للإدارة؛
  تلغي ثم ترقّي أول منتظر تلقائيًا عند تحرير مقعد مؤكد.

يبقى إرسال الإشعار والبريد في `eventService` كما هو، فالمستخدم يرى نفس الرسالة ونفس
التذكرة. وإذا لم تكن الدوال موجودة بعد، يعود العميل تلقائيًا إلى المسار القديم.

---

## 6) قائمة تحقق بعد التطبيق

بعد تنفيذ الخطوة 2، اختبر الثلاثة أدوار:

**زائر (نافذة خاصة بلا تسجيل دخول)**

- [ ] الصفحة الرئيسية وقائمة الفعاليات وتفاصيل فعالية تظهر.
- [ ] عدّاد المقاعد المعروض صحيح.
- [ ] لا يمكن تنفيذ أي إدخال/تعديل/حذف (يفشل بـ `401` أو `permission denied`).

**مشارك**

- [ ] تسجيل الدخول والتسجيل في فعالية والحصول على تذكرة.
- [ ] إلغاء التسجيل، إرسال تقييم، إرسال ملاحظة.
- [ ] الإشعارات تعمل، وتعديل الملف الشخصي يعمل.
- [ ] لا يستطيع رؤية إشعارات أو تذاكر شخص آخر.

**منظّم**

- [ ] إنشاء فعالية وتعديلها وإضافة منظمين.
- [ ] إدارة التسجيلات والحضور والتذاكر.
- [ ] التقييمات والتكاليف والدعوات.
- [ ] المالية: قراءة الصناديق والمصروفات وطلب مصروف جديد.
- [ ] الحظر: إنشاء طلب حظر `pending` ورؤية قائمة الحظر.
- [ ] لا يستطيع الوصول إلى المستخدمين أو الحملات أو البث أو إعدادات النظام.

**مدير**

- [ ] إدارة المستخدمين والأدوار والأقسام والأماكن.
- [ ] المالية والجمهور والحملات والرسائل والبث.
- [ ] سجل التدقيق والإعدادات.

### استعلام فحص سريع

```sql
-- هل ما زالت هناك سياسة متسامحة؟
select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and (qual = 'true' or with_check = 'true')
order by tablename;
```

النتيجة المتوقعة: فقط جداول القراءة العامة (`select` مع `true`)، ولا وجود لأي `INSERT`/`UPDATE`/`DELETE` بـ `true`.

```sql
-- هل ما زال anon يملك الكتابة؟
select table_name, privilege_type
from information_schema.role_table_grants
where grantee = 'anon'
  and table_schema = 'public'
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
order by table_name;
```

النتيجة المتوقعة: صفر صفوف.

---

## 7) عند وجود مشكلة

| العَرَض | السبب | الحل |
|---|---|---|
| كل الطلبات تفشل بعد الخطوة 1 | السر غير مطابق لسر المشروع | صحّح `app_private.settings` وأعد تشغيل التطبيق |
| `whoami` يعيد `user_id: null` | التوكن لم يُرفق | تأكد أن `src/lib/supabase.ts` يستخدم `authFetch` |
| `whoami` يعيد `db_role: anon` | `role` claim غير صحيح | نفّذ الخطوة 1 مرة أخرى |
| الدخول يعمل لكن البيانات فارغة | JWT سليم لكن السياسات لا تطابق الدور | راجع `app_role` في `whoami` |
| `permission denied for table ...` | صلاحية جدول ناقصة | نفّذ `grant ... to authenticated` من الخطوة 2 |
| خطأ `function auth.uid() does not exist` | تشغيل خارج Supabase | هذه الملفات لمشروع Supabase فقط |

> في التطوير، إن رفض PostgREST التوكن، يكتب `authService` تحذيرًا في الـ Console ويسقط تلقائيًا إلى الوضع المجهول، فيبقى التطبيق يعمل.

---

## 8) الرجوع للخلف

الرجوع الكامل موجود كقسم معلّق في نهاية ملف الخطوة 2. انسخه ونفّذه ليُعيد سياسات `using (true)` السابقة.

على الأقل، لإعادة الكتابة للمجهول مؤقتًا:

```sql
grant insert, update, delete on all tables in schema public to anon;
```

ثم أعد تشغيل سياسات الخطوة 2 بعد إصلاح السبب.

---

## 9) قيود معروفة (بصراحة)

1. **القراءة العامة لم تتغيّر**: صفحات الفعاليات العامة تعرض عدّاد المسجّلين، لذلك بقي `select` على `registrations` متاحًا للزائر. تقييده يتطلب دالة إحصاء `security definer` وتعديل `eventService`.
2. **`profiles` و`invitation_links`** تُقرأ من الزائر لأن صفحات الفعالية وروابط الدعوة تحتاجها. تقييدها يحتاج دوال RPC مخصّصة.
3. **`users` للمستخدمين المسجّلين**: أي مستخدم مسجّل يمكنه قراءة عمود `email` (وليس `password_hash`)، لأن شاشات المنظّم تعرض بريد المسجّلين.
4. **التوكن صالح 12 ساعة** ولا يُبطَل فورًا عند تسجيل الخروج (يُبطَل عمليًا عند إعادة التحميل لأن `get_session_user` لا يعيد إصداره). لتقصير المدة:
   ```sql
   -- في authenticate_user و get_session_user و register_user
   public.app_issue_jwt(..., interval '1 hour')
   ```
5. **`device_sessions`**: إنشاء الجلسة أصبح يتطلب مستخدمًا مسجّلًا (`user_id = auth.uid()`)، وهو ما يحدث بعد الدخول مباشرة، فلا أثر على المستخدم.

هذه النقاط موثّقة كخطوة تالية، وليست ثغرات كتابة: **لا يوجد أي مسار يسمح لغير المسجّل بالتعديل أو الحذف**.
