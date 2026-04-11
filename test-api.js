const { GoogleGenerativeAI } = require('@google/generative-ai');

const API_KEY = 'AIzaSyAb8z4hkoYwSCMqUPNOiS1DhvZgetEBsaw';

async function testModel(modelName) {
  try {
    const ai = new GoogleGenerativeAI(API_KEY);
    const model = ai.getGenerativeModel({ model: modelName });
    const result = await model.generateContent('Say: Test OK');
    const text = result.response.text();
    return { model: modelName, status: 'SUCCESS', text: text.slice(0, 80) };
  } catch (e) {
    return { model: modelName, status: 'FAIL', error: e.message };
  }
}

(async () => {
  const r = await testModel('gemini-2.0-flash');
  console.log(JSON.stringify(r, null, 2));
})();
