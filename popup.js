// When the popup is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Check if we're on the Kibu app
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentUrl = tabs[0].url;
    const isOnKibuApp = currentUrl.includes('app.kibuhq.com');
    
    // Populate the URL field
    document.getElementById('page-url').value = currentUrl;
    
    if (isOnKibuApp) {
      document.getElementById('not-on-kibu-site').style.display = 'none';
      document.getElementById('feedback-text').disabled = false;
      document.getElementById('submit-btn').disabled = false;
      
      // Check for selected text in the active tab
      chrome.tabs.sendMessage(tabs[0].id, { action: "getSelectedText" }, function(response) {
        if (response && response.selectedText) {
          document.getElementById('highlighted-text-container').style.display = 'block';
          document.getElementById('highlighted-text').value = response.selectedText;
        }
      });
    } else {
      document.getElementById('not-on-kibu-site').style.display = 'block';
      document.getElementById('feedback-text').disabled = true;
      document.getElementById('submit-btn').disabled = true;
    }
  });
  
  // Add event listener to submit button
  document.getElementById('submit-btn').addEventListener('click', function() {
    const feedbackText = document.getElementById('feedback-text').value.trim();
    
    if (feedbackText.length === 0) {
      alert('Please describe the issue before submitting.');
      return;
    }
    
    // Disable the button and change text to "Sending..."
    const submitButton = document.getElementById('submit-btn');
    submitButton.disabled = true;
    submitButton.textContent = 'Sending...';
    const originalButtonText = submitButton.textContent;
    
    // Get the current tab URL
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const currentUrl = tabs[0].url;
      
      // Get screenshot checkbox value
      const includeScreenshot = document.getElementById('include-screenshot').checked;
      
      // Get feedback type (bug or feedback)
      const isBug = document.getElementById('type-bug').checked;
      const feedbackType = isBug ? 'bug' : 'feedback';
      
      // Send message to background script
      chrome.runtime.sendMessage({
        action: "submitFeedback",
        feedbackText: feedbackText,
        url: currentUrl,
        selectedText: document.getElementById('highlighted-text')?.value || "", // Get highlighted text if available
        includeScreenshot: includeScreenshot,
        feedbackType: feedbackType,
        isContextMenu: false // Flag as coming from popup, not context menu
      }, function(response) {
        if (response && response.status) {
          // Show success message with alert
          alert('Thank you! Your feedback has been submitted.');
          // Close the popup
          window.close();
        } else {
          // Check if this is a token configuration error
          if (response && response.error && response.error.includes('Slack token not configured')) {
            // Show specific message about setting up the token
            alert('Slack token not configured. Please go to extension options to set up your Slack token.');
            // Open options page
            chrome.runtime.openOptionsPage();
          } else {
            // Show generic error message
            alert('Error submitting feedback: ' + (response?.error || 'Please try again.'));
          }
          // Re-enable the button and restore text
          submitButton.disabled = false;
          submitButton.textContent = originalButtonText;
        }
      })
    });
  });
});
