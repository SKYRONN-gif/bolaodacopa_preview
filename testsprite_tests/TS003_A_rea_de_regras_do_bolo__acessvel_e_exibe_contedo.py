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
        
        # -> Clicar no botão 'Início & Regras' para abrir a área de regras e confirmar que o conteúdo é exibido sem exigir login.
        # Início & Regras button
        elem = page.get_by_role('button', name='Início & Regras', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        elem = page.locator("text=Entrar com Google").nth(0)
        await elem.scroll_into_view_if_needed()
        # Assert: 'Entrar com Google' button is visible indicating the view is public (not authenticated)
        assert await elem.is_visible(), "Expected element to be visible after scrolling into view"
        
        elem = page.locator("text=Acerto exato").nth(0)
        await elem.scroll_into_view_if_needed()
        # Assert: The rule heading "Acerto exato" is visible in the rules section
        assert await elem.is_visible(), "Expected element to be visible after scrolling into view"
        
        elem = page.locator("text=Acerto parcial").nth(0)
        await elem.scroll_into_view_if_needed()
        # Assert: The rule heading "Acerto parcial" is visible in the rules section
        assert await elem.is_visible(), "Expected element to be visible after scrolling into view"
        
        elem = page.locator("text=Erro").nth(0)
        await elem.scroll_into_view_if_needed()
        # Assert: The rule heading "Erro" is visible in the rules section
        assert await elem.is_visible(), "Expected element to be visible after scrolling into view"
        
        elem = page.locator("text=Regra importante").nth(0)
        await elem.scroll_into_view_if_needed()
        # Assert: The section title "Regra importante" is visible in the rules content
        assert await elem.is_visible(), "Expected element to be visible after scrolling into view"
        
        elem = page.locator("text=Como o bolão funciona?").nth(0)
        await elem.scroll_into_view_if_needed()
        # Assert: The section "Como o bolão funciona?" is visible explaining how the pool works
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
    