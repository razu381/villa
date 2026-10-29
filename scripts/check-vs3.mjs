#!/usr/bin/env node
/** Regression checks against a running site: node scripts/check-vs3.mjs [http://localhost:3000] */
import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:3000";
const browser = await chromium.launch({
  ...(process.env.VL_CHROMIUM ? { executablePath: process.env.VL_CHROMIUM } : { channel: "chrome" }),
  headless: true,
});

try {
  for (const [width, saved] of [[1440, "pt"], [390, null]]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, locale: "pt-PT" });
    if (saved) await context.addInitScript((lang) => localStorage.setItem("vl-lang", lang), saved);
    await context.route("**/*", (route) => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${base}/?snap=1`, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForSelector('.vc[data-opened="1"]');
    assert.equal(await page.locator("html").getAttribute("lang"), "en", "Saved PT and Portuguese browsers must still use English while PT is paused");
    assert.ok(await page.getByRole("button", { name: "PT", exact: true, includeHidden: true }).isDisabled());
    assert.equal(await page.getByRole("button", { name: "EN", exact: true, includeHidden: true }).getAttribute("aria-pressed"), "true");
    assert.equal(await page.evaluate(() => localStorage.getItem("vl-lang")), saved, "Keep the saved preference for when PT is re-enabled");

    await page.locator('#visit [name="name"]').fill("Test Visitor");
    await page.locator('#visit [name="email"]').fill("visitor@example.com");
    await page.locator(".vl-days__opt label").first().click();
    await page.locator('#visit button[type="submit"]').click();
    await page.evaluate(() => document.querySelector(".vc-nav__lang button").click());
    await page.waitForSelector('.vl-invite[data-status="sent"]', { timeout: 4000 });
    assert.equal(await page.locator("html").getAttribute("lang"), "en", "Clicking the disabled PT button must have no effect");
    await page.locator(".vl-invite__edit").click();
    assert.equal(await page.locator('#visit [name="name"]').inputValue(), "Test Visitor");
    const weekdays = await page.locator(".vl-days__wd").allTextContents();
    assert.equal(new Set(weekdays.slice(0, 7)).size, 7, "Weekday labels must be distinct");

    const complete = await page.locator(".vc-visit__arch path").evaluateAll((paths) => paths.every((path) => {
      const dash = getComputedStyle(path).strokeDasharray;
      const matrix = path.getScreenCTM();
      return dash === "none" || parseFloat(dash) >= Math.hypot(matrix.a, matrix.b) - 0.001;
    }));
    assert.ok(complete, "The finished arches must paint their entire path at every size");
    const caption = width > 820 ? ".vc-gallery__cap b" : ".vc-ag__cap-title";
    const font = await page.locator(caption).first().evaluate((el) => ({ family: getComputedStyle(el).fontFamily, style: getComputedStyle(el).fontStyle }));
    assert.ok(font.family.includes("Adventures Unlimited Script"));
    assert.equal(font.style, "normal");
    assert.ok(await page.locator(".vc-join").evaluateAll((els) => els.every((el) => getComputedStyle(el).opacity === "0")));

    await page.goto(base, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.wheel(0, 1);
    await page.waitForSelector('section[data-join="1"]');
    await page.waitForTimeout(500);
    for (const id of ["village-heart", "villas", "gallery"]) {
      await page.evaluate((id) => {
        const section = document.getElementById(id);
        const y = section.getBoundingClientRect().top + scrollY - innerHeight / 2;
        window.__lenis.scrollTo(y, { immediate: true });
      }, id);
      await page.waitForTimeout(250);
      const overlap = await page.locator(`#${id}`).evaluate((section) => {
        const content = section.querySelector(":scope > :not(.vc-join)");
        const rect = section.getBoundingClientRect();
        const y = content.getBoundingClientRect().top - rect.top - parseFloat(getComputedStyle(section).paddingTop);
        const covering = document.elementFromPoint(innerWidth / 2, rect.top - 10);
        return { y, covered: !section.contains(covering) };
      });
      assert.ok(overlap.y < -20, `${id} must move beneath the outgoing section`);
      assert.ok(overlap.covered, `${id} must stay behind the outgoing section`);
    }
    await page.evaluate(() => {
      const visit = document.getElementById("visit");
      window.__lenis.scrollTo(visit.getBoundingClientRect().top + scrollY, { immediate: true });
    });
    await page.waitForFunction(() => [...document.querySelectorAll(".vc-visit__arch path")].every((path) => getComputedStyle(path).strokeDasharray === "none"));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector('.vc[data-opened="1"]');
    assert.equal(await page.locator("section[data-join]").count(), 0, "Reduced motion must use normal section flow");
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`VS3 regression checks passed at ${width}px`);
  }
} finally {
  await browser.close();
}
