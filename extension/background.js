// background.js

console.log("InBrowser MCP Background Script Loaded");

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Message received in background script:", request, "from sender:", sender);

  // Example: Relay message or handle background tasks
  if (request.type === "page_loaded") {
    console.log(`Content script reported page loaded: ${request.url} - ${request.title}`);
    // Optionally do something with this info, like updating extension state
    sendResponse({ status: "received", info: `Page loaded: ${request.title}` });
  } else if (request.action) {
      // If a content script sends an action message here, decide how to handle it.
      // For now, just acknowledge.
      console.log(`Received action '${request.action}' from content script.`);
      sendResponse({ status: "acknowledged", action: request.action });
  }
  else {
    // Handle other message types if needed
    sendResponse({ status: "unknown_message_type" });
  }

  // Return true to indicate you wish to send a response asynchronously
  return true;
});

// Example: Listen for commands defined in manifest.json (if any)
chrome.commands.onCommand.addListener((command) => {
  console.log(`Command received: ${command}`);
  // Handle commands like opening popup or triggering actions
});

// Example: Handling installation or update events
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("Extension installed.");
    // Perform first-time setup if needed
  } else if (details.reason === "update") {
    const previousVersion = details.previousVersion;
    console.log(`Extension updated from ${previousVersion} to ${chrome.runtime.getManifest().version}.`);
    // Handle migration if needed
  }
});

// Function to send messages to content script (example)
async function sendMessageToActiveTab(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, message);
      console.log("Response from content script:", response);
      return response;
    } catch (error) {
      console.error("Could not send message to content script:", error);
      // This often happens if the content script isn't injected or the tab is protected (e.g., chrome:// pages)
      return { status: "error", message: error.message };
    }
  } else {
      console.log("No active tab found to send message to.");
      return { status: "error", message: "No active tab" };
  }
}

// Example usage of sending message (e.g., triggered by popup or command)
// setTimeout(() => {
//   sendMessageToActiveTab({ action: "getStatus" });
// }, 5000); // Send message 5 seconds after background script loads