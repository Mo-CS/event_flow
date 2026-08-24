# 04f — مخطط التتابع: المساعد الذكي (Chatbot Edge Function)

> **النمط في Eraser:** Sequence.
> **المرجع المعياري:** OMG UML 2.5.1 §17 — نمذجة حلقة tool-calling بكتلة loop، ومسار الفشل الاحتياطي fallback بكتلة alt.

## 1. الهدف الأكاديمي

أحدث عنصر تقني في المشروع (F8.1): Edge Function تعمل كوسيط آمن بين المستخدم ونموذج لغوي، مع **استدعاء أدوات** (tool-calling) تربط النموذج ببيانات حقيقية من قاعدة البيانات، و**بديل محلي** LM Studio عند فشل المزود السحابي — مثال على هندسة التسامح مع الأخطاء.

## 2. المشاركون

ChatWidget UI (useChat) · Edge Function `supabase/functions/chatbot` · JWT verification · RateLimiter · Postgres (سياق الفعاليات عبر service-role داخليًا) · OpenAI-compatible API · LM Studio المحلي.

## 3. الوصف الكامل

1. المستخدم يطرح سؤالًا («هل تبقى مقاعد في فعالية X؟»).
2. UI > EdgeFunction: POST {message, sessionId} مع JWT في الترويسة.
3. **المصادقة والحد:** التحقق من JWT + حد معدل لكل مستخدم.
4. بناء السياق:
   - استخراج نية السؤال → اختيار الأدوات المتاحة: get_event_info / get_registration_status / list_upcoming_events.
5. **loop حتى إجابة نهائية أو حد دورات:**
   - إرسال الرسائل+تعريف الأدوات إلى مزود OpenAI-compatible.
   - alt رد بأداة مطلوبة → تنفيذها داخليًا (استعلامات محددة النطاق فقط) → إرجاع النتيجة للنموذج كرسالة tool result → تكرار.
   - alt رد نصي نهائي → خروج من الحلقة.
6. **alt فشل المزود السحابي (شبكة/مفتاح/حصة):**
   - تحويل الطلب إلى LM Studio المحلي (نفس بروتوكول OpenAI) بدون أدوات متقدمة (إجابة عامة من السياق المجمع).
7. تسجيل التفاعل audit (بدون محتوى حساس) وإعادة الإجابة للمستخدم مع مؤشر انتهاء.
8. أمان: service-role key لا يغادر الخادم؛ الاستعلامات مقيّدة بدوال مساعدة صريحة وليس SQL حر من النموذج.

## 4. كود Eraser

```eraser
title Chatbot Sequence - tool calling with local fallback

participant UserUI [icon: browser]
participant EdgeFn [icon: server]
participant Guard [icon: shield]
participant Db [icon: database]
participant CloudLLM [icon: cloud]
participant LocalLLM [icon: cpu]

UserUI > EdgeFn: POST message plus session with JWT
EdgeFn > Guard: verify JWT and rate limit per user
Guard > EdgeFn: ok

EdgeFn > Db: context queries via helper functions only
Db > EdgeFn: event data snapshot

loop until final answer or max turns
  EdgeFn > CloudLLM: chat completions with tools schema
  alt model requests a tool {
    CloudLLM > EdgeFn: tool_call name arguments
    EdgeFn > Db: execute whitelisted query
    Db > EdgeFn: rows
    EdgeFn > CloudLLM: tool result message
  } else final text {
    CloudLLM > EdgeFn: answer content
  }
end

opt cloud provider failed network quota key {
  EdgeFn > LocalLLM: same prompt without tools to LM Studio
  LocalLLM > EdgeFn: generic answer from gathered context
}

EdgeFn > UserUI: assistant reply plus done indicator
EdgeFn > Guard: audit log interaction metadata
```

## 5. نقاط النقاش أمام اللجنة

1. **لماذا Edge Function وسيطًا؟** إخفاء مفاتيح المزودين ومنع النموذج من SQL حر — سطح هجوم أصغر.
2. **Tool-calling مقابل RAG:** اخترنا أدوات استعلام محددة لأن البيانات مهيكلة علائقيًا؛ اشرح أن الدقة أعلى من تضمين نصي.
3. **Fallback المحلي:** توافر الخدمة يبقى حتى بلا إنترنت سحابي — نقطة قوية أمام لجنة «ماذا لو فشل المزود؟».
4. **حد الدورات max turns** يمنع الحلقات اللانهائية وتكاليف غير محدودة — وعي هندسي موثق.
