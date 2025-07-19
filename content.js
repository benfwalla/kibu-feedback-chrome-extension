// Check if script has already been loaded to prevent duplicate initialization
if (window.kibuFeedbackLoaded) {
  console.log("Kibu Feedback content script is already loaded, skipping initialization");
} else {
  // Mark script as loaded
  window.kibuFeedbackLoaded = true;

  // Use IIFE to prevent variable collisions
  (function() {
    // Store selected text when available
    let selectedText = '';
    
    // Make it available globally but in a namespaced way
    window.kibuFeedback = window.kibuFeedback || {};
    window.kibuFeedback.getSelectedText = function() { return selectedText; };
    window.kibuFeedback.setSelectedText = function(text) { selectedText = text; };
    
    // Listen for selection changes
    document.addEventListener('selectionchange', () => {
      selectedText = window.getSelection().toString().trim();
    });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Content script received message:", message);
  
  if (message.action === "openFeedbackForm") {
    console.log("Content script received openFeedbackForm message");
    // Capture selected text if present
    const currentSelection = window.getSelection().toString().trim();
    if (currentSelection) {
      window.kibuFeedback.setSelectedText(currentSelection);
    }
    
    // Create and display the feedback form near click coordinates if available
    showFeedbackForm(message.x, message.y, window.kibuFeedback.getSelectedText());
    // Send a response back
    sendResponse({ status: "Form opened" });
    return true;
  } else if (message.action === "getSelectedText") {
    // Send the currently selected text to the popup
    sendResponse({ selectedText: window.kibuFeedback.getSelectedText() });
    return true;
  } else if (message.action === "hideFormForScreenshot") {
    // Hide the form before taking screenshot
    console.log("Hiding feedback form for screenshot");
    const form = document.getElementById('kibu-feedback-form');
    if (form) {
      form.style.display = 'none';
    }
    sendResponse({ status: "Form hidden" });
    return true;
  } else if (message.action === "showFormAfterScreenshot") {
    // Show the form again after screenshot
    console.log("Showing feedback form after screenshot");
    const form = document.getElementById('kibu-feedback-form');
    if (form) {
      form.style.display = 'block';
    }
    sendResponse({ status: "Form shown" });
    return true;
  }
  
  return false; // For other messages
});

// Log that the content script has loaded
console.log("Kibu Feedback content script loaded on:", window.location.href);

})();  // End of IIFE

