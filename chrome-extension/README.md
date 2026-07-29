# افزونه Instagram CRM Lead

این افزونه Chrome (Manifest V3) شماره‌های تلفن موجود در صفحات اینستاگرام را
هایلایت می‌کند. کاربر پس از ورود به CRM می‌تواند با کلیک روی شماره، اطلاعات
مشتری را تکمیل و یک Lead ثبت کند. فهرست Leadهای ثبت‌شده نیز در پنجره افزونه
نگهداری می‌شود.

## نصب برای توسعه

1. در Chrome آدرس `chrome://extensions` را باز کنید.
2. گزینه **Developer mode** را فعال کنید.
3. روی **Load unpacked** بزنید و پوشه `chrome-extension` را انتخاب کنید.
4. پنجره افزونه را باز کرده و در «تنظیم اتصال API»، آدرس و endpointهای CRM را
   وارد کنید.
5. وارد CRM شوید و سپس یک صفحه اینستاگرام را باز یا refresh کنید.

## قرارداد پیش‌فرض API

چون مستندات CRM در این مخزن وجود ندارد، endpointها از رابط افزونه قابل تنظیم
هستند. قرارداد پیش‌فرض به شکل زیر است:

### ورود

```http
POST {baseUrl}/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "..."
}
```

فیلد ورود را می‌توان از `email` به `username` تغییر داد. افزونه توکن را در یکی
از مسیرهای زیر تشخیص می‌دهد:

- `access_token`
- `accessToken`
- `token`
- `data.access_token`
- `data.token`

توکن فقط در `chrome.storage.session` نگهداری می‌شود و در درخواست‌های بعدی به
شکل `Authorization: Bearer <token>` ارسال می‌شود.

### ثبت Lead

```http
POST {baseUrl}/leads
Authorization: Bearer <token>
Content-Type: application/json

{
  "customer_id": "...",
  "instagram_id": "...",
  "customer_name": "...",
  "subject": "...",
  "city": "...",
  "phone": "...",
  "source": "instagram",
  "instagram_url": "https://www.instagram.com/..."
}
```

### فهرست Leadهای کاربر

```http
GET {baseUrl}/leads?mine=1
Authorization: Bearer <token>
```

پاسخ فهرست می‌تواند یک آرایه مستقیم، `data` یا `leads` باشد. افزونه نسخه محلی
Leadهایی را که خودش ثبت کرده نگه می‌دارد؛ بنابراین حتی اگر endpoint فهرست CRM
پیاده‌سازی نشده باشد، این موارد قابل مشاهده‌اند.

## نکات فنی

- شماره‌های فارسی، عربی و لاتین با طول ۱۰ تا ۱۵ رقم پشتیبانی می‌شوند.
- هایلایت با CSS Custom Highlight API انجام می‌شود و DOM اینستاگرام را تغییر
  نمی‌دهد.
- رمز عبور ذخیره نمی‌شود.
- دسترسی دامنه‌ها به‌صورت گسترده تعریف شده تا آدرس CRM قابل تنظیم باشد. برای
  انتشار عمومی بهتر است دامنه قطعی CRM در `host_permissions` جایگزین شود.
