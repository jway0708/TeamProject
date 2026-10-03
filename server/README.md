# 本地 API 授权后端

浏览器开发代理现在将 `/api` 转发到 `http://127.0.0.1:3000`。
Token 放在 `server/.env` 的 `LOYALTY_API_TOKEN`，不要加 Bearer 前缀。
修改代理后必须重启 `npm start` 或 `ionic serve`，并同时运行 `npm run start:api`。
Email 登录 `CheckEmailPassword` 已支持，会建立 HttpOnly 会员会话。
Android 原生 App 仍使用外部 API；本次只接通浏览器本地开发。

需要 Node.js 22 或更新版本。使用 Node 内置模块，不需要新增 npm 依赖。

在项目根目录执行：

```powershell
Copy-Item server/.env.example server/.env
```

编辑 `server/.env`，填写 API 方提供的 `LOYALTY_USERNAME` 和 `LOYALTY_PASSWORD`。
也可以填写有效的 `LOYALTY_API_TOKEN`，但固定 Token 过期后需要手动更换。
如果同时填写，优先使用固定 Token。凭据只放在后端，不能放进 Angular environment 文件。

两个终端分别执行：

```powershell
npm run start:api
```

```powershell
npm start
```

浏览器打开 Angular 显示的地址（通常 http://localhost:4200），进入 `/login-page`。
开发代理将 `/api` 请求转发到 `127.0.0.1:3000`。发送 OTP 会实际触发短信，请使用自己的测试手机号。

后端使用 POST `/api/JWTToken/Post?UserName=...&Password=...` 获取 Token，支持原始 Token 字符串及
`token`、`accessToken`、`access_token`、`jwtToken`、`jwt`、`data` 字段（大小写不敏感）。
实际返回格式尚未通过有效凭据验证；格式不匹配会明确报错，需要按 API 方的响应样本调整。
Token 在服务器内存中缓存，并在到期前刷新。上游返回 401 时最多重新获取 Token 并重试一次。
超时及其他错误不会自动重发 OTP。Token 获取请求不会被转发给前端，OTP 响应中的验证码也会过滤。

开放登录、注册、OTP、推荐码，以及会话保护的 `MemberDetails/GetMemberDetails`。
真实登录成功后，后端设置 HttpOnly 会话 Cookie，有效期一小时，保存在服务器内存中；
后端重启会使会话失效。资料查询只使用会话中的手机号，不允许查询其他会员。
登录成功响应当前支持显式 `success: true` / `isSuccess: true`，或含匹配手机号的资料对象
（可放在 `data` 字段，字段大小写不敏感）；失败或未知格式不会建立会话。
真实 API 的登录成功格式没有用有效凭据验证，若格式不匹配，需要 API 方提供响应样本。
登录请求在后端按 Swagger 转换为 `Phone` / `OTP` 字段。注册接口没有 OTP 参数，
因此真实注册后需另外通过 OTP 登录才能建立资料查询会话；注册接口本身不会建立会话。
密码、设备 ID、上游 Token 不会包含在首页资料响应里。

Homepage 每次进入会查询当前登录会员的姓名、手机号、Email、等级、余额、积分、集点及推荐码。
读取失败会显示错误及重试按钮；没有登录或真实会话过期会返回登录页。
登录、注册和会员资料均使用真实 API。配置有效后端凭据并重启前后端，通过真实短信 OTP 登录。
本后端用于本机开发，不是完整的生产会员后端。

生产 Web 的 `apiBaseUrl` 为 `/api`，需要由部署平台将同域 `/api` 转发到这个后端。
部署前还需要持久化会话、OTP 频率限制及 HTTPS，并将 `SECURE_COOKIES=true`。Capacitor 原生 App 需要将 `apiBaseUrl`
设置为自己后端的 HTTPS 地址，并配置允许的 App Origin，不能使用设备上的 localhost。

验证授权逻辑（模拟上游，不发送短信）：

```powershell
npm run test:api
```

尚无有效凭据，因此测试通过不代表真实 OTP 已发送成功。现有生产构建的首页 SCSS 超预算问题与本次授权改动无关。
