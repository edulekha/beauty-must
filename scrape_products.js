#!/usr/bin/env node
/**
 * Scrapes Nykaa affiliate widget URLs from affiliate.txt
 * Extracts: product name, brand, price, image URL, affiliate link
 * Outputs: a JS PRODUCTS array ready for beauty-must.html
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Parse affiliate.txt ──

function parseAffiliateFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
    
    const categories = [];
    let currentCategory = null;

    for (const line of lines) {
        if (line.startsWith('http')) {
            if (currentCategory) {
                currentCategory.urls.push(line);
            }
        } else {
            // Category header
            currentCategory = { name: line.toLowerCase(), urls: [] };
            categories.push(currentCategory);
        }
    }
    return categories;
}

// ── Map category names to filter values ──
function mapCategory(catName) {
    const map = {
        'skincare': 'skin',
        'eyes': 'eyes',
        'lips': 'lips',
        'face': 'face',
        'tools': 'tools',
    };
    return map[catName] || catName;
}

// ── Fetch a URL and return HTML ──
function fetchURL(url) {
    return new Promise((resolve, reject) => {
        try {
            // Using bare curl to bypass Akamai WAF
            const output = execSync(`curl -sL "${url}"`, {
                encoding: 'utf-8',
                timeout: 10000
            });
            resolve(output);
        } catch (err) {
            reject(err);
        }
    });
}

// ── Extract product data from widget HTML ──
function extractProductData(html, widgetUrl, category) {
    // Extract product_id and ad_id from the widget URL
    const productIdMatch = widgetUrl.match(/product_id=(\d+)/);
    const adIdMatch = widgetUrl.match(/ad_id=([a-f0-9]+)/);
    const productId = productIdMatch ? productIdMatch[1] : '';
    const adId = adIdMatch ? adIdMatch[1] : '';
    
    // Extract image URL from <img> tag
    let imageUrl = '';
    const imgMatch = html.match(/src=['"](https:\/\/images-static\.nykaa\.com\/[^'"]+)['"]/);
    if (imgMatch) {
        imageUrl = imgMatch[1];
    }
    
    // Extract affiliate link from <a> tag  
    let affiliateLink = '';
    const linkMatch = html.match(/href=['"](https:\/\/www\.nykaa\.com\/[^'"]+affiliateId[^'"]+)['"]/);
    if (linkMatch) {
        affiliateLink = linkMatch[1].replace(/&amp;/g, '&');
    }
    
    // Extract product name from title attribute or heading
    let productName = '';
    const titleMatch = html.match(/title=['"]([^'"]+)['"]/i) || 
                       html.match(/<h2[^>]*><span>([^<]+)<\/span><\/h2>/i);
    if (titleMatch) {
        productName = titleMatch[1].trim();
    }
    
    // Extract prices (uses &#8377; entity in HTML)
    let salePrice = '';
    let originalPrice = '';
    const pricesMatch = html.match(/&#8377;([\d,]+)/g);
    if (pricesMatch && pricesMatch.length >= 2) {
        originalPrice = pricesMatch[0].replace('&#8377;', '₹'); // MRP
        salePrice = pricesMatch[1].replace('&#8377;', '₹');     // Sale price
    } else if (pricesMatch && pricesMatch.length === 1) {
        salePrice = pricesMatch[0].replace('&#8377;', '₹');
        originalPrice = pricesMatch[0].replace('&#8377;', '₹');
    }

    
    // Extract discount percentage
    let discount = '';
    const discountMatch = html.match(/(\d+)%\s*off/i);
    if (discountMatch) {
        discount = discountMatch[1] + '% Off';
    }
    
    // Extract brand from the affiliate link URL slug
    let brand = '';
    if (affiliateLink) {
        const slugMatch = affiliateLink.match(/nykaa\.com\/([^\/]+)\/p\//);
        if (slugMatch) {
            // Convert slug to brand name (first word or two)
            const slug = slugMatch[1];
            const parts = slug.split('-');
            // Common brand patterns: first 1-3 words
            brand = parts.slice(0, Math.min(2, parts.length))
                .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ');
        }
    }
    
    // Clean up product name - remove excessive length
    if (productName.length > 50) {
        // Truncate at a natural breaking point
        const shortened = productName.substring(0, 50);
        const lastSpace = shortened.lastIndexOf(' ');
        productName = shortened.substring(0, lastSpace > 30 ? lastSpace : 50);
    }
    
    return {
        name: productName || `Product ${productId}`,
        brand: brand || 'Nykaa',
        price: salePrice || originalPrice || '₹0',
        category: mapCategory(category),
        tag: discount || null,
        image: imageUrl,
        link: affiliateLink || `https://www.nykaa.com/p/${productId}`,
        productId: productId,
    };
}

// ── Process all products with rate limiting ──
async function processAll() {
    const affiliatePath = path.join(__dirname, 'affiliate.txt');
    const categories = parseAffiliateFile(affiliatePath);
    
    console.log('📦 Parsed categories:');
    for (const cat of categories) {
        console.log(`   ${cat.name}: ${cat.urls.length} products`);
    }
    
    const allProducts = [];
    let totalProcessed = 0;
    let totalFailed = 0;
    
    for (const cat of categories) {
        console.log(`\n🔍 Processing ${cat.name}...`);
        
        // Process in batches of 5 to avoid rate limiting
        for (let i = 0; i < cat.urls.length; i += 5) {
            const batch = cat.urls.slice(i, i + 5);
            const results = await Promise.allSettled(
                batch.map(async (url) => {
                    try {
                        const html = await fetchURL(url);
                        const product = extractProductData(html, url, cat.name);
                        return product;
                    } catch (err) {
                        console.error(`   ❌ Failed: ${url.substring(0, 80)}... (${err.message})`);
                        return null;
                    }
                })
            );
            
            for (const result of results) {
                if (result.status === 'fulfilled' && result.value) {
                    allProducts.push(result.value);
                    totalProcessed++;
                    process.stdout.write(`   ✅ ${totalProcessed}: ${result.value.name} (${result.value.brand}) - ${result.value.price}\n`);
                } else {
                    totalFailed++;
                }
            }
            
            // Small delay between batches
            if (i + 5 < cat.urls.length) {
                await new Promise(r => setTimeout(r, 300));
            }
        }
    }
    
    console.log(`\n✨ Done! ${totalProcessed} products processed, ${totalFailed} failed.`);
    
    // ── Generate JS output ──
    const jsLines = allProducts.map(p => {
        const name = p.name.replace(/'/g, "\\'").replace(/"/g, '\\"');
        const brand = p.brand.replace(/'/g, "\\'").replace(/"/g, '\\"');
        const tag = p.tag ? `"${p.tag}"` : 'null';
        return `            { name: "${name}", brand: "${brand}", price: "${p.price}", category: "${p.category}", tag: ${tag}, image: "${p.image}", link: "${p.link}" }`;
    });
    
    const jsOutput = `        // ── Product Data — Real Nykaa Affiliate Products ──
        const PRODUCTS = [
${jsLines.join(',\n')}
        ];`;
    
    const outputPath = path.join(__dirname, 'products_output.js');
    fs.writeFileSync(outputPath, jsOutput, 'utf-8');
    console.log(`\n📄 JS output saved to: ${outputPath}`);
    
    // Also save raw JSON for debugging
    const jsonPath = path.join(__dirname, 'products_data.json');
    fs.writeFileSync(jsonPath, JSON.stringify(allProducts, null, 2), 'utf-8');
    console.log(`📄 JSON data saved to: ${jsonPath}`);
}

processAll().catch(console.error);
