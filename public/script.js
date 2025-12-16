console.log("script.js loaded");



let progressInterval;
let isAnalyzing = false;

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded");

  const input = document.getElementById("imageInput");
  const preview = document.getElementById("preview");

  // Image preview
  input.addEventListener("change", () => {
    if (input.files && input.files[0]) {
      preview.src = URL.createObjectURL(input.files[0]);
      preview.style.display = "block";
    }
  });

  document.getElementById("analyzeBtn").addEventListener("click", analyzeWell);
});

/* ---------- Progress Bar Logic (ADAPTED TO NEW HTML) ---------- */

function startProgress() {
  const container = document.getElementById("progressContainer");
  const bar = document.getElementById("progressWater");
  const text = document.getElementById("progressText");
  const output = document.getElementById("output");

  container.style.display = "block";
  bar.style.height = "1%";
  text.textContent = "1%";

  let progress = 1;

  progressInterval = setInterval(() => {
    if (progress < 85) {
      progress += Math.floor(Math.random() * 10) + 5;
    } else if (progress < 95) {
      progress += 1;
      output.textContent = "Finalizing analysis...";
    }

    if (progress >= 95) progress = 95;

    bar.style.height = progress + "%";
    text.textContent = progress + "%";
  }, 500);
}

function completeProgress() {
  clearInterval(progressInterval);
  document.getElementById("progressWater").style.height = "100%";
  document.getElementById("progressText").textContent = "100%";
}

/* ---------- Utility ---------- */

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ---------- Output Formatter (UNCHANGED) ---------- */

function formatOutput(text) {
  const output = document.getElementById("output");
  const statusHeader = document.getElementById("statusHeader");
  const metaFooter = document.getElementById("metaFooter");

  const status = text.match(/Well Status:\s*(.*)/)?.[1] || "-";
  const risk = text.match(/Risk Level:\s*(.*)/)?.[1] || "-";
  const confidence = text.match(/AI Confidence:\s*(.*)/)?.[1] || "-";
  const inspection = text.match(/Next Inspection:\s*(.*)/)?.[1] || "-";
  const usage = text.match(/Water Usage:\s*(.*)/)?.[1] || "-";

  statusHeader.innerHTML = `
    <div class="status">Well Status: ${status}</div>
    <div class="risk">Risk Level: ${risk}</div>
  `;

  const mainText = text
    .replace(/^Well Status:.*$/m, "")
    .replace(/^Risk Level:.*$/m, "")
    .replace(/^AI Confidence:.*$/m, "")
    .replace(/^Next Inspection:.*$/m, "")
    .replace(/^Water Usage:.*$/m, "")
    .trim();

  output.textContent = mainText;

  metaFooter.innerHTML = `
    <span>AI Confidence: ${confidence}</span>
    <span>Next Inspection: ${inspection}</span>
    <span>Water Usage: ${usage}</span>
  `;

  output.className = "";
  if (status === "UNSAFE") output.classList.add("unsafe");
  else if (status === "ACCEPTABLE") output.classList.add("acceptable");
  else if (status === "GOOD" || status === "VERY GOOD") output.classList.add("good");
}

/* ---------- Main Analysis ---------- */

async function analyzeWell() {
  if (isAnalyzing) return;
  isAnalyzing = true;

  const input = document.getElementById("imageInput");
  const output = document.getElementById("output");

  if (!input.files.length) {
    output.textContent = "Please select an image first.";
    isAnalyzing = false;
    return;
  }

  output.textContent = "Analyzing well condition...";
  startProgress();

  try {
    const file = input.files[0];
    const imageBase64 = await fileToBase64(file);

    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                "You are an AI rural well inspection assistant trained to behave like an experienced human water safety inspector.\n\n" +

                "You MUST perform inspection and classification. Do NOT describe the image in paragraph form.\n" +
                "Do NOT narrate what the image shows. No explanations.\n\n" +

                "Judge carefully and realistically. Do NOT exaggerate risk.\n" +
                "If water color, walls, and surroundings appear reasonably normal, treat the well as usable unless clear risks are visible.\n\n" +

                "Initial validation rule:\n" +
                "- If the image does NOT clearly show a well or well interior, set Well Status as NO WELL FOUND – ERROR.\n" +
                "- Do NOT guess or assume a well structure.\n" +
                "- Mention visible non-well objects clearly by name.\n\n" +

                "Classification rules:\n" +
                "- VERY GOOD: clean, vegetation-free, well-maintained, protected.\n" +
                "- GOOD: usable, mostly clean, minor natural marks.\n" +
                "- ACCEPTABLE: usable but dirty, biological growth, minor vegetation.\n" +
                "- UNSAFE: trash, sewage, dead animals, oil, foam, thick muddy water, or severe contamination.\n\n" +

                "Critical safety rule:\n" +
                "- Water usage allowed ONLY for VERY GOOD or GOOD.\n" +
                "- All other statuses: water usage NOT allowed.\n\n" +

                "Important inspection rules:\n" +
                "- Any vegetation on inner walls indicates biological contamination.\n" +
                "- Open wells increase risk; recommend a cover if open.\n" +
                "- Do NOT assume chemical contamination without visible signs.\n\n" +

                "Respond ONLY in the following format:\n\n" +

                "Well Status: (VERY GOOD / GOOD / ACCEPTABLE / UNSAFE / NO WELL FOUND – ERROR)\n\n" +
                "Issues Detected:\n- (max 4 short points)\n\n" +
                "Risk Level: (LOW / MEDIUM / HIGH)\n\n" +
                "Action:\n- (max 4 short actions)\n\n" +
                "AI Confidence: (percentage)\n" +
                "Next Inspection: (time period)\n" +
                "Water Usage: (write the correct decision based on status)- status:Critical safety rule:  VERY GOOD: Water usage allowed.  GOOD: Water usage allowed after basic quality check (boiling or testing recommended).  ACCEPTABLE: Water usage NOT allowed until cleaned and disinfected.  UNSAFE or NO WELL FOUND – ERROR: Water usage NOT allowed- if no well print that- Always output the correct Water Usage line based on the Well Status. "
            },
            {
              inlineData: {
                mimeType: file.type,
                data: imageBase64
              }
            }
          ]
        }
      ]
    };

    const response = await fetch("/api/analyze", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    imageBase64,
    mimeType: file.type,
    prompt: requestBody.contents[0].parts[0].text
  })
});


    if (!response.ok) {
      clearInterval(progressInterval);
      output.textContent = "AI service temporarily unavailable. Please retry.";
      isAnalyzing = false;
      return;
    }

    const result = await response.json();
    completeProgress();

    const resultText =
      result?.candidates?.[0]?.content?.parts?.[0]?.text || "No output received.";

    formatOutput(resultText);

  } catch (err) {
    console.error(err);
    clearInterval(progressInterval);
    output.textContent = "Unexpected error occurred.";
  } finally {
    isAnalyzing = false;
  }
}
