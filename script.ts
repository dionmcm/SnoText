// Define types for FHIR API response
interface FhirParameter {
    name: string;
    value: string;
  }
  
  interface FhirResponse {
    parameter: FhirParameter[];
  }
  
  // Function to show snackbar notification
  function showSnackbar(message: string): void {
    const snackbar = document.getElementById("snackbar") as HTMLDivElement;
    snackbar.textContent = message;
    snackbar.className = "show";
    setTimeout(() => { snackbar.className = snackbar.className.replace("show", ""); }, 3000);
  }
  
  // Function to replace SNOMED CT IDs with preferred terms
  async function replaceSnomedIds(): Promise<void> {
    const inputTextElement = document.getElementById("inputText") as HTMLTextAreaElement;
    const replacementPatternElement = document.getElementById("replacementPattern") as HTMLSelectElement;
    const fhirEndpointElement = document.getElementById("fhirEndpoint") as HTMLInputElement;
    const outputTextElement = document.getElementById("outputText") as HTMLTextAreaElement;
  
    const inputText: string = inputTextElement.value;
    const replacementPattern: string = replacementPatternElement.value;
    const fhirEndpoint: string = fhirEndpointElement.value.trim();
  
    // Regular expression to match SNOMED CT IDs (5 or more digits)
    const snomedIdPattern = /\b\d{5,}\b/g;
    const snomedIds = inputText.match(snomedIdPattern);
  
    if (!snomedIds) {
      showSnackbar("No SNOMED CT IDs found in the text.");
      return;
    }
  
    // Deduplicate SNOMED IDs
    const uniqueIds: string[] = [...new Set(snomedIds)];
    const idToTermMap: { [id: string]: string } = {};
  
    try {
      // Fetch preferred terms for each SNOMED ID
      for (const snomedId of uniqueIds) {
        const response = await fetch(`${fhirEndpoint}/CodeSystem/$lookup?system=http://snomed.info/sct&code=${snomedId}`);
        
        if (response.ok) {
          const data: FhirResponse = await response.json();
          const preferredTerm = data.parameter.find(param => param.name === "display")?.value;
  
          if (preferredTerm) {
            // Modify term based on replacement pattern
            if (replacementPattern === "pipe") {
              idToTermMap[snomedId] = `${snomedId}|${preferredTerm}|`;
            } else if (replacementPattern === "underscore") {
              const underscoredTerm = preferredTerm.replace(/\s+|[^\w]/g, "_");
              idToTermMap[snomedId] = `${snomedId}_${underscoredTerm}`;
            }
          } else {
            showSnackbar(`No preferred term found for SNOMED CT ID: ${snomedId}`);
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
  
      outputTextElement.value = outputText;
    } catch (error) {
      showSnackbar("An error occurred. Please check the FHIR endpoint URL.");
      console.error("Error:", error);
    }
  }