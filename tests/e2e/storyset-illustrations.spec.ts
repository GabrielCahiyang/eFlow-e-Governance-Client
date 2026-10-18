import { test, expect } from '@playwright/test';
import { projectWorkspaceFixture } from './fixtures/projectWorkspace';

const illustrations = [
  ['empty','bro'],['search','rafiki'],['inbox','pana'],['projects','amico'],['tasks','cuate'],
  ['complete','rafiki'],['files','bro'],['chat','cuate'],['people','pana'],['budget','amico'],
];
test.setTimeout(120_000);

test('every illustration animates its layers and becomes still with reduced motion',async({page})=>{
  for (const [kind,style] of illustrations) {
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.goto(`/illustrations/storyset/${kind}-${style}.svg`);
    const layers=page.locator('g[class*="motion-"]');
    expect(await layers.count()).toBeGreaterThan(0);
    const animated=await layers.evaluateAll(elements=>elements.map(e=>getComputedStyle(e).transform));
    await page.waitForTimeout(220);
    expect(await layers.evaluateAll(elements=>elements.map(e=>getComputedStyle(e).transform))).not.toEqual(animated);
    await page.emulateMedia({reducedMotion:'reduce'});
    expect(await layers.evaluateAll(elements=>elements.every(e=>getComputedStyle(e).animationName==='none'))).toBe(true);
    const still=await page.request.get(`/illustrations/storyset/${kind}-${style}.still.svg`);
    expect(still.ok()).toBe(true);
    expect(await still.text()).not.toMatch(/<style|<script|<foreignObject|\banimation:/);
  }
});

test('application selects still artwork when reduced motion is requested',async({page})=>{
  await projectWorkspaceFixture(page,'member',false,{landingOnly:true,empty:true});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/my-work?page=Assigned%20work');
  const illustration=page.locator('img.eflow-empty-illustration').first();
  await expect(illustration).toBeVisible();
  await expect.poll(()=>illustration.evaluate((e:HTMLImageElement)=>e.currentSrc)).toMatch(/\.still\.svg$/);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await expect.poll(()=>illustration.evaluate((e:HTMLImageElement)=>e.currentSrc)).toMatch(/(?<!\.still)\.svg$/);
});

test('the complete set has varied drawings, fits its frames and animates as images',async({page},info)=>{
  await page.setViewportSize({width:1440,height:920});
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.route('**/__storyset-preview',route=>route.fulfill({contentType:'text/html',body:`
    <html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;padding:44px;background:#f5f9f9;color:#173535;font-family:Arial,sans-serif}
    h1{font-size:28px;margin:0 0 8px}p{color:#526a6a;margin:0 0 30px}.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:18px}
    figure{margin:0;border:1px solid #d8e6e5;border-radius:18px;padding:20px 12px;background:white;text-align:center}
    img{width:208px;height:220px;object-fit:contain;max-width:100%}figcaption{font-size:15px;font-weight:600}small{display:block;color:#526a6a;margin-top:6px;font-size:12px}
    a{display:block;margin-top:24px;font-size:12px;color:#0c6f6b}
    </style></head><body><h1>eFlow · Animated empty states</h1><p>Different moments, different drawings. One eFlow palette.</p>
    <div class="grid">${illustrations.map(([kind,style])=>`<figure><img src="/illustrations/storyset/${kind}-${style}.svg" alt=""><figcaption>${kind[0].toUpperCase()+kind.slice(1)}</figcaption><small>${style[0].toUpperCase()+style.slice(1)}</small></figure>`).join('')}</div>
    <a href="https://storyset.com/">Illustrations by Storyset</a></body></html>`}));
  await page.goto('/__storyset-preview');
  await expect.poll(()=>page.locator('img').evaluateAll(elements=>elements.every(e=>(e as HTMLImageElement).complete&&(e as HTMLImageElement).naturalWidth>0))).toBe(true);
  const before=await page.screenshot();
  await page.waitForTimeout(400);
  const after=await page.screenshot({path:info.outputPath('storyset-set.png')});
  expect(after.equals(before)).toBe(false);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
