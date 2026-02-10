import { chromium, devices } from 'playwright';

const browser = await chromium.launch();
const iPhone = devices['iPhone 13'];
const context = await browser.newContext({ ...iPhone });
const page = await context.newPage();

const errors = [];
page.on('console', msg => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message));

// Test 1: Homepage - click ToolCard
console.log('=== Test 1: Homepage ===');
await page.goto('https://suile-21173.web.app/', { waitUntil: 'load' });
console.log('Homepage loaded');

const toolCard = await page.$('a[href="/tools/qr-letter"]');
console.log('ToolCard link found:', !!toolCard);
if (toolCard) {
  const box = await toolCard.boundingBox();
  console.log('ToolCard bounding box:', JSON.stringify(box));
  
  // Check if something is overlapping the tool card
  const isVisible = await toolCard.isVisible();
  console.log('ToolCard visible:', isVisible);
  
  // Check for overlapping elements
  const overlapping = await page.evaluate((bbox) => {
    const elements = document.elementsFromPoint(bbox.x + bbox.width/2, bbox.y + bbox.height/2);
    return elements.map(e => ({
      tag: e.tagName,
      class: e.className?.substring?.(0, 60) || '',
      id: e.id || '',
    }));
  }, box);
  console.log('Elements at ToolCard center:', JSON.stringify(overlapping, null, 2));
  
  await toolCard.tap();
  await page.waitForTimeout(2000);
  console.log('After tap URL:', page.url());
}

// Test 2: QR tool page - tap button
console.log('\n=== Test 2: QR Tool Page ===');
await page.goto('https://suile-21173.web.app/tools/qr-letter', { waitUntil: 'load' });
const textarea = await page.$('textarea');
if (textarea) {
  await textarea.tap();
  await textarea.fill('모바일 테스트');
  await page.waitForTimeout(500);
}

const submitBtn = await page.$('button:has-text("비밀 메시지 만들기")');
if (submitBtn) {
  const box = await submitBtn.boundingBox();
  console.log('Submit button box:', JSON.stringify(box));
  const isVisible = await submitBtn.isVisible();
  console.log('Submit button visible:', isVisible);
  const disabled = await submitBtn.getAttribute('disabled');
  console.log('Submit disabled:', disabled);
  
  // Check overlapping elements
  const overlapping = await page.evaluate((bbox) => {
    const elements = document.elementsFromPoint(bbox.x + bbox.width/2, bbox.y + bbox.height/2);
    return elements.map(e => ({
      tag: e.tagName,
      class: e.className?.substring?.(0, 80) || '',
    }));
  }, box);
  console.log('Elements at button center:', JSON.stringify(overlapping, null, 2));
  
  await submitBtn.tap();
  await page.waitForTimeout(3000);
  const bodyText = await page.textContent('body');
  console.log('Result screen:', bodyText.includes('비밀 메시지 완성'));
}

console.log('\n=== JS Errors ===');
errors.forEach(e => console.log(e));

await browser.close();
