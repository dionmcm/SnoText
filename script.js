// Theme toggle functionality
document.addEventListener('DOMContentLoaded', () => {
  const themeToggle = document.getElementById('theme-switch');

  // Check if user has previously selected a theme
  const savedTheme = localStorage.getItem('theme');

  // Check system preference
  const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

  // Set initial state
  if (savedTheme === 'dark' || (savedTheme === null && prefersDarkMode)) {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeToggle.checked = true;
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
    themeToggle.checked = false;
  }

  // Handle toggle changes
  themeToggle.addEventListener('change', () => {
    if (themeToggle.checked) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
    }
  });

  // Listen for system preference changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    // Only update if user hasn't manually selected a theme
    if (!localStorage.getItem('theme')) {
      const newTheme = e.matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', newTheme);
      themeToggle.checked = e.matches;
    }
  });
});


// Function to show snackbar notification
function showSnackbar(message) {
  const snackbar = document.getElementById("snackbar");
  snackbar.textContent = message;
  snackbar.className = "show";
  setTimeout(() => { snackbar.className = snackbar.className.replace("show", ""); }, 3000);
}
// Variable to track if cancellation was requested
let isCancelled = false;

// Function to show progress indicator
function showProgress(message, current, total) {
  const progressContainer = document.getElementById("progress-container");
  const progressMessage = document.getElementById("progress-message");
  const progressBar = document.getElementById("progress-bar");
  const progressCount = document.getElementById("progress-count");

  progressContainer.style.display = "flex";
  progressMessage.textContent = message || "Processing...";

  if (current !== undefined && total !== undefined) {
    const percentage = Math.round((current / total) * 100);
    progressBar.style.width = `${percentage}%`;
    progressCount.textContent = `${current}/${total}`;
  }
}

// Function to hide progress indicator
function hideProgress() {
  const progressContainer = document.getElementById("progress-container");
  progressContainer.style.display = "none";
  // Reset cancellation flag
  isCancelled = false;
}

// Function to replace SNOMED CT IDs with preferred terms
async function replaceSnomedIds() {
  const inputText = document.getElementById("inputText").value;
  const replacementPattern = document.getElementById("replacementPattern").value;
  const fhirEndpoint = document.getElementById("fhirEndpoint").value.trim();
  const outputTextArea = document.getElementById("outputText");

  // Reset the cancelled flag
  isCancelled = false;

  // Clear the output first
  outputTextArea.value = "";

  // Regular expression to match SNOMED CT IDs (5 or more digits)
  const snomedIdPattern = /\b\d{5,}\b/g;
  const snomedIds = inputText.match(snomedIdPattern);

  if (!snomedIds) {
    showSnackbar("No SNOMED CT IDs found in the text.");
    return;
  }

  // Deduplicate SNOMED IDs
  const uniqueIds = [...new Set(snomedIds)];

  // If there are too many IDs, warn the user
  if (uniqueIds.length > 500) {
    if (!confirm(`You're about to process ${uniqueIds.length} SNOMED CT IDs. This might take some time. Continue?`)) {
      return;
    }
  }

  // Set up cancel button event handler
  document.getElementById("cancel-button").onclick = function() {
    isCancelled = true;
    showProgress("Cancelling...");
  };

  // Show initial progress
  showProgress("Starting process...", 0, uniqueIds.length);

  const idToTermMap = {};
  let processedCount = 0;

  const BATCH_SIZE = 20;

  try {
    // Process IDs in batches
    for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
      // Check if process was cancelled
      if (isCancelled) {
        showSnackbar("Process cancelled by user.");
        hideProgress();
        return;
      }

      const batch = uniqueIds.slice(i, i + BATCH_SIZE);

      // Update progress
      showProgress("Processing SNOMED CT IDs...", i, uniqueIds.length);

      // Process this batch in parallel
      const batchPromises = batch.map(async (snomedId) => {
        // Check if cancelled during API calls
        if (isCancelled) return;

        try {
          const response = await fetch(`${fhirEndpoint}/CodeSystem/$lookup?system=http://snomed.info/sct&code=${snomedId}`);

          if (response.ok) {
            const data = await response.json();
            const preferredTerm = data.parameter.find(param => param.name === "display").valueString;

            // Modify term based on replacement pattern
            if (replacementPattern === "pipe") {
              idToTermMap[snomedId] = `${snomedId}|${preferredTerm}|`;
            } else if (replacementPattern === "underscore") {
              const underscoredTerm = preferredTerm.replace(/\s+|[^\w]/g, "_");
              idToTermMap[snomedId] = `${snomedId}_${underscoredTerm}`;
            }

            // Update processed count
            processedCount++;

            // Update progress counter
            showProgress("Processing SNOMED CT IDs...", processedCount, uniqueIds.length);

            // Optionally update output in real-time
            if (!isCancelled && (processedCount % 5 === 0 || processedCount === uniqueIds.length)) {
              // Replace SNOMED IDs in the input text for what we have so far
              let currentOutputText = inputText;
              for (const [id, replacement] of Object.entries(idToTermMap)) {
                const regex = new RegExp(`\\b${id}\\b`, "g");
                currentOutputText = currentOutputText.replace(regex, replacement);
              }
              outputTextArea.value = currentOutputText;
            }
          } else {
            console.warn(`Error fetching term for SNOMED CT ID: ${snomedId}`);
          }
        } catch (error) {
          console.error(`Error processing ID ${snomedId}:`, error);
        }
      });

      // Wait for current batch to complete before moving to next batch
      await Promise.all(batchPromises);
    }

    // If process was cancelled during the last batch
    if (isCancelled) {
      showSnackbar("Process cancelled by user.");
      hideProgress();
      return;
    }

    // Final update of output text
    let finalOutputText = inputText;
    for (const [snomedId, replacement] of Object.entries(idToTermMap)) {
      const regex = new RegExp(`\\b${snomedId}\\b`, "g");
      finalOutputText = finalOutputText.replace(regex, replacement);
    }
    outputTextArea.value = finalOutputText;

    // Show completion message
    showSnackbar(`Completed! Processed ${processedCount} out of ${uniqueIds.length} SNOMED CT IDs.`);
    hideProgress();

  } catch (error) {
    showSnackbar("An error occurred. Please check the FHIR endpoint URL.");
    console.error("Error:", error);
    hideProgress();
  }
}