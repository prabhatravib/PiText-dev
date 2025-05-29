import os
import base64
from playwright.async_api import async_playwright

async def render_mermaid(html_content):
    if os.getenv("RENDER_MODE") == "image":
        return await render_as_image(html_content)
    
    return {
        "renderType": "html",
        "renderedContent": html_content
    }

async def render_as_image(html_content):
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-setuid-sandbox']
        )
        
        try:
            page = await browser.new_page()
            await page.set_content(html_content)
            await page.wait_for_selector('.mermaid svg', timeout=10000)
            
            element = await page.query_selector('.mermaid')
            screenshot = await element.screenshot()
            
            encoded = base64.b64encode(screenshot).decode('utf-8')
            return {
                "renderType": "image",
                "renderedContent": f"data:image/png;base64,{encoded}"
            }
        finally:
            await browser.close()
