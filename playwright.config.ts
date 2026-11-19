import { defineConfig } from '@playwright/test';

const deployed=process.env.PLAYWRIGHT_BASE_URL;
const local='http://127.0.0.1:5173/bluplab-aquarium/';
const iphone=process.env.PLAYWRIGHT_WEBKIT==='1';
export default defineConfig({
  testDir:'tests',
  testMatch:iphone?'**/iphone.spec.ts':'**/aquarium.spec.ts',
  timeout:45_000,
  expect:{timeout:9_000},
  workers:2,
  reporter:'list',
  use:{
    baseURL:deployed||local,
    browserName:iphone?'webkit':'chromium',
    launchOptions:!iphone&&process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:undefined,
    viewport:{width:844,height:390},
    trace:'retain-on-failure',
  },
  webServer:deployed?undefined:{
    command:'npm run preview -- --port 5173 --strictPort --base /bluplab-aquarium/',
    url:local,
    reuseExistingServer:!process.env.CI,
  },
});
