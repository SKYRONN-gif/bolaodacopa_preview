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
        # -> navigate
        await page.goto("http://localhost:3000")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Extract the full page DOM and visible text from the homepage to check for a header, match cards, ranking, or any client-side error messages.
        # [internal] extract_content: 
        
        # -> Open the site at http://127.0.0.1:3000/ in a new tab and check whether the homepage renders main content (header, match cards, or ranking).
        # Open URL in new tab
        page = await context.new_page()
        await page.goto("http://127.0.0.1:3000/")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # --> Assertions to verify final state
        # Assert: URL navigates to http://localhost:3000/ after opening the app
        current_url = await page.evaluate("() => window.location.href")
        assert "http://localhost:3000/" in current_url, "The page should have navigated to http://localhost:3000/ after opening the app"
        # Assert: Header navigation 'Início & Regras' is visible on the homepage
        elem = page.locator("text=Início & Regras").nth(0)
        await elem.scroll_into_view_if_needed()
        assert await elem.is_visible(), "The homepage should display the header navigation 'Início & Regras' after loading"
        # Assert: Main hero text 'Faça seus palpites com calma e acompanhe a disputa da Copa.' is visible on the homepage
        elem = page.locator("text=Faça seus palpites com calma e acompanhe a disputa da Copa.").nth(0)
        await elem.scroll_into_view_if_needed()
        assert await elem.is_visible(), "The homepage should show the main hero text 'Faça seus palpites com calma e acompanhe a disputa da Copa.' after loading"
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    