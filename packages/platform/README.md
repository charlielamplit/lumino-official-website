# @lumino/platform

生产平台的供应商无关契约。当前只包含 #25 的服务端身份、租户和对象授权边界，不包含真实 IdP、数据库或对象存储实现。

`ServerAuthorityBoundary` 只接受会话引用和客户端定位 hint；用户、活动租户、角色、年度项目、对象及 revision 均由注入的服务端 Provider / Repository 重建。

```bash
npm test
```

生产接入门禁见 `docs/contracts/platform-authority-boundary-v1.md`。
