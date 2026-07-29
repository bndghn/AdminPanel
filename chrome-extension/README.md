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

پیاده‌سازی بر اساس
[مستندات Worksuite API](https://documenter.getpostman.com/view/147520/2sA3kPq5NZ)
انجام شده است. آدرس نصب CRM از رابط افزونه قابل تنظیم است.

### ورود

```http
POST {baseUrl}/api/v1/auth/login
X-Requested-With: XMLHttpRequest
Content-Type: application/x-www-form-urlencoded

email=user%40example.com&password=...
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
POST {baseUrl}/api/v1/lead
Authorization: Bearer <token>
X-Requested-With: XMLHttpRequest
Content-Type: application/x-www-form-urlencoded

client_name=...
&client_email=...
&mobile=...
&city=...
&company_name=...
&website=https%3A%2F%2Fwww.instagram.com%2F...
&customer_id=...
&instagram_id=...
&subject=...
```

طبق مستندات، `client_name` و `client_email` فیلدهای اصلی ساخت Lead هستند.
فیلدهای افزونه به فیلدهای استاندارد Worksuite نیز نگاشت می‌شوند:

- نام مشتری ← `client_name`
- ایمیل مشتری ← `client_email`
- شماره تلفن ← `mobile`
- شهر ← `city`
- موضوع درخواست ← `company_name`
- آدرس صفحه اینستاگرام ← `website`

`customer_id`، `instagram_id` و `subject` نیز همراه درخواست ارسال و در نسخه
محلی افزونه نگهداری می‌شوند. پذیرش مستقیم این سه فیلد به تنظیمات/فیلدهای سفارشی
نصب Worksuite بستگی دارد.

### فهرست Leadهای کاربر

```http
GET {baseUrl}/api/v1/lead
Authorization: Bearer <token>
X-Requested-With: XMLHttpRequest
```

افزونه فقط Leadهایی را در بخش «سرنخ‌های من» نشان می‌دهد که از خود افزونه ثبت
شده‌اند. پاسخ فهرست CRM برای به‌روزرسانی همین رکوردهای محلی استفاده می‌شود و
Leadهای سایر کاربران به این بخش اضافه نمی‌شوند.

## نکات فنی

- شماره‌های فارسی، عربی و لاتین با طول ۱۰ تا ۱۵ رقم پشتیبانی می‌شوند.
- هایلایت با CSS Custom Highlight API انجام می‌شود و DOM اینستاگرام را تغییر
  نمی‌دهد.
- رمز عبور ذخیره نمی‌شود.
- دسترسی دامنه‌ها به‌صورت گسترده تعریف شده تا آدرس CRM قابل تنظیم باشد. برای
  انتشار عمومی بهتر است دامنه قطعی CRM در `host_permissions` جایگزین شود.
