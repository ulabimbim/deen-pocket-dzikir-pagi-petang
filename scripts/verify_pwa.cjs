const fs = require("fs");
const { chromium } = require("playwright");

const BASE_URL = process.env.PWA_URL || "http://127.0.0.1:4173";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const browser = await chromium.launch({
    headless: true,
    executablePath: fs.existsSync(chromePath) ? chromePath : undefined,
  });
  const page = await browser.newPage({
    viewport: { width: 360, height: 740 },
    deviceScaleFactor: 1,
  });

  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.screenshot({ path: "/private/tmp/deen-pocket-pwa-home.png", fullPage: false });

  assert(await page.getByRole("heading", { name: "Dzikir Pagi & Petang" }).isVisible(), "Home title missing");
  assert(await page.getByRole("button", { name: "Mulai Dzikir Pagi" }).isVisible(), "Morning CTA missing");
  assert(await page.getByRole("button", { name: "Mulai Dzikir Petang" }).isVisible(), "Evening CTA missing");

  const homeMetrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    manifestHref: document.querySelector('link[rel="manifest"]')?.getAttribute("href") || "",
  }));
  assert(homeMetrics.scrollWidth <= homeMetrics.innerWidth, "Home has horizontal overflow at 360px");
  assert(homeMetrics.manifestHref === "manifest.json", "Manifest link missing");

  const registrationReady = await page
    .evaluate(async () => {
      if (!("serviceWorker" in navigator)) return false;
      const registration = await navigator.serviceWorker.getRegistration();
      return Boolean(registration);
    })
    .catch(() => false);
  assert(registrationReady, "Service worker did not register");

  await page.getByRole("button", { name: "Mulai Dzikir Pagi" }).click();
  await page.getByRole("button", { name: "Mulai Dzikir Pagi" }).click();
  assert(await page.getByText("1 / 26").isVisible(), "Morning practice progress missing");
  assert(await page.getByRole("heading", { name: "Ta'awudz" }).isVisible(), "First morning item missing");

  await page.getByRole("button", { name: "Lihat keterangan" }).click();
  assert(await page.getByRole("heading", { name: "Sumber" }).isVisible(), "Info modal source missing");
  assert(!(await page.getByRole("heading", { name: "Keterangan" }).nth(1).isVisible().catch(() => false)), "Empty Keterangan label rendered");
  await page.getByRole("button", { name: "Tutup" }).click();

  await page.getByRole("button", { name: "Lanjut" }).click();
  await page.getByRole("button", { name: "Lanjut" }).click();
  assert(await page.getByRole("heading", { name: "Al-Ikhlas" }).isVisible(), "Counter item did not load");
  assert(await page.getByRole("button", { name: "Sebelumnya" }).isVisible(), "Previous button missing after first item");
  await page.getByRole("button", { name: "+" }).click();
  assert(await page.getByText("1 / 3").isVisible(), "Small counter did not increment");
  await page.getByRole("button", { name: "Lanjut" }).click();
  assert(await page.getByRole("heading", { name: "Hitungan belum selesai." }).isVisible(), "Skip confirmation should appear");
  assert(await page.getByRole("button", { name: "Tetap lanjut" }).isVisible(), "Skip confirmation action missing");
  await page.getByRole("button", { name: "Tetap lanjut" }).click();
  assert(await page.getByRole("heading", { name: "Al-Falaq" }).isVisible(), "Counter did not advance after confirmation");
  await page.getByRole("button", { name: "Sebelumnya" }).click();
  assert(await page.getByRole("heading", { name: "Al-Ikhlas" }).isVisible(), "Previous button did not return to prior item");
  const storedIndexAfterPrevious = await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem("deen-pocket-pagi-petang-progress"));
    return stored.morning.currentIndex;
  });
  assert(storedIndexAfterPrevious === 2, "Previous navigation did not update saved progress index");
  await page.goto(`${BASE_URL}/#/`, { waitUntil: "networkidle" });
  assert(
    await page.getByText("Lanjutkan dari bacaan ke-3 dari 26").isVisible(),
    "Home resume status should show current item and total",
  );

  await page.goto(`${BASE_URL}/#/practice/petang/21`, { waitUntil: "networkidle" });
  assert(await page.getByText("22 / 25").isVisible(), "Petang 100x item progress missing");
  assert(await page.getByRole("button", { name: "+10" }).isVisible(), "100x +10 button missing");
  for (let index = 0; index < 11; index += 1) {
    await page.getByRole("button", { name: "+10" }).click();
  }
  assert(await page.getByText("100 / 100").isVisible(), "100x counter did not clamp to target");
  assert(await page.getByText("Selesai dibaca").isVisible(), "Completed counter state missing");
  await page.screenshot({ path: "/private/tmp/deen-pocket-pwa-counter.png", fullPage: false });

  const practiceMetrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert(practiceMetrics.scrollWidth <= practiceMetrics.innerWidth, "Practice has horizontal overflow at 360px");

  await page.goto(`${BASE_URL}/#/list/petang`, { waitUntil: "networkidle" });
  assert(await page.getByText("1. Ta'awudz").isVisible(), "Petang list did not sort from order 1");
  assert(await page.getByText("25. Shalawat").isVisible(), "Petang list missing final ordered item");

  await page.evaluate(() => {
    localStorage.setItem(
      "deen-pocket-pagi-petang-progress",
      JSON.stringify({
        date: "2000-01-01",
        morning: { currentIndex: 8, currentCounter: 2, completed: false, started: true },
        evening: { currentIndex: 4, currentCounter: 0, completed: true, started: true },
      }),
    );
  });
  await page.goto(`${BASE_URL}/#/`, { waitUntil: "networkidle" });
  assert(await page.getByText("Belum dimulai hari ini").first().isVisible(), "Old-date progress did not reset");

  assert(consoleErrors.length === 0, `Console/page errors: ${consoleErrors.join(" | ")}`);
  await browser.close();

  console.log(
    JSON.stringify(
      {
        status: "ok",
        viewport: "360x740",
        screenshots: [
          "/private/tmp/deen-pocket-pwa-home.png",
          "/private/tmp/deen-pocket-pwa-counter.png",
        ],
      },
      null,
      2,
    ),
  );
}

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
});
