import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

const errors = [];
page.on('console', msg => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message));

console.log('Loading page...');
await page.goto('https://suile-21173.web.app/tools/qr-letter', { waitUntil: 'networkidle' });
console.log('Page loaded');

// Check textarea
const textarea = await page.$('textarea');
console.log('Textarea found:', !!textarea);

// Check all buttons
const buttons = await page.$$('button');
console.log('Total buttons:', buttons.length);
for (let i = 0; i < buttons.length; i++) {
  const text = await buttons[i].textContent();
  const disabled = await buttons[i].getAttribute('disabled');
  console.log(`Button ${i}: "${text.trim().substring(0, 40)}" | disabled: ${disabled}`);
}

// Type message
if (textarea) {
  await textarea.fill('테스트 메시지입니다');
  console.log('Typed message in textarea');
  await page.waitForTimeout(500);
}

// Check submit button
const submitBtn = await page.$('button:has-text("비밀 메시지 만들기")');
if (submitBtn) {
  const disabledAfter = await submitBtn.getAttribute('disabled');
  console.log('Submit disabled after typing:', disabledAfter);
  
  try {
    await submitBtn.click();
    console.log('Clicked submit');
  } catch (e) {
    console.log('Click error:', e.message);
  }
  
  await page.waitForTimeout(3000);
  
  const bodyText = await page.textContent('body');
  console.log('Has result screen:', bodyText.includes('비밀 메시지 완성'));
  console.log('Has share buttons:', bodyText.includes('공유하기'));
} else {
  console.log('Submit button NOT FOUND');
}

console.log('\n=== JS Errors on page ===');
errors.forEach(e => console.log(e));
console.log('=== End errors ===');

await browser.close();
