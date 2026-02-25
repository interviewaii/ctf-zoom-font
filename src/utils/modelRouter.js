/**
 * Intelligent Model Router for Groq API
 * 
 * Routes queries between:
 * - llama-3.1-8b-instant (Fast, Cheap): For simple chats, greetings, basic questions
 * - llama-3.3-70b-versatile (Smart, Powerful): For coding, complex logic, interview questions
 */

// Keywords that indicate a "hard" or "technical" query requiring the 70B model
const COMPLEX_TRIGGERS = [
    // Coding terms
    'code', 'function', 'class', 'method', 'variable', 'loop', 'array', 'list',
    'python', 'java', 'script', 'react', 'node', 'sql', 'database', 'html', 'css',
    'algorithm', 'structure', 'complexity', 'optimize', 'debug', 'error', 'fix',
    'api', 'endpoint', 'json', 'xml', 'docker', 'kubernetes', 'aws', 'cloud',

    // Interview/Logic terms
    'interview', 'design', 'architecture', 'scalability', 'system',
    'solve', 'solution', 'leetcode', 'hackerrank', 'puzzle', 'riddle',
    'explain', 'describe', 'difference', 'compare', 'pros', 'cons',
    'why', 'how', 'what if', 'scenario', 'example',

    // Format requests
    'write', 'create', 'generate', 'build', 'implement'
];

/**
 * Determines which model to use based on the user's message
 * @param {string} userMessage - The user's input message
 * @returns {string} - The model ID to use
 */
function selectModel(userMessage) {
    if (!userMessage || typeof userMessage !== 'string') {
        return 'llama-3.3-70b-versatile'; // Default to smart if input is weird
    }

    const msg = userMessage;
    const lowerMsg = msg.toLowerCase();

    // 1. Length Check
    const wordCount = msg.split(/\s+/).length;
    if (wordCount > 15) {
        console.log(`[ModelRouter] Complexity: High (Length: ${wordCount} words) -> Usage: 70B (Long Query)`);
        return 'llama-3.3-70b-versatile';
    }

    // 2. Keyword Check
    for (const word of COMPLEX_TRIGGERS) {
        if (lowerMsg.includes(word)) {
            console.log(`[ModelRouter] Complexity: High (Keyword: "${word}") -> Usage: 70B`);
            return 'llama-3.3-70b-versatile';
        }
    }

    // 3. Fallback to Simple
    console.log(`[ModelRouter] Complexity: Low (Short & Simple) -> Usage: 8B`);
    return 'llama-3.1-8b-instant';
}

module.exports = {
    selectModel
};
