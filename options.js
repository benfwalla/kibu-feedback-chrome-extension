// Load saved settings when the options page is opened
document.addEventListener('DOMContentLoaded', function() {
  // Get the saved settings
  chrome.storage.sync.get({
    userName: '',
    slackToken: '',
    bugChannel: '#bugs',
    feedbackChannel: '#feedback-suggestions'
  }, function(items) {
    // Populate the form fields with the saved settings
    document.getElementById('user-name').value = items.userName;
    document.getElementById('slack-token').value = items.slackToken;
    document.getElementById('bug-channel').value = items.bugChannel;
    document.getElementById('feedback-channel').value = items.feedbackChannel;
  });
  
  // Add event listener to the save button
  document.getElementById('save-btn').addEventListener('click', saveOptions);
});

// Save settings when the save button is clicked
function saveOptions() {
  const userName = document.getElementById('user-name').value.trim();
  const slackToken = document.getElementById('slack-token').value.trim();
  const bugChannel = document.getElementById('bug-channel').value.trim();
  const feedbackChannel = document.getElementById('feedback-channel').value.trim();
  
  // Validate inputs
  if (slackToken && !slackToken.startsWith('xoxb-')) {
    showStatus('Slack token must start with "xoxb-"', 'error');
    return;
  }
  
  if (bugChannel && !bugChannel.startsWith('#')) {
    showStatus('Bug channel must start with "#"', 'error');
    return;
  }
  
  if (feedbackChannel && !feedbackChannel.startsWith('#')) {
    showStatus('Feedback channel must start with "#"', 'error');
    return;
  }
  
  // Save the settings to chrome.storage
  chrome.storage.sync.set({
    userName: userName,
    slackToken: slackToken,
    bugChannel: bugChannel || '#bugs',
    feedbackChannel: feedbackChannel || '#feedback-suggestions'
  }, function() {
    // Show success message
    showStatus('Settings saved successfully!', 'success');
  });
}

// Show status message
function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = type;
  status.style.display = 'block';
  
  // Hide the message after 3 seconds
  setTimeout(function() {
    status.style.display = 'none';
  }, 3000);
}
