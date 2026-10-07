# Ionic Android 会员 App

本地开发可用一条命令同时启动前端（http://localhost:8100）和授权后端：

```powershell
npm run dev
```

先在 `server/.env` 配置 Token。启动前请停止原来的 `ionic serve` 和 `npm run start:api`，避免端口冲突。
按 Ctrl+C 会停止两个服务；其中一个退出时另一个也会停止。

范围为 requirementTraining.docx 的 Member app functions。会员 App 包含登录注册、首页、会员 QR、
钱包、奖励／优惠券、集点、交易历史、推荐、通知、门店、资料与反馈。没有加入 Web 产品、商家 POS 或 Admin Portal。
文档中的点餐／配送属于可选功能，目前不在实现范围。

## 开发与 Android 构建

```powershell
npm install
npm test -- --watch=false
npm run android:sync
npm run android:open
```

生产 Angular 构建输出到 `www`，Capacitor 同步到 `android`。
Android 工程使用 Java 21、SDK 36。Android Studio 中同步 Gradle 后可运行真机或生成 APK。
本机浏览器预览可以使用 `ionic serve`，它不是本次产品范围。

Android 原生网络通过 CapacitorHttp 调用 `https://xcodeappapi.xcode.com.my/api`，不依赖电脑上的
localhost 代理或 `server`。原来新增的 `server/` 保留作参考，当前 App 不使用它。
沒有模拟 OTP 或模拟会员数据。服务端 401、短信服务错误、未知响应格式都会按错误处理。
HTTP 200 正文包含 `(400) Bad Request` 时不会显示发送成功。

## 需求实现与验证边界

| 功能 | 实现与状态 |
| --- | --- |
| 手机登录 | RequestOTP → MemberMobileLoginGetProfile → GetMemberDetails。必须收到明确验证成功响应 |
| 手机注册 | RegisterOtp → 使用 FirstLogin 的 OTP 验证 → RegisterMember。注册参数没有 OTP；验证步骤语义需要 API 方确认 |
| 推荐码 | CheckReffererCodeValid，参数为 ReferralBy |
| Email 登录 | CheckEmailPassword，确认登录响应并获取对应手机号和会员资料 |
| 忘记密码 | RequestOTP → 验证 OTP → MemberResetPassword，不在验证码未验证时提交新密码 |
| 保持登录 | Android 启动后 KeepLoginUser，失败清除本地记录并回到登录页 |
| 设备推送注册 | 原生推送权限、FCM Token、UpdateDeviceId。需要 Firebase 配置及 API 接受 Token |
| 首页 | 真实会员资料、宣传 Banner、奖励目录，无固定用户或余额 |
| 会员 QR | 全屏 QR 页，目前用会员手机号作为内容；须确认柜台期望的格式 |
| 钱包 | 余额、积分、有效期、充值列表及详情 |
| Rewards／Vouchers | 目录、我的、详情；仅使用 API 明确提供的 QR 内容生成兑换码，不自行编造 |
| 集点 | Stamp list 与使用记录 |
| 历史 | 全部、充值、支付、积分、发集点、用集点、奖励、优惠券、消费分类 |
| 推荐 | 读取自己的推荐码、Android 分享、好友列表 |
| 通知 | 列表、详情、单条／全部已读、开启手机推送 |
| 门店 | 列表、GPS 权限、打开地图路线 |
| 个人资料 | Name、Email、生日、图片编辑；反馈发送及历史；登出 |
| 邮件验证 | GenerateMailOTP 已接；UpdateAccountVerify 的 Type 值及验证码检查方式未说明，尚未实现确认步骤 |
| 账户删除 | 当前只提供明确标为“停用”的操作；不能把 UpdateAccountStatusDeactive 宣称为完整删除 |
| 更新检查 | Android 启动获取 GetAllVersion，对比 AndroidVersionCode，版本落后显示不可直接关闭的更新提示 |

以上“已实现”表示页面和调用逻辑已经写好，不表示真实服务端或真机联调成功。
API 响应缺少文档的部分采用 PascalCase／camelCase 字段及 Data／Items／Results／Records 常见封装，
不认识的格式需要 API 的真实响应样本进行适配。
注册 FirstLogin 行为、Email 验证 Type、会员／奖励 QR、应用版本策略、反馈 Category 的允许值仍需确认。
App 的包名仍为项目默认 `io.ionic.starter`；发布前应设为实际包名，并与 Firebase、Play 商店条目一致。

## 推送配置

在 Firebase 创建与 Android applicationId 一致的 Android App，将该项目的
`google-services.json` 放到 `android/app/google-services.json`，将两个 environment 文件中的
`pushEnabled` 设为 true，再次运行 `npm run android:sync`。默认关闭此开关，防止缺少 Firebase 配置时原生插件出错。
当前未提供此文件，通知 Inbox 可以调用 API，但真机推送不能宣称已验证。
不要把 API 授权账号、密码或共享 Bearer Token 写进 Android App。

## 当前外部问题

RequestOTP 曾返回 401；Postman 另一次收到 HTTP 200，但正文为远端 `(400) Bad Request`。
这两类问题不能由页面代码保证修复。没有收到有效的实际登录／会员资料响应，
本次不会发短信、充值、兑换或删除真实账户来测试。

需求包括后端保管 API Token。当前按用户要求保留直连方式；如果 API 确实要求服务级 Token，
应由受控后端提供会员会话和权限检查后接入，不能把共享 Token 内置到 APK。

本地开发的手机号登录：点击 Get OTP 不发送短信，在 OTP 栏填写相同手机号即可查询该手机号的真实会员资料并进入首页。
该登录由 npm run dev 开启，仅供本机开发使用，需要有效后端 API Token；不再返回 Test Member。Email 登录仍连接真实账户。忘记密码与注册仍使用真实短信 OTP。
注册及忘记密码点击 Get OTP 后输入手机收到的验证码。
请先配置 server/.env 中的有效 Loyalty API 凭据，再运行 npm run dev。
密码重设通过本地网关的 MemberAccount/MemberResetPassword，必须有验证后的会员会话，目标手机号从会话取得。
