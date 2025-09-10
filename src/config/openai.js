const OpenAI = require("openai");

const openai_pbc_key=process.env.OPENAI_API_KEY_PBC;
const openai_key=process.env.OPENAI_API_KEY;

const openai_pbc=new OpenAI({ apiKey: openai_pbc_key });
const openai=new OpenAI({ apiKey: openai_key });

module.exports = { openai_pbc, openai };
