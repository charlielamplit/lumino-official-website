const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const privacy = read('apps/site/Lumino 隐私与数据处理.dc.html');
const cookies = read('apps/site/Lumino Cookie 与本地存储.dc.html');
const licence = read('apps/site/Lumino 用户内容与数据许可.dc.html');
const shell = read('apps/site/site/site-shell.js');

test('privacy page identifies the operator, data scope, rights and contact channel', () => {
  assert.match(privacy, /上海铄垣环保科技有限公司/);
  assert.match(privacy, /信息类型/);
  assert.match(privacy, /你的权利/);
  assert.match(privacy, /contact@lumino\.tech/);
});

test('cookie notice records the current no-tracking position and consent triggers', () => {
  assert.match(cookies, /没有启用广告、跨站追踪、行为画像、会话回放或访问分析 Cookie/);
  assert.match(cookies, /lumino\.lang/);
  assert.match(cookies, /何时需要同意/);
});

test('content licence preserves customer ownership and excludes general model training', () => {
  assert.match(licence, /用户内容和原始业务数据继续归客户、提交方或相关权利人所有/);
  assert.match(licence, /通用模型训练/);
  assert.match(licence, /不得仅通过修改隐私页面获得授权/);
});

test('public footer links all three legal pages', () => {
  assert.match(shell, /Lumino%20隐私与数据处理\.dc\.html/);
  assert.match(shell, /Lumino%20Cookie%20与本地存储\.dc\.html/);
  assert.match(shell, /Lumino%20用户内容与数据许可\.dc\.html/);
});

test('published legal pages contain no draft placeholders or dead hash links', () => {
  for (const page of [privacy, cookies, licence]) {
    assert.doesNotMatch(page, /skeleton|待法务|待确认|href=["']#["']/i);
  }
});
