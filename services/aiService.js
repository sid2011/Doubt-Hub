const { GoogleGenAI } = require("@google/genai");
const { marked } = require("marked");
const createDOMPurify = require("dompurify");
const { JSDOM } = require("jsdom");

const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);
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
Never include violent, or otherwise harmful content, especially involving minors. Keep responses factual, educational, age-appropriate, and non-graphic; when necessary, refuse and safely redirect.

Student's doubt:
${doubt}
`;

    const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt
    });

    const markdown = response.text;
    const html = DOMPurify.sanitize(marked.parse(markdown));
    return html;
}

module.exports = {
    generateAIAnswer
};