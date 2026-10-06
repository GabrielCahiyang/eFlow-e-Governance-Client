import { expect, test, type Locator } from "@playwright/test";
const fixture="/tests/e2e/fixtures/designFoundation.html";
async function hitTest(target:Locator) { await expect.poll(()=>target.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true); }

for (const width of [1440,768,390,320]) {
  test(`foundation themes, scroll affordance and control bounds at ${width}px`,async({page},info)=>{
    await page.setViewportSize({width,height:900}); await page.emulateMedia({reducedMotion:"reduce"}); await page.goto(fixture);
    for(const theme of ["light","dark","system"]){await page.getByRole("button",{name:`${theme} theme`}).click();if(theme==="system")await page.emulateMedia({colorScheme:"dark"});await expect.poll(()=>page.locator("html").evaluate(el=>el.classList.contains("dark"))).toBe(theme!=="light");
      await expect.poll(()=>page.getByRole("button",{name:"Open inspector"}).evaluate(el=>getComputedStyle(el).backgroundColor)).toBe(theme==="light"?"rgb(12, 111, 107)":"rgb(87, 200, 189)");
      const styles=await page.getByRole("button",{name:"Open inspector"}).evaluate(el=>({bg:getComputedStyle(el).backgroundColor,fg:getComputedStyle(el).color,font:getComputedStyle(el).fontFamily,height:el.getBoundingClientRect().height}));
      expect(styles.bg).toBe(theme==="light"?"rgb(12, 111, 107)":"rgb(87, 200, 189)");expect(styles.fg).toBe(theme==="light"?"rgb(255, 255, 255)":"rgb(14, 38, 36)");expect(styles.font).toContain("Figtree");expect(styles.height).toBeGreaterThanOrEqual(width<768?44:40);
      const contrasts=await page.evaluate(()=>{
        const css=getComputedStyle(document.documentElement);
        const luminance=(name:string)=>{const hex=css.getPropertyValue(`--eflow-${name}`).trim();const rgb=[1,3,5].map(offset=>parseInt(hex.slice(offset,offset+2),16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
        return [["text","surface"],["text-muted","surface"],["on-primary","primary"],["on-danger","danger"],["positive-text","positive-bg"],["warning-text","warning-bg"],["negative-text","negative-bg"],["info-text","info-bg"]].map(([fg,bg])=>{const a=luminance(fg),b=luminance(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);});
      });contrasts.forEach(value=>expect(value).toBeGreaterThanOrEqual(4.5));
      await page.screenshot({path:info.outputPath(`foundation-${theme}-${width}.png`),fullPage:false});
    }
    const scroll=page.getByRole("region",{name:"Scrollable data table"});expect(await scroll.evaluate(el=>getComputedStyle(el).scrollbarWidth)).toBe("thin");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.getByRole("button",{name:"Workspace actions"}).press("Enter");await expect(page.getByRole("menuitem",{name:/Archive/})).toBeDisabled();await expect(page.getByText("Linked to audit history")).toBeVisible();await page.keyboard.press("Escape");await expect(page.getByRole("button",{name:"Workspace actions"})).toBeFocused();
    await page.getByRole("tab",{name:"Overview"}).focus();await page.keyboard.press("ArrowRight");await expect(page.getByRole("tab",{name:"Activity"})).toBeFocused();await page.keyboard.press("Enter");await expect(page.getByText("Activity content")).toBeVisible();
  });
}
for(const surface of ["inspector","Vibe modal","feature dialog"]){test(`nested picker, pending retry and discard focus in ${surface}`,async({page},info)=>{
  await page.emulateMedia({reducedMotion:"reduce"});await page.goto(fixture);const trigger=page.getByRole("button",{name:`Open ${surface}`});await trigger.click();const dialog=page.getByRole("dialog",{name:`Foundation ${surface}`});await expect(dialog).toBeVisible();
  await dialog.getByRole("combobox",{name:"Office picker"}).click();const option=page.getByRole("option",{name:"Engineering"});await expect(option).toBeVisible();await hitTest(option);await option.click();await expect(dialog.getByRole("combobox")).toHaveText("Engineering");
  await dialog.getByRole("combobox").press("Enter");await page.keyboard.press("Escape");await expect(dialog).toBeVisible();await expect(dialog.getByRole("combobox")).toBeFocused();
  await dialog.getByRole("textbox",{name:"Draft title"}).fill("Keep my draft");await dialog.getByRole("button",{name:"Save draft"}).click();await expect(dialog.getByRole("button",{name:"Saving…"})).toBeDisabled();await page.keyboard.press("Escape");await expect(page.getByRole("alertdialog")).toHaveCount(0);await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("alert").filter({hasText:"Could not save"})).toBeVisible();await expect(dialog.getByRole("textbox",{name:"Draft title"})).toHaveValue("Keep my draft");await expect(dialog.getByLabel("Save attempts")).toHaveText("1");await dialog.getByRole("button",{name:"Retry"}).click();await expect(dialog.getByLabel("Save attempts")).toHaveText("2");await expect(dialog.getByRole("button",{name:"Save draft"})).toBeEnabled();
  const input=dialog.getByRole("textbox",{name:"Draft title"});expect(await input.evaluate(el=>el.getAttribute("aria-describedby")?.split(" ").some(id=>document.getElementById(id)?.getAttribute("role")==="alert"))).toBe(true);
  await dialog.getByRole("button",{name:"Notify"}).click();await expect(page.getByRole("status").filter({hasText:"Draft feedback"})).toBeVisible();
  await dialog.getByRole("button",{name:"Close draft"}).click();const alert=page.getByRole("alertdialog");await expect(alert).toBeVisible();await alert.getByRole("combobox").click();await hitTest(page.getByRole("option",{name:"Engineering"}));await page.getByRole("option",{name:"Engineering"}).click();await page.screenshot({path:info.outputPath(`confirmation-${surface}.png`)});await hitTest(alert.getByRole("button",{name:"Cancel"}));await alert.getByRole("button",{name:"Cancel"}).click();await expect(dialog).toBeVisible();await expect(dialog.getByRole("button",{name:"Close draft"})).toBeFocused();
  await dialog.getByRole("button",{name:"Close draft"}).click();await expect(alert.getByRole("button",{name:"Discard"})).toBeDisabled();await alert.getByRole("textbox").fill("DISCARD");await alert.getByRole("button",{name:"Discard"}).click();await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();await expect(page.getByLabel("Accepted discards")).toHaveText("1");expect(await page.locator("#root").evaluate(el=>el.inert)).toBe(false);expect(await page.evaluate(()=>document.body.style.overflow)).not.toBe("hidden");await page.screenshot({path:info.outputPath(`overlay-${surface}.png`)});
});}
test("Vibe popup is clickable outside its clipping ancestor",async({page})=>{await page.goto(fixture);await page.getByRole("button",{name:"Vibe popup",exact:true}).click();const action=page.getByRole("button",{name:"Vibe popup action"});await expect(action).toBeVisible();await hitTest(action);await action.click();});

test("dialogs and pickers fit a 200 percent zoom-equivalent viewport",async({browser},info)=>{
  // A 1440x1000 device at 200% exposes a 720x500 CSS viewport at DPR 2.
  const context=await browser.newContext({baseURL:process.env.EFLOW_E2E_BASE_URL||"http://127.0.0.1:5174",viewport:{width:720,height:500},deviceScaleFactor:2,reducedMotion:"reduce"});
  try {
    const page=await context.newPage();await page.goto(fixture);await page.getByRole("button",{name:"Open Vibe modal"}).click();const dialog=page.getByRole("dialog",{name:"Foundation Vibe modal"});await expect(dialog).toBeVisible();const rect=(await dialog.boundingBox())!;expect(rect.x).toBeGreaterThanOrEqual(0);expect(rect.x+rect.width).toBeLessThanOrEqual(720);
    await dialog.getByRole("combobox").click();const option=page.getByRole("option",{name:"Engineering"});await hitTest(option);const bounds=(await option.boundingBox())!;expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(720);expect(bounds.y+bounds.height).toBeLessThanOrEqual(500);await option.click();await page.screenshot({path:info.outputPath("foundation-zoom-equivalent-200.png")});
  } finally {await context.close();}
});