// Function to create and show the feedback form
function showFeedbackForm(clickX, clickY, selectedText = '') {
  // Check if the form already exists
  if (document.getElementById('kibu-feedback-form')) {
    return;
  }
  
  // Store selected text as a data attribute for later use
  window.kibuSelectedText = selectedText || window.kibuFeedback?.getSelectedText() || '';

  // Calculate position based on click or centered
  const posX = clickX ? (clickX - 150) : (window.innerWidth / 2 - 150);
  const posY = clickY ? (clickY - 50) : (window.innerHeight / 2 - 150);
  
  // Add Inter font if not already loaded
  if (!document.getElementById('kibu-inter-font')) {
    const fontLink = document.createElement('link');
    fontLink.id = 'kibu-inter-font';
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap';
    document.head.appendChild(fontLink);
  }
  
  // Create the floating form directly without a container
  const form = document.createElement('div');
  form.id = 'kibu-feedback-form';
  form.style.position = 'fixed';
  form.style.zIndex = '10000';
  form.style.left = `${Math.max(10, Math.min(posX, window.innerWidth - 330))}px`;
  form.style.top = `${Math.max(10, Math.min(posY, window.innerHeight - 300))}px`;
  form.style.width = '400px';
  form.style.padding = '16px';
  form.style.fontFamily = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  form.style.background = 'white';
  form.style.borderRadius = '12px';
  form.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.12)';
  
  // Add form content with Kibu's brand styling and shadcn-inspired components
  form.innerHTML = `
    <div class="form-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; cursor:move;">
      <h2 style="margin-top:0; color:#111; font-weight:600; font-size:18px; margin-bottom:0;">Kibu Feedback</h2>
      <button id="kibu-close-btn" style="background:none; border:none; font-size:18px; cursor:pointer; color:#6b7280; height:24px; width:24px; display:flex; align-items:center; justify-content:center; border-radius:4px; transition:background-color 0.2s;">&times;</button>
    </div>
    <div style="margin-bottom:12px;">
      <label for="kibu-page-url" style="display:block; font-size:14px; font-weight:500; margin-bottom:6px; color:#374151;">Page URL:</label>
      <input 
        type="text" 
        id="kibu-page-url" 
        value="${window.location.href}" 
        readonly 
        style="width:100%; padding:8px 12px; border:1px solid #e4e4e7; border-radius:8px; background-color:#f9fafb; box-sizing:border-box; font-family:inherit; font-size:14px; cursor:not-allowed;"
      >
    </div>
    ${selectedText ? `
    <div style="margin-bottom:12px;">
      <label for="kibu-highlighted-text" style="display:block; font-size:14px; font-weight:500; margin-bottom:6px; color:#374151;">Highlighted Text:</label>
      <textarea 
        id="kibu-highlighted-text" 
        readonly 
        style="width:100%; height:60px; padding:8px 12px; border:1px solid #e4e4e7; border-radius:8px; background-color:#f9fafb; box-sizing:border-box; font-family:inherit; font-size:14px; resize:none; cursor:not-allowed;"
      >${selectedText}</textarea>
    </div>
    ` : ''}
    <div style="margin-bottom:16px;">
      <label for="kibu-feedback-text" style="display:block; font-size:14px; font-weight:500; margin-bottom:6px; color:#374151;">Please describe any issues or suggestions:</label>
      <textarea 
        id="kibu-feedback-text" 
        style="width:100%; height:120px; padding:10px 12px; border:1px solid #e4e4e7; border-radius:8px; margin-bottom:4px; box-sizing:border-box; font-family:inherit; font-size:14px; transition:border-color 0.2s; resize:vertical; outline:none;"
        placeholder="What's happening!?"
      ></textarea>
    </div>
    <div style="margin-top: 10px;">
      <label style="display: flex; align-items: center; cursor: pointer; font-size: 14px; color: #374151;">
        <input type="checkbox" id="kibu-include-screenshot" style="margin-right: 8px;">
        Include screenshot
      </label>
    </div>

    <div style="margin-top: 12px;">
      <label style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 6px; color: #374151;">Type:</label>
      <div style="display: flex; gap: 16px;">
        <label style="display: flex; align-items: center; cursor: pointer; font-size: 14px; color: #374151;">
          <input type="radio" name="kibu-feedback-type" id="kibu-type-bug" value="bug" checked style="margin-right: 8px;">
          Bug
        </label>
        <label style="display: flex; align-items: center; cursor: pointer; font-size: 14px; color: #374151;">
          <input type="radio" name="kibu-feedback-type" id="kibu-type-feedback" value="feedback" style="margin-right: 8px;">
          Feedback
        </label>
      </div>
    </div>
    <div style="display:flex; justify-content:flex-end;">
      <button 
        id="kibu-feedback-submit" 
        style="background-color:#328CFF; color:white; border:none; padding:9px 16px; border-radius:8px; cursor:pointer; font-weight:500; font-size:14px; transition:background-color 0.2s;"
      >Send Feedback</button>
    </div>
    <div style="font-size:12px; color:#6b7280; margin-top:24px; text-align:center;">
          Feedback is sent to Slack
    </div>
  `;
  
  // Add hover, focus, active and disabled effects
  const style = document.createElement('style');
  style.textContent = `
    #kibu-feedback-text:hover {
      border-color: #d1d5db;
    }
    #kibu-feedback-text:focus {
      border-color: #328CFF;
      box-shadow: 0 0 0 2px rgba(50, 140, 255, 0.15);
    }
    #kibu-feedback-submit:hover {
      background-color: #2b7ae0;
    }
    #kibu-feedback-submit:active {
      background-color: #2060c0;
      transform: translateY(1px);
    }
    #kibu-feedback-submit:disabled {
      background-color: #93c5fd;
      cursor: not-allowed;
      opacity: 0.8;
    }
    #kibu-close-btn:hover {
      background-color: #f3f4f6;
    }
  `;
  document.head.appendChild(style);
  
  // Append the form to the document
  document.body.appendChild(form);
  
  // Make the form draggable
  makeFormDraggable(form);

  // Add event listeners
  document.getElementById('kibu-feedback-submit').addEventListener('click', submitFeedback);
  document.getElementById('kibu-close-btn').addEventListener('click', closeFeedbackForm);
  
  // Handle click outside
  document.addEventListener('mousedown', handleOutsideClick);
}

