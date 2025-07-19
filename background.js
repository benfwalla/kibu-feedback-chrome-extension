// Create a context menu item when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "kibufeedback",
    title: "Send Feedback to Kibu",
    contexts: ["all"],
    documentUrlPatterns: ["https://app.kibuhq.com/*"]
  });
  console.log("Context menu created");
});

// Listen for context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "kibufeedback") {
    console.log("Context menu clicked for tab", tab.id);
    
    // First, inject our content script if needed
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    }).then(() => {
      console.log("Content script injected or was already there");
      
      // Send a message to open the feedback form
      chrome.tabs.sendMessage(tab.id, { 
        action: "openFeedbackForm",
        x: info.x,
        y: info.y
      }).then(response => {
        console.log("Message sent successfully, response:", response);
      }).catch(error => {
        console.error("Error sending message to content script:", error);
      });
    }).catch(err => {
      console.error("Error injecting content script:", err);
    });
  }
});

// Get Chrome user email
function getChromeUserEmail() {
  return new Promise((resolve) => {
    chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, (userInfo) => {
      resolve(userInfo.email || 'Not available');
    });
  });
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "submitFeedback") {
    // Get the user's email and then send to Slack
    getChromeUserEmail().then(userEmail => {
      if (message.includeScreenshot) {
        if (message.isContextMenu) {
          // For context menu, first hide the form, take screenshot, then show form again
          chrome.tabs.sendMessage(sender.tab.id, { action: "hideFormForScreenshot" })
            .then(() => {
              // Wait a moment for the form to hide
              setTimeout(() => {
                chrome.tabs.captureVisibleTab(null, {format: 'png'}, function(dataUrl) {
                  // Show the form again
                  chrome.tabs.sendMessage(sender.tab.id, { action: "showFormAfterScreenshot" })
                    .then(() => {
                      // Send to Slack with screenshot
                      sendFeedbackToSlack(message.feedbackText, message.url, message.selectedText, userEmail, dataUrl, message.feedbackType)
                        .then(() => sendResponse({ status: "Feedback submitted successfully!" }))
                        .catch(error => sendResponse({ status: false, error: error.message }));
                    });
                });
              }, 100); // Short delay to ensure the form is hidden
            });
        } else {
          // Regular popup doesn't need special handling - capture screenshot directly
          chrome.tabs.captureVisibleTab(null, {format: 'png'}, function(dataUrl) {
            // Send to Slack with screenshot
            sendFeedbackToSlack(message.feedbackText, message.url, message.selectedText, userEmail, dataUrl, message.feedbackType)
              .then(() => sendResponse({ status: "Feedback submitted successfully!" }))
              .catch(error => sendResponse({ status: false, error: error.message }));
          });
        }
      } else {
        // Send to Slack without screenshot
        sendFeedbackToSlack(message.feedbackText, message.url, message.selectedText, userEmail, null, message.feedbackType)
          .then(() => sendResponse({ status: "Feedback submitted successfully!" }))
          .catch(error => sendResponse({ status: false, error: error.message }));
      }
    });
    return true; // Keep connection open for async response
  }
  return false;
});

// Function to send consolidated feedback to Slack with optional screenshot
async function sendFeedbackToSlack(feedbackText, url, selectedText, userEmail, screenshotDataUrl, feedbackType = 'bug') {
  try {
    // Get settings from storage
    const settings = await new Promise(resolve => {
      chrome.storage.sync.get({
        userName: '',
        slackToken: '', // No default token for security
        bugChannel: '#bugs',
        feedbackChannel: '#feedback-suggestions'
      }, resolve);
    });
    
    // Check if Slack token is configured
    if (!settings.slackToken) {
      console.error('Slack token not configured. Please set up your Slack token in extension options.');
      throw new Error('Slack token not configured. Please configure your Slack settings in extension options.');
    }
    
    // Determine which channel to send to based on feedback type
    const channel = feedbackType === 'bug' ? settings.bugChannel : settings.feedbackChannel;
    
    // Get Slack OAuth token from settings
    const slackToken = settings.slackToken;
    
    // Prepare the message text with user name if available
    let messageHeader = 'Chrome Extension Feedback';
    if (settings.userName) {
      messageHeader += ` from ${settings.userName}`;
    }
    
    let message = `${messageHeader}\n\n${feedbackText}\n\n*URL:* ${url}`;
    
    // Add highlighted text if available
    if (selectedText && selectedText.trim().length > 0) {
      message += `\n*Highlighted Text:* \`${selectedText}\``;
    }
    
    console.log("Preparing to send feedback to Slack");
    
    if (screenshotDataUrl) {
      // If we have a screenshot, use files.upload with initial_comment
      console.log("Screenshot included, will upload with comment");
      
      // Convert data URL to Blob
      const blobData = await dataURLtoBlob(screenshotDataUrl);
      console.log("Screenshot converted to blob, size:", blobData.size);
      
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', blobData, 'screenshot.png');
      formData.append('channels', channel);
      formData.append('initial_comment', message);
      formData.append('title', 'Feedback Screenshot');
      
      // Upload file and message together using files.upload API
      console.log("Sending request to files.upload API");
      const fileUploadResponse = await fetch('https://slack.com/api/files.upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${slackToken}`
        },
        body: formData
      });
      
      const fileUploadResult = await fileUploadResponse.json();
      console.log("File upload response:", fileUploadResult);
      
      if (!fileUploadResult.ok) {
        console.error("Error uploading file:", fileUploadResult.error);
        throw new Error(`Slack file upload error: ${fileUploadResult.error}`);
      }
      
      console.log("Feedback with screenshot sent successfully");
    } else {
      console.log("No screenshot, sending text-only message via chat.postMessage");
      const messageResponse = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${slackToken}`
        },
        body: JSON.stringify({
          channel: channel,
          text: message
        })
      });
      
      const messageResult = await messageResponse.json();
      console.log("Message response:", messageResult);
      
      if (!messageResult.ok) {
        console.error("Error sending message:", messageResult.error);
        throw new Error(`Slack message error: ${messageResult.error}`);
      }
      
      console.log("Text-only feedback sent successfully");
    }
  } catch (error) {
    console.error("Error sending feedback to Slack:", error);
    throw new Error(`Failed to send feedback: ${error.message}`);
  }
}

// Helper function to convert data URL to Blob
async function dataURLtoBlob(dataURL) {
  // Convert base64 to raw binary data held in a string
  const byteString = atob(dataURL.split(',')[1]);
  
  // Separate out the mime component
  const mimeString = dataURL.split(',')[0].split(':')[1].split(';')[0];
  
  // Write the bytes of the string to an ArrayBuffer
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  
  // Create a blob with the ArrayBuffer
  return new Blob([ab], {type: mimeString});
}
