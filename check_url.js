const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request =>
    console.log('REQUEST FAILED:', request.url(), request.failure().errorText)
  );

  try {
      console.log("Navigating to https://stockflow.circlehq.ai...");
      await page.goto('https://stockflow.circlehq.ai', { waitUntil: 'networkidle0', timeout: 30000 });
      console.log("Page loaded. Taking screenshot...");
      await page.screenshot({ path: 'screenshot.png' });
  } catch (err) {
      console.error(err);
  }

  await browser.close();
})();
