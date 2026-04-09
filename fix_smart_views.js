const fs = require('fs');

const layoutPath = 'src/app/crm/layout.tsx';
let layoutContent = fs.readFileSync(layoutPath, 'utf8');

// remove red-flag block
layoutContent = layoutContent.replace(/\s*\{\s*id:\s*'red-flag'[\s\S]*?badgeColor:\s*'bg-red-500'\s*\},/g, '');
// remove email-opened-week block
layoutContent = layoutContent.replace(/\s*\{\s*id:\s*'email-opened-week'[\s\S]*?badgeColor:\s*'bg-violet-500'\s*\}/g, '');
fs.writeFileSync(layoutPath, layoutContent);

const apiPath = 'src/app/api/crm/smart-views/route.ts';
let apiContent = fs.readFileSync(apiPath, 'utf8');
apiContent = apiContent.replace(/\s*redFlagCount,/g, '');
apiContent = apiContent.replace(/\s*emailOpenedCount/g, '');
apiContent = apiContent.replace(/\s*\/\/ Red Flag[\s\S]*?\}\)\(\),/g, '');
apiContent = apiContent.replace(/\s*\/\/ Email Opened[\s\S]*?ids\.length\)/g, '');
apiContent = apiContent.replace(/\s*'red-flag': redFlagCount,/g, '');
apiContent = apiContent.replace(/\s*'email-opened-week': emailOpenedCount/g, '');
apiContent = apiContent.replace(/\s*case 'red-flag': \{[\s\S]*?break;\s*\}/g, '');
apiContent = apiContent.replace(/\s*case 'email-opened-week': \{[\s\S]*?break;\s*\}/g, '');
fs.writeFileSync(apiPath, apiContent);

const pagePath1 = 'src/app/crm/smart-view/page.tsx';
if (fs.existsSync(pagePath1)) {
    let page1Content = fs.readFileSync(pagePath1, 'utf8');
    page1Content = page1Content.replace(/\s*'red-flag': \{[\s\S]*?text-red-500'\s*\},/g, '');
    page1Content = page1Content.replace(/\s*'email-opened-week': \{[\s\S]*?text-violet-500'\s*\}/g, '');
    fs.writeFileSync(pagePath1, page1Content);
}

const pagePath2 = 'src/app/crm/inbox/smart-view/page.tsx';
if (fs.existsSync(pagePath2)) {
    let page2Content = fs.readFileSync(pagePath2, 'utf8');
    page2Content = page2Content.replace(/\s*'red-flag': \{[\s\S]*?text-red-500'\s*\},/g, '');
    page2Content = page2Content.replace(/\s*'email-opened-week': \{[\s\S]*?text-violet-500'\s*\}/g, '');
    fs.writeFileSync(pagePath2, page2Content);
}
console.log('Fixed');
