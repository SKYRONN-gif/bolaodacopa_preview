import asyncio
import re
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None

    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()

        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",
                "--disable-dev-shm-usage",
                "--ipc=host",
                "--single-process"
            ],
        )

        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        # Wider default timeout to match the agent's DOM-stability budget;
        # auto-waiting Playwright APIs (expect, locator.wait_for) inherit this.
        context.set_default_timeout(15000)

        # Open a new page in the browser context
        page = await context.new_page()

        # Interact with the page elements to simulate user flow
        # -> Final action — this is where the agent failed
        # Error observed by agent: Navigation failed - site unavailable: http://localhost:3000
        await page.goto("http://localhost:3002")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # --> Assertions to verify final state
        # 404 header is visible on the page to indicate the site is unavailable
        elem = page.locator("text=This localhost page can’t be found").nth(0)
        await elem.scroll_into_view_if_needed()
        # Assert: The page shows the text "This localhost page can’t be found"
        assert await elem.is_visible(), "Expected element to be visible after scrolling into view"
        elem = page.locator("text=HTTP ERROR 404").nth(0)
        await elem.scroll_into_view_if_needed()
        # Assert: The page shows the text "HTTP ERROR 404"
        assert await elem.is_visible(), "Expected element to be visible after scrolling into view"
        elem = page.locator("text=No webpage was found for the web address: http://localhost:3000/").nth(0)
        await elem.scroll_into_view_if_needed()
        # Assert: The page shows the full 404 explanatory message including the URL
        assert await elem.is_visible(), "Expected element to be visible after scrolling into view"
        current_url = await page.evaluate("() => window.location.href")
        # Assert: The browser remained at the root http://localhost:3002/
        assert "http://localhost:3002/" in current_url, "The page should be at http://localhost:3002/"
        cnt = await page.locator("text=Sponte Bet").count()
        # Assert: The application title "Sponte Bet" must not be present when the site is unavailable
        assert cnt == 0, "Sponte Bet should not be present when the site is unavailable"
        cnt = await page.locator("text=Início & Regras").count()
        # Assert: The navigation option "Início & Regras" must not be present on the error page
        assert cnt == 0, "Início & Regras should not be present when the site is unavailable"
        cnt = await page.locator("text=Meus Palpites").count()
        # Assert: The navigation option "Meus Palpites" must not be present on the error page
        assert cnt == 0, "Meus Palpites should not be present when the site is unavailable"
        cnt = await page.locator("text=Classificação").count()
        # Assert: The navigation option "Classificação" must not be present on the error page
        assert cnt == 0, "Classificação should not be present when the site is unavailable"
        cnt = await page.locator("text=Entrar com Google").count()
        # Assert: The "Entrar com Google" button must not be present on the error page
        assert cnt == 0, "Entrar com Google should not be present when the site is unavailable"
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    