import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const LANDING_PAGE_PATH = "/";
const LANDING_PAGE_TITLE = "Weather Widget";
const PRODUCTION_ORIGIN = "https://weather-widget-ruby-delta.vercel.app";
const WCAG_AA_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

const EXAMPLE_HOSTS = [
  { title: "Weather Widget in plain HTML" },
  { title: "Weather Widget in React" },
  { title: "Weather Widget in Angular" },
];

test.describe("the landing page", () => {
  test("describes itself for search engines and link previews", async ({
    page,
  }) => {
    const pageUrl = `${PRODUCTION_ORIGIN}${LANDING_PAGE_PATH}`;

    await page.goto(LANDING_PAGE_PATH);

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page).toHaveTitle(LANDING_PAGE_TITLE);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /\S/,
    );
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      LANDING_PAGE_TITLE,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      pageUrl,
    );
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      "content",
      pageUrl,
    );
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      LANDING_PAGE_TITLE,
    );
    await expect(
      page.locator('meta[property="og:description"]'),
    ).toHaveAttribute("content", /\S/);
  });

  test("describes itself as a website in structured data", async ({ page }) => {
    await page.goto(LANDING_PAGE_PATH);

    const structuredData: unknown = JSON.parse(
      await page.locator('script[type="application/ld+json"]').innerText(),
    );

    expect(structuredData).toMatchObject({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: LANDING_PAGE_TITLE,
      url: `${PRODUCTION_ORIGIN}${LANDING_PAGE_PATH}`,
    });
  });

  for (const host of EXAMPLE_HOSTS) {
    test(`opens ${host.title}`, async ({ page }) => {
      await page.goto(LANDING_PAGE_PATH);

      await page.getByRole("link", { name: host.title, exact: true }).click();

      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        host.title,
      );
    });
  }

  for (const colorScheme of ["light", "dark"] as const) {
    test(`passes axe in the ${colorScheme} scheme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(LANDING_PAGE_PATH);

      const results = await new AxeBuilder({ page })
        .withTags(WCAG_AA_TAGS)
        .analyze();

      expect(results.violations).toEqual([]);
    });
  }
});
