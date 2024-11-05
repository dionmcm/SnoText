// Function to show snackbar notification
function showSnackbar(message) {
  const snackbar = document.getElementById("snackbar");
  snackbar.textContent = message;
  snackbar.className = "show";
  setTimeout(() => { snackbar.className = snackbar.className.replace("show", ""); }, 3000);
}

// Function to replace SNOMED CT IDs with preferred terms
async function replaceSnomedIds() {
  const inputText = document.getElementById("inputText").value;
  const replacementPattern = document.getElementById("replacementPattern").value;
  const fhirEndpoint = document.getElementById("fhirEndpoint").value.trim();

  // Regular expression to match SNOMED CT IDs (5 or more digits)
  const snomedIdPattern = /\b\d{5,}\b/g;
  const snomedIds = inputText.match(snomedIdPattern);

  if (!snomedIds) {
    showSnackbar("No SNOMED CT IDs found in the text.");
    return;
  }

  // Deduplicate SNOMED IDs
  const uniqueIds = [...new Set(snomedIds)];
  const idToTermMap = {};

  try {
    // Fetch preferred terms for each SNOMED ID
    for (const snomedId of uniqueIds) {
      const response = await fetch(`${fhirEndpoint}/CodeSystem/$lookup?system=http://snomed.info/sct&code=${snomedId}`);
      
      if (response.ok) {
        const data = await response.json();
        const preferredTerm = data.parameter.find(param => param.name === "display").value;

        // Modify term based on replacement pattern
        if (replacementPattern === "pipe") {
          idToTermMap[snomedId] = `${snomedId}|${preferredTerm}|`;
        } else if (replacementPattern === "underscore") {
          const underscoredTerm = preferredTerm.replace(/\s+|[^\w]/g, "_");
          idToTermMap[snomedId] = `${snomedId}_${underscoredTerm}`;
        }
      } else {
        showSnackbar(`Error fetching term for SNOMED CT ID: ${snomedId}`);
      }
    }

    // Replace SNOMED IDs in the input text
    let outputText = inputText;
    for (const [snomedId, replacement] of Object.entries(idToTermMap)) {
      const regex = new RegExp(`\\b${snomedId}\\b`, "g");
      outputText = outputText.replace(regex, replacement);
    }

    document.getElementById("outputText").value = outputText;
  } catch (error) {
    showSnackbar("An error occurred. Please check the FHIR endpoint URL.");
    console.error("Error:", error);
  }
}