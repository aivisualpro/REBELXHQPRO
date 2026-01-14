/**
 * RebelX CRM - Google Voice Auto Dialer
 * This script automatically clicks the "Call" button in Google Voice
 * when a phone number is pre-filled from the CRM.
 */

console.log('[RebelX Auto-Dialer] Extension loaded on Google Voice');

// Function to find and click the call button
function autoClickCallButton() {
  // Google Voice uses different selectors, we'll try multiple approaches
  
  // Strategy 1: Look for the main call button by text content
  const buttons = document.querySelectorAll('button');
  let callButton = null;
  
  for (const button of buttons) {
    const text = button.textContent.trim().toLowerCase();
    if (text === 'call' || text.includes('call') || button.getAttribute('aria-label')?.toLowerCase().includes('call')) {
      // Make sure it's not disabled
      if (!button.disabled && !button.getAttribute('aria-disabled')) {
        callButton = button;
        break;
      }
    }
  }
  
  // Strategy 2: Look for the green phone icon button (common in Google Voice UI)
  if (!callButton) {
    const phoneButtons = document.querySelectorAll('[data-tooltip*="Call"], [aria-label*="Call"], button[aria-label*="call"]');
    if (phoneButtons.length > 0) {
      callButton = phoneButtons[0];
    }
  }
  
  // Strategy 3: Look for buttons with specific Google Voice classes (may vary)
  if (!callButton) {
    callButton = document.querySelector('button[jsname], button[jsaction*="call"]');
  }
  
  if (callButton) {
    console.log('[RebelX Auto-Dialer] Found call button, clicking in 1 second...');
    
    // Wait 1 second to ensure the number is fully loaded, then click
    setTimeout(() => {
      callButton.click();
      console.log('[RebelX Auto-Dialer] ✅ Call button clicked!');
    }, 1000);
    
    return true;
  }
  
  return false;
}

// Check if URL contains the auto-dial parameter
function shouldAutoDial() {
  const url = window.location.href;
  // Check if URL has ?a=nc, which indicates a new call request
  return url.includes('?a=nc,') || url.includes('calls?a=');
}

// Main execution
if (shouldAutoDial()) {
  console.log('[RebelX Auto-Dialer] Auto-dial triggered from CRM');
  
  // Try immediately
  if (!autoClickCallButton()) {
    // If not found, wait for the page to fully render
    console.log('[RebelX Auto-Dialer] Waiting for UI to load...');
    
    // Set up a mutation observer to detect when the call button appears
    const observer = new MutationObserver((mutations) => {
      if (autoClickCallButton()) {
        observer.disconnect();
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Stop observing after 10 seconds to prevent infinite loops
    setTimeout(() => {
      observer.disconnect();
      console.log('[RebelX Auto-Dialer] Timeout - Button not found');
    }, 10000);
  }
} else {
  console.log('[RebelX Auto-Dialer] Standby mode (no auto-dial trigger detected)');
}
