(function(){
  const nav=[
    ['services','/Lumino%20%E5%AE%98%E7%BD%91.dc.html#services','服务'],
    ['method','/Lumino%20%E5%AE%98%E7%BD%91.dc.html#method','我们如何工作'],
    ['platform','/Lumino%20%E5%B9%B3%E5%8F%B0.dc.html','平台'],
    ['knowledge','/knowledge/','知识库'],
    ['about','/Lumino%20%E5%85%B3%E4%BA%8E.dc.html','关于']
  ];
  const navLinks=current=>nav.map(([id,href,label])=>`<a href="${href}" ${id===current?'aria-current="page"':''}>${label}</a>`).join('');

  class LuminoHeader extends HTMLElement{
    connectedCallback(){
      const current=this.getAttribute('current')||'';
      const links=navLinks(current);
      this.innerHTML=`<a class="skip" href="#main">跳到主要内容</a>
        <header class="site-header">
          <div class="site-header__accent" aria-hidden="true"></div>
          <div class="site-header__row">
            <a class="brand-lockup" href="/" aria-label="Lumino 首页">
              <span class="logo">LUMINO</span>
              <span class="brand-discipline">COMPLIANCE<br>SERVICES</span>
            </a>
            <nav class="site-nav" aria-label="主导航">${links}</nav>
            <div class="header-actions">
              <a class="portal-entry" href="/portal/"><span>企业门户</span><b aria-hidden="true">↗</b></a>
              <a class="header-cta" href="/Lumino%20%E8%81%94%E7%B3%BB.dc.html">预约诊断</a>
              <button class="menu-button" type="button" aria-label="打开导航菜单" aria-expanded="false" aria-controls="site-mobile-nav"><span></span><span></span></button>
            </div>
          </div>
          <div class="mobile-nav-shell" data-open="false"><div><nav id="site-mobile-nav" class="mobile-nav" aria-label="移动导航">${links}<a href="/portal/">企业门户 ↗</a><a href="/Lumino%20%E8%81%94%E7%B3%BB.dc.html">预约诊断</a></nav></div></div>
        </header>`;
      const button=this.querySelector('.menu-button');
      const shell=this.querySelector('.mobile-nav-shell');
      const close=()=>{button.setAttribute('aria-expanded','false');button.setAttribute('aria-label','打开导航菜单');shell.dataset.open='false'};
      button.addEventListener('click',()=>{const open=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',open?'关闭导航菜单':'打开导航菜单');shell.dataset.open=String(open)});
      shell.addEventListener('click',event=>{if(event.target.closest('a'))close()});
      document.addEventListener('keydown',event=>{if(event.key==='Escape')close()});
    }
  }

  class LuminoFooter extends HTMLElement{
    connectedCallback(){
      this.innerHTML=`<footer class="site-footer"><div class="site-footer__inner"><div class="footer-brand"><a class="logo" href="/">LUMINO</a><p>企业绿色合规服务<br>AI 辅助 · 确定性计算 · 专家复核</p></div><nav class="footer-links" aria-label="页脚导航">${nav.map(([,href,label])=>`<a href="${href}">${label}</a>`).join('')}<a href="/Lumino%20%E8%81%94%E7%B3%BB.dc.html">联系我们</a><a href="/portal/">企业门户 ↗</a></nav><div class="copyright"><span>© 2026 Lumino</span><span>演示站中的企业、项目和数据均为原型示例。</span></div></div></footer>`;
    }
  }

  customElements.define('lumino-header',LuminoHeader);
  customElements.define('lumino-footer',LuminoFooter);
})();
