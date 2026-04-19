# Nykaa Affiliate Link Conversion Reference

This reference explains how to mathematically map a raw Nykaa widget parameter string into a pure, clickable affiliate URL without relying on web scrapers or server DOM evaluation.

## 1. The Formula

Nykaa uses a canonical route structure of `/p/{product_id}`. The affiliate tracking strictly uses query parameters mapped directly from the iframe URL payload.

**Example Original Widget Link:**
`https://affiliate.nykaa.com/v2/get_product_widget?ad_id=69e3abb34e60a613ccb29cd5&add_resources=True&affiliate_id=Anshuvis-106980&product_id=13900220&store=nykaa&text_color=000000&theme_variation=TEXT_AND_IMAGE&theme=affiliate&aff_link_type=affiliate%3Anap_dashboard%3Aproduct`

**Extracted Variables required for linking:**
- `product_id`: `13900220`
- `affiliate_id`: `Anshuvis-106980`
- `ad_id`: `69e3abb34e60a613ccb29cd5`
- `aff_link_type`: Decode URL Encoded `%3A` to colons -> `affiliate:nap_dashboard:product` 

**Final Affiliate URL Structure:**
Instead of requiring the product SEO name in the URL, you can instantly bypass it using `"product"`, relying natively on Nykaa's internal mapping system which keys strictly to `product_id`:
`https://www.nykaa.com/product/p/13900220?affiliateId=Anshuvis-106980&adId=69e3abb34e60a613ccb29cd5&aff_link_type=affiliate:nap_dashboard:product`

## 2. JavaScript Automation

If you are writing scripts to extract standalone product URLs globally and don't need UI-specific metadata (like high-res images or accurate titles), use Javascript's native `URL` parsing logic:

```javascript
/**
 * Converts a Nykaa Affiliate v2 widget iframe URL into a direct clickable affiliate product link.
 * 
 * @param {string} iframeSrc - The complete src query payload from the Widget markup.
 * @returns {string} - The final NYKAA URL encoded with affiliate tracking IDs.
 */
function convertIframeToAffiliate(iframeSrc) {
    const url = new URL(iframeSrc);
    
    // Extract the exact tracking variables 
    const productId = url.searchParams.get('product_id');
    const adId = url.searchParams.get('ad_id');
    const affiliateId = url.searchParams.get('affiliate_id');
    
    // If not supplied, fallback to standard link type for conversions
    const affLinkType = url.searchParams.get('aff_link_type') || 'affiliate:nap_dashboard:product';
    
    // Build and return the final link
    return `https://www.nykaa.com/product/p/${productId}?affiliateId=${affiliateId}&adId=${adId}&aff_link_type=${affLinkType}`;
}
```