// Function to handle click outside the form
function handleOutsideClick(e) {
  const form = document.getElementById('kibu-feedback-form');
  if (form && !form.contains(e.target)) {
    closeFeedbackForm();
  }
}

// Function to submit the feedback
function submitFeedback() {
  const submitButton = document.getElementById('kibu-feedback-submit');
  const feedbackText = document.getElementById('kibu-feedback-text').value.trim();
  
  if (!feedbackText) {
    alert('Please enter some feedback before submitting.');
    return;
  }
  
  // Disable button to prevent double-submission
  submitButton.disabled = true;
  submitButton.textContent = 'Sending...';
  
  // Get the current URL and any selected text
  const currentUrl = window.location.href;
  const selectedText = window.kibuSelectedText || window.kibuFeedback?.getSelectedText() || '';
  const includeScreenshot = document.getElementById('kibu-include-screenshot').checked;
  
  // Get feedback type (bug or feedback)
  const isBug = document.getElementById('kibu-type-bug').checked;
  const feedbackType = isBug ? 'bug' : 'feedback';
  
  // Send the feedback to the background script
  chrome.runtime.sendMessage({
    action: "submitFeedback",
    feedbackText: feedbackText,
    url: currentUrl,
    selectedText: selectedText,
    includeScreenshot: includeScreenshot,
    feedbackType: feedbackType,
    isContextMenu: true  // Flag this as coming from context menu
  }, response => {
    console.log("Response from background script:", response);
    
    // Re-enable button
    submitButton.disabled = false;
    submitButton.textContent = 'Send Feedback';
    
    if (response && response.status) {
      alert('Thank you! Your feedback has been submitted.');
      closeFeedbackForm();
    } else {
      // Check if this is a token configuration error
      if (response && response.error && response.error.includes('Slack token not configured')) {
        // Show specific message about setting up the token
        alert('Slack token not configured. Please go to extension options to set up your Slack token.');
        // Open options page
        chrome.runtime.openOptionsPage();
      } else {
        // Show generic error message
        alert('Sorry, there was an error submitting your feedback: ' + (response?.error || 'Please try again.'));
      }
    }
  });
}

// Function to close the feedback form
function closeFeedbackForm() {
  const form = document.getElementById('kibu-feedback-form');
  if (form) {
    form.remove();
  }
  document.removeEventListener('mousedown', handleOutsideClick);
  
  // Clear stored selected text when closing form
  if (window.kibuSelectedText) {
    window.kibuSelectedText = '';
  }
}

// Function to make the form draggable
function makeFormDraggable(form) {
  const header = form.querySelector('.form-header');
  let offsetX = 0, offsetY = 0, startX = 0, startY = 0;
  
  if (header) {
    header.addEventListener('mousedown', startDrag);
  }
  
  function startDrag(e) {
    e.preventDefault();
    startX = e.clientX;
    startY = e.clientY;
    offsetX = parseInt(form.style.left) || 0;
    offsetY = parseInt(form.style.top) || 0;
    
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);
  }
  
  function drag(e) {
    e.preventDefault();
    const newX = offsetX + (e.clientX - startX);
    const newY = offsetY + (e.clientY - startY);
    
    form.style.left = `${Math.max(0, Math.min(newX, window.innerWidth - form.offsetWidth))}px`;
    form.style.top = `${Math.max(0, Math.min(newY, window.innerHeight - form.offsetHeight))}px`;
  }
  
  function stopDrag() {
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', stopDrag);
  }
}

} // End of the main IIFE
