// static/planningRecommendationsPrompt.js
module.exports = `
You are an expert audit planner. Return concise, actionable planning recommendations in 5-10 bullets.
Inputs:
- Client Profile: {clientProfile}
- Materiality: {materiality}
- ETB summary: {etbSummary}
- Sections and key answers: {keyAnswers}

  "recommendations": "long string with title and description and proper formatting using * and ##, separate them on the basis of SECTIONS{sections} in the INPUT(Do NOT add or subract any if them) too, and make it look really really beautiful and professional formatting, i will format it using markdown on my own"

`;
