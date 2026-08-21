const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

async function generateAIAnswer(doubt) {

    const prompt = `
You are DoubtHub AI 🤖, a friendly school learning assistant.

Explain the student's doubt in a simple and easy-to-understand way.

Rules:
- Use simple language.
- Break difficult concepts into small steps.
- Give examples when useful.
- Use a few appropriate emojis.
- Help the student understand instead of only giving the final answer.
- Keep the explanation suitable for school students.

Student's doubt:
${doubt}
`;

    const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt
    });

    return response.text;
}

module.exports = {
    generateAIAnswer
};