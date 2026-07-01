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
        elem = page.locator("text=This localhost page can’t be found").nth(0)
        await elem.scroll_into_view_if_needed()
        # Assert: The page shows the message "This localhost page can’t be found"
        assert await elem.is_visible(), "Expected element to be visible after scrolling into view"
        elem = page.locator("text=No webpage was found for the web address: http://localhost:3000/").nth(0)
        await elem.scroll_into_view_if_needed()
        # Assert: The page shows the detailed message "No webpage was found for the web address: http://localhost:3000/"
        assert await elem.is_visible(), "Expected element to be visible after scrolling into view"
        elem = page.locator("text=HTTP ERROR 404").nth(0)
        await elem.scroll_into_view_if_needed()
        # Assert: The page shows the error code "HTTP ERROR 404"
        assert await elem.is_visible(), "Expected element to be visible after scrolling into view"
        elem = page.locator("text=Reload").nth(0)
        await elem.scroll_into_view_if_needed()
        # Assert: The page shows a "Reload" control to retry loading the site
        assert await elem.is_visible(), "Expected element to be visible after scrolling into view"
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    