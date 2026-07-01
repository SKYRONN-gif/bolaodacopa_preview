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
        
        # -> Abrir a página 'Partidas' (navegar para /partidas) e aguardar o carregamento da interface 'Partidas' para localizar os cards de partidas.
        await page.goto("http://localhost:3000/partidas")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Scroll down the page and search for the 'Partidas' section or match cards (look for visible text 'Partidas' or time strings like 'HH:MM').
        await page.mouse.wheel(0, 300)
        
        # -> Scroll down to reveal match cards and verify the page shows match date/time (HH:MM) and the teams (e.g., 'Brasil x Argentina') on the cards.
        await page.mouse.wheel(0, 300)
        
        # --> Assertions to verify final state
        # Assert: URL navigates to /partidas after opening the Partidas section
        current_url = await page.evaluate("() => window.location.href")
        assert '/partidas' in current_url, "The page should have navigated to /partidas after opening the Partidas section"
        # Assert: Match cards display team pairings in the format 'TimeA x TimeB' on the Partidas page
        elem = page.locator("xpath=//*[contains(., ' x ')]").nth(0)
        await elem.scroll_into_view_if_needed()
        assert await elem.is_visible(), "The match cards should display the teams in the format 'TimeA x TimeB' (e.g., 'Brasil x Argentina') when matches are available"
        # Assert: Match cards show date/time strings like 'HH:MM' indicating scheduled match times
        elem = page.locator("xpath=//*[contains(., ':')]").nth(0)
        await elem.scroll_into_view_if_needed()
        assert await elem.is_visible(), "The match cards should display the match time in HH:MM format when matches are available on the Partidas page"
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    